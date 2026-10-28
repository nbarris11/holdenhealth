-- Offline reservations remain pending and count toward session capacity. No payment is recorded.
alter table public.registration_requests add column payment_method text
  check (payment_method in ('venmo','cash','check'));
alter policy registration_requests_public_insert on public.registration_requests
  with check (status='pending' and reviewed_by is null and reviewed_at is null and payment_method is null);

CREATE OR REPLACE FUNCTION public.reserve_checkout_order(p_session_id uuid, p_full_name text, p_email text, p_phone text, p_weekly_commitment smallint, p_attendance_interest text[])
 RETURNS checkout_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if exists (select 1 from public.registration_requests where session_id=p_session_id and email=lower(trim(p_email)) and status='pending' and payment_method is not null) then
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
    + (select count(*) from public.registration_requests where session_id=p_session_id and status='pending' and payment_method is not null)
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
$function$;

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
 if not p_attendance_interest <@ array['Tuesday 6:00 AM','Wednesday 7:00 PM','Saturday 7:30 AM','Saturday 9:00 AM']::text[] then raise exception 'Invalid attendance'; end if;
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
revoke all on function public.reserve_offline_registration(uuid,text,text,text,smallint,text[],text,text) from public,anon,authenticated;
grant execute on function public.reserve_offline_registration(uuid,text,text,text,smallint,text[],text,text) to service_role;
