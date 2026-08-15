alter table public.sessions
  add column if not exists two_day_price_cents integer check (two_day_price_cents >= 0),
  add column if not exists three_day_price_cents integer check (three_day_price_cents >= 0);

alter table public.registration_requests
  add column if not exists weekly_commitment smallint check (weekly_commitment in (2, 3));

alter table public.member_invitations
  add column if not exists weekly_commitment smallint check (weekly_commitment in (2, 3));

alter table public.enrollments
  add column if not exists weekly_commitment smallint check (weekly_commitment in (2, 3));

insert into public.sessions (
  name, slug, description, location_name, address_line, city, state,
  starts_on, ends_on, capacity, new_member_price_cents,
  returning_member_price_cents, two_day_price_cents,
  three_day_price_cents, status, published
) values (
  'Focus on You: First 6-Week Session',
  'focus-on-you-october-2026',
  'Six weeks of in-person total-body conditioning, nutrition habits, check-ins, and accountability. Choose two or three coached classes each week.',
  'Moore Performance Health',
  '41100 Plymouth Rd., Suite B1-162',
  'Plymouth',
  'MI',
  '2026-10-14',
  '2026-11-21',
  25,
  19900,
  24900,
  19900,
  24900,
  'enrolling',
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  location_name = excluded.location_name,
  address_line = excluded.address_line,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  capacity = excluded.capacity,
  new_member_price_cents = excluded.new_member_price_cents,
  returning_member_price_cents = excluded.returning_member_price_cents,
  two_day_price_cents = excluded.two_day_price_cents,
  three_day_price_cents = excluded.three_day_price_cents,
  status = excluded.status,
  published = excluded.published;

with october_session as (
  select id from public.sessions where slug = 'focus-on-you-october-2026'
), meeting_days as (
  select day::date as meeting_date, extract(isodow from day)::integer as weekday
  from generate_series('2026-10-14'::date, '2026-11-21'::date, interval '1 day') day
  where extract(isodow from day) in (2, 3, 6)
), meeting_times as (
  select
    meeting_date,
    case weekday
      when 2 then time '06:00'
      when 3 then time '19:00'
      when 6 then time '09:00'
    end as meeting_time
  from meeting_days
)
insert into public.class_meetings (session_id, starts_at, ends_at, title, notes)
select
  october_session.id,
  (meeting_date + meeting_time) at time zone 'America/Detroit',
  ((meeting_date + meeting_time) at time zone 'America/Detroit') + interval '1 hour',
  'Total-body conditioning',
  'All equipment is provided.'
from october_session cross join meeting_times
where not exists (
  select 1 from public.class_meetings existing
  where existing.session_id = october_session.id
    and existing.starts_at = (meeting_date + meeting_time) at time zone 'America/Detroit'
);

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

drop trigger if exists claim_existing_member_invitation on public.member_invitations;
create trigger claim_existing_member_invitation
after insert or update of email, session_id, enrollment_status, weekly_commitment, payment_status, payment_method, amount_cents
on public.member_invitations
for each row execute function private.claim_member_invitation();
