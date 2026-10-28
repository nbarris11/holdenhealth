'use server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { getPrivateSignup, privateSignupUrl, UUID_PATTERN } from '@/lib/private-signup';

export async function payPrivateSignup(form: FormData) {
  const token = String(form.get('token') ?? '');
  if (!UUID_PATTERN.test(token)) redirect('/register/private');
  const path = `/register/private?token=${encodeURIComponent(token)}`;
  function fail(message: string): never { redirect(`${path}&message=${message}`); }
  if (form.get('website')) fail('details');
  const signup = await getPrivateSignup(token);
  if (!signup) fail('unavailable');
  if (signup.order && ['paid','payment_processing'].includes(signup.order.status)) fail('submitted');
  const admin = createAdminClient();
  const stripe = getStripe();
  // Resume the original checkout; never start a second payment while its outcome is unknown.
  if (signup.order?.status==='reserved' && signup.order.stripe_checkout_session_id) {
    let checkout;
    try { checkout = await stripe.checkout.sessions.retrieve(signup.order.stripe_checkout_session_id); }
    catch { fail('unavailable'); }
    if (checkout.status==='open' && checkout.url) redirect(checkout.url);
    if (checkout.status!=='expired' || checkout.payment_status==='paid') fail('submitted');
    const {error} = await admin.from('checkout_orders').update({status:'expired'}).eq('id',signup.order.id).eq('status','reserved');
    if (error) fail('unavailable');
  }
  const method = String(form.get('paymentMethod') ?? '');
  if (!['card','ach'].includes(method)) fail('payment');
  const phone = String(form.get('phone') ?? '').trim();
  if (phone.length<7 || phone.length>40) fail('details');
  if (form.get('adultConfirmed')!=='on' || form.get('exerciseClearanceConfirmed')!=='on' || form.get('policiesConfirmed')!=='on') fail('consent');
  const {data,error} = await admin.rpc('reserve_private_signup_checkout',{p_offer_id:token,p_phone:phone});
  if (error || !data) fail(error?.message?.toLowerCase().includes('full')?'full':'in-progress');
  const order = Array.isArray(data)?data[0]:data;
  let url: string | null = null;
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode:'payment',payment_method_types:[method==='card'?'card':'us_bank_account'],customer_creation:'always',customer_email:order.email,client_reference_id:order.id,
      expires_at:Math.floor(Date.parse(order.expires_at)/1000),
      line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:order.amount_cents-400,product_data:{name:'Holden Health · 1 class per week',description:`${signup.session.name} · ${signup.offer.attendance_time}`}}},{quantity:1,price_data:{currency:'usd',unit_amount:400,product_data:{name:'Online payment convenience fee'}}}],
      metadata:{checkout_order_id:order.id,session_id:order.session_id,online_payment_fee_cents:'400'},
      payment_intent_data:{metadata:{checkout_order_id:order.id,session_id:order.session_id,online_payment_fee_cents:'400'}},
      success_url:`${new URL(privateSignupUrl(token)).origin}/register/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:privateSignupUrl(token),
    },{idempotencyKey:`private-signup-${order.id}`});
    const {error:saveError} = await admin.from('checkout_orders').update({stripe_checkout_session_id:checkout.id,expires_at:new Date(checkout.expires_at*1000).toISOString()}).eq('id',order.id).eq('status','reserved');
    if (saveError) throw saveError;
    url=checkout.url;
  } catch {
    // Do not cancel on a timeout: Stripe may already have created the payment.
    // Retrying the same order uses the same Stripe idempotency key.
    fail('unavailable');
  }
  if (!url) fail('unavailable');
  redirect(url);
}
