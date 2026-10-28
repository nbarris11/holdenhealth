-- Reuse the existing workout player and snapshots for enrolled class members.
-- Every workout belongs to exactly one free challenge or class program.
alter table public.challenge_workouts
  alter column challenge_id drop not null,
  add column session_id uuid references public.sessions(id),
  add constraint workout_one_program check (num_nonnulls(challenge_id, session_id) = 1);
create index class_workouts_schedule_idx on public.challenge_workouts(session_id, publish_on) where session_id is not null;

alter table public.challenge_workout_logs
  alter column participant_id drop not null,
  add column enrollment_id uuid references public.enrollments(id),
  add constraint workout_log_one_membership check (num_nonnulls(participant_id, enrollment_id) = 1);
create index class_workout_logs_enrollment_date_idx on public.challenge_workout_logs(enrollment_id, performed_on desc) where enrollment_id is not null;

create function private.validate_workout_program() returns trigger language plpgsql set search_path = '' as $$
declare program_start date; program_end date;
begin
  if tg_op = 'UPDATE' and (new.challenge_id is distinct from old.challenge_id or new.session_id is distinct from old.session_id) then
    raise exception 'A saved workout cannot move to another program. Use a template instead.';
  end if;
  if new.session_id is not null then
    select starts_on, ends_on into program_start, program_end from public.sessions where id = new.session_id;
    if not found or new.publish_on < program_start or new.publish_on > program_end then
      raise exception 'Choose a release date within the class program.';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_workout_program() from public, anon, authenticated;
create trigger validate_workout_program before insert or update on public.challenge_workouts
  for each row execute function private.validate_workout_program();

alter policy workout_read on public.challenge_workouts using (
  (select private.is_admin()) or (
    published and not archived and publish_on <= (now() at time zone 'America/Detroit')::date
    and (
      exists (select 1 from public.challenge_participants p join public.habit_challenges c on c.id = p.challenge_id
        where p.challenge_id = challenge_workouts.challenge_id and p.user_id = (select auth.uid()) and c.published and not c.archived)
      or exists (select 1 from public.enrollments e join public.sessions s on s.id = e.session_id
        where e.session_id = challenge_workouts.session_id and e.member_id = (select auth.uid())
        and e.status in ('invited', 'active', 'completed') and s.published and s.status not in ('draft', 'cancelled'))
    )
  )
);

alter policy workout_log_read on public.challenge_workout_logs using (
  (select private.is_admin())
  or exists (select 1 from public.challenge_participants p where p.id = participant_id and p.user_id = (select auth.uid()))
  or exists (select 1 from public.enrollments e where e.id = enrollment_id and e.member_id = (select auth.uid()))
);
alter policy workout_log_insert on public.challenge_workout_logs with check (
  exists (select 1 from public.challenge_participants p
    join public.habit_challenges c on c.id = p.challenge_id
    join public.challenge_workouts w on w.challenge_id = c.id
    where p.id = participant_id and p.user_id = (select auth.uid()) and w.id = workout_id
    and c.published and not c.archived and w.published and not w.archived
    and performed_on = (now() at time zone 'America/Detroit')::date
    and performed_on between greatest(p.joined_on, c.starts_on, w.publish_on) and c.ends_on)
  or exists (select 1 from public.enrollments e
    join public.sessions s on s.id = e.session_id
    join public.challenge_workouts w on w.session_id = s.id
    where e.id = enrollment_id and e.member_id = (select auth.uid()) and e.status in ('invited', 'active')
    and w.id = workout_id and s.published and s.status not in ('draft', 'cancelled', 'completed')
    and w.published and not w.archived
    and performed_on = (now() at time zone 'America/Detroit')::date
    and performed_on between greatest(s.starts_on, w.publish_on, (e.created_at at time zone 'America/Detroit')::date) and s.ends_on)
);
