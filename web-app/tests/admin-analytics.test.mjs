import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../src/app/admin/analytics/data.ts', import.meta.url), 'utf8');
const rangeSource = fs.readFileSync(new URL('../src/app/admin/analytics/range.ts', import.meta.url), 'utf8');

function loadRange() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(rangeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Date, Intl, Object, Number, RegExp });
  return exports.resolveAnalyticsRange;
}

function load(env, fetch) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: () => ({}), process: { env }, fetch, URL, AbortSignal,
    console: { error() {} }, setTimeout: (fn) => fn(),
  });
  return exports;
}

const start = new Date('2026-09-19T00:00:00Z');
const end = new Date('2026-09-26T00:00:00Z');

test('admin analytics uses session-based PostHog visitors and reads Resend tracking state', async () => {
  const requests = [];
  const h = load({ POSTHOG_PERSONAL_API_KEY: 'private-read-key', RESEND_REPORTING_API_KEY: 'private-resend-key' }, async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/domains/')) return { ok: true, json: async () => ({ open_tracking: true, click_tracking: true, records: [{ record: 'Tracking', type: 'CNAME', status: 'failed' }] }) };
    if (String(url).includes('resend.com')) return { ok: true, json: async () => ({ totals: { sent: 20, delivered: 18, unique_opened: 0, unique_clicked: 0, failed: 1, bounced: 1, complained: 0 } }) };
    const query = JSON.parse(options.body).query.query;
    return { ok: true, json: async () => ({ results: query.includes('AS session_person_id')
      ? [['website', 9, 15], ['portal', 3, 7]]
      : query.includes('GROUP BY path') ? [['/', 12], ['/about.html', 3]] : [['website_form_submitted', 2]] }) };
  });
  const [traffic, email] = await Promise.all([h.getTrafficSummary(start, end), h.getEmailSummary(start, end)]);
  assert.equal(traffic.status, 'ok');
  assert.equal(traffic.data.websiteVisitors, 9);
  assert.equal(traffic.data.portalVisitors, 3);
  assert.equal(traffic.data.portalPageviews, 7);
  assert.equal(traffic.data.websiteForms, 2);
  assert.equal(traffic.data.topPages[0].path, '/');
  assert.equal(email.status, 'ok');
  assert.equal(email.data.uniqueClicked, 0);
  assert.equal(email.data.trackingReady, false);
  assert.equal(requests.length, 5);
  assert.ok(requests.every(request => !request.url.includes('private-')));
  assert.ok(requests.filter(request => request.url.includes('posthog.com')).every(request => request.options.cache === 'no-store'));
  const trafficQuery = JSON.parse(requests.find(request => request.url.includes('posthog.com') && request.options.body.includes('AS session_person_id')).options.body).query.query;
  assert.match(trafficQuery, /events\.\$session_id_uuid IS NOT NULL/);
  assert.match(trafficQuery, /timestamp < toDateTime\('2026-09-26T00:00:00\.000Z'\)/);
  assert.ok(requests.find(request => request.url.includes('/emails/metrics')).url.includes('start_date='));
  assert.equal(requests.find(request => request.url.includes('/emails/metrics')).options.headers.Authorization, 'Bearer private-resend-key');
});

test('missing credentials and provider failures show unavailable states instead of false zeroes', async () => {
  const missing = load({}, async () => { throw new Error('must not fetch'); });
  assert.equal((await missing.getTrafficSummary(start, end)).status, 'not_configured');
  assert.equal((await missing.getEmailSummary(start, end)).status, 'not_configured');
  const failed = load({ POSTHOG_PERSONAL_API_KEY: 'key', RESEND_REPORTING_API_KEY: 'key' }, async () => ({ ok: false, status: 401 }));
  assert.equal((await failed.getTrafficSummary(start, end)).status, 'error');
  assert.equal((await failed.getEmailSummary(start, end)).status, 'error');
});

