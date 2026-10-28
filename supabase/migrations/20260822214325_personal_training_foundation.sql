-- First personal-training vertical slice: service relationship, Plan A/B/C,
-- weekly reset, workout completion, and coach feedback.

create table public.coaching_relationships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.profiles(id) on delete cascade,
  coach_id uuid not null references auth.users(id),
  service_mode text not null default 'online' check (service_mode in ('online', 'in_person', 'hybrid')),
  status text not null default 'active' check (status in ('invited', 'active', 'paused', 'completed')),
  primary_goal text,
  available_equipment text,
  starts_on date not null default current_date,
  next_review_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coaching_relationships(id) on delete cascade,
  scheduled_for date not null,
  title text not null,
  focus text,
  coach_note text,
  recommended_option text not null default 'A' check (recommended_option in ('A', 'B', 'C')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'deferred')),
  deferred_reason text,
  published_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_options (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.scheduled_workouts(id) on delete cascade,
  option_code text not null check (option_code in ('A', 'B', 'C')),
  label text not null,
  estimated_minutes integer not null check (estimated_minutes between 5 and 180),
  plan text not null,
  created_at timestamptz not null default now(),
  unique (workout_id, option_code)
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null unique references public.scheduled_workouts(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  option_code text not null check (option_code in ('A', 'B', 'C')),
  energy_before integer not null check (energy_before between 1 and 5),
  effort integer not null check (effort between 1 and 10),
  completion_note text,
  personal_win text,
  completed_at timestamptz not null default now()
);

create table public.workout_feedback (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null unique references public.workout_logs(id) on delete cascade,
  coach_id uuid not null references auth.users(id),
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.week_resets (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coaching_relationships(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  reset_on date not null default current_date,
  remaining_sessions integer not null check (remaining_sessions between 1 and 3),
  energy text not null check (energy in ('low', 'steady', 'good')),
  member_note text,
  created_at timestamptz not null default now()
);

create index coaching_relationships_coach_idx on public.coaching_relationships(coach_id);
create index scheduled_workouts_relationship_date_idx on public.scheduled_workouts(relationship_id, scheduled_for);
create index scheduled_workouts_status_idx on public.scheduled_workouts(status, scheduled_for);
create index workout_options_workout_idx on public.workout_options(workout_id);
create index workout_logs_member_completed_idx on public.workout_logs(member_id, completed_at desc);
create index workout_feedback_coach_idx on public.workout_feedback(coach_id);
create index week_resets_relationship_date_idx on public.week_resets(relationship_id, reset_on desc);

create trigger coaching_relationships_set_updated_at before update on public.coaching_relationships
for each row execute function public.set_updated_at();
create trigger scheduled_workouts_set_updated_at before update on public.scheduled_workouts
for each row execute function public.set_updated_at();
create trigger workout_feedback_set_updated_at before update on public.workout_feedback
for each row execute function public.set_updated_at();

alter table public.coaching_relationships enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.workout_options enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_feedback enable row level security;
alter table public.week_resets enable row level security;

create policy "coaching_relationships_member_read" on public.coaching_relationships for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "coaching_relationships_admin_insert" on public.coaching_relationships for insert to authenticated
with check ((select private.is_admin()));
create policy "coaching_relationships_admin_update" on public.coaching_relationships for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "coaching_relationships_admin_delete" on public.coaching_relationships for delete to authenticated
using ((select private.is_admin()));

create policy "scheduled_workouts_member_read" on public.scheduled_workouts for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.coaching_relationships r
  where r.id = scheduled_workouts.relationship_id and r.member_id = (select auth.uid())
));
create policy "scheduled_workouts_admin_insert" on public.scheduled_workouts for insert to authenticated
with check ((select private.is_admin()));
create policy "scheduled_workouts_admin_update" on public.scheduled_workouts for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "scheduled_workouts_admin_delete" on public.scheduled_workouts for delete to authenticated
using ((select private.is_admin()));

create policy "workout_options_member_read" on public.workout_options for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.scheduled_workouts w
  join public.coaching_relationships r on r.id = w.relationship_id
  where w.id = workout_options.workout_id and r.member_id = (select auth.uid())
));
create policy "workout_options_admin_insert" on public.workout_options for insert to authenticated
with check ((select private.is_admin()));
create policy "workout_options_admin_update" on public.workout_options for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "workout_options_admin_delete" on public.workout_options for delete to authenticated
using ((select private.is_admin()));

create policy "workout_logs_member_read" on public.workout_logs for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "workout_logs_member_insert" on public.workout_logs for insert to authenticated
with check (
  member_id = (select auth.uid()) and exists (
    select 1 from public.scheduled_workouts w
    join public.coaching_relationships r on r.id = w.relationship_id
    where w.id = workout_logs.workout_id
      and r.member_id = (select auth.uid())
      and r.status = 'active'
      and w.status = 'scheduled'
  )
);
create policy "workout_logs_admin_update" on public.workout_logs for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "workout_logs_admin_delete" on public.workout_logs for delete to authenticated
using ((select private.is_admin()));

create policy "workout_feedback_member_read" on public.workout_feedback for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.workout_logs l
  where l.id = workout_feedback.workout_log_id and l.member_id = (select auth.uid())
));
create policy "workout_feedback_admin_insert" on public.workout_feedback for insert to authenticated
with check ((select private.is_admin()));
create policy "workout_feedback_admin_update" on public.workout_feedback for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "workout_feedback_admin_delete" on public.workout_feedback for delete to authenticated
using ((select private.is_admin()));

create policy "week_resets_member_read" on public.week_resets for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "week_resets_admin_insert" on public.week_resets for insert to authenticated
with check ((select private.is_admin()));

grant select on public.coaching_relationships, public.scheduled_workouts, public.workout_options,
  public.workout_logs, public.workout_feedback, public.week_resets to authenticated;
grant insert on public.workout_logs to authenticated;
grant insert, update, delete on public.coaching_relationships, public.scheduled_workouts,
  public.workout_options, public.workout_feedback to authenticated;
grant update, delete on public.workout_logs to authenticated;
grant insert on public.week_resets to authenticated;
