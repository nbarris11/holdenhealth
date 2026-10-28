-- Run inside a transaction; all fixtures are rolled back.
insert into auth.users(id, email, raw_user_meta_data) values
 ('70100000-0000-4000-8000-000000000001', 'class-workout-qa-a@example.invalid', '{"full_name":"TEST Class Workout A"}'),
 ('70100000-0000-4000-8000-000000000002', 'class-workout-qa-b@example.invalid', '{"full_name":"TEST Class Workout B"}'),
 ('70100000-0000-4000-8000-000000000003', 'class-workout-qa-coach@example.invalid', '{"full_name":"TEST Class Workout Coach"}');
insert into public.staff_roles(user_id,role) values ('70100000-0000-4000-8000-000000000003','admin');
insert into public.sessions(id,name,slug,address_line,starts_on,ends_on,capacity,new_member_price_cents,status,published)
select id::uuid, 'TEST Class Workouts', slug, 'Test only', (now() at time zone 'America/Detroit')::date,
 (now() at time zone 'America/Detroit')::date+41, 10, 0, 'active', true
from (values ('70200000-0000-4000-8000-000000000001','qa-class-workouts-a'),('70200000-0000-4000-8000-000000000002','qa-class-workouts-b')) x(id,slug);
insert into public.enrollments(id,session_id,member_id,status) values
 ('70300000-0000-4000-8000-000000000001','70200000-0000-4000-8000-000000000001','70100000-0000-4000-8000-000000000001','invited'),
 ('70300000-0000-4000-8000-000000000002','70200000-0000-4000-8000-000000000002','70100000-0000-4000-8000-000000000002','active');
set local role authenticated;
select set_config('request.jwt.claim.sub','70100000-0000-4000-8000-000000000003',true);
insert into public.challenge_workouts(id,session_id,title,minutes,plan,publish_on,published)
select id::uuid, session_id::uuid, title, 10, 'Test plan', (now() at time zone 'America/Detroit')::date+days, published
from (values
 ('70400000-0000-4000-8000-000000000001','70200000-0000-4000-8000-000000000001','Released',0,true),
 ('70400000-0000-4000-8000-000000000002','70200000-0000-4000-8000-000000000001','Draft',0,false),
 ('70400000-0000-4000-8000-000000000003','70200000-0000-4000-8000-000000000001','Future',1,true),
 ('70400000-0000-4000-8000-000000000004','70200000-0000-4000-8000-000000000002','Other program',0,true)
) x(id,session_id,title,days,published);
do $$ begin
 if (select count(*) from public.challenge_workouts where session_id::text like '70200000-%') <> 4 then raise exception 'Admin preview failed'; end if;
 begin
  update public.challenge_workouts set publish_on=(now() at time zone 'America/Detroit')::date+42 where id='70400000-0000-4000-8000-000000000001';
  raise exception 'Invalid release accepted';
 exception when raise_exception then if sqlerrm = 'Invalid release accepted' then raise; end if; end;
 begin
  update public.challenge_workouts set session_id='70200000-0000-4000-8000-000000000002' where id='70400000-0000-4000-8000-000000000001';
  raise exception 'Reassignment accepted';
 exception when raise_exception then if sqlerrm = 'Reassignment accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','70100000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.challenge_workouts where session_id::text like '70200000-%') <> 1 then raise exception 'Draft, future or other program exposed'; end if;
 begin
  insert into public.challenge_workouts(session_id,title,minutes,plan,publish_on) values ('70200000-0000-4000-8000-000000000001','Unauthorized',10,'Test',current_date);
  raise exception 'Member created workout';
 exception when insufficient_privilege then null; end;
 update public.challenge_workouts set title='Unauthorized' where id='70400000-0000-4000-8000-000000000001';
 if found then raise exception 'Member edited workout'; end if;
end $$;
insert into public.challenge_workout_logs(id,enrollment_id,workout_id,status,workout_title,workout_revision,performed_on)
values ('70500000-0000-4000-8000-000000000001','70300000-0000-4000-8000-000000000001','70400000-0000-4000-8000-000000000001','completed','Tampered',999,'2000-01-01');
do $$ begin
 if not exists(select 1 from public.challenge_workout_logs where id='70500000-0000-4000-8000-000000000001' and workout_title='Released' and workout_revision=1 and performed_on=(now() at time zone 'America/Detroit')::date) then raise exception 'Snapshot not trusted'; end if;
 begin
  insert into public.challenge_workout_logs(id,enrollment_id,workout_id,status) values (gen_random_uuid(),'70300000-0000-4000-8000-000000000001','70400000-0000-4000-8000-000000000004','completed');
  raise exception 'Cross-program log accepted';
 exception when insufficient_privilege or raise_exception then if sqlerrm = 'Cross-program log accepted' then raise; end if; end;
 begin
  insert into public.challenge_workout_logs(id,enrollment_id,workout_id,status) values (gen_random_uuid(),'70300000-0000-4000-8000-000000000002','70400000-0000-4000-8000-000000000001','completed');
  raise exception 'Cross-member log accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','70100000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.challenge_workout_logs where id='70500000-0000-4000-8000-000000000001') then raise exception 'Other member history exposed'; end if;
end $$;
reset role;
update public.enrollments set status='withdrawn' where id='70300000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','70100000-0000-4000-8000-000000000001',true);
do $$ begin
 if exists(select 1 from public.challenge_workouts where session_id='70200000-0000-4000-8000-000000000001') then raise exception 'Withdrawn member has access'; end if;
 if not exists(select 1 from public.challenge_workout_logs where id='70500000-0000-4000-8000-000000000001') then raise exception 'Own history disappeared'; end if;
end $$;
reset role;
update public.enrollments set status='completed' where id='70300000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.challenge_workouts where id='70400000-0000-4000-8000-000000000001') then raise exception 'Completed member cannot revisit'; end if;
 begin
  insert into public.challenge_workout_logs(id,enrollment_id,workout_id,status) values(gen_random_uuid(),'70300000-0000-4000-8000-000000000001','70400000-0000-4000-8000-000000000001','partial');
  raise exception 'Completed enrollment saved new log';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.enrollments set status='active' where id='70300000-0000-4000-8000-000000000001';
update public.sessions set published=false where id='70200000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.challenge_workouts where session_id='70200000-0000-4000-8000-000000000001') then raise exception 'Hidden parent exposed'; end if;
end $$;
reset role;
select 'class program workout access checks passed' as result;
