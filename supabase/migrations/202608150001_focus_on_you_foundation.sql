-- Holden Health / Focus on You secure application foundation
-- Prepared for Supabase project urxxiohatmvqbgrzqibq.

create extension if not exists pgcrypto;

create type public.session_status as enum ('draft', 'enrolling', 'full', 'active', 'completed', 'cancelled');
create type public.enrollment_status as enum ('prospect', 'invited', 'active', 'completed', 'withdrawn');
create type public.payment_status as enum ('pending', 'paid', 'credited', 'refunded', 'waived');
create type public.payment_method as enum ('venmo', 'zelle', 'check', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  location_name text not null default 'Holden Health',
  address_line text not null,
  city text not null default 'Plymouth',
  state text not null default 'MI',
  postal_code text,
  starts_on date not null,
  ends_on date not null,
  capacity integer not null check (capacity between 1 and 100),
  new_member_price_cents integer not null check (new_member_price_cents >= 0),
  returning_member_price_cents integer check (returning_member_price_cents >= 0),
  status public.session_status not null default 'draft',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null default 'Total-body conditioning',
  notes text,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status public.enrollment_status not null default 'prospect',
  returning_member boolean not null default false,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create table public.attendance_selections (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  meeting_id uuid not null references public.class_meetings(id) on delete cascade,
  selected_at timestamptz not null default now(),
  attended boolean,
  unique (enrollment_id, meeting_id)
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments(id) on delete cascade,
  status public.payment_status not null default 'pending',
  method public.payment_method,
  amount_cents integer not null check (amount_cents >= 0),
  received_on date,
  internal_note text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 12),
  went_well text not null,
  did_not_go_well text not null,
  upcoming_goal text not null,
  support_needed text not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  coach_response text,
  reviewed_by uuid references auth.users(id),
  unique (enrollment_id, week_number)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  title text not null,
  body text not null,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null,
  description text,
  url text not null,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.site_content (
  content_key text primary key,
  value jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  published_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index enrollments_member_idx on public.enrollments(member_id);
create index enrollments_session_idx on public.enrollments(session_id);
create index meetings_session_start_idx on public.class_meetings(session_id, starts_at);
create index attendance_enrollment_idx on public.attendance_selections(enrollment_id);
create index check_ins_enrollment_idx on public.check_ins(enrollment_id, week_number);
create index announcements_session_idx on public.announcements(session_id, published_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();
create trigger enrollments_set_updated_at before update on public.enrollments
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payment_records
for each row execute function public.set_updated_at();
create trigger site_content_set_updated_at before update on public.site_content
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.sessions enable row level security;
alter table public.class_meetings enable row level security;
alter table public.enrollments enable row level security;
alter table public.attendance_selections enable row level security;
alter table public.payment_records enable row level security;
alter table public.check_ins enable row level security;
alter table public.announcements enable row level security;
alter table public.resources enable row level security;
alter table public.site_content enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select public.is_admin()))
with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "staff_roles_admin_only" on public.staff_roles for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "sessions_public_read" on public.sessions for select to anon, authenticated
using (published or (select public.is_admin()));
create policy "sessions_admin_write" on public.sessions for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "meetings_member_read" on public.class_meetings for select to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.enrollments e
  where e.session_id = class_meetings.session_id
    and e.member_id = (select auth.uid()) and e.status in ('invited', 'active', 'completed')
));
create policy "meetings_admin_write" on public.class_meetings for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "enrollments_member_read" on public.enrollments for select to authenticated
using (member_id = (select auth.uid()) or (select public.is_admin()));
create policy "enrollments_admin_write" on public.enrollments for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "attendance_member_read" on public.attendance_selections for select to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.enrollments e where e.id = attendance_selections.enrollment_id
  and e.member_id = (select auth.uid())
));
create policy "attendance_member_insert" on public.attendance_selections for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.enrollments e join public.class_meetings m on m.session_id = e.session_id
  where e.id = attendance_selections.enrollment_id
    and m.id = attendance_selections.meeting_id
    and e.member_id = (select auth.uid()) and e.status = 'active'
));
create policy "attendance_member_delete" on public.attendance_selections for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.enrollments e where e.id = attendance_selections.enrollment_id
  and e.member_id = (select auth.uid()) and e.status = 'active'
));
create policy "attendance_admin_update" on public.attendance_selections for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "payments_member_read" on public.payment_records for select to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.enrollments e where e.id = payment_records.enrollment_id
  and e.member_id = (select auth.uid())
));
create policy "payments_admin_write" on public.payment_records for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "check_ins_member_read" on public.check_ins for select to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.enrollments e where e.id = check_ins.enrollment_id
  and e.member_id = (select auth.uid())
));
create policy "check_ins_member_submit" on public.check_ins for insert to authenticated
with check (exists (
  select 1 from public.enrollments e where e.id = check_ins.enrollment_id
  and e.member_id = (select auth.uid()) and e.status = 'active'
));
create policy "check_ins_admin_manage" on public.check_ins for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "announcements_member_read" on public.announcements for select to authenticated
using (published_at is not null and ((select public.is_admin()) or exists (
  select 1 from public.enrollments e where e.session_id = announcements.session_id
  and e.member_id = (select auth.uid()) and e.status in ('invited', 'active', 'completed')
)));
create policy "announcements_admin_write" on public.announcements for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "resources_member_read" on public.resources for select to authenticated
using (published and ((select public.is_admin()) or session_id is null or exists (
  select 1 from public.enrollments e where e.session_id = resources.session_id
  and e.member_id = (select auth.uid()) and e.status in ('invited', 'active', 'completed')
)));
create policy "resources_admin_write" on public.resources for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "site_content_public_read" on public.site_content for select to anon, authenticated
using (published or (select public.is_admin()));
create policy "site_content_admin_write" on public.site_content for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "audit_admin_read" on public.audit_events for select to authenticated
using ((select public.is_admin()));
create policy "audit_admin_insert" on public.audit_events for insert to authenticated
with check ((select public.is_admin()) and actor_id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.sessions, public.site_content to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Seed the confirmed December offer without adding any members.
insert into public.sessions (
  name, slug, description, address_line, city, state, starts_on, ends_on,
  capacity, new_member_price_cents, returning_member_price_cents, status, published
) values (
  'Focus on You: December Mini Session',
  'focus-on-you-december-2026',
  'Three weeks of in-person total-body conditioning, nutrition habits, check-ins, and accountability.',
  '41100 Plymouth Road, Suite B1-162', 'Plymouth', 'MI',
  '2026-12-01', '2026-12-19', 25, 13900, 9900, 'enrolling', true
);
