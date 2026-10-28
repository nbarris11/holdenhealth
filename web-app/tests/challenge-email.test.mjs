import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { buildChallengeRecipients, loadChallengeRecipients } from '../src/lib/challenge-email-recipients.ts';
const contact = (id, extra = {}) => ({ user_id: id, email: `${id}@example.invalid`, email_opt_in: true, is_test: false, unsubscribe_token: `token-${id}`, ...extra });
test('challenge-only contacts are personalized, deduplicated and respect preferences', () => {
  const participants = ['one', 'one', 'two', 'off', 'test', 'missing'].map(user_id => ({ user_id, display_name: 'Challenge Name' }));
  const result = buildChallengeRecipients(participants, [contact('one'), contact('two'), contact('off', { email_opt_in: false }), contact('test', { is_test: true }), contact('unrelated')], [{ id: 'one', full_name: 'Profile Name' }]);
  assert.deepEqual(result.map(p => [p.memberId, p.firstName, p.unsubscribeToken]), [['one', 'Profile', 'token-one'], ['two', 'Challenge', 'token-two']]);
});
test('blank names fall back safely and duplicate normalized addresses receive once', () => {
  const result = buildChallengeRecipients([{ user_id: 'a', display_name: ' ' }, { user_id: 'b', display_name: 'B' }], [contact('a'), contact('b', { email: ' A@example.invalid ' })], []);
  assert.equal(result.length, 1); assert.equal(result[0].firstName, 'there');
});
test('loader reads beyond the first page and fails closed on query errors', async () => {
  const participants = Array.from({ length: 501 }, (_, i) => ({ user_id: `u${i}`, display_name: 'Reader' }));
  const db = { from(table) { return { select() { return this; }, order() { return this; }, async range(a,b) { return { data: (table === 'challenge_participants' ? participants : table === 'member_contacts' ? [contact('u500')] : []).slice(a,b+1) }; } }; } };
  assert.equal((await loadChallengeRecipients(db))[0].memberId, 'u500');
  db.from = () => ({ select() { return this; }, order() { return this; }, async range() { return { error: new Error('unavailable') }; } });
  await assert.rejects(loadChallengeRecipients(db), /could not be loaded/);
});
function actionFixture({ denied = false, fail = false } = {}) {
  const writes = [], sends = [];
  const recipients = buildChallengeRecipients([{ user_id: 'a', display_name: 'Anna Example' }], [contact('a')], []);
  const db = { from(table) { return { insert(value) { writes.push({ table, value }); return this; }, select() { return this; }, async single() { return { data: { id: 'campaign' } }; }, update(value) { writes.push({ table, value }); return this; }, async eq() { return {}; } }; } };
  const imports = {
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect(url) { throw new Error(url); } },
    '@/lib/auth': { async verifyAdmin() { if (denied) throw new Error('denied'); return { userId: 'admin', email: 'admin@example.invalid' }; } },
    '@/lib/supabase/server': { async createClient() { return db; } },
    '@/lib/challenge-email-recipients': { async loadChallengeRecipients() { if (fail) throw new Error('db'); return recipients; } },
    '@/lib/communication-email': { renderHoldenHealthEmail: data => JSON.stringify(data), renderHoldenHealthText: data => JSON.stringify(data) },
  };
  const exports = {};
  const source = fs.readFileSync(new URL('../src/app/admin/communications/actions.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key], process: { env: { RESEND_API_KEY: 'mock' } }, URL, crypto, fetch: async (url, options) => { sends.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ data: [{ id: 'provider' }] }) }; } });
  const form = new FormData();
  for (const [key,value] of Object.entries({ audience: 'free_challenge', kind: 'session_update', subject: 'Challenge update', heading: 'Welcome', body: 'Hello', intent: 'send', confirmed: 'on' })) form.set(key,value);
  return { run: () => exports.sendMemberCommunication(form), form, writes, sends };
}
test('challenge send works without class session and records member delivery/unsubscribe token', async () => {
  const h = actionFixture(); await assert.rejects(h.run(), /message=sent/);
  assert.equal(h.sends.length, 1); assert.equal(h.sends[0].body[0].to[0], 'a@example.invalid');
  assert.equal(JSON.parse(h.sends[0].body[0].html).firstName, 'Anna');
  assert.equal(JSON.parse(h.sends[0].body[0].html).unsubscribeToken, 'token-a');
  assert.equal(h.writes[0].value.session_id, null); assert.equal(h.writes[0].value.audience, 'free_challenge');
  assert.equal(h.writes[1].value[0].member_id, 'a');
});
test('unauthorized, unconfirmed, or failed recipient queries send nothing', async () => {
  for (const options of [{ denied: true }, { fail: true }, {}]) {
    const h = actionFixture(options); if (!options.denied && !options.fail) h.form.delete('confirmed');
    await assert.rejects(h.run()); assert.equal(h.sends.length, 0); assert.equal(h.writes.length, 0);
  }
});
test('preview sends only to admin and creates no campaign', async () => {
  const h = actionFixture(); h.form.set('intent', 'test'); h.form.delete('confirmed');
  await assert.rejects(h.run(), /preview-sent/);
  assert.equal(h.sends[0].body.to[0], 'admin@example.invalid'); assert.equal(h.writes.length, 0);
});
