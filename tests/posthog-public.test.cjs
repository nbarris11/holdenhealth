const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('posthog-public.js', 'utf8');
function run(hostname, search = '', embedded = false) {
  const scripts = [];
  const window = { location: { hostname, search } };
  window.parent = embedded ? {} : window;
  const document = { querySelector: () => null, createElement: () => ({ setAttribute() {} }), head: { appendChild: s => scripts.push(s) } };
  vm.runInNewContext(source, { window, document, URLSearchParams });
  return { scripts, window };
}
test('public replay excludes local, preview, and embedded editor traffic', () => {
  for (const args of [['localhost'], ['example.vercel.app'], ['www.holden.health', '?holden-editor=1'], ['www.holden.health', '', true]]) assert.equal(run(...args).scripts.length, 0);
});
test('production replay starts anonymously and discards private payloads', () => {
  const { scripts, window } = run('www.holden.health');
  assert.equal(scripts.length, 1);
  let config;
  window.posthog = { init: (_key, options) => { config = options; } };
  scripts[0].onload();
  assert.equal(config.person_profiles, 'never');
  assert.equal(config.session_recording.maskAllInputs, false);
  assert.equal(config.session_recording.maskAllElementAttributes, false);
  assert.equal(config.session_recording.maskTextSelector, null);
  assert.equal(config.session_recording.maskInputOptions.password, true);
  assert.ok(config.session_recording.blockSelector.includes('input[autocomplete="current-password"]'));
  assert.ok(!config.session_recording.blockSelector.includes('img'));
  assert.equal(config.session_recording.maskCapturedNetworkRequestFn({ name: 'private-url', body: 'private-answer' }), null);
  assert.equal(config.capture_exceptions, false);
  assert.equal(config.capture_pageview, 'history_change');
  assert.equal(config.capture_pageleave, true);
  const event = { properties: { $current_url: 'https://www.holden.health/?token=secret#private', $pathname: '/' } };
  config.before_send(event);
  assert.equal(event.properties.$current_url, 'https://www.holden.health/');
  assert.equal(event.properties.$pathname, '/');
  assert.equal(config.autocapture, false);
  let capturedName;
  config.loaded({ capture: name => { capturedName = name; } });
  assert.equal(capturedName, 'website_opened');
});
