import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props });
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const session = { name: 'Class program', starts_on: '2026-10-13', ends_on: '2026-11-21' };
function load({ admin = false, cookie, missing = false, roleError = false } = {}) {
  const calls = [];
  const own = { id: 'own', sessions: session };
  const db = { from(table) {
    calls.push(table);
    let rows = table === 'staff_roles' ? (admin ? [{ user_id: 'user', role: 'admin' }] : []) : table === 'enrollments' ? (missing ? [] : [{ id: 'preview', sessions: session }]) : [];
    return { select() { return this; }, eq(key, val) { rows = rows.filter(row => row[key] === val); return this; }, in() { return this; }, order() { return this; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: table === 'staff_roles' && roleError ? new Error('Unavailable') : null }); },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); } };
  } };
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'a' },
    'next/headers': { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) },
    '@/lib/auth': { verifySession: async () => ({ userId: 'user' }) },
    '@/lib/member-data': { memberData: async () => ({ today: '2026-10-08' }) },
    '@/lib/member-enrollments': { memberEnrollments: async () => admin ? [] : [own] },
    '@/lib/member-session': { chooseEnrollment: rows => rows[0] },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/class-habits': { currentHabitWeek: () => 1 },
    './class-tracker': { default: 'class-tracker' }, '@/app/challenge/tracker': { default: 'challenge-tracker' },
    '@/app/admin/preview-actions': { stopMemberPreview() {} }, '@/app/challenge/style.css': {},
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/app/portal/habits/page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: key => imports[key] });
  return { render: async () => nodes(await exports.default({ searchParams: Promise.resolve({ enrollment: 'preview' }) })), calls };
}
test('admin preview displays only the selected enrollment in read-only mode', async () => {
  const page = await load({ admin: true, cookie: 'preview' }).render();
  const tracker = page.find(n => n.type === 'class-tracker');
  assert.equal(tracker.props.enrollmentId, 'preview');
  assert.equal(tracker.props.readOnly, true);
  assert.equal(page.some(n => n.type === 'challenge-tracker'), false);
});
test('member cannot acquire preview access with a cookie or enrollment parameter', async () => {
  const ctx = load({ cookie: 'preview' });
  const tracker = (await ctx.render()).find(n => n.type === 'class-tracker');
  assert.equal(tracker.props.enrollmentId, 'own');
  assert.equal(tracker.props.readOnly, false);
  assert.equal(ctx.calls.includes('enrollments'), false);
});
test('admin without a valid preview gets People guidance, never the challenge signup prompt', async () => {
  for (const options of [{ admin: true }, { admin: true, cookie: 'preview', missing: true }]) {
    const page = await load(options).render();
    assert.ok(page.some(n => n.props?.href === '/admin/people'));
    assert.equal(page.some(n => n.props?.href === '/challenge'), false);
    assert.equal(page.some(n => n.type === 'class-tracker'), false);
  }
});
test('role lookup failure stops before loading any preview enrollment', async () => {
  const ctx = load({ admin: true, cookie: 'preview', roleError: true });
  await assert.rejects(ctx.render(), /account access/);
  assert.equal(ctx.calls.includes('enrollments'), false);
});

test('saved habit checkboxes are disabled in preview and enabled for an active member day', () => {
  const exports = {};
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: value => [value, () => {}], useTransition: () => [false, () => {}] },
    '@/lib/challenge': { dateLabel: value => value, addDays: (value, n) => new Date(Date.parse(value) + n * 86400000).toISOString().slice(0, 10) },
    '@/lib/class-habits': { weekDates: () => ({ start: '2026-10-13', end: '2026-10-18' }), habitCounts: () => ({ fullDays: 0, days: 1, perHabit: [0, 0, 0] }) },
    './actions': {}, '@/lib/check-in': { SIX_WEEK_CHECK_IN_URL: 'https://example.invalid' },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/app/portal/habits/class-tracker.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: key => imports[key] });
  for (const readOnly of [true, false]) {
    const tree = nodes(exports.default({ enrollmentId: 'own', sessionName: 'Class program', startsOn: '2026-10-13', endsOn: '2026-11-21', today: '2026-10-13', weekNumber: 1, weeks: [{ id: 'week', week_number: 1, habits: ['Walk', 'Water', 'Sleep'] }], marks: [], readOnly }));
    const checks = tree.filter(n => n.type === 'input' && n.props.type === 'checkbox');
    assert.equal(checks.length, 3);
    assert.ok(checks.every(n => n.props.disabled === readOnly));
  }
});
