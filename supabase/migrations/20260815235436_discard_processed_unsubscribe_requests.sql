-- Process the token but skip storing the public request row, preventing the
-- write-only endpoint from accumulating unnecessary data.

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
  return null;
end;
$$;

revoke all on function private.process_communication_unsubscribe() from public, anon, authenticated;
