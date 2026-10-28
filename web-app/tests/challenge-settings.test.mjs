import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as challengeModule from '../src/lib/challenge.ts';
const ts = createRequire(import.meta.url)('typescript');
function harness({ end = '2026-10-04', failRead = false, admin = true } = {}) {
  const exports = {}, writes = [];
  const imports = {
    '@/lib/challenge': challengeModule,
    '@/lib/auth': { verifyAdmin: async () => { if (!admin) throw new Error('denied'); } },
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/supabase/server': { createClient: async () => ({ from: () => {
      let write = false;
      const query = {
        select: () => query, eq: () => query,
        update: payload => { write = true; writes.push(payload); return query; },
        insert: payload => { write = true; writes.push(payload); return query; },
        single: async () => write ? { data: { id: 'saved' } } : failRead ? { error: {} } : { data: { starts_on: '2026-09-21', ends_on: end } },
      };
      return query;
    } }) },
  };
  const source = fs.readFileSync(new URL('../src/app/admin/challenges/actions.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key] || {}, Date });
  return { save: exports.saveChallenge, writes };
}
function form(existing = true) {
  const data = new FormData();
  if (existing) data.set('id', '00000000-0000-4000-8000-000000000001');
  data.set('title', 'Updated wording');
  data.set('starts_on', '2026-09-21');
  data.set('goal_options', 'Movement | Walk\nNutrition | Protein\nRest | Sleep');
  return data;
}
test('wording saves preserve both 14-day and legacy 21-day schedules', async () => {
  for (const end of ['2026-10-04', '2026-10-11']) {
    const h = harness({ end });
    assert.ok((await h.save({}, form())).success);
    assert.equal(h.writes[0].ends_on, end);
  }
});
test('new challenges default to 14 days', async () => {
  const h = harness();
  await assert.rejects(h.save({}, form(false)), /redirect/);
  assert.equal(h.writes[0].ends_on, '2026-10-04');
});
test('failed schedule reads and unauthorized edits never write dates', async () => {
  const h = harness({ failRead: true });
  assert.ok((await h.save({}, form())).error);
  assert.equal(h.writes.length, 0);
  const denied = harness({ admin: false });
  await assert.rejects(denied.save({}, form()), /denied/);
  assert.equal(denied.writes.length, 0);
});
