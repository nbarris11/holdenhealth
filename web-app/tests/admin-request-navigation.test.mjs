import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const sessions = [
  { id: 'october', name: 'October program', starts_on: '2026-10-13', ends_on: '2026-11-21', status: 'enrolling' },
  { id: 'december', name: 'December program', starts_on: '2026-12-01', ends_on: '2026-12-19', status: 'full' },
];
function setup(file) {
  const filters = [];
  const db = { from(table) {
    let rows = table === 'sessions' ? [...sessions] : table === 'registration_requests' ? [{ id: 'request', status: 'pending', attendance_interest: [] }] : [];
    const builder = {
      select() { return this; }, in() { return this; }, is() { return this; }, gte() { return this; },
      eq(key, value) { filters.push({ table, key, value }); return this; },
      order(key, options) { if (table === 'sessions') rows.sort((a, b) => a[key].localeCompare(b[key]) * (options?.ascending === false ? -1 : 1)); return this; },
      limit(n) { rows = rows.slice(0, n); return this; },
      maybeSingle: async () => ({ data: rows[0] }),
      then(resolve) { return Promise.resolve({ data: rows }).then(resolve); },
    };
    return builder;
  } };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'a' },
    '@/lib/auth': { verifyAdmin: async () => {} },
    '@/lib/people': { PERSONAL_TRAINING_PROGRAM: 'personal-training' },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/app/admin/login/actions': { adminSignOut() {} }, './program-select': { default: 'program-select' }, '@/app/actions': {}, './directory': { default: 'directory' }, './private-signups': { default: 'private-signups' },
  };
  const exports = {};
  const source = fs.readFileSync(new URL(`../src/app/admin/${file}`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: key => imports[key] });
  return { render: exports.default, filters };
}
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
test('dashboard request opens the same program in People when a later program also exists', async () => {
  const dashboard = setup('page.tsx');
  const tree = elements(await dashboard.render());
  const requestLink = tree.find(node => node.props?.href?.endsWith('#requests'));
  assert.equal(requestLink.props.href, '/admin/people?program=october#requests');
  for (const params of [{}, { program: 'october' }, { program: 'unknown' }]) {
    const people = setup('people/page.tsx');
    const page = elements(await people.render({ searchParams: Promise.resolve(params) }));
    assert.equal(people.filters.find(f => f.table === 'registration_requests' && f.key === 'session_id').value, 'october');
    assert.ok(page.some(node => node.props?.id === 'requests'));
  }
});
test('People program selector and directory search preserve an explicitly selected later program', async () => {
  const people = setup('people/page.tsx');
  const page = elements(await people.render({ searchParams: Promise.resolve({ program: 'december', q: 'Alex' }) }));
  assert.equal(people.filters.find(f => f.table === 'registration_requests' && f.key === 'session_id').value, 'december');
  assert.equal(page.find(node => node.type === 'program-select').props.selected, 'december');
  assert.equal(page.find(node => node.type === 'directory').props.program, 'december');
  assert.equal(page.find(node => node.type === 'directory').props.showEveryone, false);
  assert.ok(page.some(node => node.type === 'input' && node.props.name === 'q' && node.props.value === 'Alex'));
});
test('People personal-training selection shows coaching directory without class-only sections', async () => {
  const people = setup('people/page.tsx');
  const page = elements(await people.render({ searchParams: Promise.resolve({ program: 'personal-training', q: 'Alex' }) }));
  assert.equal(page.find(node => node.type === 'program-select').props.selected, 'personal-training');
  assert.equal(page.find(node => node.type === 'directory').props.program, 'personal-training');
  assert.equal(page.find(node => node.type === 'directory').props.query, 'Alex');
  assert.ok(page.find(node => node.type === 'program-select').props.programs.some(program => program.id === 'personal-training'));
  assert.ok(!people.filters.some(filter => filter.table === 'enrollments' || filter.table === 'registration_requests'));
  assert.ok(!page.some(node => node.props?.id === 'members' || node.props?.id === 'requests'));
});

test('Programs shows class programs with matching people, schedule and details links', async () => {
  const hub = setup('training/page.tsx');
  const page = elements(await hub.render());
  assert.equal(page.find(node => node.type === 'h1').props.children, 'Programs');
  for (const program of sessions) {
    for (const route of ['people', 'classes', 'settings']) {
      assert.ok(page.some(node => node.props?.href === `/admin/${route}?program=${program.id}`));
    }
  }
  assert.ok(page.some(node => node.type === 'h2' && node.props.children === 'Personal-training clients'));
});
test('program details edit the requested later program even when it is full', async () => {
  const settings = setup('settings/page.tsx');
  const page = elements(await settings.render({ searchParams: Promise.resolve({ program: 'december' }) }));
  assert.equal(page.find(node => node.type === 'input' && node.props.name === 'sessionId').props.value, 'december');
  assert.equal(page.find(node => node.type === 'input' && node.props.name === 'name').props.defaultValue, 'December program');
  assert.ok(page.some(node => node.props?.href === '/admin/classes?program=december'));
});
