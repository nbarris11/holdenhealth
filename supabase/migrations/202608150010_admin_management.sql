-- Allow existing administrators to invite and manage additional administrators.

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index admin_invitations_pending_email_idx
on public.admin_invitations (lower(email))
where accepted_at is null and revoked_at is null;

create index admin_invitations_invited_by_idx on public.admin_invitations(invited_by);
create index admin_invitations_accepted_by_idx on public.admin_invitations(accepted_by);

alter table public.admin_invitations enable row level security;

create policy "admin_invitations_admin_select" on public.admin_invitations
for select to authenticated using ((select private.is_admin()));

create policy "admin_invitations_admin_insert" on public.admin_invitations
for insert to authenticated
with check ((select private.is_admin()) and invited_by = (select auth.uid()));

create policy "admin_invitations_admin_update" on public.admin_invitations
for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "admin_invitations_admin_delete" on public.admin_invitations
for delete to authenticated using ((select private.is_admin()));

create or replace function public.claim_admin_invitation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  account_email text;
begin
  account_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if account_email = '' or auth.uid() is null then
    return false;
  end if;

  select invitation.id into invitation_id
  from public.admin_invitations invitation
  where lower(invitation.email) = account_email
    and invitation.accepted_at is null
    and invitation.revoked_at is null
  order by invitation.created_at desc
  limit 1
  for update;

  if invitation_id is null then
    return false;
  end if;

  insert into public.staff_roles (user_id, role)
  values (auth.uid(), 'admin')
  on conflict (user_id) do update set role = excluded.role;

  update public.admin_invitations
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invitation_id;

  return true;
end;
$$;

revoke all on function public.claim_admin_invitation() from public, anon;
grant execute on function public.claim_admin_invitation() to authenticated;

create or replace function public.list_admin_accounts()
returns table (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select role.user_id, account.email::text, profile.full_name, role.created_at
  from public.staff_roles role
  join auth.users account on account.id = role.user_id
  left join public.profiles profile on profile.id = role.user_id
  where role.role = 'admin'
  order by role.created_at;
end;
$$;

revoke all on function public.list_admin_accounts() from public, anon;
grant execute on function public.list_admin_accounts() to authenticated;
