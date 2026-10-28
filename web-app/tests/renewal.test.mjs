import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {chooseRenewalSession,renewalStatus} from '../src/lib/renewal.ts';
function load(path,imports) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:k=>imports[k]});
 return exports;
}
test('renewal selects a new session without blocking on previous memberships, and allows explicit status review',()=>{
 const sessions=[{id:'oct'},{id:'dec'}];
 assert.equal(chooseRenewalSession(sessions,[{session_id:'old',status:'completed'}]).id,'oct');
 assert.equal(chooseRenewalSession(sessions,[{session_id:'oct',status:'active'}]).id,'dec');
 assert.equal(chooseRenewalSession(sessions,[{session_id:'oct',status:'active'}],'oct').id,'oct');
 assert.equal(chooseRenewalSession([],[]),undefined);
 assert.equal(chooseRenewalSession(sessions,[],'unpublished').id,'oct');
});
test('registration, processing, checkout and offline states never offer a second payment',()=>{
 assert.equal(renewalStatus(false,{status:'paid'}),'registered');
 assert.equal(renewalStatus(true,{status:'payment_processing'}),'processing');
 assert.equal(renewalStatus(true),'registered');
 assert.equal(renewalStatus(false,{status:'reserved'}),'checkout');
 assert.equal(renewalStatus(false,null,{status:'pending'}),'offline');
 assert.equal(renewalStatus(false,{status:'expired'}),'available');
});
test('renewal action binds the verified email and rejects duplicate or unoffered sessions',async()=>{
 let data={auth:{email:'member@example.test'},session:{id:'next'},status:'available'};let submitted;
 const actions=load('../src/app/portal/renew/actions.ts',{
 'next/navigation':{redirect:url=>{throw Error(url);}},
 '@/lib/renewal-data':{renewalData:async()=>data},
 '@/app/register/enrollment-action':{submitEnrollment:async form=>{submitted=form;}},
 '@/lib/supabase/admin':{},'@/lib/stripe':{},
 });
 const form=new FormData();form.set('sessionId','next');form.set('email','someone-else@example.test');
 await actions.submitRenewal(form);assert.equal(submitted.get('email'),'member@example.test');assert.equal(submitted.get('renewal'),'on');
 for(const status of ['registered','processing','checkout','offline']){submitted=null;data={...data,status};await assert.rejects(actions.submitRenewal(form),/portal\/renew/);assert.equal(submitted,null);}
 data={...data,status:'available'};form.set('sessionId','unpublished');await assert.rejects(actions.submitRenewal(form),/portal\/renew/);
});
test('checkout recovery only expires a reserved order after Stripe confirms expiry; paid/processing orders are untouched',async()=>{
 let status='checkout', stripeStatus='open',updates=0,retrieves=0;
 const chain={eq(){return this;},then(resolve){resolve({error:null});}};
 const actions=load('../src/app/portal/renew/actions.ts',{
 'next/navigation':{redirect:url=>{throw Error(url);}},
 '@/lib/renewal-data':{renewalData:async()=>({auth:{email:'member@example.test'},session:{id:'next'},status,order:{id:'owned',stripe_checkout_session_id:'cs_owned'}})},
 '@/app/register/enrollment-action':{},
 '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({update:d=>{assert.equal(d.status,'expired');updates++;return chain;}})})},
 '@/lib/stripe':{getStripe:()=>({checkout:{sessions:{retrieve:async id=>{assert.equal(id,'cs_owned');retrieves++;return {status:stripeStatus,url:'https://checkout.stripe.com/owned'};}}}})},
 });
 const form=new FormData();form.set('sessionId','next');
 await assert.rejects(actions.resumeRenewal(form),/checkout.stripe.com\/owned/);assert.equal(updates,0);
 stripeStatus='expired';await assert.rejects(actions.resumeRenewal(form),/portal\/renew/);assert.equal(updates,1);
 for(status of ['processing','registered']) await assert.rejects(actions.resumeRenewal(form),/portal\/renew/);
 assert.equal(updates,1);assert.equal(retrieves,2);
});
test('all privileged renewal reads are scoped to the authenticated email and selected session',async()=>{
 const filters=[];
 function db(admin=false){return {from:table=>{const chain={select(){return this;},eq(k,v){filters.push({admin,table,k,v});return this;},gte(k,v){filters.push({admin,table,k,v});return this;},in(k,v){filters.push({admin,table,k,v});return this;},order(){return this;},limit(){return this;},maybeSingle:async()=>({data:null}),then(resolve){resolve({data:table==='sessions'?[{id:'next'}]:[]});}};return chain;}};}
 const mod=load('../src/lib/renewal-data.ts',{
 'server-only':{},'./auth':{verifySession:async()=>({userId:'self',email:'MEMBER@example.test'})},
 './supabase/server':{createClient:async()=>db()},'./supabase/admin':{createAdminClient:()=>db(true)},
 './challenge':{detroitToday:()=> '2026-09-13'},'./registration-schedule':{registrationClassTimes:()=>[]},'./renewal':{chooseRenewalSession,renewalStatus},
 });
 await mod.renewalData();
 for(const table of ['checkout_orders','registration_requests','member_invitations']){
 assert.ok(filters.some(f=>f.admin&&f.table===table&&f.k==='email'&&f.v==='member@example.test'));
 assert.ok(filters.some(f=>f.admin&&f.table===table&&f.k==='session_id'&&f.v==='next'));
 }
 assert.ok(filters.some(f=>f.table==='sessions'&&f.k==='status'&&Array.isArray(f.v)&&f.v.includes('enrolling')&&f.v.includes('active')));
 assert.ok(filters.some(f=>f.table==='sessions'&&f.k==='ends_on'&&f.v==='2026-09-13'));
});
test('shared form renders saved contact details and plan without allowing account email changes',async()=>{
 const React=await import('react'), jsx=await import('react/jsx-runtime'),{renderToStaticMarkup}=await import('react-dom/server');
 const Form=load('../src/app/register/registration-form.tsx',{'react':React,'react-dom':{useFormStatus:()=>({pending:false})},'react/jsx-runtime':jsx,'@/components/privacy-notice':{default:()=>null},'./enrollment-action':{submitEnrollment:async()=>{}}}).default;
 const html=renderToStaticMarkup(React.createElement(Form,{sessionId:'next',twoDayPriceCents:19900,threeDayPriceCents:24900,onlineEnrollmentAvailable:true,lockEmail:true,defaults:{fullName:'Sample Member',email:'sample@example.test',phone:'5555555555',weeklyCommitment:'2'}}));
 assert.match(html,/<input(?=[^>]*name="email")(?=[^>]*readOnly="")(?=[^>]*value="sample@example.test")[^>]*>/);
 assert.match(html,/name="phone"[^>]*value="5555555555"/);
 assert.match(html,/<input(?=[^>]*name="weeklyCommitment")(?=[^>]*checked="")(?=[^>]*value="2")[^>]*>/);
});
