-- Prevent synthetic member activity from emailing real staff.
create or replace function private.record_coach_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare member uuid; event_kind text; destination text; source text; event_id uuid; legacy public.workout_logs;
begin
 if tg_table_name='class_habit_weeks' then
  if tg_op='UPDATE' and new.habits is not distinct from old.habits then return new; end if;
  if new.relationship_id is not null then select member_id into member from public.coaching_relationships where id=new.relationship_id;
   destination:='/admin/training/'||member||'/habits';
  else select member_id into member from public.enrollments where id=new.enrollment_id; destination:='/admin/people/'||member; end if;
  event_kind:=case when tg_op='INSERT' then 'habits_chosen' else 'habits_edited' end;
  source:='habits:'||new.id||':'||new.version;
 elsif tg_table_name='scheduled_workouts' then
  if new.status<>'completed' or old.status='completed' then return new; end if;
  select * into legacy from public.workout_logs where workout_id=new.id;
  if legacy.id is null then return new; end if;
  member:=legacy.member_id; event_kind:='workout_completed'; source:='legacy-workout:'||legacy.id; destination:='/admin/training/'||member||'#progress';
 else
  if new.status<>'completed' then return new; end if;
  if new.relationship_id is not null then select member_id into member from public.coaching_relationships where id=new.relationship_id; destination:='/admin/training/workouts/'||new.relationship_id;
  elsif new.enrollment_id is not null then select member_id into member from public.enrollments where id=new.enrollment_id; destination:='/admin/people/'||member;
  else select user_id into member from public.challenge_participants where id=new.participant_id; destination:='/admin/people/'||member; end if;
  event_kind:='workout_completed'; source:='workout:'||new.id;
 end if;
 if member is null then return new; end if;
 insert into public.coach_activity(member_id,kind,source_key,href) values(member,event_kind,source,destination) on conflict(source_key) do nothing returning id into event_id;
 if event_id is not null then
  insert into public.coach_activity_deliveries(activity_id,user_id)
  select event_id,p.user_id from public.coach_activity_preferences p join public.staff_roles r on r.user_id=p.user_id and r.role='admin'
  where ((event_kind='workout_completed' and p.email_workouts) or (event_kind<>'workout_completed' and p.email_habits))
  and (not coalesce((select is_test from public.member_contacts where user_id=member),false)
    or coalesce((select is_test from public.member_contacts where user_id=p.user_id),false))
  on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.record_coach_activity() from public,anon,authenticated;

-- Test member activity remains visible only to test staff.
alter policy coach_activity_read on public.coach_activity using (
 (select private.is_admin()) and (
  not coalesce((select c.is_test from public.member_contacts c where c.user_id=member_id),false)
  or coalesce((select c.is_test from public.member_contacts c where c.user_id=(select auth.uid())),false)
 )
);
