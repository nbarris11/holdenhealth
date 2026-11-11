-- Keep existing bookings intact; new public bookings use the atomic function below.
alter table public.class_meetings
  add column drop_in_price_cents integer not null default 1000
  check (drop_in_price_cents between 0 and 100000);

alter table public.drop_in_bookings
  add column payment_method text check (payment_method in ('venmo', 'cash')),
  add column payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  add column price_cents integer check (price_cents between 0 and 100000),
  add column waiver_version text,
  add column waiver_text text,
  add column signed_name text,
  add column signed_at timestamptz,
  add column photo_release_text text,
  add column photo_consent boolean;

drop policy if exists "drop_in_bookings_public_insert" on public.drop_in_bookings;
revoke insert on public.drop_in_bookings from anon, authenticated;

drop index public.drop_in_bookings_meeting_email_idx;
create unique index drop_in_bookings_meeting_email_active_idx
  on public.drop_in_bookings (meeting_id, lower(email))
  where status in ('requested', 'confirmed');

create or replace function public.reserve_drop_in(
  p_meeting_id uuid, p_full_name text, p_email text, p_phone text,
  p_payment_method text, p_signed_name text, p_waiver_accepted boolean,
  p_waiver_version text, p_waiver_text text, p_photo_release_text text,
  p_photo_consent boolean, p_note text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  meeting record;
  booking_id uuid;
begin
  select id, drop_in_capacity, drop_in_price_cents into meeting
  from public.class_meetings
  where id = p_meeting_id and drop_in_enabled and not cancelled and starts_at > now()
  for update;
  if not found then raise exception 'class_unavailable'; end if;
  if meeting.drop_in_capacity < 1 or (
    select count(*) from public.drop_in_bookings
    where meeting_id = p_meeting_id and status in ('requested', 'confirmed')
  ) >= meeting.drop_in_capacity then raise exception 'class_full'; end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 or length(p_full_name) > 140
    or p_email is null or p_email <> lower(p_email) or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email) > 254
    or p_phone is null or length(trim(p_phone)) < 7 or length(p_phone) > 40
    or p_payment_method is null or p_payment_method not in ('venmo', 'cash')
    or p_waiver_accepted is distinct from true
    or p_signed_name is null or length(trim(p_signed_name)) < 2 or length(p_signed_name) > 140
    or p_waiver_version is null or p_waiver_text is null or p_photo_release_text is null
    or p_photo_consent is null or length(coalesce(p_note,'')) > 1000
  then raise exception 'invalid_booking'; end if;

  insert into public.drop_in_bookings (
    meeting_id, full_name, email, phone, note, status, payment_method,
    payment_status, price_cents, waiver_version, waiver_text, signed_name,
    signed_at, photo_release_text, photo_consent
  ) values (
    p_meeting_id, trim(p_full_name), p_email, trim(p_phone), nullif(trim(p_note),''),
    'confirmed', p_payment_method, 'pending', meeting.drop_in_price_cents,
    p_waiver_version, p_waiver_text, trim(p_signed_name), now(),
    p_photo_release_text, p_photo_consent
  ) returning id into booking_id;
  return booking_id;
end;
$$;

revoke all on function public.reserve_drop_in(uuid,text,text,text,text,text,boolean,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.reserve_drop_in(uuid,text,text,text,text,text,boolean,text,text,text,boolean,text) to service_role;
