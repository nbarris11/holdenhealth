import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {weeklyClassTime,classConfirmationLine} from '../src/lib/private-class-times.ts';
test('weekly matching stays at Saturday 9 AM through Eastern daylight saving change',()=>{
 assert.equal(weeklyClassTime('2026-10-17T13:00:00Z'),'Saturday 9:00 AM');
 assert.equal(weeklyClassTime('2026-11-07T14:00:00Z'),'Saturday 9:00 AM');
 assert.match(classConfirmationLine({starts_at:'2026-11-07T14:00:00Z',is_zoom:true}),/November 7, 2026.*9:00 AM Eastern · Zoom/);
});
function load(db){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/private-class-confirmation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>({'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/private-class-times':{classConfirmationLine}}[key])});return exports;}
test('paid confirmation includes saved weekly class, dates, location and Zoom information',async()=>{
 const rows={private_signup_offers:{session_id:'s',attendance_time:'Saturday 9:00 AM',class_meeting_ids:['class']},sessions:{name:'October program',starts_on:'2026-10-13',ends_on:'2026-11-21',location_name:'Burroughs',address_line:'41100 Plymouth Rd',city:'Plymouth',state:'MI'},class_meetings:[{id:'class',starts_at:'2026-11-07T14:00:00Z',is_zoom:true,cancelled:false}]};
 const db={from:table=>({select(){return this;},eq(){return this;},in(){return this;},single:async()=>({data:rows[table]}),order:async()=>({data:rows[table]})})};
 const result=await load(db).privateClassConfirmation('order');
 for(const text of ['Saturday 9:00 AM','2026-10-13','2026-11-21','November 7, 2026','Zoom','Burroughs','private intake'])assert.ok(result.includes(text),text);
});
test('unclaimed admin roster includes only verified paid offers',async()=>{
 const offers=[{checkout_order_id:'paid',email:'paid@example.invalid',class_meeting_ids:['m']},{checkout_order_id:'pending',email:'pending@example.invalid',class_meeting_ids:['m']}];
 const filters=[];const db={from:table=>({select(){return this;},eq(k,v){filters.push([table,k,v]);return this;},is(k,v){filters.push([table,k,v]);return this;},in(){return this;},then(resolve){resolve({data:table==='private_signup_offers'?offers:[{id:'paid'}]});}})};
 const roster=await load(db).pendingPrivateClassRoster('session');assert.equal(roster.length,1);assert.equal(roster[0].email,'paid@example.invalid');assert.ok(filters.some(f=>f[0]==='checkout_orders'&&f[1]==='status'&&f[2]==='paid'));assert.ok(filters.some(f=>f[1]==='class_assignments_synced_at'&&f[2]===null));
});
