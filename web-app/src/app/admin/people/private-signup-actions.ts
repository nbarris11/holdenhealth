'use server';
import { weeklyClassTime } from '@/lib/private-class-times';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifyAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTransactionalEmail } from '@/lib/email';
import { CLASS_TIMES, UUID_PATTERN, privateSignupUrl, getPrivateSignup } from '@/lib/private-signup';

export async function createPrivateSignup(form: FormData) {
  const actor = await verifyAdmin();
  const sessionId = String(form.get('sessionId') ?? '');
  const name = String(form.get('fullName') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const time = String(form.get('attendanceTime') ?? '');
  const amount = String(form.get('amount') ?? '').trim();
  if (!UUID_PATTERN.test(sessionId) || name.length<2 || name.length>140 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !CLASS_TIMES.includes(time) || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount)<1 || Number(amount)>10000) throw new Error('Check the name, email, class time and session price.');
  const admin = createAdminClient();
  const {data:session} = await admin.from('sessions').select('id,status,ends_on').eq('id',sessionId).maybeSingle();
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (!session || !['enrolling','active'].includes(session.status) || session.ends_on<today) throw new Error('Choose an enrolling or active program.');
  const {data:meetings,error:meetingError} = await admin.from('class_meetings').select('id,starts_at').eq('session_id',sessionId).eq('cancelled',false).gt('starts_at',new Date().toISOString());
  const classIds = (meetings??[]).filter(meeting=>weeklyClassTime(meeting.starts_at)===time).map(meeting=>meeting.id);
  if (meetingError || !classIds.length) throw new Error('There are no upcoming classes at that time in this program. Choose a scheduled class time.');
  const {data:offer,error} = await admin.from('private_signup_offers').insert({session_id:sessionId,full_name:name,email,attendance_time:time,class_meeting_ids:classIds,amount_cents:Math.round(Number(amount)*100),created_by:actor.userId}).select('id').single();
  if (error?.code==='23505') redirect(`/admin/people?program=${sessionId}&privateMessage=exists#private-signups`);
  if (error || !offer) throw new Error('The private signup could not be saved. Please try again.');
  revalidatePath('/admin/people');
  redirect(`/admin/people?program=${sessionId}&privateMessage=created#private-signups`);
}

export async function emailPrivateSignup(form: FormData) {
  await verifyAdmin();
  const id = String(form.get('offerId') ?? '');
  if (!UUID_PATTERN.test(id)) throw new Error('Invalid signup.');
  const admin = createAdminClient();
  const {data:offer,error} = await admin.from('private_signup_offers').select('id,session_id,full_name,email,attendance_time,amount_cents,expires_at,checkout_order_id').eq('id',id).single();
  if (error || !offer || Date.parse(offer.expires_at)<=Date.now()) throw new Error('This signup has expired. Contact the member to arrange a new signup.');
  if (offer.checkout_order_id) {
    const {data:order} = await admin.from('checkout_orders').select('status').eq('id',offer.checkout_order_id).single();
    if (!order || ['paid','payment_processing'].includes(order.status)) throw new Error('Payment has already been submitted. Do not send another payment request.');
  }
  if (!await getPrivateSignup(id)) throw new Error('This program or signup is no longer available.');
  const sent = await sendTransactionalEmail(offer.email,'Your once-a-week Holden Health signup',{
    firstName:offer.full_name.split(/\s+/)[0],preheader:'Your private signup and payment link from Kelsey.',heading:'Your once-a-week plan is ready.',
    body:`As arranged with Kelsey, your plan includes one class each week at ${offer.attendance_time} (Eastern time). The price for your session is $${(offer.amount_cents/100).toFixed(2)}. Secure card or bank checkout adds the existing $4 online payment fee. This is a one-time session payment, with no automatic renewal.\n\nOpen your private link to review the program dates, confirm the safety and attendance policies, and pay. Full Holden Health app access is included after payment and setup. If you need a different payment method, reply to Kelsey before paying.\n\nThis link expires ${new Date(offer.expires_at).toLocaleDateString('en-US',{timeZone:'America/Detroit'})}. Please keep it private. Your place is confirmed after payment; availability is checked at checkout.`,
    ctaLabel:'Review my signup and pay',ctaUrl:privateSignupUrl(offer.id),
  });
  if (sent) {
    const {error:saveError} = await admin.from('private_signup_offers').update({email_sent_at:new Date().toISOString()}).eq('id',id);
    if (saveError) throw new Error('The email was sent, but its sent status could not be saved.');
  }
  revalidatePath('/admin/people');
  redirect(`/admin/people?program=${offer.session_id}&privateMessage=${sent?'sent':'email-failed'}#private-signups`);
}

export async function extendPrivateSignup(form: FormData) {
  await verifyAdmin();
  const id=String(form.get('offerId')??'');
  if (!UUID_PATTERN.test(id)) throw new Error('Invalid signup.');
  const admin=createAdminClient();
  const {data:offer,error}=await admin.from('private_signup_offers').update({expires_at:new Date(Date.now()+14*24*60*60*1000).toISOString()}).eq('id',id).select('session_id').single();
  if (error || !offer) throw new Error('The link could not be extended.');
  // Extending the link never alters an existing checkout or its payment status.
  revalidatePath('/admin/people');
  redirect(`/admin/people?program=${offer.session_id}&privateMessage=extended#private-signups`);
}
