import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const programs = [
  { id: 'oct', name: 'October Program', status: 'active', starts_on: '2026-10-01', new_member_price_cents: 12000, two_day_price_cents: 9000 },
  { id: 'dec', name: 'December Program', status: 'draft', starts_on: '2026-12-01', new_member_price_cents: 6500, two_day_price_cents: null },
];
const source = fs.readFileSync(new URL('../src/app/admin/people/add/page.tsx', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText, { exports, require: key => ({
  'react/jsx-runtime': jsx,
  'next/link': { default: props => jsx.jsx('a', props) },
  '@/app/actions': { inviteMember: async () => {} },
  '@/app/training-actions': { addPersonalTrainingClient: async () => {} },
  '@/lib/auth': { verifyAdmin: async () => {} },
  '@/lib/supabase/server': { createClient: async () => ({ from: () => ({ select() { return this; }, order: async () => ({ data: programs }) }) }) },
  '../program-select': { default: ({ programs, selected }) => jsx.jsx('select', { name: 'program', defaultValue: selected, children: programs.map(program => jsx.jsx('option', { value: program.id, children: program.name }, program.id)) }) },
})[key] });
const AddPersonPage = exports.default;

test('program links preselect the right program and amount; switching programs changes both', async () => {
  for (const [program, name, amount] of [['oct', 'October Program', '90'], ['dec', 'December Program', '65']]) {
    const html = renderToStaticMarkup(await AddPersonPage({ searchParams: Promise.resolve({ program }) }));
    assert.match(html, new RegExp(`Adding to ${name}`));
    assert.match(html, new RegExp(`name="sessionId" value="${program}"`));
    assert.match(html, new RegExp(`name="amount"[^>]*value="${amount}"`));
    assert.match(html, /<option value="oct"/);
    assert.match(html, /<option value="dec"/);
  }
});

test('adding someone defaults to personal training without class payment fields', async () => {
  const html = renderToStaticMarkup(await AddPersonPage({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Personal training · no class program/);
  assert.match(html, /Add client and send setup email/);
  assert.doesNotMatch(html, /name="sessionId"|name="paymentStatus"|name="amount"/);
});
