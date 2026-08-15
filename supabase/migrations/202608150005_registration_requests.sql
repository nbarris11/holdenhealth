-- Public session-interest requests stay pending until an administrator approves them.

create table public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 140),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text not null check (char_length(phone) between 7 and 40),
  returning_member boolean not null default false,
  attendance_interest text[] not null default '{}',
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registration_requests_session_status_idx on public.registration_requests(session_id, status, created_at desc);
create index registration_requests_email_idx on public.registration_requests(email);
create trigger registration_requests_set_updated_at before update on public.registration_requests
for each row execute function public.set_updated_at();

alter table public.registration_requests enable row level security;

create policy "registration_requests_public_insert" on public.registration_requests for insert to anon, authenticated
with check (status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "registration_requests_admin_select" on public.registration_requests for select to authenticated
using ((select private.is_admin()));
create policy "registration_requests_admin_update" on public.registration_requests for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "registration_requests_admin_delete" on public.registration_requests for delete to authenticated
using ((select private.is_admin()));

grant insert on public.registration_requests to anon;
grant select, insert, update, delete on public.registration_requests to authenticated;
