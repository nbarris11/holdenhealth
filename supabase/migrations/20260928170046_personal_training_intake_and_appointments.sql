create table public.personal_training_intakes (
  relationship_id uuid primary key references public.coaching_relationships(id) on delete cascade,
  member_id uuid not null unique references public.profiles(id) on delete cascade,
  responses jsonb not null,
  health_review_required boolean not null default false,
  acknowledgment_version text not null,
  signed_name text not null check (char_length(signed_name) between 2 and 140),
  signed_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create table public.personal_training_appointments (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coaching_relationships(id) on delete cascade,
  session_date date not null,
  session_time time without time zone not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
  location_note text check (char_length(location_note) <= 300),
  created_at timestamptz not null default now(),
  unique (relationship_id, session_date, session_time)
);

create index personal_training_appointments_schedule_idx
  on public.personal_training_appointments(relationship_id, session_date, session_time);

alter table public.personal_training_intakes enable row level security;
alter table public.personal_training_appointments enable row level security;

create policy "personal_training_intakes_read" on public.personal_training_intakes
for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "personal_training_intakes_member_submit" on public.personal_training_intakes
for insert to authenticated
with check (
  member_id = (select auth.uid()) and reviewed_at is null and reviewed_by is null
  and exists (
    select 1 from public.coaching_relationships r
    where r.id = relationship_id and r.member_id = (select auth.uid())
      and r.status in ('invited', 'active')
  )
);
create policy "personal_training_intakes_admin_review" on public.personal_training_intakes
for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "personal_training_appointments_read" on public.personal_training_appointments
for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.coaching_relationships r
  where r.id = relationship_id and r.member_id = (select auth.uid())
));
create policy "personal_training_appointments_admin_insert" on public.personal_training_appointments
for insert to authenticated with check ((select private.is_admin()));
create policy "personal_training_appointments_admin_delete" on public.personal_training_appointments
for delete to authenticated using ((select private.is_admin()));

grant select, insert, update on public.personal_training_intakes to authenticated;
grant select, insert, delete on public.personal_training_appointments to authenticated;

comment on table public.personal_training_intakes is
  'Private personal-training intake. Never include health answers in email.';
comment on column public.personal_training_appointments.session_time is
  'Local America/Detroit appointment time.';
