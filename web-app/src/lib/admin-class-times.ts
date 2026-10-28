import 'server-only';
import { verifyAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function loadAdminClassTimes(memberId: string, enrollmentId?: string) {
  await verifyAdmin();
  const db = createAdminClient();
  let query = db.from('enrollments').select('id,session_id,status,sessions(name)').eq('member_id', memberId);
  if (enrollmentId) query = query.eq('id', enrollmentId);
  const [enrollments, contact] = await Promise.all([
    query.order('created_at', { ascending: false }),
    db.from('member_contacts').select('email').eq('user_id', memberId).maybeSingle(),
  ]);
  if (enrollments.error || contact.error) throw new Error('Class times could not be loaded.');

  return Promise.all((enrollments.data ?? []).map(async enrollment => {
    const [invitations, selections] = await Promise.all([
      db.from('member_invitations').select('email').eq('claimed_by', memberId).eq('session_id', enrollment.session_id),
      db.from('attendance_selections').select('meeting_id').eq('enrollment_id', enrollment.id),
    ]);
    if (invitations.error || selections.error) throw new Error('Class times could not be loaded.');
    const emails = [...new Set([contact.data?.email, ...(invitations.data ?? []).map(row => row.email)]
      .filter((email): email is string => Boolean(email)).map(email => email.trim().toLowerCase()))];
    const meetingIds = (selections.data ?? []).map(row => row.meeting_id);
    const [requests, orders, meetings] = await Promise.all([
      emails.length ? db.from('registration_requests').select('attendance_interest,created_at')
        .eq('session_id', enrollment.session_id).in('email', emails).in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: [], error: null }),
      emails.length ? db.from('checkout_orders').select('attendance_interest,created_at')
        .eq('session_id', enrollment.session_id).in('email', emails).eq('status', 'paid')
        .order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: [], error: null }),
      meetingIds.length ? db.from('class_meetings').select('id,starts_at,is_zoom')
        .eq('session_id', enrollment.session_id).in('id', meetingIds).eq('cancelled', false)
        .gte('starts_at', new Date().toISOString()).order('starts_at') : Promise.resolve({ data: [], error: null }),
    ]);
    if (requests.error || orders.error || meetings.error) throw new Error('Class times could not be loaded.');
    const preferences = [
      ...(requests.data ?? []).map(row => ({ label: 'Signup request', times: row.attendance_interest as string[] })),
      ...(orders.data ?? []).map(row => ({ label: 'Paid signup', times: row.attendance_interest as string[] })),
    ];
    const session = enrollment.sessions as unknown as { name: string } | null;
    return { id: enrollment.id, sessionId: enrollment.session_id, name: session?.name ?? 'Class program',
      preferences, meetings: meetings.data ?? [] };
  }));
}
