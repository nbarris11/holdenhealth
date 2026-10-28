-- Public drop-in class scheduling and admin booking management.

alter table public.class_meetings
  add column drop_in_enabled boolean not null default true,
  add column drop_in_capacity integer not null default 6 check (drop_in_capacity between 0 and 50);

create table public.drop_in_bookings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.class_meetings(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 140),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text not null check (char_length(phone) between 1 and 40),
  note text check (char_length(note) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index drop_in_bookings_meeting_email_idx
  on public.drop_in_bookings (meeting_id, lower(email));
create index drop_in_bookings_meeting_idx on public.drop_in_bookings(meeting_id);
create index drop_in_bookings_status_idx on public.drop_in_bookings(status);

create trigger drop_in_bookings_set_updated_at
before update on public.drop_in_bookings
for each row execute function public.set_updated_at();

alter table public.drop_in_bookings enable row level security;

create policy "drop_in_meetings_public_read" on public.class_meetings
for select to anon, authenticated
using (drop_in_enabled and not cancelled and starts_at > now());

create policy "drop_in_bookings_public_insert" on public.drop_in_bookings
for insert to anon, authenticated
with check (
  status = 'requested'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1 from public.class_meetings meeting
    where meeting.id = meeting_id
      and meeting.drop_in_enabled
      and not meeting.cancelled
      and meeting.starts_at > now()
  )
);

create policy "drop_in_bookings_admin_select" on public.drop_in_bookings
for select to authenticated using ((select private.is_admin()));
create policy "drop_in_bookings_admin_update" on public.drop_in_bookings
for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "drop_in_bookings_admin_delete" on public.drop_in_bookings
for delete to authenticated using ((select private.is_admin()));

grant select on public.class_meetings to anon;
grant insert on public.drop_in_bookings to anon, authenticated;
grant select, update, delete on public.drop_in_bookings to authenticated;
