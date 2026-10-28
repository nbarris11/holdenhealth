-- Save high-intent public website forms so administrators can follow up in the portal.

create table public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  form_name text not null check (form_name in ('contact', 'consultation-request')),
  full_name text not null check (char_length(full_name) between 2 and 140),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) between 7 and 40),
  topic text check (topic is null or char_length(topic) <= 200),
  message text check (message is null or char_length(message) <= 3000),
  source_path text check (source_path is null or char_length(source_path) <= 500),
  status text not null default 'pending' check (status in ('pending', 'handled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index website_inquiries_status_created_idx
  on public.website_inquiries (status, created_at desc);

create trigger website_inquiries_set_updated_at
before update on public.website_inquiries
for each row execute function public.set_updated_at();

alter table public.website_inquiries enable row level security;

create policy "website_inquiries_admin_select" on public.website_inquiries
for select to authenticated
using ((select private.is_admin()));

create policy "website_inquiries_admin_update" on public.website_inquiries
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "website_inquiries_admin_delete" on public.website_inquiries
for delete to authenticated
using ((select private.is_admin()));

grant select, update, delete on public.website_inquiries to authenticated;
grant select, insert, update, delete on public.website_inquiries to service_role;
