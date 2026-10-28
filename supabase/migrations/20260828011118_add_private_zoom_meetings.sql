-- Keep Zoom join links private. Every scheduled class occurrence gets its own
-- Zoom meeting, and everyone registered for that occurrence shares its link.

create table public.class_zoom_meetings (
  meeting_id uuid primary key references public.class_meetings(id) on delete cascade,
  zoom_meeting_id text not null unique check (char_length(zoom_meeting_id) between 1 and 80),
  join_url text not null check (char_length(join_url) <= 1000 and join_url like 'https://%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drop_in_bookings
add column zoom_link_sent_at timestamptz;

create trigger class_zoom_meetings_set_updated_at
before update on public.class_zoom_meetings
for each row execute function public.set_updated_at();

alter table public.class_zoom_meetings enable row level security;

create policy "class_zoom_meetings_admin_all"
on public.class_zoom_meetings
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "class_zoom_meetings_selected_member_read"
on public.class_zoom_meetings
for select to authenticated
using (exists (
  select 1
  from public.attendance_selections selection
  join public.enrollments enrollment on enrollment.id = selection.enrollment_id
  where selection.meeting_id = class_zoom_meetings.meeting_id
    and enrollment.member_id = (select auth.uid())
    and enrollment.status = 'active'
));

grant select, insert, update, delete on public.class_zoom_meetings to authenticated;

comment on table public.class_zoom_meetings is
  'Private Zoom meeting and join URL for one scheduled class occurrence. Never readable by anonymous visitors.';
