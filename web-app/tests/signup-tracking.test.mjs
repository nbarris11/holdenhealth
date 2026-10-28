import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function registrationAction(rpc, mini = false) {
  const events = [];
  const exports = {};
  const source = fs.readFileSync(new URL('../src/app/actions.ts', import.meta.url), 'utf8');
  const imports = {
    '@/app/admin/consultations/availability-actions': {},
    '@supabase/supabase-js': {},
    'next/cache': {},
    'next/headers': {},
    'next/navigation': { redirect: url => { throw new Error(url); } },
    '@/lib/auth': {},
    '@/lib/email': { sendTransactionalEmail: async () => true },
    '@/lib/stripe': {},
    '@/lib/posthog-server': { distinctIdForValue: () => 'hashed-email', captureServerEvent: async (...args) => events.push(args) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: '11111111-1111-4111-8111-111111111111', name: mini ? 'December Mini Session' : 'October Session', new_member_price_cents: mini ? 13900 : 19900, returning_member_price_cents: mini ? 9900 : 24900, two_day_price_cents: mini ? null : 19900, three_day_price_cents: mini ? null : 24900 } }) }) }) }) }) },
    '@/lib/supabase/server': {},
    '@/lib/zoom': {},
    '@/lib/program-schedule': {},
    '@/lib/registration-schedule': { registrationClassTimes: () => ['Tuesday 6:00 AM','Saturday 9:00 AM'] },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: key => imports[key], process: { env: {} },
  });
  return { action: exports.submitRegistrationRequest, events };
}

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    sessionId: '11111111-1111-4111-8111-111111111111', fullName: 'Test Person',
    email: 'test@example.test', phone: '5555555555', weeklyCommitment: '2',
    paymentMethod: 'venmo', policiesConfirmed: 'on',
  })) data.set(key, value);
  data.append('attendance', 'Tuesday 6:00 AM');
  return data;
}

test('successful offline reservation records a completed signup without personal details', async () => {
  const { action, events } = registrationAction(async () => ({ error: null }));
  await assert.rejects(action(form()), /\/register\?session=11111111-1111-4111-8111-111111111111&sent=1&reserved=1&paymentMethod=venmo/);
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'hashed-email');
  assert.equal(events[0][1], 'group_signup_completed');
  assert.equal(events[0][2].completion_status, 'reserved');
  assert.equal(events[0][2].payment_status, 'pending');
  assert.equal(events[0][3], 'offline:11111111-1111-4111-8111-111111111111:test@example.test');
  assert.ok(!JSON.stringify(events[0][2]).includes('test@example.test'));
});
test('December offline reservation uses mini package and returning-member flag',async()=>{
  let name, args;
  const {action}=registrationAction(async (rpcName,rpcArgs)=>{name=rpcName;args=rpcArgs;return {error:null};},true);
  const data=form();data.set('weeklyCommitment','3');data.set('returningMember','on');
  await assert.rejects(action(data),/reserved=1/);
  assert.equal(name,'reserve_mini_offline_registration');
  assert.equal(args.p_returning_member,true);
  assert.equal(args.p_weekly_commitment,undefined);
});

test('failed offline reservation does not record a completed signup', async () => {
  const { action, events } = registrationAction(async () => ({ error: { message: 'Session full' } }));
  await assert.rejects(action(form()), /checkoutError=full/);
  assert.equal(events.length, 0);
});
