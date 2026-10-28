import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (/ 2(\.|$)/.test(entry.name)) return [];
    return entry.isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

test('the Sunday check-in email is no longer scheduled', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(config.crons.some((c) => c.path.includes('sunday-check-in')), false);
});

test('members are never sent to the weekly check-in survey', () => {
  const offenders = sourceFiles(path.join(root, 'src')).filter((file) =>
    /SIX_WEEK_CHECK_IN_URL|docs\.google\.com\/forms|weekly-check-in|id="check-in"|href="#check-in"/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders.map((f) => path.relative(root, f)), []);
});
