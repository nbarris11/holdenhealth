import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const appRoot = new URL('../', import.meta.url);

function pngDimensions(path) {
  const bytes = fs.readFileSync(new URL(path, appRoot));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('Android home-screen manifest provides standard and maskable square icons', () => {
  const manifest = fs.readFileSync(new URL('src/app/manifest.ts', appRoot), 'utf8');

  for (const [path, size] of [
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
    ['public/icon-maskable-512.png', 512],
  ]) {
    assert.deepEqual(pngDimensions(path), [size, size]);
  }

  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(manifest, /icon-maskable-512\.png/);
  assert.match(manifest, /purpose: "maskable"/);
});
