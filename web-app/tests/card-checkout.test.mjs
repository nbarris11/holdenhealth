import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, imports) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports, require:k=>imports[k], process:{env:{NEXT_PUBLIC_APP_URL:'https://example.test', STRIPE_WEBHOOK_SECRET:'mock'}}});
 return exports;
}
for (const method of ['card','ach']) test(`${method} checkout uses server pricing and enforces safety`, async()=>{
 let checkout, count=0;
 const chain={eq(){return this;},maybeSingle:async()=>({data:{name:'October session',starts_on:'2099-01-01',two_day_price_cents:19900,three_day_price_cents:24900}})};
 const admin={from:()=>({select:()=>chain,update:()=>({eq:async()=>({error:null})})}),rpc:async()=>{count++;return {data:{id:'order',amount_cents:19900}};}};
 const action=load('../src/app/register/checkout-action.ts',{
 'next/headers':{},'next/navigation':{redirect:u=>{throw Error(u);}},
 '@/lib/posthog-server':{distinctIdForValue:()=> 'mock',captureServerEvent:async()=>{}},
 '@/lib/supabase/admin':{createAdminClient:()=>admin},
 '@/lib/registration-schedule':{registrationClassTimes:()=>['Tuesday 6:00 AM','Saturday 9:00 AM']},
 '@/lib/stripe':{getStripe:()=>({checkout:{sessions:{create:async data=>{checkout=data;return {id:'cs_mock',url:'https://checkout.stripe.com/mock',expires_at:2000000000};}}}})}
 });
 const form=new FormData();
 for(const [k,v] of Object.entries({paymentMethod:method,sessionId:'11111111-1111-4111-8111-111111111111',fullName:'Test Person',email:'test@example.test',phone:'5555555555',weeklyCommitment:'2',attendance:'Tuesday 6:00 AM',policiesConfirmed:'on'})) form.set(k,v);
 await assert.rejects(action.startStripeCheckout(form),/book.html/);assert.equal(count,0);
 form.set('adultConfirmed','on');form.set('exerciseClearanceConfirmed','on');
 await assert.rejects(action.startStripeCheckout(form),/checkout.stripe.com/);
 assert.deepEqual(Array.from(checkout.payment_method_types),[method==='card'?'card':'us_bank_account']);
 assert.equal(checkout.line_items.reduce((n,x)=>n+x.price_data.unit_amount,0),20300);
 assert.equal(Boolean(checkout.custom_text),method==='ach');
 form.set('paymentMethod','crypto');await assert.rejects(action.startStripeCheckout(form),/checkoutError=payment/);assert.equal(count,1);
});
test('mini checkout uses the returning price and keeps the December signup link',async()=>{
 let rpcName, rpcArgs, checkout;
 const chain={eq(){return this;},maybeSingle:async()=>({data:{name:'December Mini Session',starts_on:'2099-01-01',two_day_price_cents:null,three_day_price_cents:null}})};
 const admin={from:()=>({select:()=>chain,update:()=>({eq:async()=>({error:null})})}),rpc:async(name,args)=>{rpcName=name;rpcArgs=args;return {data:{id:'mini-order',amount_cents:9900}};}};
 const action=load('../src/app/register/checkout-action.ts',{
  'next/headers':{},'next/navigation':{redirect:u=>{throw Error(u);}},
  '@/lib/posthog-server':{distinctIdForValue:()=> 'mock',captureServerEvent:async()=>{}},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/registration-schedule':{registrationClassTimes:()=>['Tuesday 6:00 AM','Saturday 9:00 AM']},
  '@/lib/stripe':{getStripe:()=>({checkout:{sessions:{create:async data=>{checkout=data;return {id:'cs_mini',url:'https://checkout.stripe.com/mini',expires_at:2000000000};}}}})}
 });
 const form=new FormData();
 for(const [k,v] of Object.entries({paymentMethod:'card',sessionId:'11111111-1111-4111-8111-111111111111',fullName:'Returning Member',email:'member@example.test',phone:'5555555555',weeklyCommitment:'3',returningMember:'on',attendance:'Saturday 9:00 AM',policiesConfirmed:'on',adultConfirmed:'on',exerciseClearanceConfirmed:'on'}))form.set(k,v);
 await assert.rejects(action.startStripeCheckout(form),/checkout.stripe.com\/mini/);
 assert.equal(rpcName,'reserve_mini_checkout_order');
 assert.equal(rpcArgs.p_returning_member,true);
 assert.equal(checkout.line_items.reduce((n,x)=>n+x.price_data.unit_amount,0),10300);
 assert.match(checkout.cancel_url,/register\?session=11111111-1111-4111-8111-111111111111/);
});
for(const commitment of [1,2]) for(const method of ['card','us_bank_account']) test(`paid ${method} ${commitment}-class webhook records method and handles retries`,async()=>{
 const order={id:'order',amount_cents:20300,full_name:'Test Person',email:'test@example.test',phone:'5555555555',session_id:'session',weekly_commitment:commitment,status:'pending'};
 const invitations=[],emails=[],links=[],analytics=[];
 const admin={from:table=>{let update;const chain={select(){return this;},eq(){return this;},is(){return this;},update(d){update=d;return this;},upsert(d){invitations.push(d);return this;},single:async()=>({data:{id:'invite'}}),maybeSingle:async()=>({data:order}),then(resolve){if(table==='checkout_orders'&&update)Object.assign(order,update);resolve({error:null});}};return chain;}};
 const session={id:'cs_mock',metadata:{checkout_order_id:'order'},payment_method_types:[method],payment_status:'paid',currency:'usd',amount_total:20300,payment_intent:'pi_mock'};
 const route=load('../src/app/api/webhooks/stripe/route.ts',{
 stripe:{},'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status??200})}},
 '@/lib/private-class-confirmation':{privateClassConfirmation:async()=> 'Class signup confirmed: Saturday 9:00 AM Eastern; October 17, 2026',syncPrivateClassSignup:async()=>{}},
 '@/lib/email':{sendTransactionalEmails:async batch=>{emails.push(...batch);return true;},sendMemberPortalLink:async(...args)=>links.push(args)},
 '@/lib/posthog-server':{captureServerEvent:async(...args)=>analytics.push(args),captureServerException:async()=>{},distinctIdForValue:()=> 'mock'},
 '@/lib/supabase/admin':{createAdminClient:()=>admin},
 '@/lib/registration-schedule':{registrationClassTimes:()=>['Tuesday 6:00 AM','Saturday 9:00 AM']},
 '@/lib/stripe':{getStripe:()=>({webhooks:{constructEvent:()=>({type:'checkout.session.completed',data:{object:session}})}})}
 });
 const request={headers:{get:()=> 'mock-signature'},text:async()=> 'mock-body'};
 assert.equal((await route.POST(request)).status,200);
 const signup=analytics.find(([,event])=>event==='group_signup_completed');
 assert.equal(signup[2].completion_status,'paid');
 assert.equal(signup[2].offering,'group_enrollment');
 assert.equal(signup[3],'stripe:cs_mock');
 assert.equal(invitations[0].payment_method,method==='card'?'stripe_card':'stripe_ach');assert.equal(order.status,'paid');assert.equal(invitations[0].weekly_commitment,commitment);
 assert.equal(emails.length,2);assert.equal(links.length,1);if(commitment===1){assert.match(emails[0].content.body,/Saturday 9:00 AM/);assert.match(emails[0].subject,/class signup confirmed/);}assert.doesNotMatch(JSON.stringify(emails),/bank payment|ACH/);
 assert.equal((await route.POST(request)).status,200);assert.equal(invitations.length,1);assert.equal(emails.length,2);assert.equal(links.length,1);
 assert.equal(analytics.filter(([,event])=>event==='group_signup_completed').length,2);
 session.amount_total=100;assert.equal((await route.POST(request)).status,500);
});
test('bank checkout counts signup when submitted, before payment clears',async()=>{
 const order={id:'order',amount_cents:20300,full_name:'Test Person',email:'test@example.test',phone:'5555555555',session_id:'session',weekly_commitment:2,status:'reserved'};
 const analytics=[];
 const admin={from:table=>{let update;const chain={select(){return this;},eq(){return this;},is(){return this;},update(data){update=data;return this;},maybeSingle:async()=>({data:order}),then(resolve){if(table==='checkout_orders'&&update)Object.assign(order,update);resolve({error:null});}};return chain;}};
 const session={id:'cs_bank',metadata:{checkout_order_id:'order'},payment_method_types:['us_bank_account'],payment_status:'unpaid',currency:'usd',amount_total:20300,payment_intent:'pi_bank'};
 const route=load('../src/app/api/webhooks/stripe/route.ts',{
  stripe:{},'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status??200})}},
  '@/lib/private-class-confirmation':{},
  '@/lib/email':{sendTransactionalEmails:async()=>true},
  '@/lib/posthog-server':{captureServerEvent:async(...args)=>analytics.push(args),captureServerException:async()=>{},distinctIdForValue:()=> 'mock'},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/registration-schedule':{registrationClassTimes:()=>['Tuesday 6:00 AM','Saturday 9:00 AM']},
  '@/lib/stripe':{getStripe:()=>({webhooks:{constructEvent:()=>({type:'checkout.session.completed',data:{object:session}})}})}
 });
 assert.equal((await route.POST({headers:{get:()=> 'signature'},text:async()=> 'body'})).status,200);
 const signup=analytics.find(([,event])=>event==='group_signup_completed');
 assert.equal(signup[2].completion_status,'processing');
 assert.equal(signup[2].payment_status,'unpaid');
 assert.equal(signup[3],'stripe:cs_bank');
 assert.equal(order.status,'payment_processing');
});
test('paid December checkout retains returning-member status for the portal',async()=>{
 const order={id:'mini-order',amount_cents:10300,full_name:'Returning Member',email:'member@example.test',phone:'5555555555',session_id:'december',weekly_commitment:3,returning_member:true,plan_kind:'mini',status:'reserved'};
 let invitation,coachEmail;
 const admin={from:table=>{let update;const chain={select(){return this;},eq(){return this;},is(){return this;},update(d){update=d;return this;},upsert(d){invitation=d;return this;},single:async()=>({data:{id:'invite'}}),maybeSingle:async()=>({data:order}),then(resolve){if(table==='checkout_orders'&&update)Object.assign(order,update);resolve({error:null});}};return chain;}};
 const session={id:'cs_mini',metadata:{checkout_order_id:'mini-order'},payment_method_types:['card'],payment_status:'paid',currency:'usd',amount_total:10300,payment_intent:'pi_mini'};
 const route=load('../src/app/api/webhooks/stripe/route.ts',{
  stripe:{},'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status??200})}},
  '@/lib/private-class-confirmation':{},'@/lib/email':{sendTransactionalEmails:async batch=>{coachEmail=batch[1];return true;},sendMemberPortalLink:async()=>{}},
  '@/lib/posthog-server':{captureServerEvent:async()=>{},captureServerException:async()=>{},distinctIdForValue:()=> 'mock'},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/registration-schedule':{registrationClassTimes:()=>['Tuesday 6:00 AM','Saturday 9:00 AM']},
  '@/lib/stripe':{getStripe:()=>({webhooks:{constructEvent:()=>({type:'checkout.session.completed',data:{object:session}})}})}
 });
 assert.equal((await route.POST({headers:{get:()=> 'signature'},text:async()=> 'body'})).status,200);
 assert.equal(invitation.returning_member,true);
 assert.equal(invitation.amount_cents,10300);
 assert.match(coachEmail.content.body,/All classes · returning member/);
});
