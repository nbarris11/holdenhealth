-- Dated plans for coached personal-training sessions, separate from at-home workouts.
create table public.personal_training_session_plans (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coaching_relationships(id) on delete cascade,
  session_date date not null,
  title text not null check (char_length(title) between 1 and 140),
  plan text not null check (char_length(plan) between 1 and 15000),
  member_visible boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_training_session_plans_relationship_date_idx
  on public.personal_training_session_plans(relationship_id, session_date desc);
create trigger personal_training_session_plans_set_updated_at
  before update on public.personal_training_session_plans
  for each row execute function public.set_updated_at();

alter table public.personal_training_session_plans enable row level security;
revoke all on public.personal_training_session_plans from anon, authenticated;
grant select, insert, update on public.personal_training_session_plans to authenticated;

create policy personal_training_session_plans_read
  on public.personal_training_session_plans for select to authenticated
  using ((select private.is_admin()) or (
    member_visible and exists (
      select 1 from public.coaching_relationships r
      where r.id = relationship_id and r.member_id = (select auth.uid())
    )
  ));
create policy personal_training_session_plans_admin_insert
  on public.personal_training_session_plans for insert to authenticated
  with check ((select private.is_admin()));
create policy personal_training_session_plans_admin_update
  on public.personal_training_session_plans for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
