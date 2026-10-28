-- Customers may see dates and times for published group programs.
-- Private Zoom join URLs remain in a separate protected table.
create policy meetings_published_program_read on public.class_meetings
for select to anon, authenticated
using (exists (
  select 1 from public.sessions program
  where program.id = session_id and program.published
    and program.status in ('enrolling', 'active')
    and program.ends_on >= (now() at time zone 'America/Detroit')::date
));
