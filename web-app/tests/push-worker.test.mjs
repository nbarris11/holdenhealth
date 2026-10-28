import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

function push(data) {
  const listeners = {}, shown = [];
  const self = { addEventListener: (type, fn) => { listeners[type] = fn; }, registration: { showNotification: (title, options) => { shown.push({ title, options }); return Promise.resolve(); } } };
  vm.runInNewContext(fs.readFileSync(new URL('../public/chat-sw.js', import.meta.url), 'utf8'), { self, URL });
  listeners.push({ data: { json: () => data }, waitUntil: p => p });
  return shown[0];
}

test('habit notes open Habits with their own wording', () => {
  const shown = push({ url: '/portal/habits', tag: 'habit-note' });
  assert.equal(shown.options.body, 'Kelsey left you a note on your habits.');
  assert.equal(shown.options.data.url, '/portal/habits');
});

test('chat messages still open their conversation, and unknown links fall back to Messages', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(push({ url: `/portal/communicate?conversation=${id}` }).options.data.url, `/portal/communicate?conversation=${id}`);
  assert.equal(push({ url: `/portal/communicate?conversation=${id}` }).options.body, 'You have a new message in Holden Health.');
  assert.equal(push({ url: 'https://evil.example/' }).options.data.url, '/portal/communicate');
});
