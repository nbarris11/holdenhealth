-- Match signup choices to the actual non-cancelled class schedule, in Detroit time.
create or replace function private.program_attendance_allowed(p_session_id uuid, p_slots text[])
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(cardinality(p_slots), 0) > 0 and coalesce(p_slots <@ (
    select array_agg(distinct trim(to_char(starts_at at time zone 'America/Detroit', 'FMDay')) || ' ' || trim(to_char(starts_at at time zone 'America/Detroit', 'FMHH12:MI AM')))
    from public.class_meetings where session_id = p_session_id and not cancelled
  ), false);
$$;
revoke all on function private.program_attendance_allowed(uuid,text[]) from public, anon, authenticated;
grant execute on function private.program_attendance_allowed(uuid,text[]) to service_role;

-- reserve_checkout_order now checks live class times.
create or replace function public.reserve_checkout_order(
  p_session_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_weekly_commitment smallint,
  p_attendance_interest text[]
)
returns public.checkout_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  reserved_count integer;
  expected_amount integer;
  new_order public.checkout_orders%rowtype;
begin
  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if session_row.id is null or not session_row.published or session_row.status <> 'enrolling' then
    raise exception 'This session is not accepting online enrollment.';
  end if;

  if not private.program_attendance_allowed(p_session_id, p_attendance_interest) then
    raise exception 'Invalid attendance';
  end if;

  if p_weekly_commitment = 2 then
    expected_amount := session_row.two_day_price_cents;
  elsif p_weekly_commitment = 3 then
    expected_amount := session_row.three_day_price_cents;
  end if;

  if expected_amount is null then
    raise exception 'That plan is not available for this session.';
  end if;

  if exists (
    select 1 from public.checkout_orders
    where session_id = p_session_id and email = lower(trim(p_email))
      and status in ('reserved', 'payment_processing', 'paid')
  ) then
    raise exception 'An enrollment is already in progress for this email address.';
  end if;

  select
    (select count(*) from public.enrollments
      where session_id = p_session_id and status in ('invited', 'active'))
    +
    (select count(*) from public.member_invitations
      where session_id = p_session_id and claimed_at is null
        and enrollment_status in ('invited', 'active'))
    +
    (select count(*) from public.checkout_orders
      where session_id = p_session_id
        and (
          (status = 'reserved' and expires_at > now())
          or status = 'payment_processing'
        ))
  into reserved_count;

  if reserved_count >= session_row.capacity then
    raise exception 'This session is currently full.';
  end if;

  insert into public.checkout_orders (
    session_id, full_name, email, phone, weekly_commitment, attendance_interest,
    amount_cents, adult_confirmed, exercise_clearance_confirmed,
    health_clearance_confirmed, policies_confirmed, expires_at
  ) values (
    p_session_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone),
    p_weekly_commitment, p_attendance_interest, expected_amount,
    true, true, true, true, now() + interval '30 minutes'
  ) returning * into new_order;

  return new_order;
end;
$$;

