import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = fs.readFileSync(new URL('../src/lib/coach-activity.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({}) });

test('member replies to habit comments get their own activity label', () => {
  assert.equal(exports.activityLabel('habit_comment_reply'), 'Replied to your habit comment');
  assert.equal(exports.activityLabel('habits_chosen'), 'Chose weekly habits');
});
