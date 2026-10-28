-- Additive upgrade: existing enrollment, habit and training records remain intact.
-- Filename matches the migration version assigned by the Supabase migration API.
alter table public.habit_challenges add column archived boolean not null default false;
alter table public.challenge_workouts
 add column archived boolean not null default false,
 add column revision integer not null default 1,
 add column level text not null default 'All levels' check (level in ('Beginner','All levels','Intermediate')),
 add column focus text not null default 'Full body' check (length(focus) between 1 and 80),
 add column steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps)='array' and jsonb_array_length(steps)<=40 and octet_length(steps::text)<=100000);

create function private.version_challenge_workout() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.title,new.plan,new.steps,new.timer_config,new.exercises,new.minutes,new.equipment)
 is distinct from row(old.title,old.plan,old.steps,old.timer_config,old.exercises,old.minutes,old.equipment) then
   new.revision := old.revision + 1;
 else new.revision := old.revision;
 end if;
 if new.archived then new.published := false; end if;
 return new;
end; $$;
revoke all on function private.version_challenge_workout() from public, anon, authenticated;
create trigger version_challenge_workout before update on public.challenge_workouts for each row execute function private.version_challenge_workout();

-- An unpublished parent must also hide its workouts from direct API requests.
alter policy workout_read on public.challenge_workouts using (
 (select private.is_admin()) or (
 published and not archived and publish_on <= (now() at time zone 'America/Detroit')::date
 and exists(select 1 from public.challenge_participants p join public.habit_challenges c on c.id=p.challenge_id
 where p.challenge_id=challenge_workouts.challenge_id and p.user_id=(select auth.uid()) and c.published and not c.archived))
);

create table public.challenge_workout_logs (
 id uuid primary key,
 participant_id uuid not null references public.challenge_participants(id),
 workout_id uuid not null references public.challenge_workouts(id),
 status text not null check (status in ('completed','partial')),
 elapsed_seconds integer not null default 0 check (elapsed_seconds between 0 and 10800),
 effort integer check (effort between 1 and 10),
 note text not null default '' check (length(note)<=2000),
 performed_on date not null default (now() at time zone 'America/Detroit')::date,
 completed_at timestamptz not null default now(),
 workout_revision integer not null default 1,
 workout_title text not null default '',
 workout_snapshot jsonb not null default '{}'::jsonb
);
create index challenge_workout_logs_participant_date_idx on public.challenge_workout_logs(participant_id,performed_on desc);
create index challenge_workout_logs_workout_idx on public.challenge_workout_logs(workout_id);
alter table public.challenge_workout_logs enable row level security;
revoke all on public.challenge_workout_logs from anon, authenticated;
grant select, insert on public.challenge_workout_logs to authenticated;
create policy workout_log_read on public.challenge_workout_logs for select to authenticated using (
 exists(select 1 from public.challenge_participants p where p.id=participant_id and (p.user_id=(select auth.uid()) or (select private.is_admin())))
);
create policy workout_log_insert on public.challenge_workout_logs for insert to authenticated with check (
 exists(select 1 from public.challenge_participants p
 join public.habit_challenges c on c.id=p.challenge_id
 join public.challenge_workouts w on w.challenge_id=c.id
 where p.id=participant_id and p.user_id=(select auth.uid()) and w.id=workout_id
 and c.published and not c.archived and w.published and not w.archived
 and performed_on=(now() at time zone 'America/Detroit')::date
 and performed_on between greatest(p.joined_on,c.starts_on,w.publish_on) and c.ends_on)
);
-- Snapshots and timestamps are set by the database, not trusted from a client.
create function private.snapshot_challenge_workout_log() returns trigger language plpgsql set search_path='' as $$
declare w public.challenge_workouts;
begin
 select * into w from public.challenge_workouts where id=new.workout_id;
 if not found then raise exception 'Workout unavailable'; end if;
 new.completed_at := now();
 new.performed_on := (now() at time zone 'America/Detroit')::date;
 new.workout_revision := w.revision;
 new.workout_title := w.title;
 new.workout_snapshot := jsonb_build_object('title',w.title,'plan',w.plan,'steps',w.steps,'minutes',w.minutes,'equipment',w.equipment,'timer_config',w.timer_config);
 return new;
end; $$;
revoke all on function private.snapshot_challenge_workout_log() from public, anon, authenticated;
create trigger snapshot_challenge_workout_log before insert on public.challenge_workout_logs for each row execute function private.snapshot_challenge_workout_log();
