-- Keep legacy 21-day schedules valid while supporting 14-day challenges.
alter table public.habit_challenges drop constraint habit_challenges_check;
alter table public.habit_challenges add constraint habit_challenges_check
  check (ends_on - starts_on in (13, 20));

-- User-authorized correction of the upcoming challenge. The normal participant
-- date lock remains unchanged. All operations below are atomic under the table lock.
do $$
declare
  target public.habit_challenges%rowtype;
begin
  lock table public.habit_challenges in access exclusive mode;
  select * into strict target from public.habit_challenges
    where title = 'The 14 Day Commitment!' and starts_on = date '2026-09-21'
      and published and not archived;
  if target.ends_on <> date '2026-10-11'
    or target.starts_on <= (now() at time zone 'America/Detroit')::date
    or exists (select 1 from public.challenge_checkmarks m
      join public.challenge_participants p on p.id=m.participant_id where p.challenge_id=target.id)
    or exists (select 1 from public.challenge_workout_logs l
      join public.challenge_participants p on p.id=l.participant_id where p.challenge_id=target.id)
    or exists (select 1 from public.challenge_workouts
      where challenge_id=target.id and publish_on > target.starts_on + 13 and not archived)
  then
    raise exception 'Challenge state changed; review schedule and progress before shortening.';
  end if;
  alter table public.habit_challenges disable trigger lock_challenge_dates;
  update public.habit_challenges set ends_on=starts_on + 13 where id=target.id;
  alter table public.habit_challenges enable trigger lock_challenge_dates;
exception when no_data_found then
  -- Other environments may not contain this published challenge.
  null;
end;
$$;
