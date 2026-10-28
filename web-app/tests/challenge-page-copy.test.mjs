import assert from 'node:assert/strict';
import { test } from 'node:test';
import { challengePageFields, normalizeChallengePageCopy, parseChallengePageCopy } from '../src/lib/challenge-page-copy.ts';

test('existing pages retain their wording and malformed overrides fall back safely', () => {
  const defaults = normalizeChallengePageCopy(null);
  assert.equal(defaults.support_heading, 'A little support at home');
  assert.deepEqual(normalizeChallengePageCopy([]), defaults);
  const copy = normalizeChallengePageCopy({ support_heading: 'Support your way', support_body: {}, intro: '', signup_heading: 'x'.repeat(201), unexpected: 'ignored' });
  assert.equal(copy.support_heading, 'Support your way');
  assert.equal(copy.support_body, defaults.support_body);
  assert.equal(copy.intro, defaults.intro);
  assert.equal(copy.signup_heading, defaults.signup_heading);
  assert.equal(copy.unexpected, undefined);
});

test('page copy saves multiline text, rejects incomplete/oversized data, and ignores extra fields', () => {
  const form = new FormData();
  for (const field of challengePageFields) form.set(field.key, field.default);
  form.set('support_body', ' First paragraph\n\nSecond paragraph ');
  form.set('published', 'false');
  const parsed = parseChallengePageCopy(form);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.value.support_body, 'First paragraph\n\nSecond paragraph');
  assert.equal(parsed.value.published, undefined);
  form.set('support_heading', 'x'.repeat(201));
  assert.ok(parseChallengePageCopy(form).error);
  form.delete('support_heading');
  assert.ok(parseChallengePageCopy(form).error);
});

import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as copyModule from '../src/lib/challenge-page-copy.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function actionHarness({ admin = true, fail = false } = {}) {
  const exports = {}, writes = [], paths = [];
  const imports = {
    '@/lib/challenge-page-copy': copyModule,
    '@/lib/auth': { verifyAdmin: async () => { if (!admin) throw new Error('denied'); return { userId: 'admin-test' }; } },
    '@/lib/supabase/server': { createClient: async () => ({ from: table => ({ upsert: (payload) => { writes.push({ table, payload }); return { select: () => ({ single: async () => fail ? { error: {} } : { data: { content_key: payload.content_key } } }) }; } }) }) },
    'next/cache': { revalidatePath: path => paths.push(path) },
  };
  const source = fs.readFileSync(new URL('../src/app/admin/challenges/actions.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key] || {}, Date });
  return { save: exports.saveChallengePageCopy, writes, paths };
}
function validForm() {
  const form = new FormData();
  for (const field of challengePageFields) form.set(field.key, field.default);
  form.set('support_body', 'Updated support\nSecond line');
  return form;
}
test('actual save action authorizes, publishes, and refreshes challenge content', async () => {
  const h = actionHarness();
  assert.ok((await h.save({}, validForm())).success);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].table, 'site_content');
  assert.equal(h.writes[0].payload.content_key, 'challenge:page');
  assert.equal(h.writes[0].payload.value.support_body, 'Updated support\nSecond line');
  assert.equal(h.writes[0].payload.published, true);
  assert.ok(h.paths.includes('/challenge'));
});
test('save action rejects unauthorized or invalid writes and reports storage failure', async () => {
  const denied = actionHarness({ admin: false });
  await assert.rejects(denied.save({}, validForm()), /denied/);
  assert.equal(denied.writes.length, 0);
  const invalid = actionHarness();
  assert.ok((await invalid.save({}, new FormData())).error);
  assert.equal(invalid.writes.length, 0);
  const failed = actionHarness({ fail: true });
  assert.ok((await failed.save({}, validForm())).error);
  assert.equal(failed.paths.length, 0);
});
