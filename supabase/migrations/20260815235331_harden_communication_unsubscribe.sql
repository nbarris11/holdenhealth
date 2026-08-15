-- Accept unsubscribe requests through a write-only table and process them in a
-- private trigger instead of exposing a privileged public RPC.

revoke execute on function public.unsubscribe_member_communications(uuid) from anon, authenticated;
drop function public.unsubscribe_member_communications(uuid);

create table public.communication_unsubscribe_requests (
  id uuid primary key default gen_random_uuid(),
  token uuid not null,
  created_at timestamptz not null default now()
);

alter table public.communication_unsubscribe_requests enable row level security;

create policy "unsubscribe_requests_public_insert" on public.communication_unsubscribe_requests
for insert to anon, authenticated with check (true);

grant insert on public.communication_unsubscribe_requests to anon, authenticated;

create or replace function private.process_communication_unsubscribe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_contacts
  set email_opt_in = false, unsubscribed_at = now(), updated_at = now()
  where unsubscribe_token = new.token and email_opt_in = true;
  return new;
end;
$$;

revoke all on function private.process_communication_unsubscribe() from public, anon, authenticated;

create trigger process_communication_unsubscribe_request
before insert on public.communication_unsubscribe_requests
for each row execute function private.process_communication_unsubscribe();
