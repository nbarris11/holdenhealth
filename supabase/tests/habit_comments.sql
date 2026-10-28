-- Synthetic fixtures only. Run as postgres; everything is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('73100000-0000-4000-8000-000000000001','qa-habit-comment-a@example.invalid','{"full_name":"TEST Comment A"}'),
 ('73100000-0000-4000-8000-000000000002','qa-habit-comment-b@example.invalid','{"full_name":"TEST Comment B"}'),
 ('73100000-0000-4000-8000-000000000003','qa-habit-comment-coach@example.invalid','{"full_name":"TEST Comment Coach"}'),
 ('73100000-0000-4000-8000-000000000004','qa-habit-comment-c@example.invalid','{"full_name":"TEST Comment C"}');
insert into public.staff_roles(user_id,role) values('73100000-0000-4000-8000-000000000003','admin');
insert into public.coaching_relationships(id,member_id,coach_id,service_mode,status,starts_on) values
 ('73200000-0000-4000-8000-000000000001','73100000-0000-4000-8000-000000000001','73100000-0000-4000-8000-000000000003','online','active',(now() at time zone 'America/Detroit')::date),
 ('73200000-0000-4000-8000-000000000002','73100000-0000-4000-8000-000000000002','73100000-0000-4000-8000-000000000003','online','active',(now() at time zone 'America/Detroit')::date);
insert into public.sessions(id,name,slug,address_line,starts_on,ends_on,capacity,new_member_price_cents,two_day_price_cents,three_day_price_cents,status,published)
values ('73400000-0000-4000-8000-000000000001','TEST Comment Session','qa-habit-comment-session','Test only',(now() at time zone 'America/Detroit')::date,(now() at time zone 'America/Detroit')::date+41,5,20000,20000,30000,'active',true);
insert into public.enrollments(id,session_id,member_id,status) values
 ('73500000-0000-4000-8000-000000000001','73400000-0000-4000-8000-000000000001','73100000-0000-4000-8000-000000000004','active');

set local role authenticated;
-- Members choose their own habit weeks.
select set_config('request.jwt.claim.sub','73100000-0000-4000-8000-000000000001',true);
insert into public.class_habit_weeks(id,relationship_id,week_number,habits) values('73600000-0000-4000-8000-000000000001','73200000-0000-4000-8000-000000000001',1,array['Walk daily','Drink water','Read daily']);
select set_config('request.jwt.claim.sub','73100000-0000-4000-8000-000000000004',true);
insert into public.class_habit_weeks(id,enrollment_id,week_number,habits) values('73600000-0000-4000-8000-000000000002','73500000-0000-4000-8000-000000000001',1,array['Stretch','Protein','Sleep']);

-- Coach starts threads; the stored habit text comes from the week, not the client.
select set_config('request.jwt.claim.sub','73100000-0000-4000-8000-000000000003',true);
insert into public.habit_comments(id,week_id,day,habit_index,habit_text,body) values
 ('73700000-0000-4000-8000-000000000001','73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,1,'spoofed','Great job on water!'),
 ('73700000-0000-4000-8000-000000000002','73600000-0000-4000-8000-000000000002',(now() at time zone 'America/Detroit')::date,0,'spoofed','Nice stretching.');
do $$ begin
 if (select habit_text from public.habit_comments where id='73700000-0000-4000-8000-000000000001')<>'Drink water' then raise exception 'habit_text not taken from the week'; end if;
 if (select author_id from public.habit_comments where id='73700000-0000-4000-8000-000000000001')<>'73100000-0000-4000-8000-000000000003' then raise exception 'author not set to caller'; end if;
 begin insert into public.habit_comments(week_id,day,habit_index,body) values('73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date+1,0,'Future'); raise exception 'Future day accepted'; exception when raise_exception then if sqlerrm='Future day accepted' then raise; end if; end;
 begin insert into public.habit_comments(week_id,day,habit_index,body) values('73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,3,'Bad index'); raise exception 'Bad index accepted'; exception when raise_exception then if sqlerrm='Bad index accepted' then raise; end if; end;
 begin insert into public.habit_comments(week_id,day,habit_index,body) values('73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,0,'   '); raise exception 'Blank body accepted'; exception when check_violation then null; end;
end $$;

-- Owner reads and replies; cannot start a new thread.
select set_config('request.jwt.claim.sub','73100000-0000-4000-8000-000000000001',true);
insert into public.habit_comments(id,week_id,day,habit_index,body) values
 ('73700000-0000-4000-8000-000000000003','73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,1,'Thanks Kelsey!');
do $$ begin
 if (select count(*) from public.habit_comments)<>2 then raise exception 'Owner should see exactly own thread (2 rows)'; end if;
 begin insert into public.habit_comments(week_id,day,habit_index,body) values('73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,0,'Starting my own thread'); raise exception 'Member started a thread'; exception when insufficient_privilege then null; end;
end $$;
select public.mark_habit_comments_read('73600000-0000-4000-8000-000000000001');
do $$ begin
 if (select member_read_at from public.habit_comments where id='73700000-0000-4000-8000-000000000001') is null then raise exception 'Coach comment not marked read'; end if;
 if (select member_read_at from public.habit_comments where id='73700000-0000-4000-8000-000000000003') is not null then raise exception 'Own reply marked read'; end if;
end $$;
-- Editing habits keeps the comment's original habit text.
update public.class_habit_weeks set habits=array['Walk daily','Eat vegetables','Read daily'] where id='73600000-0000-4000-8000-000000000001' and version=1;
do $$ begin
 if (select habit_text from public.habit_comments where id='73700000-0000-4000-8000-000000000001')<>'Drink water' then raise exception 'habit_text changed after habit edit'; end if;
end $$;

-- Another member sees nothing, cannot reply, and cannot mark read.
select set_config('request.jwt.claim.sub','73100000-0000-4000-8000-000000000002',true);
select public.mark_habit_comments_read('73600000-0000-4000-8000-000000000002');
do $$ begin
 if exists(select 1 from public.habit_comments) then raise exception 'Other member can read comments'; end if;
 begin insert into public.habit_comments(week_id,day,habit_index,body) values('73600000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,1,'Intruder'); raise exception 'Other member replied'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select member_read_at from public.habit_comments where id='73700000-0000-4000-8000-000000000002') is not null then raise exception 'Non-owner marked comments read'; end if;
 if (select count(*) from public.coach_activity where kind='habit_comment_reply' and member_id='73100000-0000-4000-8000-000000000001' and href='/admin/training/73100000-0000-4000-8000-000000000001/habits')<>1 then raise exception 'Reply activity missing'; end if;
 if exists(select 1 from public.coach_activity_deliveries d join public.coach_activity a on a.id=d.activity_id where a.kind='habit_comment_reply') then raise exception 'Reply created an email delivery'; end if;
end $$;

-- Group member replies route the coach to the program habits page.
set local role authenticated;
select set_config('request.jwt.claim.sub','73100000-0000-4000-8000-000000000004',true);
insert into public.habit_comments(week_id,day,habit_index,body) values('73600000-0000-4000-8000-000000000002',(now() at time zone 'America/Detroit')::date,0,'Thank you!');
reset role;
do $$ begin
 if (select count(*) from public.coach_activity where kind='habit_comment_reply' and href='/admin/programs/73400000-0000-4000-8000-000000000001/habits')<>1 then raise exception 'Group reply activity missing'; end if;
end $$;

set local role anon;
do $$ begin
 begin perform 1 from public.habit_comments; raise exception 'Anonymous access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: habit comments ownership, replies, read state, snapshots, activity and anonymous denial' as verification;
