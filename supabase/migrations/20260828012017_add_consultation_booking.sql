create table public.consultation_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_minutes integer not null default 20 check (duration_minutes between 15 and 60),
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (starts_at)
);

create table public.consultation_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.consultation_slots(id) on delete restrict,
  full_name text not null check (char_length(full_name) between 2 and 140),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) between 7 and 40),
  goal text check (goal is null or char_length(goal) <= 200),
  note text check (note is null or char_length(note) <= 3000),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  zoom_meeting_id text unique,
  zoom_join_url text check (zoom_join_url is null or (char_length(zoom_join_url) <= 1000 and zoom_join_url like 'https://%')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index consultation_bookings_open_slot_idx
on public.consultation_bookings(slot_id)
where status = 'booked';

create index consultation_slots_available_idx
on public.consultation_slots(active, starts_at);

create trigger consultation_slots_set_updated_at
before update on public.consultation_slots
for each row execute function public.set_updated_at();

create trigger consultation_bookings_set_updated_at
before update on public.consultation_bookings
for each row execute function public.set_updated_at();

alter table public.consultation_slots enable row level security;
alter table public.consultation_bookings enable row level security;

create policy "consultation_slots_admin_all" on public.consultation_slots
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "consultation_bookings_admin_all" on public.consultation_bookings
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, insert, update, delete on public.consultation_slots to authenticated, service_role;
grant select, insert, update, delete on public.consultation_bookings to authenticated, service_role;
