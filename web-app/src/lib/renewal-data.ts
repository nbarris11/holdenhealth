import 'server-only';
import { verifySession } from './auth';
import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { detroitToday } from './challenge';
import { chooseRenewalSession, renewalStatus } from './renewal';
import { registrationClassTimes } from './registration-schedule';

export async function renewalData(requested?: string) {
  const auth = await verifySession();
  const db = await createClient();
  // Privileged queries below are always scoped to the verified account email.
  const admin = createAdminClient();
  const [profile, programs, memberships] = await Promise.all([
    db.from('profiles').select('full_name,phone').eq('id', auth.userId).maybeSingle(),
    db.from('sessions').select('id,name,description,starts_on,ends_on,new_member_price_cents,returning_member_price_cents,two_day_price_cents,three_day_price_cents').eq('published', true).in('status', ['enrolling','active']).gte('ends_on', detroitToday()).order('starts_on'),
    db.from('enrollments').select('id,session_id,status,weekly_commitment').eq('member_id', auth.userId).order('created_at', {ascending:false}),
  ]);
  if ([profile, programs, memberships].some(r => r.error)) throw new Error('Your renewal details could not be loaded. Please try again.');
  const sessions = programs.data ?? [], enrollments = memberships.data ?? [];
  const session = chooseRenewalSession(sessions, enrollments, requested);
  if (!session) return {auth, profile:profile.data, sessions, session, enrollments, status:'available' as const, order:null, request:null, classTimes:[] as string[], includedClassCount:0};
  const [orders, requests, invitations, meetings] = await Promise.all([
    admin.from('checkout_orders').select('id,status,stripe_checkout_session_id').eq('email', auth.email.toLowerCase()).eq('session_id', session.id).in('status',['reserved','payment_processing','paid']).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    admin.from('registration_requests').select('status,payment_method').eq('email',auth.email.toLowerCase()).eq('session_id',session.id).in('status',['pending','approved']).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    admin.from('member_invitations').select('id').eq('email',auth.email.toLowerCase()).eq('session_id',session.id).in('enrollment_status',['invited','active','completed']).limit(1).maybeSingle(),
    admin.from('class_meetings').select('starts_at,cancelled').eq('session_id',session.id).order('starts_at'),
  ]);
  if ([orders, requests, invitations, meetings].some(r=>r.error)) throw new Error('Your registration status could not be checked. Please try again.');
  const enrolled = Boolean(invitations.data) || enrollments.some(e=>e.session_id===session.id && ['invited','active','completed'].includes(e.status));
  return {auth,profile:profile.data,sessions,session,enrollments,order:orders.data,request:requests.data,status:renewalStatus(enrolled,orders.data,requests.data),classTimes:registrationClassTimes(meetings.data ?? []),includedClassCount:(meetings.data ?? []).filter(meeting=>!meeting.cancelled).length};
}
