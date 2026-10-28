import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(file, imports, env) {
  const exports = {};
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, { exports, require: key => imports[key], process: { env } });
  return exports;
}
const production = { NODE_ENV: 'production', NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'test', NEXT_PUBLIC_POSTHOG_HOST: 'https://example.invalid' };
test('named identity updates and account switching never merge two members', () => {
  let id = 'anonymous';
  const calls = [];
  const h = load('lib/posthog-identity.ts', { 'posthog-js': {
    get_distinct_id: () => id,
    reset: () => { calls.push('reset'); id = 'anonymous'; },
    identify: (next, properties) => { calls.push({ next, properties }); id = next; },
  } }, production);
  h.syncPostHogIdentity({ id: 'a', name: 'First name', email: 'excluded@example.invalid' });
  h.syncPostHogIdentity({ id: 'a', name: 'Updated name' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].properties.name, 'Updated name');
  h.syncPostHogIdentity({ id: 'b', name: 'Second member' });
  assert.equal(calls[2], 'reset');
  assert.equal(calls[3].next, 'member:b');
  assert.ok(!JSON.stringify(calls).includes('excluded@example.invalid'));
  h.syncPostHogIdentity(null);
  assert.equal(calls[4], 'reset');
  assert.equal(id, 'anonymous');
});
test('analytics runs after the response and failures never reject member actions', async () => {
  const queue = [], events = [];
  class Client { capture(event) { events.push(event); } async flush() { throw new Error('provider unavailable'); } }
  const h = load('lib/posthog-server.ts', { 'server-only': {}, 'node:crypto': require('node:crypto'), 'next/server': { after: callback => queue.push(callback) }, 'posthog-node': { PostHog: Client } }, production);
  await h.captureServerEvent('member-private-id', 'story_entry_saved', { email: 'private@example.invalid', body: 'private health details', character_count: 123, entry_type: 'win' });
  assert.equal(events.length, 0);
  await queue.shift()();
  assert.equal(events.length, 1);
  const serialized = JSON.stringify(events[0]);
  for (const secret of ['member-private-id', 'private@example.invalid', 'private health details', 'character_count']) assert.ok(!serialized.includes(secret));
  assert.equal(events[0].properties.entry_type, 'win');
  assert.equal(events[0].properties.$process_person_profile, false);
  await h.captureServerException(new Error('private@example.invalid'));
  await queue.shift()();
  assert.ok(!JSON.stringify(events).includes('private@example.invalid'));
});
test('signup event retries use one stable, private event UUID', async () => {
  const queue = [], events = [];
  class Client { capture(event) { events.push(event); } async flush() {} }
  const h = load('lib/posthog-server.ts', { 'server-only': {}, 'node:crypto': require('node:crypto'), 'next/server': { after: callback => queue.push(callback) }, 'posthog-node': { PostHog: Client } }, production);
  await h.captureServerEvent('private@example.invalid', 'group_signup_completed', { completion_status: 'reserved', payment_method: 'venmo', email: 'private@example.invalid' }, 'offline:session:private@example.invalid');
  await h.captureServerEvent('private@example.invalid', 'group_signup_completed', { completion_status: 'reserved' }, 'offline:session:private@example.invalid');
  for (const callback of queue) await callback();
  assert.match(events[0].uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(events[0].uuid, events[1].uuid);
  assert.equal(events[0].properties.completion_status, 'reserved');
  assert.ok(!JSON.stringify(events).includes('private@example.invalid'));
});
test('missing configuration is harmless and local development never starts replay', async () => {
  let initialized = false;
  load('instrumentation-client.ts', { 'posthog-js': { init: () => { initialized = true; } } }, { ...production, NODE_ENV: 'development' });
  load('instrumentation-client.ts', { 'posthog-js': { init: () => { initialized = true; } } }, { NODE_ENV: 'production' });
  assert.equal(initialized, false);
});
test('replay privacy callbacks discard sensitive URL and network payloads', () => {
  let config;
  load('instrumentation-client.ts', { 'posthog-js': { init: (_token, options) => { config = options; } } }, production);
  assert.equal(config.session_recording.maskCapturedNetworkRequestFn({ name: 'https://portal.holden.health/login?token=secret', requestBody: 'private health details' }), null);
  assert.equal(config.session_recording.maskAllInputs, false);
  assert.equal(config.session_recording.maskAllElementAttributes, false);
  assert.equal(config.session_recording.maskTextSelector, null);
  assert.equal(config.session_recording.maskInputOptions.password, true);
  assert.ok(config.session_recording.blockSelector.includes('input[autocomplete="current-password"]'));
  assert.ok(!config.session_recording.blockSelector.includes('img'));
  assert.equal(config.autocapture, false);
  assert.equal(config.enable_recording_console_log, false);
  assert.equal(config.capture_exceptions, false);
  assert.equal(config.person_profiles, 'identified_only');
  assert.equal(config.capture_pageview, 'history_change');
  assert.equal(config.capture_pageleave, true);
  const event = { properties: { $current_url: 'https://portal.holden.health/login?token=secret#private', $pathname: '/login', $set: { $initial_referrer: 'https://example.com/?email=secret' } } };
  config.before_send(event);
  assert.equal(event.properties.$current_url, 'https://portal.holden.health/login');
  assert.equal(event.properties.$pathname, '/login');
  assert.equal(event.properties.$set.$initial_referrer, 'https://example.com/');
});

test('blank profile refreshes never erase an existing PostHog name', () => {
  const calls = [];
  const h = load('lib/posthog-identity.ts', { 'posthog-js': {
    get_distinct_id: () => 'member:a', reset: () => {},
    identify: (id, properties) => calls.push({ id, properties }),
  } }, production);
  h.syncPostHogIdentity({ id: 'a', name: '  Saved Name  ' });
  h.syncPostHogIdentity({ id: 'a', name: '' });
  h.syncPostHogIdentity({ id: 'a', name: '   ' });
  assert.equal(calls[0].properties.name, 'Saved Name');
  assert.equal(calls[1].properties, undefined);
  assert.equal(calls[2].properties, undefined);
});
test('identity observer uses challenge signup name and refreshes without navigation', async () => {
  let effect, timer, cleanup, profileName = '', disposed = false;
  const identities = [], queries = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'account-a' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { disposed = true; } } } }) },
    from: table => {
      const query = { table };
      queries.push(query);
      return { select(column) { query.column = column; return this; }, eq(column, value) { query.filter = [column, value]; return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: table === 'profiles' ? { full_name: profileName } : { display_name: 'Challenge Name' } }) };
    },
  };
  const exports = {};
  const imports = { react: { useEffect: fn => { effect = fn; } }, 'next/navigation': { usePathname: () => '/challenge' }, '@/lib/supabase/client': { createClient: () => db }, '@/lib/posthog-identity': { syncPostHogIdentity: user => identities.push(user) } };
  const source = fs.readFileSync(new URL('../src/components/posthog-identity.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: key => imports[key], process: { env: production },
    document: { visibilityState: 'visible' }, window: { addEventListener() {}, removeEventListener() {}, setInterval(fn, ms) { assert.equal(ms, 60000); timer = fn; return 1; }, clearInterval() {} },
  });
  exports.default(); cleanup = effect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(identities.at(-1).name, 'Challenge Name');
  assert.deepEqual(queries[1].filter, ['user_id', 'account-a']);
  profileName = 'Saved Full Name'; timer();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(identities.at(-1).name, 'Saved Full Name');
  assert.equal(queries.length, 3);
  cleanup(); assert.equal(disposed, true);
});
