import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { buildChallengeRecipients } from '../src/lib/challenge-email-recipients.ts';

function moduleFrom(file, imports = {}, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key], Date, Intl, crypto, ...extra });
  return exports;
}
const reviews = moduleFrom('../src/lib/program-reviews.ts', { 'node:crypto': { createHash }, './challenge-email-recipients': { buildChallengeRecipients } });
const { deliverProgramReviews } = moduleFrom('../src/lib/send-program-reviews.ts', { 'node:crypto': { createHash } });
const program = { key: 'class:123', name: 'Program', ends_on: '2026-09-22', status: 'completed' };
const person = id => ({ memberId: id, email: `${id}@example.invalid`, name: 'Anna Example', firstName: 'Anna', unsubscribeToken: `token-${id}` });

test('review eligibility opens after the final Michigan day and excludes cancelled/draft', () => {
  assert.equal(reviews.detroitDate(new Date('2026-09-23T03:59:59Z')), '2026-09-22');
  assert.equal(reviews.canRequestReviews(program, '2026-09-22'), false);
  assert.equal(reviews.canRequestReviews(program, '2026-09-23'), true);
  for (const status of ['draft','cancelled']) assert.equal(reviews.canRequestReviews({ ...program, status }, '2026-09-23'), false);
});
test('previous member OR email requests are excluded, definite failures remain retryable', () => {
  const people = [person('a'), person('b'), person('c'), person('d')];
  const records = [{ member_id: 'a', email: 'old@example.invalid', status: 'sent' }, { member_id: 'other', email: 'b@example.invalid', status: 'unknown' }, { member_id: 'c', email: 'c@example.invalid', status: 'sending' }, { member_id: 'd', email: 'd@example.invalid', status: 'failed' }];
  assert.deepEqual(Array.from(reviews.pendingReviewRecipients(people, records), p => p.memberId), ['d']);
  assert.equal(reviews.recipientFingerprint(people), reviews.recipientFingerprint([...people].reverse()));
  assert.notEqual(reviews.recipientFingerprint(people), reviews.recipientFingerprint([person('e')]));
});
function store({ rejectClaim = false, rejectUpdate = false } = {}) {
  const records = [], sent = [];
  return { records, sent, db: { from() { let values, mode, filters = []; return {
    insert(v) { mode = 'insert'; values = v; return this; }, update(v) { mode = 'update'; values = v; return this; }, eq(k,v) { filters.push([k,v]); return this; }, select() { return this; },
    async maybeSingle() {
      if (rejectClaim) return { error: { code: 'XX000' } };
      if (mode === 'insert') {
        if (records.some(r => r.program_key === values.program_key && (r.member_id === values.member_id || r.email === values.email))) return { error: { code: '23505' } };
        const row = { id: crypto.randomUUID(), status: 'sending', ...values }; records.push(row); return { data: row };
      }
      const row = records.find(r => filters.every(([k,v]) => r[k] === v));
      if (!row) return { data: null }; Object.assign(row, values); return { data: row };
    },
    async in(key, ids) { if (rejectUpdate) return { error: new Error('db') }; for (const r of records) if (ids.includes(r[key])) Object.assign(r, values); return {}; },
  }; } }, async send(people,key) { sent.push({ people,key }); return 200; } };
}
const request = (s, extra={}) => ({ db: s.db, programKey: 'class:123', adminId: 'admin', recipients: [person('a'),person('b')], records: [], send: s.send, ...extra });
test('simultaneous submissions reserve each member once and keep bounded idempotency keys', async () => {
  const s = store(); await Promise.all([deliverProgramReviews(request(s)), deliverProgramReviews(request(s))]);
  assert.equal(s.sent.flatMap(s => s.people).length, 2);
  assert.ok(s.sent.every(s => s.key.length < 256));
  assert.ok(s.records.every(r => r.status === 'sent'));
  await deliverProgramReviews(request(s)); assert.equal(s.sent.flatMap(s => s.people).length, 2);
});
test('known provider rejections can retry exactly once under concurrent retries', async () => {
  const s = store(); assert.equal(await deliverProgramReviews(request(s, { send: async () => 429 })), 'failed');
  const old = structuredClone(s.records);
  await Promise.all([deliverProgramReviews(request(s, { records: old })), deliverProgramReviews(request(s, { records: old }))]);
  assert.equal(s.sent.flatMap(s => s.people).length, 2);
  assert.ok(s.records.every(r => r.status === 'sent'));
});
test('timeouts, server failures and failed result writes never become retryable', async () => {
  for (const send of [async () => { throw new Error('timeout'); }, async () => 500, async () => 409]) {
    const s = store(); assert.equal(await deliverProgramReviews(request(s,{ send })), 'unknown');
    assert.equal(reviews.pendingReviewRecipients([person('a'),person('b')],s.records).length,0);
  }
  const s = store({ rejectUpdate: true }); assert.equal(await deliverProgramReviews(request(s)), 'unknown');
  assert.ok(s.records.every(r => r.status === 'sending'));
});
test('database reservation failure sends nothing', async () => {
  const s = store({ rejectClaim: true }); await assert.rejects(deliverProgramReviews(request(s))); assert.equal(s.sent.length,0);
});
function actionFixture({ denied=false, changed=false, ended=true, confirmed=true }={}) {
  let sends=0, claims=0;
  const audience=[person('a')];
  const imports={
    'next/navigation': { redirect(url) { throw new Error(url); } }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth': { async verifyAdmin() { if(denied) throw new Error('denied'); return {userId:'admin'}; } },
    '@/lib/supabase/server': { async createClient() { return {}; } },
    '@/lib/program-reviews': {...reviews, async loadReviewPrograms() {return [program];}, canRequestReviews() {return ended;}, async loadReviewAudience(){ return { recipients: audience, records: [] }; } },
    '@/lib/send-program-reviews': { async deliverProgramReviews(input) {claims++; await input.send(audience, 'mock-key'); return 'sent';} },
    '@/lib/communication-email': {renderHoldenHealthEmail: JSON.stringify, renderHoldenHealthText: JSON.stringify},
  };
  imports['@/lib/program-review-email'] = { async sendReviewEmailBatch(people) { sends++; assert.equal(people[0].unsubscribeToken, 'token-a'); return 200; } };
  const exports=moduleFrom('../src/app/admin/communications/reviews/actions.ts',imports,{ process:{env:{RESEND_API_KEY:'mock'}}, AbortSignal, encodeURIComponent, fetch:async(url,options)=>{sends++; const payload=JSON.parse(options.body); assert.equal(payload[0].to[0], 'a@example.invalid'); const content=JSON.parse(payload[0].html); assert.equal(content.unsubscribeToken,'token-a'); assert.equal(content.ctaUrl,reviews.GOOGLE_REVIEW_URL); return {ok:true,status:200,json:async()=>({data:[{id:'provider'}]})};} });
  const form=new FormData(); form.set('program',program.key); form.set('fingerprint',changed?'stale':reviews.recipientFingerprint(audience)); if(confirmed) form.set('confirmed','on');
  return { run:()=>exports.sendProgramReviewRequests(form), counts:()=>({sends,claims}) };
}
test('action denies unauthorized, premature, unconfirmed and stale-recipient sends', async()=>{
  for(const options of [{denied:true},{ended:false},{confirmed:false},{changed:true}]){const h=actionFixture(options);await assert.rejects(h.run());assert.deepEqual(h.counts(),{sends:0,claims:0});}
});
test('confirmed action uses server-owned copy, address and unsubscribe link',async()=>{const h=actionFixture();await assert.rejects(h.run(),/message=sent/);assert.deepEqual(h.counts(),{sends:1,claims:1});});
test('audience is program-specific, includes completed enrollments, honors opt-outs and paginates', async()=>{
  const contacts=Array.from({length:501},(_,i)=>({user_id:`m${i}`,email:`m${i}@example.invalid`,email_opt_in:true,is_test:false,unsubscribe_token:'token'}));
  contacts[0].email_opt_in=false; contacts[1].is_test=true;
  const tables={
    enrollments:[{id:'e1',member_id:'m0',session_id:'123',status:'active'},{id:'e2',member_id:'m1',session_id:'123',status:'active'},{id:'e3',member_id:'m500',session_id:'123',status:'completed'},{id:'e4',member_id:'m2',session_id:'other',status:'active'},{id:'e5',member_id:'m3',session_id:'123',status:'withdrawn'}],
    challenge_participants:[{id:'p1',user_id:'m500',challenge_id:'456',display_name:'Challenge Name'},{id:'p2',user_id:'m2',challenge_id:'other',display_name:'Other'}],
    member_contacts:contacts,profiles:[],program_review_requests:[],
  };
  const db={from(table){const filters=[];return{select(){return this;},order(){return this;},eq(k,v){filters.push(r=>r[k]===v);return this;},in(k,v){filters.push(r=>v.includes(r[k]));return this;},async range(a,b){return {data:tables[table].filter(r=>filters.every(f=>f(r))).slice(a,b+1)};}};}};
  const a=await reviews.loadReviewAudience(db,program);assert.deepEqual(Array.from(a.recipients,p=>p.memberId),['m500']);
  const b=await reviews.loadReviewAudience(db,{...program,key:'challenge:456'});assert.deepEqual(Array.from(b.recipients,p=>p.name),['Challenge Name']);
  db.from=()=>({select(){return this;},eq(){return this;},in(){return this;},order(){return this;},async range(){return {error:new Error('db')};}});
  await assert.rejects(reviews.loadReviewAudience(db,program),/could not be loaded/);
});
test('automatic schedule includes next-day programs and missed runs, not old or upcoming programs',()=>{
  const all=[{...program,ends_on:'2026-10-04'},{...program,key:'old',ends_on:'2026-09-22'},{...program,key:'future',ends_on:'2026-10-06'},{...program,key:'cancelled',ends_on:'2026-10-04',status:'cancelled'}];
  assert.deepEqual(Array.from(reviews.automaticReviewPrograms(all,'2026-10-05'),p=>p.key),['class:123']);
  assert.equal(reviews.automaticReviewPrograms([all[0]],'2026-10-11').length,1);
  assert.equal(reviews.automaticReviewPrograms([all[0]],'2026-10-12').length,0);
  assert.equal(reviews.automaticReviewPrograms([all[0]],'2026-10-04').length,0);
});
function cronFixture(){
  let sends=0,writes=0,reads=0;
  const exported=moduleFrom('../src/app/api/cron/program-reviews/route.ts',{
    '@/lib/supabase/admin': {createAdminClient(){return {}; }},
    '@/lib/program-reviews': {...reviews,detroitDate:()=> '2026-10-05',async loadReviewPrograms(){reads++;return [{...program,ends_on:'2026-10-04'}];},async loadReviewAudience(){return {recipients:[person('a')],records:[],remaining:0};}},
    '@/lib/send-program-reviews': {async deliverProgramReviews(input){writes++;assert.equal(input.adminId,null);await input.send(input.recipients,'cron-key');return 'sent';}},
    '@/lib/program-review-email': {async sendReviewEmailBatch(){sends++;return 200;}},
  },{process:{env:{CRON_SECRET:'test-secret',RESEND_API_KEY:'mock'}},Response,URL});
  return {run:(path='',auth='Bearer test-secret')=>exported.GET(new Request(`https://example.invalid/api/cron/program-reviews${path}`,{headers:{authorization:auth}})),counts:()=>({sends,writes,reads})};
}
test('cron denies unauthorized calls and dry-run never claims or sends',async()=>{
  const h=cronFixture();assert.equal((await h.run('','bad')).status,401);assert.deepEqual(h.counts(),{sends:0,writes:0,reads:0});
  const r=await h.run('?dryRun=1&date=2026-10-05');assert.equal(r.status,200);assert.equal((await r.json()).results[0].eligible,1);assert.deepEqual(h.counts(),{sends:0,writes:0,reads:1});
});
test('cron sends due programs but ignores date overrides outside dry run',async()=>{
  const h=cronFixture();const r=await h.run('?date=2099-01-01');assert.equal(r.status,200);assert.equal((await r.json()).date,'2026-10-05');assert.deepEqual(h.counts(),{sends:1,writes:1,reads:1});
});
test('email uses personalized copy, Google profile and unsubscribe link; malformed success is uncertain',async()=>{
  let body;
  const sender=moduleFrom('../src/lib/program-review-email.ts',{
    'server-only':{},'@/lib/program-reviews':reviews,
    '@/lib/communication-email':{renderHoldenHealthEmail:JSON.stringify,renderHoldenHealthText:JSON.stringify},
  },{process:{env:{RESEND_API_KEY:'mock'}},AbortSignal,fetch:async(url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:[]})};}});
  assert.equal(await sender.sendReviewEmailBatch([person('a')],'key'),502);
  assert.deepEqual(body[0].to,['a@example.invalid']);const content=JSON.parse(body[0].html);
  assert.equal(content.firstName,'Anna');assert.equal(content.unsubscribeToken,'token-a');assert.equal(content.ctaUrl,reviews.GOOGLE_REVIEW_URL);
});
