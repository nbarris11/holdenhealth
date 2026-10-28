import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const CLASS_TIMES = ['Tuesday 6:00 AM', 'Wednesday 7:00 PM', 'Saturday 7:30 AM', 'Saturday 9:00 AM'];
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function privateSignupUrl(id: string) {
  return `${(process.env.NEXT_PUBLIC_APP_URL || 'https://portal.holden.health').replace(/\/$/, '')}/register/private?token=${encodeURIComponent(id)}`;
}
export async function getPrivateSignup(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  const admin = createAdminClient();
  const { data: offer, error } = await admin.from('private_signup_offers').select('id,session_id,full_name,email,attendance_time,class_meeting_ids,amount_cents,expires_at,checkout_order_id').eq('id',id).maybeSingle();
  if (error) throw new Error('Private signup is temporarily unavailable. Please contact Kelsey.');
  if (!offer) return null;
  const { data: session } = await admin.from('sessions').select('name,starts_on,ends_on,status').eq('id',offer.session_id).maybeSingle();
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (!session || !['enrolling','active'].includes(session.status) || session.ends_on < today || Date.parse(offer.expires_at)<=Date.now()) return null;
  const { data: order } = offer.checkout_order_id ? await admin.from('checkout_orders').select('id,status,stripe_checkout_session_id,expires_at').eq('id',offer.checkout_order_id).maybeSingle() : {data:null};
  const {data:meetings,error:meetingError} = await admin.from('class_meetings').select('id,title,starts_at,is_zoom,cancelled').eq('session_id',offer.session_id).in('id',offer.class_meeting_ids).order('starts_at');
  if (meetingError) throw new Error('Class details are temporarily unavailable. Please contact Kelsey.');
  return {offer,session,order,meetings:meetings??[]};
}
