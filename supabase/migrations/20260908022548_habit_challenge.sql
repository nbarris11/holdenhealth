-- Free challenges are independent of paid enrollments and coaching relationships.
create table public.habit_challenges (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 120),
 starts_on date not null, ends_on date not null,
 published boolean not null default false, signup_open boolean not null default false,
 welcome text not null default '', community_url text not null default '',
 goal_options jsonb not null default '[]'::jsonb check (jsonb_typeof(goal_options) = 'array'),
 created_at timestamptz not null default now(),
 check (ends_on = starts_on + 20),
 check (community_url = '' or community_url ~ '^https://chat[.]whatsapp[.]com/[A-Za-z0-9/?=&_-]+$')
);
create table public.challenge_participants (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.habit_challenges(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 100),
 goals text[] not null check (array_length(goals,1) = 3 and array_ndims(goals) = 1 and array_position(goals,null) is null),
 weekly_workouts integer not null check (weekly_workouts between 1 and 7),
 joined_on date not null default (now() at time zone 'America/Detroit')::date,
 unique(challenge_id,user_id)
);
create index challenge_participants_user_idx on public.challenge_participants(user_id);
create table public.challenge_checkmarks (
 participant_id uuid not null references public.challenge_participants(id) on delete cascade,
 day date not null, goal_index integer not null check (goal_index between 0 and 2),
 completed boolean not null default false,
 primary key(participant_id,day,goal_index)
);
create table public.challenge_workouts (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.habit_challenges(id),
 title text not null check(length(trim(title)) between 1 and 120),
 minutes integer not null check(minutes between 1 and 180), equipment text not null default '',
 plan text not null check(length(trim(plan)) between 1 and 20000),
 exercises jsonb not null default '[]'::jsonb check(jsonb_typeof(exercises)='array'),
 publish_on date not null, published boolean not null default false,
 created_at timestamptz not null default now()
);
create index challenge_workouts_schedule_idx on public.challenge_workouts(challenge_id,publish_on);
alter table public.habit_challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_checkmarks enable row level security;
alter table public.challenge_workouts enable row level security;
revoke all on public.habit_challenges, public.challenge_participants, public.challenge_checkmarks, public.challenge_workouts from anon, authenticated;
grant select on public.habit_challenges to anon, authenticated;
grant insert, update on public.habit_challenges to authenticated;
grant select, insert on public.challenge_participants to authenticated;
grant select, insert, update on public.challenge_checkmarks to authenticated;
grant select, insert, update on public.challenge_workouts to authenticated;
create policy challenge_public_read on public.habit_challenges for select to anon using(published);
create policy challenge_member_read on public.habit_challenges for select to authenticated using(published or (select private.is_admin()));
create policy challenge_admin_insert on public.habit_challenges for insert to authenticated with check((select private.is_admin()));
create policy challenge_admin_update on public.habit_challenges for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy participant_read on public.challenge_participants for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy participant_join on public.challenge_participants for insert to authenticated with check (
 user_id=(select auth.uid()) and joined_on=(now() at time zone 'America/Detroit')::date
 and exists(select 1 from public.habit_challenges c where c.id=challenge_id and c.published and c.signup_open and c.ends_on >= (now() at time zone 'America/Detroit')::date)
);
create policy checkmark_read on public.challenge_checkmarks for select to authenticated using(
 exists(select 1 from public.challenge_participants p where p.id=participant_id and (p.user_id=(select auth.uid()) or (select private.is_admin())))
);
create policy checkmark_insert on public.challenge_checkmarks for insert to authenticated with check(
 exists(select 1 from public.challenge_participants p join public.habit_challenges c on c.id=p.challenge_id
 where p.id=participant_id and p.user_id=(select auth.uid()) and day between greatest(p.joined_on,c.starts_on) and least(c.ends_on,(now() at time zone 'America/Detroit')::date))
);
create policy checkmark_update on public.challenge_checkmarks for update to authenticated using(
 exists(select 1 from public.challenge_participants p where p.id=participant_id and p.user_id=(select auth.uid()))
) with check(
 exists(select 1 from public.challenge_participants p join public.habit_challenges c on c.id=p.challenge_id
 where p.id=participant_id and p.user_id=(select auth.uid()) and day between greatest(p.joined_on,c.starts_on) and least(c.ends_on,(now() at time zone 'America/Detroit')::date))
);
create policy workout_read on public.challenge_workouts for select to authenticated using(
 (select private.is_admin()) or (published and publish_on <= (now() at time zone 'America/Detroit')::date and exists(select 1 from public.challenge_participants p where p.challenge_id=challenge_workouts.challenge_id and p.user_id=(select auth.uid())))
);
create policy workout_admin_insert on public.challenge_workouts for insert to authenticated with check((select private.is_admin()));
create policy workout_admin_update on public.challenge_workouts for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
-- Snapshots cannot be changed by participants. Reject malformed snapshots even via direct API.
create function private.validate_challenge_goals() returns trigger language plpgsql set search_path='' as $$
begin
 if (select count(distinct lower(trim(g))) from unnest(new.goals) g) <> 3
 or exists(select 1 from unnest(new.goals) g where length(trim(g)) not between 1 and 140) then
 raise exception 'Choose three different habits, each 1–140 characters.';
 end if;
 return new;
