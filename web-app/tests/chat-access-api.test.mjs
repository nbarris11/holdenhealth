import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const id = '6c4a7fcf-4434-41e8-ac87-15fb7550d17f';
function handlers({ paid = false, admin = false, targetEligible = false } = {}) {
  const exports = {};
  let serviceCalls = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: admin ? { role: 'admin' } : null }) }),
    rpc: async name => ({ data: name === 'chat_has_access' ? paid || admin : [] }),
  };
  const imports = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status }) }, after: () => {} },
    'next/headers': { cookies: async () => ({ delete: () => {} }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/supabase/admin': { createAdminClient: () => { serviceCalls++; return { rpc: async () => ({ data: targetEligible ? [id] : [] }) }; } },
    '@/lib/chat': { isUuid: value => value === id, validPushSubscription: () => true },
    '@/lib/chat-push': { deliverChatPush: () => {} },
  };
  const source = fs.readFileSync(new URL('../src/app/api/chat/route.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key], process: { env: {} } });
  const request = (action, query = '') => ({ headers: { get: () => 'https://portal.holden.health' }, nextUrl: new URL('https://portal.holden.health/api/chat' + query), text: async () => JSON.stringify({ action, member: id, conversation: id }) });
  return { exports, request, serviceCalls: () => serviceCalls };
}
test('free members cannot use inbox, direct history, start, send, or push registration APIs', async () => {
  const h = handlers();
  for (const query of ['', '?conversation=' + id]) assert.equal((await h.exports.GET(h.request('', query))).status, 403);
  for (const action of ['start', 'send', 'subscribe', 'push-status', 'read', 'mute']) assert.equal((await h.exports.POST(h.request(action))).status, 403);
  assert.equal(h.serviceCalls(), 0);
});
test('paid members retain access to inbox API', async () => {
  const h = handlers({ paid: true });
  assert.equal((await h.exports.GET(h.request(''))).status, 200);
});
test('coach cannot start a private conversation for a free-only member', async () => {
  const h = handlers({ admin: true });
  assert.equal((await h.exports.POST(h.request('start'))).status, 403);
});
