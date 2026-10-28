import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx = (type, props) => ({ type, props });
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
function setup({ denied = false, empty = false } = {}) {
  let authorized = false;
  const calls = [];
  const rows = {
    sessions: [{ id: 'program', name: 'October', starts_on: '2026-10-13', ends_on: '2026-11-21' }],
    enrollments: empty ? [] : [
      { id: 'own', session_id: 'program', status: 'active', profiles: { full_name: 'Member one' } },
      { id: 'other', session_id: 'other-program', status: 'active', profiles: { full_name: 'Other member' } },
      { id: 'withdrawn', session_id: 'program', status: 'withdrawn', profiles: { full_name: 'Withdrawn member' } },
    ],
    class_habit_weeks: [{ id: 'week', enrollment_id: 'own', week_number: 1, habits: ['Walk', 'Water', 'Sleep'] }, { id: 'other-week', enrollment_id: 'other', week_number: 1, habits: ['Private'] }],
    class_habit_marks: [],
    habit_comments: [],
  };
  const db = { from(table) {
    assert.equal(authorized, true); calls.push(table); let result = rows[table];
    return { select() { return this; }, eq(k,v) { result = result.filter(r => r[k] === v); return this; }, in(k,v) { result = result.filter(r => v.includes(r[k])); return this; }, order() { return this; },
      maybeSingle: async () => ({ data: result[0], error: null }), then: resolve => Promise.resolve({ data: result, error: null }).then(resolve) };
  } };
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'a' }, 'next/navigation': { notFound() { throw new Error('Not found'); } },
    '@/lib/auth': { verifyAdmin: async () => { if (denied) throw new Error('Denied'); authorized = true; } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/challenge': { isUuid: () => true, dateLabel: d => d, detroitToday: () => '2026-10-08' },
    '@/lib/class-habits': { currentHabitWeek: () => 1, weekDates: () => ({ start: '2026-10-13', end: '2026-10-18' }), habitCounts: () => ({ days: 0, fullDays: 0, perHabit: [0,0,0] }) },
    '@/app/admin/preview-actions': { startMemberPreview() {} },
    '@/lib/habit-comments': { commentRows: r => r.data ?? [] },
    '@/app/portal/habits/habit-comments': { EarlierHabitComments: 'EarlierHabitComments' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/app/admin/programs/[programId]/habits/page.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: k => imports[k] });
  return { calls, render: async () => nodes(await exports.default({ params: Promise.resolve({ programId: 'program' }) })) };
}
test('program habit overview requires admin authorization before data access', async () => {
  const ctx = setup({ denied: true }); await assert.rejects(ctx.render(), /Denied/); assert.deepEqual(ctx.calls, []);
});
test('overview excludes other programs and withdrawn enrollments and opens habit preview directly', async () => {
  const tree = await setup().render();
  assert.deepEqual(tree.filter(n => n.type === 'h3').map(n => n.props.children), ['Member one']);
  assert.deepEqual(tree.filter(n => n.type === 'input' && n.props.name === 'enrollmentId').map(n => n.props.value), ['own']);
  assert.ok(tree.some(n => n.type === 'input' && n.props.name === 'view' && n.props.value === 'habits'));
  assert.equal(JSON.stringify(tree).includes('Private'), false);
});
test('empty programs explain where enrolled members will appear', async () => {
  const ctx = setup({ empty: true }); const tree = await ctx.render();
  assert.ok(tree.some(n => n.type === 'h3' && n.props.children === 'No members enrolled yet.'));
  assert.equal(ctx.calls.includes('class_habit_weeks'), false);
});