-- reserve_offline_registration now checks live class times.
create or replace function public.reserve_offline_registration(
 p_session_id uuid, p_full_name text, p_email text, p_phone text,
 p_weekly_commitment smallint, p_attendance_interest text[], p_payment_method text, p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sessions%rowtype; n integer; result uuid;
begin
 select * into s from public.sessions where id=p_session_id for update;
 if s.id is null or not s.published or s.status<>'enrolling' or s.starts_on<=current_date then raise exception 'Session unavailable'; end if;
 if p_payment_method not in ('venmo','cash','check') or p_payment_method is null then raise exception 'Invalid payment method'; end if;
 if p_weekly_commitment not in (2,3) or p_weekly_commitment is null then raise exception 'Invalid plan'; end if;
 if (p_weekly_commitment=2 and s.two_day_price_cents is null) or (p_weekly_commitment=3 and s.three_day_price_cents is null) then raise exception 'Invalid plan'; end if;
 if length(trim(p_full_name))<2 or length(trim(p_phone))<7 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(cardinality(p_attendance_interest),0)=0 then raise exception 'Invalid details'; end if;
 if not private.program_attendance_allowed(p_session_id,p_attendance_interest) then raise exception 'Invalid attendance'; end if;
 if exists(select 1 from public.registration_requests where session_id=p_session_id and email=lower(trim(p_email)) and status in ('pending','approved'))
 or exists(select 1 from public.checkout_orders where session_id=p_session_id and email=lower(trim(p_email)) and (status in ('payment_processing','paid') or (status='reserved' and expires_at>now())))
 or exists(select 1 from public.member_invitations where session_id=p_session_id and email=lower(trim(p_email)) and enrollment_status in ('invited','active'))
 then raise exception 'An enrollment is already in progress'; end if;
 select
 (select count(*) from public.enrollments where session_id=p_session_id and status in ('invited','active')) +
 (select count(*) from public.member_invitations where session_id=p_session_id and claimed_at is null and enrollment_status in ('invited','active')) +
 (select count(*) from public.checkout_orders where session_id=p_session_id and ((status='reserved' and expires_at>now()) or status='payment_processing')) +
 (select count(*) from public.registration_requests where session_id=p_session_id and status='pending' and payment_method is not null)
 into n;
 if n>=s.capacity then raise exception 'Session full'; end if;
 insert into public.registration_requests(session_id,full_name,email,phone,weekly_commitment,attendance_interest,payment_method,note)
 values(p_session_id,trim(p_full_name),lower(trim(p_email)),trim(p_phone),p_weekly_commitment,p_attendance_interest,p_payment_method,left(p_note,1000)) returning id into result;
 return result;
end $$;

-- request_late_registration now checks live class times.
create or replace function public.request_late_registration(p_session_id uuid,p_full_name text,p_email text,p_phone text,p_weekly_commitment smallint,p_attendance_interest text[],p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sessions; result uuid;
begin
 select * into s from public.sessions where id=p_session_id for update;
 if s.id is null or not s.published or s.status not in ('enrolling','active') or s.starts_on>(now() at time zone 'America/Detroit')::date or s.ends_on<(now() at time zone 'America/Detroit')::date then raise exception 'Session unavailable'; end if;
 if p_weekly_commitment is null or p_weekly_commitment not in (2,3) or coalesce(length(trim(p_full_name)),0)<2 or coalesce(length(trim(p_phone)),0)<7 or p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(cardinality(p_attendance_interest),0)=0 or not private.program_attendance_allowed(p_session_id,p_attendance_interest) then raise exception 'Invalid details'; end if;
 if exists(select 1 from public.registration_requests where session_id=s.id and email=lower(trim(p_email)) and status in ('pending','approved'))
 or exists(select 1 from public.member_invitations where session_id=s.id and email=lower(trim(p_email)) and enrollment_status in ('invited','active','completed'))
 or exists(select 1 from public.checkout_orders where session_id=s.id and email=lower(trim(p_email)) and (status in ('paid','payment_processing') or (status='reserved' and expires_at>now())))
 then raise exception 'An enrollment is already in progress'; end if;
 insert into public.registration_requests(session_id,full_name,email,phone,weekly_commitment,attendance_interest,note)
 values(s.id,trim(p_full_name),lower(trim(p_email)),trim(p_phone),p_weekly_commitment,p_attendance_interest,left('Late join request. Price and space need coach approval. '||coalesce(p_note,''),1000)) returning id into result;
 return result;
end $$;

-- reserve_mini_checkout_order now checks live class times.
create or replace function public.reserve_mini_checkout_order(
  p_session_id uuid, p_full_name text, p_email text, p_phone text,
  p_attendance_interest text[], p_returning_member boolean
) returns public.checkout_orders language plpgsql security invoker set search_path = '' as $$
declare
  s public.sessions%rowtype;
  reserved_count integer;
  result public.checkout_orders%rowtype;
begin
  select * into s from public.sessions where id = p_session_id for update;
  if s.id is null or not s.published or s.status <> 'enrolling' or s.starts_on <= (now() at time zone 'America/Detroit')::date
    or s.two_day_price_cents is not null or s.three_day_price_cents is not null then
    raise exception 'Mini session unavailable';
  end if;
  if length(trim(p_full_name)) < 2 or length(trim(p_phone)) < 7
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or coalesce(cardinality(p_attendance_interest), 0) = 0
    or not private.program_attendance_allowed(p_session_id,p_attendance_interest) then
    raise exception 'Invalid mini session details';
  end if;
  if exists (select 1 from public.registration_requests where session_id = p_session_id and email = lower(trim(p_email)) and status in ('pending','approved'))
    or exists (select 1 from public.checkout_orders where session_id = p_session_id and email = lower(trim(p_email)) and (status in ('payment_processing','paid') or (status = 'reserved' and expires_at > now())))
    or exists (select 1 from public.member_invitations where session_id = p_session_id and email = lower(trim(p_email)) and enrollment_status in ('invited','active')) then
    raise exception 'An enrollment is already in progress';
  end if;
  select
    (select count(*) from public.enrollments where session_id = p_session_id and status in ('invited','active')) +
    (select count(*) from public.member_invitations where session_id = p_session_id and claimed_at is null and enrollment_status in ('invited','active')) +
    (select count(*) from public.checkout_orders where session_id = p_session_id and ((status = 'reserved' and expires_at > now()) or status = 'payment_processing')) +
    (select count(*) from public.registration_requests where session_id = p_session_id and status = 'pending' and payment_method is not null)
    into reserved_count;
  if reserved_count >= s.capacity then raise exception 'Session full'; end if;
  insert into public.checkout_orders (
    session_id, full_name, email, phone, weekly_commitment, attendance_interest,
    returning_member, plan_kind, amount_cents, adult_confirmed, exercise_clearance_confirmed,
    health_clearance_confirmed, policies_confirmed, expires_at
  ) values (
    p_session_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone), 3,
    p_attendance_interest, coalesce(p_returning_member, false), 'mini',
    case when coalesce(p_returning_member, false) then coalesce(s.returning_member_price_cents, s.new_member_price_cents) else s.new_member_price_cents end,
    true, true, true, true, now() + interval '30 minutes'
  ) returning * into result;
  return result;
end $$;

-- reserve_mini_offline_registration now checks live class times.
create or replace function public.reserve_mini_offline_registration(
  p_session_id uuid, p_full_name text, p_email text, p_phone text,
  p_attendance_interest text[], p_returning_member boolean,
  p_payment_method text, p_note text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  s public.sessions%rowtype;
  reserved_count integer;
  result uuid;
begin
  select * into s from public.sessions where id = p_session_id for update;
  if s.id is null or not s.published or s.status <> 'enrolling' or s.starts_on <= (now() at time zone 'America/Detroit')::date
    or s.two_day_price_cents is not null or s.three_day_price_cents is not null then
    raise exception 'Mini session unavailable';
  end if;
  if p_payment_method not in ('venmo','cash','check') or p_payment_method is null then raise exception 'Invalid payment method'; end if;
  if length(trim(p_full_name)) < 2 or length(trim(p_phone)) < 7
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or coalesce(cardinality(p_attendance_interest), 0) = 0
    or not private.program_attendance_allowed(p_session_id,p_attendance_interest) then
    raise exception 'Invalid mini session details';
  end if;
  if exists (select 1 from public.registration_requests where session_id = p_session_id and email = lower(trim(p_email)) and status in ('pending','approved'))
    or exists (select 1 from public.checkout_orders where session_id = p_session_id and email = lower(trim(p_email)) and (status in ('payment_processing','paid') or (status = 'reserved' and expires_at > now())))
    or exists (select 1 from public.member_invitations where session_id = p_session_id and email = lower(trim(p_email)) and enrollment_status in ('invited','active')) then
    raise exception 'An enrollment is already in progress';
  end if;
  select
    (select count(*) from public.enrollments where session_id = p_session_id and status in ('invited','active')) +
    (select count(*) from public.member_invitations where session_id = p_session_id and claimed_at is null and enrollment_status in ('invited','active')) +
    (select count(*) from public.checkout_orders where session_id = p_session_id and ((status = 'reserved' and expires_at > now()) or status = 'payment_processing')) +
    (select count(*) from public.registration_requests where session_id = p_session_id and status = 'pending' and payment_method is not null)
    into reserved_count;
  if reserved_count >= s.capacity then raise exception 'Session full'; end if;
  insert into public.registration_requests (
    session_id, full_name, email, phone, weekly_commitment, returning_member,
    attendance_interest, payment_method, note
  ) values (
    p_session_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone), 3,
    coalesce(p_returning_member, false), p_attendance_interest, p_payment_method,
    left(coalesce(p_note, ''), 1000)
  ) returning id into result;
  return result;
end $$;

