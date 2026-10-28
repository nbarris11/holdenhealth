import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: key => imports[key], Date, Intl, Buffer });
  return exports;
}

const calendar = load('../src/lib/consultation-calendar.ts');
const time = load('../src/lib/manual-consultation.ts', { '@/lib/consultation-calendar': calendar, '@/lib/email': {} }).manualConsultationTime;

test('lead calendar uses the chosen time and meeting details without a Zoom link', () => {
  const invite = calendar.leadConversationCalendarInvite('lead-1', '2027-01-10T19:15:00Z', 30, 'phone', 'Kelsey will call, then we can talk.');
  const body = Buffer.from(invite.content, 'base64').toString();
  assert.match(body, /DTSTART:20270110T191500Z/);
  assert.match(body, /DTEND:20270110T194500Z/);
  assert.ok(body.includes('DESCRIPTION:Phone call. Kelsey will call\\, then we can talk.'));
  assert.doesNotMatch(body, /Zoom|zoom/);
});

function fixture({ denied = false, sendFails = false } = {}) {
  const events = [];
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const saved = { id, full_name: 'Alex Lead', email: 'alex@example.test', starts_at: '2027-01-10T19:15:00.000Z', duration_minutes: 30, meeting_type: 'phone', meeting_details: 'I will call you.', confirmation_sent_at: null };
  const db = { from: () => ({
    insert: values => { events.push(['insert', values]); return { select() { return this; }, single: async () => ({ data: saved, error: null }) }; },
    update: values => { events.push(['update', values]); return { eq() { return this; }, is: async () => ({ error: null }) }; },
    select() { return this; }, eq() { return this; }, single: async () => ({ data: saved, error: null }),
  }) };
  const actions = load('../src/app/admin/leads/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: path => { throw Error(path); } },
    '@/lib/auth': { verifyAdmin: async () => { events.push(['auth']); if (denied) throw Error('denied'); return { userId: 'admin-id' }; } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/manual-consultation': { manualConsultationTime: time },
    '@/lib/consultation-calendar': { leadConversationCalendarInvite: calendar.leadConversationCalendarInvite },
    '@/lib/email': { sendTransactionalEmail: async (...args) => { events.push(['email', args]); return !sendFails; } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ leadId: id, fullName: 'Alex Lead', email: 'ALEX@example.test', date: '2027-01-10', time: '14:15', duration: '30', meetingType: 'phone', details: 'I will call you.', source: 'instagram', reviewed: 'on' })) form.set(key, value);
  return { actions, events, form };
}

test('admin review is required before saving or emailing a lead', async () => {
  const denied = fixture({ denied: true });
  await assert.rejects(denied.actions.createLeadAndSend(denied.form), /denied/);
  assert.deepEqual(denied.events, [['auth']]);
  const missingReview = fixture(); missingReview.form.delete('reviewed');
  await assert.rejects(missingReview.actions.createLeadAndSend(missingReview.form), /invalid/);
  assert.deepEqual(missingReview.events, [['auth']]);
});

test('lead saves before sending; failure remains retryable without another insert', async () => {
  const first = fixture({ sendFails: true });
  await assert.rejects(first.actions.createLeadAndSend(first.form), /send-failed/);
  assert.deepEqual(first.events.map(event => event[0]), ['auth', 'insert', 'email']);
  assert.equal(first.events[1][1].email, 'alex@example.test');
  const retry = fixture();
  await assert.rejects(retry.actions.retryLeadConfirmation(retry.form), /sent/);
  assert.deepEqual(retry.events.map(event => event[0]), ['auth', 'email', 'update']);
  assert.equal(retry.events[1][1][3].idempotencyKey, 'lead-confirmation-123e4567-e89b-42d3-a456-426614174000');
});
