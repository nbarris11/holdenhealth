-- Synthetic fixtures only. Execute inside BEGIN/ROLLBACK.
insert into auth.users(id,email,raw_user_meta_data) values
 ('71100000-0000-4000-8000-000000000001','qa-oct-coaching-a@example.invalid','{"full_name":"TEST Coaching A"}'),
 ('71100000-0000-4000-8000-000000000002','qa-oct-coaching-b@example.invalid','{"full_name":"TEST Coaching B"}'),
 ('71100000-0000-4000-8000-000000000003','qa-oct-coaching-coach@example.invalid','{"full_name":"TEST Coaching Coach"}');
insert into public.staff_roles(user_id,role) values('71100000-0000-4000-8000-000000000003','admin');
insert into public.coaching_relationships(id,member_id,coach_id,service_mode,status,starts_on) values
 ('71200000-0000-4000-8000-000000000001','71100000-0000-4000-8000-000000000001','71100000-0000-4000-8000-000000000003','online','active',(now() at time zone 'America/Detroit')::date),
 ('71200000-0000-4000-8000-000000000002','71100000-0000-4000-8000-000000000002','71100000-0000-4000-8000-000000000003','online','active',(now() at time zone 'America/Detroit')::date);
insert into public.sessions(id,name,slug,address_line,starts_on,ends_on,capacity,new_member_price_cents,two_day_price_cents,three_day_price_cents,status,published)
values ('71400000-0000-4000-8000-000000000001','TEST Late Join','qa-oct-late-join','Test only',(now() at time zone 'America/Detroit')::date,(now() at time zone 'America/Detroit')::date+41,1,20000,20000,30000,'active',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','71100000-0000-4000-8000-000000000003',true);
insert into public.coach_activity_preferences(user_id,email_habits,email_workouts) values('71100000-0000-4000-8000-000000000003',true,true);
insert into public.challenge_workouts(id,relationship_id,title,minutes,plan,publish_on,published) values
 ('71300000-0000-4000-8000-000000000001','71200000-0000-4000-8000-000000000001','TEST Structured PT',10,'Test plan',(now() at time zone 'America/Detroit')::date,true),
 ('71300000-0000-4000-8000-000000000002','71200000-0000-4000-8000-000000000001','TEST Draft PT',10,'Test plan',(now() at time zone 'America/Detroit')::date,false),
 ('71300000-0000-4000-8000-000000000003','71200000-0000-4000-8000-000000000001','TEST Future PT',10,'Test plan',(now() at time zone 'America/Detroit')::date+1,true);
select set_config('request.jwt.claim.sub','71100000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.challenge_workouts where relationship_id='71200000-0000-4000-8000-000000000001')<>1 then raise exception 'Draft/future visibility failed'; end if;
 begin insert into public.challenge_workout_logs(relationship_id,workout_id,status) values('71200000-0000-4000-8000-000000000002','71300000-0000-4000-8000-000000000001','completed'); raise exception 'Cross-member log allowed'; exception when insufficient_privilege then null; end;
end $$;
insert into public.challenge_workout_logs(id,relationship_id,workout_id,status) values('71500000-0000-4000-8000-000000000001','71200000-0000-4000-8000-000000000001','71300000-0000-4000-8000-000000000001','completed');
insert into public.class_habit_weeks(id,relationship_id,week_number,habits) values('71600000-0000-4000-8000-000000000001','71200000-0000-4000-8000-000000000001',1,array['Walk daily','Drink water','Read daily']);
select public.set_weekly_habit_mark('71600000-0000-4000-8000-000000000001',1,(now() at time zone 'America/Detroit')::date,0,true);
select public.set_weekly_habit_mark('71600000-0000-4000-8000-000000000001',1,(now() at time zone 'America/Detroit')::date,1,true);
update public.class_habit_weeks set habits=array['Stretch daily','Drink water','Read daily'] where id='71600000-0000-4000-8000-000000000001' and version=1;
do $$ begin
 if (select version from public.class_habit_weeks where id='71600000-0000-4000-8000-000000000001')<>2 then raise exception 'Habit version not incremented'; end if;
 if (select count(*) from public.class_habit_marks where week_id='71600000-0000-4000-8000-000000000001')<>1 then raise exception 'Changed mark was retained or unchanged lost'; end if;
 if not exists(select 1 from public.habit_week_revisions where week_id='71600000-0000-4000-8000-000000000001' and habits[1]='Walk daily' and jsonb_array_length(marks)=2) then raise exception 'Historical marks not preserved'; end if;
 begin perform public.set_weekly_habit_mark('71600000-0000-4000-8000-000000000001',1,(now() at time zone 'America/Detroit')::date,0,true); raise exception 'Stale version accepted'; exception when raise_exception then if sqlerrm='Stale version accepted' then raise; end if; end;
 if exists(select 1 from public.coach_activity) then raise exception 'Member can read coach activity'; end if;
 begin insert into public.coach_activity(member_id,kind,source_key,href) values('71100000-0000-4000-8000-000000000001','workout_completed','spoof','/admin'); raise exception 'Member forged activity'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','71100000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.class_habit_weeks where id='71600000-0000-4000-8000-000000000001') or exists(select 1 from public.habit_week_revisions where week_id='71600000-0000-4000-8000-000000000001') then raise exception 'Other member habits exposed'; end if;
 if exists(select 1 from public.challenge_workouts where relationship_id='71200000-0000-4000-8000-000000000001') then raise exception 'Other member workouts exposed'; end if;
 begin perform public.approve_priced_registration(gen_random_uuid(),100); raise exception 'Member approved a price'; exception when raise_exception then if sqlerrm='Member approved a price' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.coach_activity where member_id='71100000-0000-4000-8000-000000000001')<>3 then raise exception 'Activity triggers failed'; end if;
 if (select count(*) from public.coach_activity_deliveries where user_id='71100000-0000-4000-8000-000000000003')<>3 then raise exception 'Email queue failed'; end if;
