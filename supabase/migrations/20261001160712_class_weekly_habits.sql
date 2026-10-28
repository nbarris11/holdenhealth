-- Weekly class habit plans are snapshots. A new week can carry habits forward
-- without changing the previous week's record.
create table public.class_habit_weeks (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 6),
  habits text[] not null check (
    coalesce(array_length(habits, 1), 0) between 3 and 6
    and array_position(habits, null) is null
  ),
  created_at timestamptz not null default now(),
  unique (enrollment_id, week_number),
  unique (id, enrollment_id)
);

create table public.class_habit_marks (
  week_id uuid not null references public.class_habit_weeks(id) on delete cascade,
  day date not null,
  habit_index smallint not null check (habit_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (week_id, day, habit_index)
);

create index class_habit_weeks_enrollment on public.class_habit_weeks(enrollment_id);

create function public.validate_class_habit_week() returns trigger language plpgsql set search_path = '' as $$
declare session_start date; session_end date; week_start date;
begin
  select s.starts_on, s.ends_on into session_start, session_end
  from public.enrollments e join public.sessions s on s.id = e.session_id where e.id = new.enrollment_id;
  week_start := date_trunc('week', session_start::timestamp)::date + (new.week_number - 1) * 7;
  if week_start > session_end or (new.week_number > 1 and week_start > (now() at time zone 'America/Detroit')::date)
    or session_end < (now() at time zone 'America/Detroit')::date
    or exists (select 1 from unnest(new.habits) h where length(btrim(h)) < 3 or length(h) > 100)
    or (select count(distinct lower(btrim(h))) from unnest(new.habits) h) <> coalesce(array_length(new.habits, 1), 0) then
    raise exception 'Invalid weekly habit plan';
  end if;
  return new;
end $$;
create trigger validate_class_habit_week_before_insert before insert on public.class_habit_weeks
  for each row execute function public.validate_class_habit_week();

create function public.validate_class_habit_mark() returns trigger language plpgsql set search_path = '' as $$
declare session_start date; session_end date; week_number integer; habit_count integer; week_start date;
begin
  select s.starts_on, s.ends_on, w.week_number, array_length(w.habits, 1)
    into session_start, session_end, week_number, habit_count
  from public.class_habit_weeks w join public.enrollments e on e.id = w.enrollment_id
  join public.sessions s on s.id = e.session_id where w.id = new.week_id;
  week_start := date_trunc('week', session_start::timestamp)::date + (week_number - 1) * 7;
  if new.day < greatest(week_start, session_start) or new.day > least(week_start + 6, session_end)
    or new.day > (now() at time zone 'America/Detroit')::date
    or new.habit_index >= habit_count then
    raise exception 'Invalid habit checkmark';
  end if;
  return new;
end $$;
create trigger validate_class_habit_mark_before_insert before insert on public.class_habit_marks
  for each row execute function public.validate_class_habit_mark();

alter table public.class_habit_weeks enable row level security;
alter table public.class_habit_marks enable row level security;
revoke all on public.class_habit_weeks, public.class_habit_marks from anon, authenticated;
grant select, insert on public.class_habit_weeks to authenticated;
grant select, insert, delete on public.class_habit_marks to authenticated;

create policy class_habit_weeks_read on public.class_habit_weeks for select to authenticated
  using (exists (select 1 from public.enrollments e where e.id = enrollment_id
    and (e.member_id = (select auth.uid()) or (select private.is_admin()))));
create policy class_habit_weeks_insert on public.class_habit_weeks for insert to authenticated
  with check (exists (select 1 from public.enrollments e where e.id = enrollment_id
    and e.member_id = (select auth.uid()) and e.status in ('invited', 'active', 'completed')));
create policy class_habit_marks_read on public.class_habit_marks for select to authenticated
  using (exists (select 1 from public.class_habit_weeks w join public.enrollments e on e.id = w.enrollment_id
    where w.id = week_id and (e.member_id = (select auth.uid()) or (select private.is_admin()))));
create policy class_habit_marks_insert on public.class_habit_marks for insert to authenticated
  with check (exists (select 1 from public.class_habit_weeks w join public.enrollments e on e.id = w.enrollment_id
    where w.id = week_id and e.member_id = (select auth.uid()) and e.status in ('invited', 'active')));
create policy class_habit_marks_delete on public.class_habit_marks for delete to authenticated
  using (exists (select 1 from public.class_habit_weeks w join public.enrollments e on e.id = w.enrollment_id
    where w.id = week_id and e.member_id = (select auth.uid()) and e.status in ('invited', 'active')));
