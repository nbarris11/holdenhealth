-- An authenticated server action checks ownership before invoking this service-only transaction.
alter table public.week_resets drop constraint week_resets_remaining_sessions_check;
alter table public.week_resets add constraint week_resets_remaining_sessions_check check (remaining_sessions between 0 and 3);

create function public.reset_member_week(p_member_id uuid, p_relationship_id uuid, p_reset_id uuid, p_remaining integer, p_energy text, p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Detroit')::date;
  v_end date;
  v_workout record;
  v_index integer := 0;
begin
  if p_remaining is null or p_remaining not between 0 and 3 or p_energy is null or p_energy not in ('low','steady','good') or p_reset_id is null or length(coalesce(p_note,'')) > 1000 then
    raise exception 'Invalid reset details';
  end if;
  perform 1 from public.coaching_relationships where id=p_relationship_id and member_id=p_member_id and status='active' for update;
  if not found then raise exception 'Personal training is not active for this account'; end if;
  if exists (select 1 from public.week_resets where id=p_reset_id and member_id=p_member_id and relationship_id=p_relationship_id) then return; end if;
  v_end := v_today + ((7 - extract(dow from v_today)::integer) % 7);
  insert into public.week_resets(id, relationship_id, member_id, reset_on, remaining_sessions, energy, member_note)
  values(p_reset_id,p_relationship_id,p_member_id,v_today,p_remaining,p_energy,nullif(btrim(p_note),''));
  -- Include unfinished earlier sessions so they cannot silently survive a zero-day reset.
  for v_workout in select id from public.scheduled_workouts where relationship_id=p_relationship_id and status='scheduled' and scheduled_for<=v_end order by scheduled_for,id for update loop
    update public.scheduled_workouts set
      status=case when v_index<p_remaining then 'scheduled' else 'deferred' end,
      recommended_option=case p_energy when 'low' then 'C' when 'steady' then 'B' else 'A' end,
      deferred_reason=case when v_index<p_remaining then null else 'Set aside during your weekly reset. The plan remains available to read; ask Kelsey before adding it back to your schedule.' end
    where id=v_workout.id;
    v_index := v_index+1;
  end loop;
end;
$$;
revoke all on function public.reset_member_week(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.reset_member_week(uuid,uuid,uuid,integer,text,text) to service_role;
