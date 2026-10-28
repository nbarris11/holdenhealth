-- Publish one extra time, including re-opening an existing closed slot.
-- Share the booking lock so a concurrent booking cannot be changed underneath us.
create function public.publish_consultation_slot(p_starts_at timestamptz)
returns text language plpgsql security invoker set search_path = '' as $$
declare existing public.consultation_slots%rowtype;
begin
  if not coalesce(private.is_admin(),false) then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_starts_at is null or p_starts_at <= now() then return 'time-in-past'; end if;
  perform pg_catalog.pg_advisory_xact_lock(731921,1);
  select * into existing from public.consultation_slots where starts_at=p_starts_at;
  if exists(select 1 from public.consultation_bookings b
    join public.consultation_slots s on s.id=b.slot_id
    where b.status='booked' and s.starts_at < p_starts_at + interval '60 minutes'
      and s.starts_at + make_interval(mins=>s.duration_minutes) > p_starts_at)
  then return 'slot-booked'; end if;
  if existing.id is not null then
    if existing.active then return 'time-exists'; end if;
    update public.consultation_slots set active=true,duration_minutes=60 where id=existing.id;
    return 'slot-reopened';
  end if;
  insert into public.consultation_slots(starts_at,duration_minutes,active,created_by)
    values(p_starts_at,60,true,auth.uid());
  return 'slot-created';
end;
$$;
revoke all on function public.publish_consultation_slot(timestamptz) from public,anon;
grant execute on function public.publish_consultation_slot(timestamptz) to authenticated;
