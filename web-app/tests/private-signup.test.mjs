import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const token='11111111-1111-4111-8111-111111111111';
function load(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:k=>imports[k],URL,Date,process:{env:{}}});return exports;}
function setup(overrides={}) {
 const calls={rpc:[],stripe:[],updates:[]};
 const signup={offer:{id:token,full_name:'Private Member',email:'private@example.invalid',amount_cents:9900,attendance_time:'Saturday 9:00 AM'},session:{name:'October'},order:null,...overrides};
 const admin={from:()=>{const chain={update(d){calls.updates.push(d);return this;},eq(){return this;},then(resolve){resolve({error:null});}};return chain;},rpc:async(name,args)=>{calls.rpc.push({name,args});return{data:{id:'order',session_id:'session',email:'private@example.invalid',phone:'5555555555',amount_cents:10300,expires_at:'2099-01-01T00:00:00Z'}};}};
 const stripe={checkout:{sessions:{create:async(data,opts)=>{calls.stripe.push({data,opts});if(overrides.failStripe)throw Error('timeout');return{id:'cs_private',url:'https://checkout.stripe.com/mock',expires_at:2000000000};},retrieve:async()=>overrides.checkout??{status:'open',url:'https://checkout.stripe.com/resume'}}}};
 const {payPrivateSignup}=load('../src/app/register/private/actions.ts',{'next/navigation':{redirect:url=>{throw Error(url);}},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/stripe':{getStripe:()=>stripe},'@/lib/private-signup':{getPrivateSignup:async()=>signup,UUID_PATTERN:/^[a-f0-9-]{36}$/,privateSignupUrl:id=>`https://example.test/register/private?token=${id}`}});
 const form=new FormData();for(const [key,value]of Object.entries({token,phone:'5555555555',paymentMethod:'card',adultConfirmed:'on',exerciseClearanceConfirmed:'on',policiesConfirmed:'on',amount:'1',email:'attacker@example.invalid',weeklyCommitment:'3'}))form.set(key,value);
 return {payPrivateSignup,form,calls};
}
for(const method of ['card','ach'])test(`private ${method} uses saved identity and price plus fee, with idempotency`,async()=>{
 const {payPrivateSignup,form,calls}=setup();form.set('paymentMethod',method);await assert.rejects(payPrivateSignup(form),/checkout.stripe.com\/mock/);
 assert.equal(calls.rpc[0].name,'reserve_private_signup_checkout');assert.deepEqual(Object.keys(calls.rpc[0].args).sort(),['p_offer_id','p_phone']);
 const {data,opts}=calls.stripe[0];assert.equal(data.customer_email,'private@example.invalid');assert.equal(data.line_items.reduce((sum,i)=>sum+i.price_data.unit_amount,0),10300);assert.equal(data.payment_method_types[0],method==='card'?'card':'us_bank_account');assert.equal(opts.idempotencyKey,'private-signup-order');assert.match(data.cancel_url,/token=/);
});
test('missing consent, invalid method and invalid token never reserve or charge',async()=>{
 for(const [key,value]of [['adultConfirmed',''],['exerciseClearanceConfirmed',''],['policiesConfirmed',''],['paymentMethod','venmo'],['token','bad']]){const d=setup();d.form.set(key,value);await assert.rejects(d.payPrivateSignup(d.form));assert.equal(d.calls.rpc.length,0);assert.equal(d.calls.stripe.length,0);}
});
test('paid and processing offers reject another payment',async()=>{
 for(const status of ['paid','payment_processing']){const d=setup({order:{status}});await assert.rejects(d.payPrivateSignup(d.form),/message=submitted/);assert.equal(d.calls.rpc.length,0);assert.equal(d.calls.stripe.length,0);}
});
test('existing checkout resumes without creating another charge; completed checkout stays blocked',async()=>{
 const d=setup({order:{id:'order',status:'reserved',stripe_checkout_session_id:'cs_old'}});await assert.rejects(d.payPrivateSignup(d.form),/checkout.stripe.com\/resume/);assert.equal(d.calls.rpc.length,0);assert.equal(d.calls.stripe.length,0);
 const completed=setup({order:{id:'order',status:'reserved',stripe_checkout_session_id:'cs_old'},checkout:{status:'complete',payment_status:'paid'}});await assert.rejects(completed.payPrivateSignup(completed.form),/message=submitted/);assert.equal(completed.calls.updates.length,0);
});
test('Stripe timeout retains reservation so retry cannot bypass duplicate protection',async()=>{
 const d=setup({failStripe:true});await assert.rejects(d.payPrivateSignup(d.form),/message=unavailable/);assert.equal(d.calls.updates.length,0);
});
test('only Stripe-confirmed expired checkout is released for a fresh attempt',async()=>{
 const d=setup({order:{id:'order',status:'reserved',stripe_checkout_session_id:'cs_old'},checkout:{status:'expired',payment_status:'unpaid'}});await assert.rejects(d.payPrivateSignup(d.form),/checkout.stripe.com\/mock/);assert.equal(d.calls.updates[0].status,'expired');assert.equal(d.calls.rpc.length,1);
});
test('coach creation requires admin and preserves exact custom cents without sending emails',async()=>{
 let allowed=false,inserted,sent=0;
 const chain={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{status:'enrolling',ends_on:'2099-01-01'}}),insert(d){inserted=d;return this;},single:async()=>({data:{id:token}}),gt:async()=>({data:[{id:'meeting',starts_at:'2099-01-01T14:00:00Z'}]})};
 const {createPrivateSignup}=load('../src/app/admin/people/private-signup-actions.ts',{'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:u=>{throw Error(u);}},'@/lib/auth':{verifyAdmin:async()=>{if(!allowed)throw Error('admin required');return{userId:'coach'};}},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>chain})},'@/lib/email':{sendTransactionalEmail:()=>{sent++;}},'@/lib/private-class-times':{weeklyClassTime:()=> 'Saturday 9:00 AM'},'@/lib/private-signup':{CLASS_TIMES:['Saturday 9:00 AM'],UUID_PATTERN:/^[a-f0-9-]{36}$/}});
 const form=new FormData();for(const[k,v]of Object.entries({sessionId:token,fullName:'Private Member',email:'MEMBER@example.invalid',amount:'99.95',attendanceTime:'Saturday 9:00 AM'}))form.set(k,v);
 await assert.rejects(createPrivateSignup(form),/admin required/);assert.equal(inserted,undefined);
 allowed=true;await assert.rejects(createPrivateSignup(form),/privateMessage=created/);assert.equal(inserted.amount_cents,9995);assert.equal(inserted.class_meeting_ids[0],'meeting');assert.equal(inserted.email,'member@example.invalid');assert.equal(inserted.created_by,'coach');assert.equal(sent,0);
 form.set('amount','0');await assert.rejects(createPrivateSignup(form),/Check the name/);
});
