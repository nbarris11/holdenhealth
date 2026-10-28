-- NULL explicitly means all signed-in member accounts. Existing audiences stay intact.
alter table public.announcements alter column session_id drop not null;

drop policy announcements_member_read on public.announcements;
create policy announcements_member_read on public.announcements for select to authenticated
using (
  (select private.is_admin())
  or (
    published_at <= now()
    and (select auth.uid()) is not null
    and (
      session_id is null
      or exists (
        select 1 from public.enrollments e
        where e.session_id = announcements.session_id
          and e.member_id = (select auth.uid())
          and e.status in ('invited', 'active', 'completed')
      )
    )
  )
);
