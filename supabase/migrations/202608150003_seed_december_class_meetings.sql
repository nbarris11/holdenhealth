-- Seed the nine confirmed one-hour class meetings for the December 2026 mini session.
-- Local times are converted with the Detroit time zone so daylight-saving rules stay correct.

with session_target as (
  select id
  from public.sessions
  where slug = 'focus-on-you-december-2026'
), meeting_times(local_start) as (
  values
    (timestamp '2026-12-01 06:00:00'),
    (timestamp '2026-12-02 19:00:00'),
    (timestamp '2026-12-05 09:00:00'),
    (timestamp '2026-12-08 06:00:00'),
    (timestamp '2026-12-09 19:00:00'),
    (timestamp '2026-12-12 09:00:00'),
    (timestamp '2026-12-15 06:00:00'),
    (timestamp '2026-12-16 19:00:00'),
    (timestamp '2026-12-19 09:00:00')
), prepared_meetings as (
  select
    session_target.id as session_id,
    meeting_times.local_start at time zone 'America/Detroit' as starts_at,
    (meeting_times.local_start + interval '1 hour') at time zone 'America/Detroit' as ends_at
  from session_target
  cross join meeting_times
)
insert into public.class_meetings (session_id, starts_at, ends_at, title, notes)
select
  prepared_meetings.session_id,
  prepared_meetings.starts_at,
  prepared_meetings.ends_at,
  'Focus on You: Total-body conditioning',
  'Equipment is provided. Nutrition and habit accountability are included throughout the session.'
from prepared_meetings
where not exists (
  select 1
  from public.class_meetings existing
  where existing.session_id = prepared_meetings.session_id
    and existing.starts_at = prepared_meetings.starts_at
);
