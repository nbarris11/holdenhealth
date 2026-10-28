import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, imports = {}) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports, require:k=>imports[k], FormData, Intl, Date, process:{env:{STRIPE_WEBHOOK_SECRET:'mock'}}});
 return exports;
}
const pricing=load('../src/lib/training-billing.ts');
function form(amount='200.01') { const f=new FormData(); for(const [k,v] of Object.entries({amount,month:'2026-10',dueOn:'2026-10-01',description:'Two sessions'}))f.set(k,v);return f; }
test('bill parsing preserves cents and rejects malformed amounts and dates',()=>{
 assert.equal(pricing.parseBill(form()).amount_cents,20001);
 for(const amount of ['-1','0','1.001','1e3','10001','NaN'])assert.throws(()=>pricing.parseBill(form(amount)));
 const f=form();f.set('dueOn','2026-02-30');assert.throws(()=>pricing.parseBill(f));
});
function fixture(existing=false) {
 const bill={id:'bill',member_id:'member',amount_cents:20000,customer_email:'test@example.test',billing_month:'2026-10-01',description:'Two sessions'};
 const attempt={id:'attempt',bill_id:'bill',stripe_session_id:existing?'cs_test':null,expires_at:'2026-10-01T12:31:00Z'};
 const session={id:'cs_test',url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',currency:'usd',amount_total:20400,metadata:{purchase_type:pricing.TRAINING_CHECKOUT_TYPE,training_bill_id:'bill',training_bill_checkout_id:'attempt'}};
 const calls=[];
 const chain={select(){return this},eq(){return this},in:async()=>({data:existing?[attempt]:[]}),single:async()=>({data:{bill_id:'bill'}})};
 const admin={from:()=>chain,rpc:async(name,args)=>{calls.push({name,args});return {data:name==='reserve_training_bill_checkout'?{bill,attempt}:null};}};
 const sessions={retrieve:async()=>session,create:async(data,opts)=>{calls.push({name:'stripe.create',data,opts});return session;},expire:async()=>{session.status='expired';return session;}};
 const lib=load('../src/lib/training-billing-stripe.ts',{'server-only':{},'@/lib/training-billing':pricing,'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/stripe':{getStripe:()=>({checkout:{sessions}})}});
 return {lib,calls,session,admin};
}
test('checkout uses stored amount, adds fee only in Stripe, and attaches before return',async()=>{
 const f=fixture();assert.match(await f.lib.trainingCheckout('bill','member'),/checkout.stripe.com/);
 const c=f.calls.find(x=>x.name==='stripe.create');assert.equal(c.data.mode,'payment');assert.equal(c.data.line_items[0].price_data.unit_amount,20000);assert.equal(c.data.line_items[1].price_data.unit_amount,400);assert.equal(c.opts.idempotencyKey,'training-bill-attempt');assert.equal(f.calls.at(-1).name,'update_training_bill_checkout');
});
test('repeated checkout uses existing session without another create',async()=>{
 const f=fixture(true);await f.lib.trainingCheckout('bill','member');assert.equal(f.calls.filter(x=>x.name==='stripe.create').length,0);
});
test('paid session settles with total and payment intent; metadata/currency mismatch fails',async()=>{
 const f=fixture();f.session.payment_status='paid';f.session.payment_intent='pi_test';await f.lib.syncTrainingCheckout(f.session);
 assert.equal(f.calls.at(-1).args.p_state,'paid');assert.equal(f.calls.at(-1).args.p_total,20400);assert.equal(f.calls.at(-1).args.p_intent,'pi_test');
 f.session.currency='eur';await assert.rejects(f.lib.syncTrainingCheckout(f.session));
 f.session.currency='usd';f.session.metadata.training_bill_id='other';await assert.rejects(f.lib.syncTrainingCheckout(f.session));
});
test('offline update closes open checkout before recording payment',async()=>{
 const f=fixture(true);await f.lib.refreshTrainingBill('bill',true);assert.equal(f.calls.at(-1).args.p_state,'expired');
});
test('monthly webhook routes separately and retrieves authoritative session',async()=>{
 let synced=0;const session={id:'cs_test',metadata:{purchase_type:pricing.TRAINING_CHECKOUT_TYPE}};
 const route=load('../src/app/api/webhooks/stripe/route.ts',{'stripe':{},'next/server':{NextResponse:{json:(data,opts)=>({data,status:opts?.status||200})}},'@/lib/training-billing-stripe':{syncTrainingCheckout:async s=>{assert.equal(s.payment_status,'paid');synced++}},'@/lib/stripe':{getStripe:()=>({webhooks:{constructEvent:()=>({type:'checkout.session.completed',data:{object:session}})},checkout:{sessions:{retrieve:async()=>({...session,payment_status:'paid'})}}})},'@/lib/posthog-server':{captureServerException:async()=>{}}});
 assert.equal((await route.POST({headers:{get:()=> 'sig'},text:async()=>''})).status,200);assert.equal(synced,1);
});
test('send bill email contains base amount and stable member link, with no fee language',async()=>{
 let email,updated=false;
 const bill={id:'bill',member_id:'member',status:'unpaid',amount_cents:20000,customer_email:'member@example.test',billing_month:'2026-10-01',description:'Two sessions',due_on:'2026-10-05'};
 const chain={select(){return this},eq(){return this},single:async()=>({data:bill}),update(){updated=true;return this},then(resolve){resolve({error:null})}};
 const actions=load('../src/app/training-billing-actions.ts',{'next/cache':{revalidatePath:()=>{}},'@/lib/auth':{verifyAdmin:async()=>({userId:'admin'})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>chain})},'@/lib/training-billing':pricing,'@/lib/training-billing-stripe':{refreshTrainingBill:async()=>{}},'@/lib/email':{sendTransactionalEmail:async(...args)=>{email=args;return true}}});
 const f=new FormData();f.set('billId','bill');assert((await actions.sendTrainingBill(f)).success);assert.equal(email[0],bill.customer_email);assert.match(email[2].body,/\$200.00/);assert.doesNotMatch(email[2].body,/fee|204.00/);assert.equal(email[2].ctaUrl,'https://portal.holden.health/portal/training/billing?bill=bill');assert(updated);
});
test('member payment refuses a bill outside the signed-in owner before calling Stripe',async()=>{
 let checkout=false,owner;
 const chain={select(){return this},eq(k,v){if(k==='member_id')owner=v;return this},single:async()=>({data:null})};
 const actions=load('../src/app/training-billing-actions.ts',{'@/lib/auth':{verifySession:async()=>({userId:'member'})},'@/lib/supabase/server':{createClient:async()=>({from:()=>chain})},'@/lib/training-billing-stripe':{trainingCheckout:async()=>{checkout=true}},'@/lib/stripe':{isStripeConfigured:()=>true}});
 const f=new FormData();f.set('billId','another-member-bill');assert((await actions.payTrainingBill(f)).error);assert.equal(owner,'member');assert(!checkout);
});
