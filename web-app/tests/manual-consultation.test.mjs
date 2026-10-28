import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: key => imports[key], Date, Intl, Buffer });
  return exports;
}
const calendar = load('../src/lib/consultation-calendar.ts');
const helpers = load('../src/lib/manual-consultation.ts', { '@/lib/consultation-calendar': calendar, '@/lib/email': {} });

test('Eastern appointments honor winter, summer, and DST transitions and reject impossible dates', () => {
  const parse = helpers.manualConsultationTime;
  assert.equal(parse('2027-01-10', '14:15').toISOString(), '2027-01-10T19:15:00.000Z');
  assert.equal(parse('2027-07-10', '14:15').toISOString(), '2027-07-10T18:15:00.000Z');
  assert.equal(parse('2027-03-14', '03:30').toISOString(), '2027-03-14T07:30:00.000Z');
  assert.equal(parse('2026-11-01', '03:30').toISOString(), '2026-11-01T08:30:00.000Z');
  for (const [date,time] of [['2027-03-14','02:30'], ['2027-02-30','12:00'], ['bad','12:00'], ['2027-01-10','24:00']]) assert.equal(parse(date,time), null);
});

test('calendar attachment has the correct UTC start/end and private link, with escaped name', () => {
  const invite = calendar.consultationCalendarInvite('booking-id', 'Alex, A;B\r\nName', '2027-01-10T19:15:00Z', 60, 'https://zoom.us/j/123');
  const text = Buffer.from(invite.content,'base64').toString();
  assert.match(text,/DTSTART:20270110T191500Z/); assert.match(text,/DTEND:20270110T201500Z/);
  assert.match(text,/UID:booking-id@holden.health/); assert.match(text,/LOCATION:https:\/\/zoom.us\/j\/123/);
  assert.ok(text.includes('Alex\\, A\\;B\\nName')); assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);
});

test('both invites use the same calendar; partial email failure is retryable and already-sent recipient is skipped', async () => {
  let failing = true; const calls = [], updates = [];
  const mod = load('../src/lib/manual-consultation.ts', {
    '@/lib/consultation-calendar': calendar,
    '@/lib/email': { sendTransactionalEmail: async (...args) => { calls.push(args); if (args[0] === 'guest@example.test' && failing) throw Error('network'); return true; } },
  });
  const db = { from: () => ({ update: data => { updates.push(data); return { eq() { return this; }, select() { return this; }, single: async () => ({data:{id:'booking'},error:null}) }; } }) };
  const booking = { id:'booking',full_name:'Alex Guest',email:'guest@example.test',zoom_join_url:'https://zoom.us/j/123',visitor_invite_sent_at:null,coach_invite_sent_at:null };
  const slot = { starts_at:'2027-01-10T19:15:00Z',duration_minutes:60 };
  assert.equal(await mod.sendManualConsultationInvites(db,booking,slot),false);
  assert.equal(calls.length,2); assert.equal(updates.length,1);
  assert.equal(calls[0][3].attachments[0].content,calls[1][3].attachments[0].content);
  assert.match(calls[0][2].body,/2:15 PM EST/);
  failing=false; booking.coach_invite_sent_at='saved'; calls.length=0;
  assert.equal(await mod.sendManualConsultationInvites(db,booking,slot),true);
  assert.equal(calls.length,1); assert.equal(calls[0][0],'guest@example.test');
  booking.visitor_invite_sent_at='saved'; calls.length=0;
  assert.equal(await mod.sendManualConsultationInvites(db,booking,slot),true);assert.equal(calls.length,0);
});

function actionFixture({ denied=false, conflict=false, zoomFails=false, sendFails=false } = {}) {
  const effects = [];
  const booking = { id:'123e4567-e89b-42d3-a456-426614174000',slot_id:'slot',full_name:'Alex',email:'alex@example.test',zoom_join_url:'https://zoom.us/j/123' };
  const db = { rpc:async(name,args)=>{effects.push(['rpc',name,args]);return {error:conflict?{code:'23505'}:null};},from:table=>{
    const chain={select(){return this;},eq(){return this;},update(){effects.push(['save-zoom']);return this;},single:async()=>({data:table==='consultation_slots'?{starts_at:'2027-01-10T19:15:00Z',duration_minutes:60}:booking,error:null})};return chain;
  }};
  const mod = load('../src/app/admin/consultations/manual-actions.ts',{
    'next/cache':{revalidatePath(){}},'next/navigation':{redirect:path=>{throw Error(path);}},
    '@/lib/auth':{verifyAdmin:async()=>{effects.push(['auth']);if(denied)throw Error('denied');return {userId:'admin'};}},
    '@/lib/supabase/server':{createClient:async()=>db},
    '@/lib/zoom':{createScheduledZoomMeeting:async()=>{effects.push(['zoom']);if(zoomFails)throw Error('zoom error');return {zoomMeetingId:'1',joinUrl:'https://zoom.us/j/123'};}},
    '@/lib/manual-consultation':{manualConsultationTime:helpers.manualConsultationTime,sendManualConsultationInvites:async()=>{effects.push(['email']);return !sendFails;}},
  });
  const form = new FormData(); for(const [key,value] of Object.entries({bookingId:booking.id,fullName:'Alex',email:'ALEX@example.test',date:'2027-01-10',time:'14:15'}))form.set(key,value);
  return {mod,form,effects};
}

test('manual action verifies admin before creating records or contacting Zoom/email', async()=>{
  const f=actionFixture({denied:true}); await assert.rejects(f.mod.createManualConsultation(f.form),/denied/);
  assert.deepEqual(f.effects,[['auth']]);
  await assert.rejects(f.mod.retryManualConsultationInvites(f.form),/denied/);
});
test('manual action rejects invalid details before any booking and conflict before Zoom', async()=>{
  let f=actionFixture(); f.form.set('email','bad');await assert.rejects(f.mod.createManualConsultation(f.form),/invite-details-invalid/);assert.equal(f.effects.length,1);
  f=actionFixture();f.form.set('date','2020-01-01');await assert.rejects(f.mod.createManualConsultation(f.form),/time-in-past/);assert.equal(f.effects.length,1);
  f=actionFixture({conflict:true});await assert.rejects(f.mod.createManualConsultation(f.form),/invite-conflict/);assert.equal(f.effects.some(x=>x[0]==='zoom'),false);
});
test('manual action reserves then saves Zoom before email and normalizes email', async()=>{
  const f=actionFixture();await assert.rejects(f.mod.createManualConsultation(f.form),/invite-sent/);
  assert.deepEqual(f.effects.map(x=>x[0]),['auth','rpc','zoom','save-zoom','auth','email']);
  assert.equal(f.effects[1][2].p_email,'alex@example.test');assert.equal(f.effects[1][2].p_starts_at,'2027-01-10T19:15:00.000Z');
});
test('Zoom failure sends no email; email failure retains booking and retry creates no Zoom',async()=>{
  let f=actionFixture({zoomFails:true});await assert.rejects(f.mod.createManualConsultation(f.form),/invite-zoom-failed/);assert.equal(f.effects.some(x=>x[0]==='email'),false);
  f=actionFixture({sendFails:true});await assert.rejects(f.mod.createManualConsultation(f.form),/invite-email-failed/);
  f=actionFixture();await assert.rejects(f.mod.retryManualConsultationInvites(f.form),/invite-sent/);assert.deepEqual(f.effects.map(x=>x[0]),['auth','email']);
});
