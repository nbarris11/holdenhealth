create or replace function private.claim_member_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_user_id uuid;
  invitation_row public.member_invitations%rowtype;
  claimed_enrollment_id uuid;
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
    session_id, member_id, status, returning_member, weekly_commitment, invited_at, joined_at
  ) values (
    invitation_row.session_id,
    matched_user_id,
    invitation_row.enrollment_status,
    invitation_row.returning_member,
    invitation_row.weekly_commitment,
    invitation_row.created_at,
    case when invitation_row.enrollment_status = 'active' then now() else null end
  )
  on conflict (session_id, member_id) do update set
    status = excluded.status,
    returning_member = excluded.returning_member,
    weekly_commitment = excluded.weekly_commitment,
    invited_at = coalesce(public.enrollments.invited_at, excluded.invited_at)
  returning id into claimed_enrollment_id;

  insert into public.payment_records (
    enrollment_id, status, method, amount_cents, received_on, recorded_by
  ) values (
    claimed_enrollment_id,
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
