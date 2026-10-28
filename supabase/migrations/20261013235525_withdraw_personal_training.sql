alter table public.coaching_relationships drop constraint coaching_relationships_status_check;
alter table public.coaching_relationships add constraint coaching_relationships_status_check check (status in ('invited','active','paused','completed','withdrawn'));

-- One transaction ends coaching and removes upcoming appointments, retaining history and bills.
create function public.withdraw_personal_training(p_member_id uuid, p_relationship_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not coalesce(private.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 perform 1 from public.coaching_relationships where id=p_relationship_id and member_id=p_member_id for update;
 if not found then raise exception 'Coaching record not found'; end if;
 update public.coaching_relationships set status='withdrawn' where id=p_relationship_id;
 delete from public.personal_training_appointments where relationship_id=p_relationship_id
  and session_date >= (now() at time zone 'America/Detroit')::date;
end $$;
revoke all on function public.withdraw_personal_training(uuid,uuid) from public,anon;
grant execute on function public.withdraw_personal_training(uuid,uuid) to authenticated;
