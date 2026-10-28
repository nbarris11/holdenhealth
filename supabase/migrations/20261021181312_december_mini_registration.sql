-- Mini sessions use one all-classes package, priced by prior paid membership.
-- Keep the existing two-/three-day checkout and reservation functions intact.
alter table public.checkout_orders
  add column returning_member boolean not null default false,
  add column plan_kind text not null default 'weekly' check (plan_kind in ('weekly','mini'));

create function public.reserve_mini_checkout_order(
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
    or not p_attendance_interest <@ array['Tuesday 6:00 AM','Wednesday 7:00 PM','Saturday 9:00 AM']::text[] then
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

revoke all on function public.reserve_mini_checkout_order(uuid,text,text,text,text[],boolean) from public, anon, authenticated;
grant execute on function public.reserve_mini_checkout_order(uuid,text,text,text,text[],boolean) to service_role;

create function public.reserve_mini_offline_registration(
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
    or not p_attendance_interest <@ array['Tuesday 6:00 AM','Wednesday 7:00 PM','Saturday 9:00 AM']::text[] then
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

revoke all on function public.reserve_mini_offline_registration(uuid,text,text,text,text[],boolean,text,text) from public, anon, authenticated;
grant execute on function public.reserve_mini_offline_registration(uuid,text,text,text,text[],boolean,text,text) to service_role;
