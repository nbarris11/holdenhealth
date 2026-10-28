-- One review invitation per member and email address within a program.
create table public.program_review_requests (
  id uuid primary key default gen_random_uuid(),
  program_key text not null check (program_key ~ '^(class|challenge):[0-9a-f-]{36}$'),
  member_id uuid not null references public.profiles(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and length(email) > 3),
  status text not null default 'sending' check (status in ('sending','sent','failed','unknown')),
  attempt_id uuid not null default gen_random_uuid(),
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(program_key, member_id),
  unique(program_key, email)
);
create index program_review_requests_member_idx on public.program_review_requests(member_id);
create index program_review_requests_admin_idx on public.program_review_requests(requested_by);
alter table public.program_review_requests enable row level security;
revoke all on public.program_review_requests from anon, authenticated;
grant select, insert, update on public.program_review_requests to authenticated;
grant all on public.program_review_requests to service_role;
create policy review_requests_admin_read on public.program_review_requests for select to authenticated using ((select private.is_admin()));
create policy review_requests_admin_insert on public.program_review_requests for insert to authenticated with check ((select private.is_admin()) and requested_by=(select auth.uid()));
create policy review_requests_admin_update on public.program_review_requests for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
