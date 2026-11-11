-- A selection is one transaction: every class reserves successfully or none do.
create or replace function public.reserve_drop_ins(
  p_meeting_ids uuid[], p_full_name text, p_email text, p_phone text,
  p_payment_method text, p_signed_name text, p_waiver_accepted boolean,
  p_waiver_version text, p_waiver_text text, p_photo_release_text text,
  p_photo_consent boolean, p_note text default null
) returns uuid[] language plpgsql security invoker set search_path = '' as $$
declare
  meeting_id uuid;
  booking_ids uuid[] := '{}';
begin
  if p_meeting_ids is null or cardinality(p_meeting_ids) < 1 or cardinality(p_meeting_ids) > 80
    or array_position(p_meeting_ids, null) is not null
    or cardinality(p_meeting_ids) <> (select count(distinct id) from unnest(p_meeting_ids) as ids(id))
  then raise exception 'invalid_booking'; end if;

  -- Use a consistent lock order for overlapping selections.
  for meeting_id in select id from unnest(p_meeting_ids) as ids(id) order by id loop
    booking_ids := array_append(booking_ids, public.reserve_drop_in(
      meeting_id, p_full_name, p_email, p_phone, p_payment_method,
      p_signed_name, p_waiver_accepted, p_waiver_version, p_waiver_text,
      p_photo_release_text, p_photo_consent, p_note
    ));
  end loop;
  return booking_ids;
end;
$$;
revoke all on function public.reserve_drop_ins(uuid[],text,text,text,text,text,boolean,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.reserve_drop_ins(uuid[],text,text,text,text,text,boolean,text,text,text,boolean,text) to service_role;