end; $$;
revoke all on function private.validate_challenge_goals() from public,anon,authenticated;
create trigger validate_challenge_goals before insert on public.challenge_participants for each row execute function private.validate_challenge_goals();
create function private.lock_challenge_dates() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.starts_on<>old.starts_on or new.ends_on<>old.ends_on) and exists(select 1 from public.challenge_participants where challenge_id=old.id) then
 raise exception 'Dates cannot change once participants have joined. Create a new challenge instead.';
 end if;
 return new;
end; $$;
revoke all on function private.lock_challenge_dates() from public,anon,authenticated;
create trigger lock_challenge_dates before update on public.habit_challenges for each row execute function private.lock_challenge_dates();
insert into public.habit_challenges(title,starts_on,ends_on,welcome,goal_options)
values ('The 21-day habit challenge','2026-09-21','2026-10-11','Small habits. Big changes. Choose three habits that fit your life, and check them off as you go.',
'[{"category":"Movement","label":"Move your body intentionally every day"},{"category":"Movement","label":"Get outside for a walk"},{"category":"Movement","label":"Complete a workout"},{"category":"Movement","label":"Stretch or do mobility work for 10 minutes"},{"category":"Movement","label":"Take the stairs when you can"},{"category":"Nutrition & hydration","label":"Meet my daily water goal"},{"category":"Nutrition & hydration","label":"Eat a protein-rich food at each meal"},{"category":"Nutrition & hydration","label":"Add a fruit or vegetable to your meals"},{"category":"Nutrition & hydration","label":"Eat meals sitting down, without distractions"},{"category":"Nutrition & hydration","label":"Plan your meals for the next day"},{"category":"Nutrition & hydration","label":"Make your next food choice a nourishing one"},{"category":"Sleep & recovery","label":"Aim for 7+ hours of sleep"},{"category":"Sleep & recovery","label":"Create a consistent bedtime"},{"category":"Sleep & recovery","label":"Put your phone away 30 minutes before bed"},{"category":"Sleep & recovery","label":"Take 10 minutes to stretch, breathe, or unwind"},{"category":"Mindset & self-care","label":"Take 10 minutes just for YOU"},{"category":"Mindset & self-care","label":"Practice gratitude — write down 3 things you’re grateful for"},{"category":"Mindset & self-care","label":"Give yourself grace when things don’t go as planned"},{"category":"Mindset & self-care","label":"Do something that makes you happy"},{"category":"Mindset & self-care","label":"Spend time with someone who makes you feel good"},{"category":"Mindset & self-care","label":"Check in with yourself: How am I feeling today, and what do I need?"}]');
