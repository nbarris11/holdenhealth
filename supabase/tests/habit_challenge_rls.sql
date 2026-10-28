-- Run as postgres. Everything, including fixture accounts, is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000a01','challenge-test-a@example.invalid','{}'),
 ('00000000-0000-4000-8000-000000000a02','challenge-test-b@example.invalid','{}');
insert into public.habit_challenges(id,title,starts_on,ends_on,published,signup_open) values
 ('00000000-0000-4000-8000-000000000c01','RLS test',(now() at time zone 'America/Detroit')::date-6,(now() at time zone 'America/Detroit')::date+14,true,true),
 ('00000000-0000-4000-8000-000000000c02','Draft test',(now() at time zone 'America/Detroit')::date,(now() at time zone 'America/Detroit')::date+20,false,false);
insert into public.challenge_workouts(challenge_id,title,minutes,plan,publish_on,published) values
 ('00000000-0000-4000-8000-000000000c01','Published test',15,'Test plan',(now() at time zone 'America/Detroit')::date,true),
 ('00000000-0000-4000-8000-000000000c01','Future test',15,'Test plan',(now() at time zone 'America/Detroit')::date+1,true),
 ('00000000-0000-4000-8000-000000000c01','Draft test',15,'Test plan',(now() at time zone 'America/Detroit')::date,false);
set local role anon;
do $$ begin
 if exists(select 1 from public.habit_challenges where id='00000000-0000-4000-8000-000000000c02') then raise exception 'Draft exposed'; end if;
 begin perform 1 from public.challenge_participants; raise exception 'Anonymous participant access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a01',true);
insert into public.challenge_participants(id,challenge_id,user_id,display_name,goals,weekly_workouts) values
 ('00000000-0000-4000-8000-000000000b01','00000000-0000-4000-8000-000000000c01','00000000-0000-4000-8000-000000000a01','Test A',array['Walk','Sleep','Protein'],3);
insert into public.challenge_checkmarks(participant_id,day,goal_index,completed) values
 ('00000000-0000-4000-8000-000000000b01',(now() at time zone 'America/Detroit')::date,0,true);
do $$ begin
 if (select count(*) from public.challenge_workouts where challenge_id='00000000-0000-4000-8000-000000000c01')<>1 then raise exception 'Workout publication leak'; end if;
 if exists(select 1 from public.enrollments) or exists(select 1 from public.member_intakes) or exists(select 1 from public.coaching_relationships) then raise exception 'Paid data leak'; end if;
 begin
 insert into public.challenge_checkmarks values('00000000-0000-4000-8000-000000000b01',(now() at time zone 'America/Detroit')::date-1,0,true);
 raise exception 'Pre-join checkmark accepted'; exception when insufficient_privilege then null; end;
 begin
 insert into public.challenge_checkmarks values('00000000-0000-4000-8000-000000000b01',(now() at time zone 'America/Detroit')::date+1,0,true);
 raise exception 'Future checkmark accepted'; exception when insufficient_privilege then null; end;
 begin
 update public.challenge_participants set goals=array['Changed','Sleep','Protein'] where id='00000000-0000-4000-8000-000000000b01';
 raise exception 'Snapshot changed'; exception when insufficient_privilege then null; end;
 begin
 insert into public.challenge_participants(challenge_id,user_id,display_name,goals,weekly_workouts) values('00000000-0000-4000-8000-000000000c01','00000000-0000-4000-8000-000000000a02','Spoof',array['Walk','Sleep','Protein'],3);
 raise exception 'Other-user enrollment allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a02',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.challenge_participants) or exists(select 1 from public.challenge_checkmarks) then raise exception 'Other-user data exposed'; end if;
 if exists(select 1 from public.challenge_workouts where challenge_id='00000000-0000-4000-8000-000000000c01') then raise exception 'Nonparticipant workout access'; end if;
 update public.challenge_checkmarks set completed=false where participant_id='00000000-0000-4000-8000-000000000b01';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'Other-user write allowed'; end if;
 begin
 insert into public.challenge_participants(challenge_id,user_id,display_name,goals,weekly_workouts) values('00000000-0000-4000-8000-000000000c02','00000000-0000-4000-8000-000000000a02','Test B',array['Walk','Sleep','Protein'],3);
 raise exception 'Draft join accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Validate snapshots, locked dates, and normal undo as well as insert.
do $$ begin
 begin
 insert into public.challenge_participants(challenge_id,user_id,display_name,goals,weekly_workouts) values('00000000-0000-4000-8000-000000000c01','00000000-0000-4000-8000-000000000a02','Test B',array['Walk','walk','Protein'],3);
 raise exception 'Duplicate habits accepted'; exception when raise_exception then if sqlerrm='Duplicate habits accepted' then raise; end if; end;
 begin
 update public.habit_challenges set starts_on=starts_on+1,ends_on=ends_on+1 where id='00000000-0000-4000-8000-000000000c01';
 raise exception 'Dates changed after joining'; exception when raise_exception then if sqlerrm='Dates changed after joining' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a01',true);
update public.challenge_checkmarks set completed=false where participant_id='00000000-0000-4000-8000-000000000b01';
do $$ begin if not exists(select 1 from public.challenge_checkmarks where participant_id='00000000-0000-4000-8000-000000000b01' and not completed) then raise exception 'Undo failed'; end if; end $$;
reset role;
rollback;
select 'PASS: anonymous access, ownership, paid separation, signup, late join, future dates, snapshots, published workouts and undo' as verification;
