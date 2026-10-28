create index drop_in_bookings_reviewed_by_idx on public.drop_in_bookings(reviewed_by);

alter policy "drop_in_meetings_public_read" on public.class_meetings to anon;

alter policy "meetings_member_read" on public.class_meetings
using (
  (select private.is_admin())
  or (drop_in_enabled and not cancelled and starts_at > now())
  or exists (
    select 1 from public.enrollments enrollment
    where enrollment.session_id = class_meetings.session_id
      and enrollment.member_id = (select auth.uid())
      and enrollment.status in ('invited', 'active', 'completed')
  )
);