test('domain-status outages do not hide working Resend delivery metrics', async () => {
  const h = load({ RESEND_REPORTING_API_KEY: 'key' }, async (url) => String(url).includes('/domains/')
    ? { ok: false, status: 503 }
    : { ok: true, json: async () => ({ totals: { sent: 4, delivered: 4, unique_opened: 2 } }) });
  const email = await h.getEmailSummary(start, end);
  assert.equal(email.status, 'ok');
  assert.equal(email.data.sent, 4);
  assert.equal(email.data.trackingReady, null);
});

test('custom ranges use inclusive Detroit dates, including daylight saving changes', () => {
  const resolve = loadRange();
  const now = new Date('2026-09-26T15:00:00Z');
  const spring = resolve({ start: '2026-03-08', end: '2026-03-08' }, now);
  assert.equal(spring.selected, 'custom');
  assert.equal(spring.start.toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(spring.end.toISOString(), '2026-03-09T04:00:00.000Z');
  const fall = resolve({ start: '2025-11-02', end: '2025-11-02' }, now);
  assert.equal(fall.start.toISOString(), '2025-11-02T04:00:00.000Z');
  assert.equal(fall.end.toISOString(), '2025-11-03T05:00:00.000Z');
  assert.equal(resolve({ start: '2026-09-27', end: '2026-09-27' }, now).invalid, true);
  assert.equal(resolve({ days: '90' }, now).selected, 90);
  const last24Hours = resolve({ hours: '24' }, now);
  assert.equal(last24Hours.selected, '24h');
  assert.equal(last24Hours.start.toISOString(), '2026-09-25T15:00:00.000Z');
  assert.equal(last24Hours.end.toISOString(), now.toISOString());
});

test('individual history includes transactional emails, follows cursors, and uses selected date bounds', async () => {
  const requests=[];
  const rows=[
    {id:'intake',to:['tracymetivier@hotmail.com'],subject:'Complete your private training intake',created_at:'2026-09-25 12:00:00+00',last_event:'delivered'},
    {id:'old',to:['other@example.test'],subject:'Older email',created_at:'2026-09-18T00:00:00Z',last_event:'opened'}
  ];
  const h=load({RESEND_REPORTING_API_KEY:'key'},async(url,options)=>{requests.push(String(url));assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({data:[rows[requests.length-1]],has_more:true})};});
  const result=await h.getEmailHistory(start,end);
  assert.equal(result.status,'ok');assert.equal(result.data.rows.length,1);assert.equal(result.data.rows[0].to[0],'tracymetivier@hotmail.com');assert.equal(result.data.rows[0].status,'delivered');assert.equal(result.data.truncated,false);assert.match(requests[1],/after=intake/);
});
test('history marks incomplete scans and never converts provider failure into empty history', async()=>{
  let page=0;
  const h=load({RESEND_REPORTING_API_KEY:'key'},async()=>({ok:true,json:async()=>({data:[{id:String(++page),to:['a@example.test'],subject:'bill',created_at:'2026-09-25T00:00:00Z',last_event:'sent'}],has_more:true})}));
  assert.equal((await h.getEmailHistory(start,end)).data.truncated,true);assert.equal(page,5);
  const failed=load({RESEND_REPORTING_API_KEY:'key'},async()=>({ok:false,status:403}));assert.equal((await failed.getEmailHistory(start,end)).status,'error');
  assert.equal((await load({},async()=>{}).getEmailHistory(start,end)).status,'not_configured');
});


test('email history retries provider throttling without losing rows', async () => {
  let calls = 0;
  const h = load({ RESEND_REPORTING_API_KEY: 'key' }, async () => ++calls === 1
    ? { ok: false, status: 429 }
    : { ok: true, json: async () => ({ data: [{ id: 'welcome', to: ['member@example.test'], subject: 'Welcome', created_at: '2026-09-25T00:00:00Z', last_event: 'delivered' }], has_more: false }) });
  const result = await h.getEmailHistory(start, end);
  assert.equal(result.status, 'ok'); assert.equal(result.data.rows.length, 1); assert.equal(calls, 2);
});
