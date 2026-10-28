drop policy "class_zoom_meetings_admin_all" on public.class_zoom_meetings;
drop policy "class_zoom_meetings_selected_member_read" on public.class_zoom_meetings;

create policy "class_zoom_meetings_authorized_read"
on public.class_zoom_meetings
for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.attendance_selections selection
    join public.enrollments enrollment on enrollment.id = selection.enrollment_id
    where selection.meeting_id = class_zoom_meetings.meeting_id
      and enrollment.member_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "class_zoom_meetings_admin_insert"
on public.class_zoom_meetings
for insert to authenticated
with check ((select private.is_admin()));

create policy "class_zoom_meetings_admin_update"
on public.class_zoom_meetings
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "class_zoom_meetings_admin_delete"
on public.class_zoom_meetings
for delete to authenticated
using ((select private.is_admin()));