end $$;
select public.request_late_registration('71400000-0000-4000-8000-000000000001','TEST Late Person','qa-oct-late@example.invalid','5555551212',2::smallint,array['Tuesday 6:00 AM'],'Test only');
set local role authenticated;
select set_config('request.jwt.claim.sub','71100000-0000-4000-8000-000000000003',true);
select public.approve_priced_registration(id,7500) from public.registration_requests where email='qa-oct-late@example.invalid';
select public.approve_priced_registration(id,7500) from public.registration_requests where email='qa-oct-late@example.invalid';
do $$ begin
 if not exists(select 1 from public.member_invitations where email='qa-oct-late@example.invalid' and amount_cents=7500 and payment_status='pending' and enrollment_status='invited') then raise exception 'Quote not preserved'; end if;
 begin perform public.approve_priced_registration((select id from public.registration_requests where email='qa-oct-late@example.invalid'),8000); raise exception 'Retry overwrote quote'; exception when raise_exception then if sqlerrm='Retry overwrote quote' then raise; end if; end;
end $$;
reset role;
select public.request_late_registration('71400000-0000-4000-8000-000000000001','TEST Second Person','qa-oct-late2@example.invalid','5555551213',2::smallint,array['Tuesday 6:00 AM'],'Test only');
set local role authenticated;
select set_config('request.jwt.claim.sub','71100000-0000-4000-8000-000000000003',true);
do $$ begin
 begin perform public.approve_priced_registration((select id from public.registration_requests where email='qa-oct-late2@example.invalid'),7500); raise exception 'Capacity exceeded'; exception when raise_exception then if sqlerrm='Capacity exceeded' then raise; end if; end;
end $$;
reset role;
update public.coaching_relationships set status='paused' where id='71200000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','71100000-0000-4000-8000-000000000001',true);
do $$ begin
 begin insert into public.challenge_workout_logs(relationship_id,workout_id,status) values('71200000-0000-4000-8000-000000000001','71300000-0000-4000-8000-000000000001','completed'); raise exception 'Paused client logged'; exception when insufficient_privilege then null; end;
 update public.class_habit_weeks set habits=array['New habit','Drink water','Read daily'] where id='71600000-0000-4000-8000-000000000001';
 if found then raise exception 'Paused client edited habits'; end if;
end $$;
reset role;
select 'October coaching, habit history, notifications, priced approval checks passed' as result;
