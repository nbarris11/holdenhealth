import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as people from '../src/lib/people.ts';

function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../src/app/admin/people/${file}.tsx`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, URLSearchParams, require: key => ({
    'react/jsx-runtime': jsx, 'next/link': { default: props => jsx.jsx('a', props) },
    '@/lib/people': people, ...imports,
  })[key] });
  return exports.default;
}
const data = {
  profiles: [{ id: 'oct-person', full_name: 'October Person', phone: null }, { id: 'dec-person', full_name: 'December Person', phone: null }, { id: 'challenge-person', full_name: 'Challenge Person', phone: null }, { id: 'training-person', full_name: 'Training Person', phone: null }],
  contacts: [], participants: [], coaching: [{ id: 'c1', member_id: 'training-person', status: 'active' }, { id: 'c2', member_id: 'oct-person', status: 'paused' }], challenges: [],
  enrollments: [{ id: 'e1', member_id: 'oct-person', session_id: 'oct', status: 'active' }, { id: 'e2', member_id: 'dec-person', session_id: 'dec', status: 'invited' }],
  sessions: [{ id: 'oct', name: 'October Program' }, { id: 'dec', name: 'December Program' }],
};
const Directory = load('directory', { '@/lib/people-data': { loadPeopleData: async () => data } });
test('withdrawn members leave the program list and count but remain searchable in Everyone', async () => {
  const withdrawnData = structuredClone(data);
  withdrawnData.profiles.push({ id: 'withdrawn-person', full_name: 'Withdrawn Member', phone: null });
  withdrawnData.enrollments.push({ id: 'withdrawn', member_id: 'withdrawn-person', session_id: 'oct', status: 'withdrawn' });
  // An enrollment in another program must not restore this program's membership.
  withdrawnData.enrollments.push({ id: 'other-active', member_id: 'withdrawn-person', session_id: 'dec', status: 'active' });
  const View = load('directory', { '@/lib/people-data': { loadPeopleData: async () => withdrawnData } });
  const program = renderToStaticMarkup(await View({ program: 'oct' }));
  assert.match(program, /Program people · 1/);
  assert.doesNotMatch(program, /Withdrawn Member/);
  const search = renderToStaticMarkup(await View({ program: 'oct', query: 'Withdrawn Member' }));
  assert.match(search, /Program people · 0/);
  const everyone = renderToStaticMarkup(await View({ program: 'oct', showEveryone: true, query: 'Withdrawn Member' }));
  assert.match(everyone, /Everyone · 1/);
  assert.match(everyone, /Withdrawn Member/);
  assert.match(renderToStaticMarkup(await View({ program: 'dec' })), /Program people · 2/);
});
test('rendered directory changes people/count/header with selected program and shows empty state', async () => {
  for (const [program, included, excluded] of [['oct', 'October Person', 'December Person'], ['dec', 'December Person', 'October Person']]) {
    const html = renderToStaticMarkup(await Directory({ program }));
    assert.ok(html.includes(included)); assert.ok(!html.includes(excluded)); assert.ok(!html.includes('Challenge Person'));
    assert.match(html, /Program people · 1/); assert.match(html, /Show everyone/);
    assert.ok(html.includes(`name="program" value="${program}"`));
  }
  assert.match(renderToStaticMarkup(await Directory({ program: 'empty' })), /No people are enrolled in this program yet/);
});
test('everyone and search retain scope in links and form submissions', async () => {
  const all = renderToStaticMarkup(await Directory({ program: 'oct', showEveryone: true }));
  assert.match(all, /Everyone · 4/); assert.match(all, /Challenge Person/);
  const searched = renderToStaticMarkup(await Directory({ program: 'oct', showEveryone: true, query: 'December' }));
  assert.match(searched, /Everyone · 1/); assert.match(searched, /name="people" value="all"/);
  assert.match(searched, /href="\/admin\/people\?program=oct&amp;people=all"/);
  const filtered = renderToStaticMarkup(await Directory({ program: 'oct', query: 'December' }));
  assert.match(filtered, /Program people · 0/); assert.match(filtered, /No people match your search in this view/);
});
test('personal training shows coaching clients, including someone who also attends class', async () => {
  const html = renderToStaticMarkup(await Directory({ program: people.PERSONAL_TRAINING_PROGRAM }));
  assert.match(html, /Personal-training clients · 2/);
  assert.match(html, /Training Person/);
  assert.match(html, /October Person/);
  assert.doesNotMatch(html, /December Person|Challenge Person/);
  assert.match(html, /name="program" value="personal-training"/);
  assert.match(renderToStaticMarkup(await Directory({ program: people.PERSONAL_TRAINING_PROGRAM, query: 'December' })), /Personal-training clients · 0/);
});
test('changing program submits the surrounding GET form immediately', () => {
  const Select = load('program-select');
  const label = Select({ programs: [{ id: people.PERSONAL_TRAINING_PROGRAM, name: 'Personal Training' }, ...data.sessions], selected: 'oct' });
  const select = label.props.children.find(child => child?.type === 'select');
  assert.equal(label.props.children[0], 'Program');
  assert.equal(select.props.children[0].props.value, 'personal-training');
  let submissions = 0;
  select.props.onChange({ currentTarget: { form: { requestSubmit() { submissions++; } } } });
  assert.equal(submissions, 1);
});
