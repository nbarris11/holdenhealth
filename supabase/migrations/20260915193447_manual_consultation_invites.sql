alter table public.consultation_bookings
  add column manually_created boolean not null default false,
  add column visitor_invite_sent_at timestamptz,
  add column coach_invite_sent_at timestamptz;

-- Reserve and hide the time in one transaction. Existing public slots retain
-- their visibility; a newly created private time stays private after cancellation.
create function public.book_manual_consultation(
  p_booking_id uuid, p_starts_at timestamptz, p_full_name text, p_email text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  slot_id_value uuid;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_starts_at is null or p_starts_at <= now()
     or p_full_name is null or char_length(trim(p_full_name)) not between 2 and 140
     or p_email is null or char_length(p_email) > 254
     or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid appointment details' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(731921, 1);
  -- A repeated request must never create a second meeting or email sequence.
  if exists(select 1 from public.consultation_bookings where id = p_booking_id) then
    raise exception 'Appointment already submitted' using errcode = '23505';
  end if;
  select id into slot_id_value from public.consultation_slots where starts_at = p_starts_at;
  if slot_id_value is null then
    insert into public.consultation_slots(starts_at, duration_minutes, created_by, active)
      values(p_starts_at, 60, auth.uid(), true) returning id into slot_id_value;
    insert into public.consultation_bookings(id,slot_id,full_name,email,manually_created)
      values(p_booking_id,slot_id_value,trim(p_full_name),lower(trim(p_email)),true);
    update public.consultation_slots set active = false where id = slot_id_value;
  else
    -- The booking trigger checks the same conflict rules as public bookings.
    -- Temporarily activate closed availability only inside this transaction.
    declare was_active boolean;
    begin
      select active into was_active from public.consultation_slots where id=slot_id_value;
      if exists(select 1 from public.consultation_bookings where slot_id=slot_id_value and status='booked') then
        raise exception 'This time is already booked' using errcode='23505';
      end if;
      update public.consultation_slots set active=true, duration_minutes=60 where id=slot_id_value;
      insert into public.consultation_bookings(id,slot_id,full_name,email,manually_created)
        values(p_booking_id,slot_id_value,trim(p_full_name),lower(trim(p_email)),true);
      update public.consultation_slots set active=was_active where id=slot_id_value;
    end;
  end if;
  return p_booking_id;
end;
$$;
revoke all on function public.book_manual_consultation(uuid,timestamptz,text,text) from public,anon;
grant execute on function public.book_manual_consultation(uuid,timestamptz,text,text) to authenticated;
