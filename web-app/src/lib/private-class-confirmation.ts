import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { classConfirmationLine } from '@/lib/private-class-times';

export async function privateClassConfirmation(orderId: string) {
  const admin = createAdminClient();
  const { data: offer, error } = await admin.from('private_signup_offers')
    .select('session_id,attendance_time,class_meeting_ids').eq('checkout_order_id',orderId).single();
  if (error || !offer) throw new Error('The paid private class assignment could not be loaded.');
  const [{data:session,error:sessionError},{data:meetings,error:meetingError}] = await Promise.all([
    admin.from('sessions').select('name,starts_on,ends_on,address_line,city,state,location_name').eq('id',offer.session_id).single(),
    admin.from('class_meetings').select('id,starts_at,is_zoom,cancelled').eq('session_id',offer.session_id).in('id',offer.class_meeting_ids).order('starts_at'),
  ]);
  if (sessionError || meetingError || !session || !meetings?.length) throw new Error('The confirmed class details could not be loaded.');
  const dates = meetings.map(meeting=>`${classConfirmationLine(meeting)}${meeting.cancelled?' · Cancelled':''}`).join('\n');
  return `Your class signup is confirmed:\n${session.name}\nProgram dates: ${session.starts_on}–${session.ends_on}\n1 class per week · ${offer.attendance_time} Eastern\n\nScheduled classes:\n${dates}\n\nIn-person location: ${session.location_name}, ${session.address_line}, ${session.city}, ${session.state}. Dates marked Zoom meet online; the private class link is in your member portal.\n\nComplete your private intake before attending. Kelsey reviews it before participation. Contact Kelsey about any schedule changes or makeups.`;
}

export async function syncPrivateClassSignup(orderId: string) {
  const {error} = await createAdminClient().rpc('sync_private_signup_classes',{p_order_id:orderId});
  if (error) throw new Error('The paid class roster could not be updated.');
}

// A paid reservation appears immediately, even before a new member creates their
// account. Once attendance has been assigned, the normal member roster takes over.
export async function pendingPrivateClassRoster(sessionId: string) {
  const admin=createAdminClient();
  const {data:offers,error}=await admin.from('private_signup_offers')
    .select('full_name,email,class_meeting_ids,checkout_order_id').eq('session_id',sessionId).is('class_assignments_synced_at',null);
  if (error) throw new Error('Private class reservations could not be loaded.');
  const ids=(offers??[]).flatMap(offer=>offer.checkout_order_id?[offer.checkout_order_id]:[]);
  if (!ids.length) return [];
  const {data:orders,error:orderError}=await admin.from('checkout_orders').select('id').in('id',ids).eq('status','paid');
  if (orderError) throw new Error('Private class payment status could not be loaded.');
  const paidIds=new Set((orders??[]).map(order=>order.id));
  return (offers??[]).filter(offer=>paidIds.has(offer.checkout_order_id));
}
