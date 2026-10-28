import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import * as challenge from '../src/lib/challenge.ts';
function load(path,imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:k=>imports[k]||{},Date,Math,Number,String,Boolean,JSON,console});return exports;}
const scope=load('../src/lib/workout-program.ts',{'./challenge':challenge});
const id='71100000-0000-4000-8000-000000000001';
test('personal assignments accept exactly one owner and return to personal training',()=>{
 assert.equal(scope.workoutScope('','',id).table,'coaching_relationships');
 assert.equal(scope.workoutScope('',id,id),null);assert.equal(scope.workoutScope(id,'',id),null);assert.equal(scope.workoutScope('','','bad'),null);
 assert.equal(scope.workoutLibraryPath({challenge_id:null,relationship_id:id}),'/portal/training');
});
test('late join form requests approval without presenting a full price or payment choice',()=>{
 const Form=load('../src/app/register/registration-form.tsx',{'react':React,'react-dom':{useFormStatus:()=>({pending:false})},'react/jsx-runtime':jsx,'@/components/privacy-notice':{default:()=>null}}).default;
 const html=renderToStaticMarkup(React.createElement(Form,{sessionId:id,twoDayPriceCents:19900,threeDayPriceCents:24900,onlineEnrollmentAvailable:false,lateJoin:true}));
 assert.match(html,/Request to join/);assert.match(html,/value="request"/);assert.match(html,/does not reserve a place/);
 assert.doesNotMatch(html,/\$199|\$249|How would you like to pay|Reserve my place/);
});
test('late request routing never opens Stripe',async()=>{
 let request=0;
 const actions=load('../src/app/register/enrollment-action.ts',{'@/app/actions':{submitRegistrationRequest:async()=>{request++;}},'./checkout-action':{startStripeCheckout:async()=>{throw Error('Unexpected Stripe checkout');}},'next/navigation':{redirect:()=>{throw Error('unexpected redirect');}}});
 const form=new FormData();form.set('paymentMethod','request');await actions.submitEnrollment(form);assert.equal(request,1);
});
test('activity email workers skip a delivery claimed by another worker',async()=>{
 let sends=0;
 const db={from:()=>{const q={select:()=>q,or:()=>q,order:()=>q,limit:async()=>({data:[{id:'job',user_id:'coach',status:'pending',created_at:new Date().toISOString()}]}),update:()=>q,eq:()=>q,maybeSingle:async()=>({data:null})};return q;}};
 const {deliverCoachActivity}=load('../src/lib/coach-activity.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/email':{sendTransactionalEmail:async()=>{sends++;return true;}}});
 await deliverCoachActivity();assert.equal(sends,0);
});
test('activity email retries stop before provider idempotency expires',async()=>{
 let failed=0,sends=0;
 const db={from:()=>{const q={select:()=>q,or:()=>q,order:()=>q,limit:async()=>({data:[{id:'job',status:'pending',created_at:'2000-01-01T00:00:00Z'}]}),update:v=>{if(v.status==='failed')failed++;return q;},eq:()=>q};return q;}};
 const {deliverCoachActivity}=load('../src/lib/coach-activity.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/email':{sendTransactionalEmail:async()=>{sends++;return true;}}});
 await deliverCoachActivity();assert.equal(failed,1);assert.equal(sends,0);
});
for (const allowed of [true,false]) test(`activity delivery ${allowed?'uses a stable private message and recipient key':'respects disabled email preferences'}`,async()=>{
 let sends=0,delivered=false;
 const db={auth:{admin:{getUserById:async()=>({data:{user:{email:'delivered@test.invalid'}}})}},from:table=>{
  const q={select:()=>q,or:()=>q,order:()=>q,limit:async()=>({data:[{id:'job-1',activity_id:'event-1',user_id:'coach-1',status:'pending',created_at:new Date().toISOString()}]}),update:v=>{if(v.status==='sent')delivered=true;return q;},eq:()=>q,
   maybeSingle:async()=>({data:table==='staff_roles'?{role:'admin'}:table==='coach_activity_preferences'?{email_habits:allowed,email_workouts:allowed}:{id:'job-1'}}),
   single:async()=>({data:{kind:'habits_chosen',href:'/admin/people/private-member',member_id:'private-member'}})};return q;
 }};
 const {deliverCoachActivity}=load('../src/lib/coach-activity.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/email':{sendTransactionalEmail:async(to,subject,body,options)=>{sends++;assert.equal(to,'delivered@test.invalid');assert.equal(options.idempotencyKey,'coach-activity-job-1');assert.equal(body.ctaUrl,'https://portal.holden.health/admin/activity');assert.doesNotMatch(JSON.stringify(body),/private-member/);return true;}}});
 await deliverCoachActivity();assert.equal(sends,allowed?1:0);assert.equal(delivered,allowed);
});
test('withdrawal requires confirmation, uses the admin RPC and refreshes both portals',async()=>{
 let verified=0,calls=0;const paths=[];
 const {withdrawPersonalTraining}=load('../src/app/training-actions.ts',{'@/lib/auth':{verifyAdmin:async()=>{verified++;}},'@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls++;assert.equal(name,'withdraw_personal_training');assert.equal(args.p_member_id,id);return {error:null};}})},'next/cache':{revalidatePath:p=>paths.push(p)}});
 const form=new FormData();form.set('memberId',id);form.set('relationshipId',id);
 assert.match((await withdrawPersonalTraining(form)).error,/Confirm/);assert.equal(calls,0);
 form.set('confirmWithdrawal','yes');assert.match((await withdrawPersonalTraining(form)).success,/withdrawn/);assert.equal(calls,1);assert.equal(verified,2);assert.ok(paths.includes('/portal'));assert.ok(paths.includes('/admin/training'));assert.ok(paths.includes(`/admin/people/${id}`));
});
test('withdrawal database failures remain visible and do not report success',async()=>{
 const {withdrawPersonalTraining}=load('../src/app/training-actions.ts',{'@/lib/auth':{verifyAdmin:async()=>{}},'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({error:{message:'failed'}})})}});
 const form=new FormData();form.set('memberId',id);form.set('relationshipId',id);form.set('confirmWithdrawal','yes');assert.match((await withdrawPersonalTraining(form)).error,/could not/);
});
test('withdrawn PT clients stay in Everyone but leave the current PT filter',()=>{
 const {filterPeople}=load('../src/lib/people.ts');const people=['active','withdrawn','completed'].map(status=>({name:status,email:'',phone:'',coaching:[{status}],enrollments:[]}));
 assert.equal(filterPeople(people).length,3);assert.deepEqual(Array.from(filterPeople(people,'personal-training'),p=>p.name),['active']);
});
test('stale PT workout editor cannot save after withdrawal',async()=>{
 let wrote=0;
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{starts_on:'2026-01-01',status:'withdrawn'}})})}),insert:()=>{wrote++}})};
 const {saveWorkout}=load('../src/app/admin/challenges/actions.ts',{'@/lib/auth':{verifyAdmin:async()=>{}},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/workout-program':{workoutScope:()=>({table:'coaching_relationships',id,column:'relationship_id'})},'@/lib/challenge':{validDate:()=>true}});
 const f=new FormData();for(const [k,v] of Object.entries({relationship_id:id,title:'Test',minutes:'10',publish_on:'2026-10-14',plan:'Move',equipment:'None'}))f.set(k,v);
 assert.match((await saveWorkout({},f)).error,/withdrawn/);assert.equal(wrote,0);
});
