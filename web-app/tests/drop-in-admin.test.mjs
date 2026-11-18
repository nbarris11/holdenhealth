import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../src/app/actions.ts',import.meta.url),'utf8');
function actions(result) {
 const calls=[],invalidated=[];
 const db={from(table){const chain={select(){return chain;},eq(){return chain;},update(value){calls.push({table,value});return chain;},single:async()=>result,maybeSingle:async()=>({data:{id:'booking-1',meeting_id:'meeting-1',zoom_link_sent_at:'already-sent'}})};return chain;}};
 const exports={};
 const start=source.indexOf('export async function updateDropInPaymentStatus');
 const end=source.indexOf('export async function createConsultationSlot',start);
 vm.runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,verifyAdmin:async()=>({userId:'admin'}),uuidField:f=>f.get('bookingId'),textField:(f,k)=>f.get(k),createClient:async()=>db,DROP_IN_STATUSES:new Set(['confirmed','cancelled']),redirect:url=>{throw Error(url);},revalidatePath:path=>invalidated.push(path)});
 return {exports,calls,invalidated};
}
for(const [name,field,value] of [['updateDropInBookingStatus','status','confirmed'],['updateDropInPaymentStatus','paymentStatus','paid']]) {
 test(`${name} returns to exact saved booking and refreshes dashboards`,async()=>{
  const {exports,calls,invalidated}=actions({data:{id:'booking-1'},error:null});
  const f=new FormData();f.set('bookingId','booking-1');f.set(field,value);
  await assert.rejects(exports[name](f),/booking=booking-1&message=booking-updated#booking-booking-1/);
  assert.equal(calls.length,1);
  assert.ok(invalidated.includes('/admin'));assert.ok(invalidated.includes('/admin/activity'));
  if(field==='status')assert.equal(calls[0].value.payment_status,undefined);
 });
 test(`${name} does not report success when no row was updated`,async()=>{
  const {exports}=actions({data:null,error:null});const f=new FormData();f.set('bookingId','booking-1');f.set(field,value);
  await assert.rejects(exports[name](f),/message=booking-update-failed/);
 });
}
test('confirmed unpaid drop-ins render booking and roster links',async()=>{
 const filters=[];
 const chain={select(){return this;},in(...args){filters.push(args);return this;},eq(){return this;},gte(){return this;},order(){return this;},limit:async()=>({data:[{id:'booking-1',full_name:'Example guest',status:'confirmed',payment_status:'pending',class_meetings:{id:'meeting-1',title:'Class',starts_at:'2026-11-25T11:00:00Z'}}]})};
 const exports={};
 const code=fs.readFileSync(new URL('../src/components/admin-drop-in-bookings.tsx',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:k=>k==='next/link'?{default:props=>require('react').createElement('a',props)}:k==='@/lib/supabase/server'?{createClient:async()=>({from:()=>chain})}:require(k)});
 const html=renderToStaticMarkup(await exports.AdminDropInBookings());
 assert.match(html,/Example guest/);assert.match(html,/Spot confirmed/);assert.match(html,/Payment pending/);
 assert.match(html,/booking=booking-1#booking-booking-1/);assert.match(html,/meeting=meeting-1#class-meeting-1/);
 assert.ok(filters[0][1].includes('confirmed'));
});
