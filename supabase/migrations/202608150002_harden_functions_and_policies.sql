-- Move privileged helpers out of the exposed API schema and remove redundant policies.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.handle_new_user() set schema private;
alter function public.is_admin() set schema private;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

drop policy "sessions_admin_write" on public.sessions;
create policy "sessions_admin_insert" on public.sessions for insert to authenticated
with check ((select private.is_admin()));
create policy "sessions_admin_update" on public.sessions for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "sessions_admin_delete" on public.sessions for delete to authenticated
using ((select private.is_admin()));

drop policy "meetings_admin_write" on public.class_meetings;
create policy "meetings_admin_insert" on public.class_meetings for insert to authenticated
with check ((select private.is_admin()));
create policy "meetings_admin_update" on public.class_meetings for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "meetings_admin_delete" on public.class_meetings for delete to authenticated
using ((select private.is_admin()));

drop policy "enrollments_admin_write" on public.enrollments;
create policy "enrollments_admin_insert" on public.enrollments for insert to authenticated
with check ((select private.is_admin()));
create policy "enrollments_admin_update" on public.enrollments for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "enrollments_admin_delete" on public.enrollments for delete to authenticated
using ((select private.is_admin()));

drop policy "payments_admin_write" on public.payment_records;
create policy "payments_admin_insert" on public.payment_records for insert to authenticated
with check ((select private.is_admin()));
create policy "payments_admin_update" on public.payment_records for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "payments_admin_delete" on public.payment_records for delete to authenticated
using ((select private.is_admin()));

drop policy "check_ins_admin_manage" on public.check_ins;
drop policy "check_ins_member_submit" on public.check_ins;
create policy "check_ins_submit" on public.check_ins for insert to authenticated
with check ((select private.is_admin()) or exists (
  select 1 from public.enrollments e where e.id = check_ins.enrollment_id
  and e.member_id = (select auth.uid()) and e.status = 'active'
));
create policy "check_ins_admin_update" on public.check_ins for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "check_ins_admin_delete" on public.check_ins for delete to authenticated
using ((select private.is_admin()));

drop policy "announcements_admin_write" on public.announcements;
create policy "announcements_admin_insert" on public.announcements for insert to authenticated
with check ((select private.is_admin()));
create policy "announcements_admin_update" on public.announcements for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "announcements_admin_delete" on public.announcements for delete to authenticated
using ((select private.is_admin()));

drop policy "resources_admin_write" on public.resources;
create policy "resources_admin_insert" on public.resources for insert to authenticated
with check ((select private.is_admin()));
create policy "resources_admin_update" on public.resources for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "resources_admin_delete" on public.resources for delete to authenticated
using ((select private.is_admin()));

drop policy "site_content_admin_write" on public.site_content;
create policy "site_content_admin_insert" on public.site_content for insert to authenticated
with check ((select private.is_admin()));
create policy "site_content_admin_update" on public.site_content for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "site_content_admin_delete" on public.site_content for delete to authenticated
using ((select private.is_admin()));

create index announcements_created_by_idx on public.announcements(created_by);
create index attendance_meeting_idx on public.attendance_selections(meeting_id);
create index audit_actor_idx on public.audit_events(actor_id);
create index check_ins_reviewer_idx on public.check_ins(reviewed_by);
create index payment_records_recorded_by_idx on public.payment_records(recorded_by);
create index resources_created_by_idx on public.resources(created_by);
create index resources_session_idx on public.resources(session_id);
create index site_content_updated_by_idx on public.site_content(updated_by);
