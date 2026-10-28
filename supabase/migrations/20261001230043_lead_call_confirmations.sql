create table public.lead_appointments (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 140),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 120),
  meeting_type text not null check (meeting_type in ('phone', 'in_person')),
  meeting_details text not null check (char_length(meeting_details) between 3 and 300),
  source text not null default 'other' check (source in ('instagram', 'website', 'referral', 'other')),
  note text check (note is null or char_length(note) <= 1000),
  confirmation_sent_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, starts_at)
);

create index lead_appointments_upcoming_idx on public.lead_appointments (starts_at);
create trigger lead_appointments_set_updated_at before update on public.lead_appointments
for each row execute function public.set_updated_at();

alter table public.lead_appointments enable row level security;
create policy "lead_appointments_admin_all" on public.lead_appointments
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
grant select, insert, update, delete on public.lead_appointments to authenticated, service_role;
