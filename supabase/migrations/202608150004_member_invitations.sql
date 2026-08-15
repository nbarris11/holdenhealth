-- Admin-created invitations connect a confirmed signup to Auth and the correct session.

create table public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  full_name text not null,
  phone text,
  session_id uuid not null references public.sessions(id) on delete cascade,
  enrollment_status public.enrollment_status not null default 'invited',
  returning_member boolean not null default false,
  payment_status public.payment_status not null default 'pending',
  payment_method public.payment_method,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  invited_by uuid not null references auth.users(id),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, email)
);

create index member_invitations_email_idx on public.member_invitations(email);
create index member_invitations_session_idx on public.member_invitations(session_id);

create trigger member_invitations_set_updated_at before update on public.member_invitations
for each row execute function public.set_updated_at();

alter table public.member_invitations enable row level security;

create policy "member_invitations_admin_select" on public.member_invitations for select to authenticated
using ((select private.is_admin()));
create policy "member_invitations_admin_insert" on public.member_invitations for insert to authenticated
with check ((select private.is_admin()) and invited_by = (select auth.uid()));
create policy "member_invitations_admin_update" on public.member_invitations for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "member_invitations_admin_delete" on public.member_invitations for delete to authenticated
using ((select private.is_admin()));

grant select, insert, update, delete on public.member_invitations to authenticated;

create or replace function private.claim_member_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_user_id uuid;
  invitation_row public.member_invitations%rowtype;
  enrollment_id uuid;
begin
  if tg_table_name = 'member_invitations' then
    invitation_row := new;
    select id into matched_user_id
    from auth.users
    where lower(email) = invitation_row.email
    limit 1;
  else
    matched_user_id := new.id;
    select i.* into invitation_row
    from public.member_invitations i
    join auth.users u on u.id = matched_user_id
    where i.email = lower(u.email)
      and i.claimed_at is null
    order by i.created_at
    limit 1;
  end if;

  if matched_user_id is null or invitation_row.id is null then
    return new;
  end if;

  update public.profiles
  set full_name = case when full_name = '' then invitation_row.full_name else full_name end,
      phone = coalesce(phone, invitation_row.phone)
  where id = matched_user_id;

  insert into public.enrollments (
    session_id, member_id, status, returning_member, invited_at, joined_at
  ) values (
    invitation_row.session_id,
    matched_user_id,
    invitation_row.enrollment_status,
    invitation_row.returning_member,
    invitation_row.created_at,
    case when invitation_row.enrollment_status = 'active' then now() else null end
  )
  on conflict (session_id, member_id) do update set
    status = excluded.status,
    returning_member = excluded.returning_member,
    invited_at = coalesce(public.enrollments.invited_at, excluded.invited_at)
  returning id into enrollment_id;

  insert into public.payment_records (
    enrollment_id, status, method, amount_cents, received_on, recorded_by
  ) values (
    enrollment_id,
    invitation_row.payment_status,
    invitation_row.payment_method,
    invitation_row.amount_cents,
    case when invitation_row.payment_status = 'paid' then current_date else null end,
    invitation_row.invited_by
  )
  on conflict (enrollment_id) do update set
    status = excluded.status,
    method = excluded.method,
    amount_cents = excluded.amount_cents,
    received_on = excluded.received_on,
    recorded_by = excluded.recorded_by;

  update public.member_invitations
  set claimed_by = matched_user_id, claimed_at = coalesce(claimed_at, now())
  where id = invitation_row.id;

  return new;
end;
$$;

revoke all on function private.claim_member_invitation() from public, anon, authenticated;

create trigger claim_existing_member_invitation
after insert or update of email, session_id, enrollment_status, payment_status, payment_method, amount_cents
on public.member_invitations
for each row execute function private.claim_member_invitation();

create trigger claim_new_profile_invitation
after insert on public.profiles
for each row execute function private.claim_member_invitation();
