import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(rows, { denied = false, failTable } = {}) {
  let authorized = false;
  const calls = [];
  const db = { from(table) {
    assert.equal(authorized, true);
    calls.push(table);
    let result = rows[table] ?? [];
    let single = false;
    return {
      select() { return this; },
      eq(key, value) { result = result.filter(row => row[key] === value); return this; },
      in(key, values) { result = result.filter(row => values.includes(row[key])); return this; },
      gte(key, value) { result = result.filter(row => row[key] >= value); return this; },
      order(key, options) { result = [...result].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options?.ascending === false ? -1 : 1)); return this; },
      limit(count) { result = result.slice(0, count); return this; },
      maybeSingle() { single = true; return this; },
      then(resolve) { return Promise.resolve(resolve({ data: single ? result[0] ?? null : result, error: table === failTable ? new Error('Unavailable') : null })); },
    };
  } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/admin-class-times.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: key => ({
    'server-only': {},
    '@/lib/auth': { verifyAdmin: async () => { if (denied) throw new Error('Denied'); authorized = true; } },
    '@/lib/supabase/admin': { createAdminClient: () => db },
  }[key]) });
  return { read: exports.loadAdminClassTimes, calls };
}

function fixture() {
  return {
    enrollments: [
      { id: 'oct', member_id: 'member', session_id: 'october', sessions: { name: 'October' }, created_at: '2026-09-01' },
      { id: 'dec', member_id: 'member', session_id: 'december', sessions: { name: 'December' }, created_at: '2026-09-02' },
      { id: 'other', member_id: 'someone-else', session_id: 'october' },
    ],
    member_contacts: [{ user_id: 'member', email: 'new@example.invalid' }],
    member_invitations: [{ claimed_by: 'member', session_id: 'october', email: 'old@example.invalid' }],
    registration_requests: [
      { session_id: 'october', email: 'old@example.invalid', status: 'approved', attendance_interest: ['Saturday 7:30 AM'], created_at: '2026-09-01' },
      { session_id: 'october', email: 'new@example.invalid', status: 'declined', attendance_interest: ['WRONG declined'], created_at: '2026-09-02' },
      { session_id: 'october', email: 'someone-else@example.invalid', status: 'approved', attendance_interest: ['WRONG person'], created_at: '2026-09-03' },
      { session_id: 'december', email: 'new@example.invalid', status: 'pending', attendance_interest: ['Saturday 9:00 AM'], created_at: '2026-09-04' },
    ],
    checkout_orders: [
      { session_id: 'october', email: 'old@example.invalid', status: 'paid', attendance_interest: ['Saturday 9:00 AM'], created_at: '2026-09-03' },
      { session_id: 'october', email: 'old@example.invalid', status: 'cancelled', attendance_interest: ['WRONG cancelled'], created_at: '2026-09-04' },
    ],
    attendance_selections: ['future', 'past', 'cancelled', 'different-program'].map(meeting_id => ({ enrollment_id: 'oct', meeting_id })),
    class_meetings: [
      { id: 'future', session_id: 'october', starts_at: '2099-10-17T13:00:00Z', cancelled: false },
      { id: 'past', session_id: 'october', starts_at: '2000-10-17T13:00:00Z', cancelled: false },
      { id: 'cancelled', session_id: 'october', starts_at: '2099-10-17T13:00:00Z', cancelled: true },
      { id: 'different-program', session_id: 'december', starts_at: '2099-10-17T13:00:00Z', cancelled: false },
    ],
  };
}

test('admin authorization happens before any service-role data access', async () => {
  const { read, calls } = load(fixture(), { denied: true });
  await assert.rejects(read('member'), /Denied/);
  assert.deepEqual(calls, []);
});

test('approved and paid preferences survive email changes and remain scoped to the person and program', async () => {
  const { read } = load(fixture());
  const result = JSON.parse(JSON.stringify(await read('member', 'oct')));
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].preferences, [
    { label: 'Signup request', times: ['Saturday 7:30 AM'] },
    { label: 'Paid signup', times: ['Saturday 9:00 AM'] },
  ]);
  assert.deepEqual(result[0].meetings.map(row => row.id), ['future']);
  assert.equal((await read('member', 'other')).length, 0);
});

test('each program gets its own preferences and empty selections stay empty', async () => {
  const { read } = load(fixture());
  const result = await read('member');
  assert.equal(result.length, 2);
  const december = result.find(row => row.id === 'dec');
  assert.equal(december.preferences[0].times[0], 'Saturday 9:00 AM');
  assert.equal(december.meetings.length, 0);
});

test('query failures cannot silently turn into no saved preferences', async () => {
  const { read } = load(fixture(), { failTable: 'registration_requests' });
  await assert.rejects(read('member', 'oct'), /could not be loaded/);
});
