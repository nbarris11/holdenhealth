begin;
-- Test-only identities live for this transaction and are rolled back.
select set_config('test.story.member', gen_random_uuid()::text, true);
select set_config('test.story.other', gen_random_uuid()::text, true);
select set_config('test.story.coach', gen_random_uuid()::text, true);
insert into auth.users(id,email,raw_user_meta_data) select current_setting('test.story.member')::uuid,'story-member-'||gen_random_uuid()||'@example.invalid','{"full_name":"TEST Story member"}'::jsonb;
insert into auth.users(id,email,raw_user_meta_data) select current_setting('test.story.other')::uuid,'story-other-'||gen_random_uuid()||'@example.invalid','{"full_name":"TEST Other member"}'::jsonb;
insert into auth.users(id,email,raw_user_meta_data) select current_setting('test.story.coach')::uuid,'story-coach-'||gen_random_uuid()||'@example.invalid','{"full_name":"TEST Story coach"}'::jsonb;
insert into public.profiles(id,full_name) values(current_setting('test.story.member')::uuid,'TEST Story member'),(current_setting('test.story.other')::uuid,'TEST Other member'),(current_setting('test.story.coach')::uuid,'TEST Story coach') on conflict(id) do nothing;
insert into public.staff_roles(user_id,role) values(current_setting('test.story.coach')::uuid,'admin');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.member'),'role','authenticated')::text,true);
insert into public.member_story_goals(member_id,goal,created_at) values(auth.uid(),'TEST I want to enjoy hiking.','2000-01-01');
insert into public.member_story_wins(member_id,body) values(auth.uid(),'TEST Stairs felt easier.');
do $$ begin
 if (select count(*) from public.member_story_goals where member_id=auth.uid())<>1 then raise exception 'Own goal missing'; end if;
 if exists(select 1 from public.member_story_goals where member_id=auth.uid() and created_at<'2020-01-01') then raise exception 'Forged timestamp accepted'; end if;
 begin
  insert into public.member_story_goals(member_id,goal) values(current_setting('test.story.other')::uuid,'Forged other goal');
  raise exception 'Cross-member insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.member_story_recaps(member_id,body,period_start,period_end) values(auth.uid(),'Forged coach note',current_date-41,current_date);
  raise exception 'Member authored coach note';
 exception when insufficient_privilege then null; end;
 begin
  update public.member_story_goals set goal='Overwrite original' where member_id=auth.uid();
  raise exception 'Original goal mutable';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.member_story_goals where member_id=current_setting('test.story.member')::uuid) then raise exception 'Other goal visible'; end if;
 if exists(select 1 from public.member_story_wins where member_id=current_setting('test.story.member')::uuid) then raise exception 'Other win visible'; end if;
 delete from public.member_story_wins where member_id=current_setting('test.story.member')::uuid;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.coach'),'role','authenticated')::text,true);
insert into public.member_story_recaps(member_id,body,period_start,period_end,summary) values(current_setting('test.story.member')::uuid,'TEST Coach recap',current_date-41,current_date,'{"workouts":0,"partials":0,"classes":0,"habitDays":0,"activeWeeks":0}');
do $$ begin
 if (select count(*) from public.member_story_goals where member_id=current_setting('test.story.member')::uuid)<>1 then raise exception 'Coach cannot see goal'; end if;
 if (select count(*) from public.member_story_wins where member_id=current_setting('test.story.member')::uuid)<>1 then raise exception 'Other member removed win'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.member'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.member_story_recaps where member_id=auth.uid()) then raise exception 'Draft visible to member'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.coach'),'role','authenticated')::text,true);
update public.member_story_recaps set published_at=now() where member_id=current_setting('test.story.member')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.member'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.member_story_recaps where member_id=auth.uid())<>1 then raise exception 'Published recap missing'; end if;
 update public.member_story_recaps set body='Forged edit' where member_id=auth.uid();
 if exists(select 1 from public.member_story_recaps where body='Forged edit') then raise exception 'Member altered coach recap'; end if;
 delete from public.member_story_wins where member_id=auth.uid();
 if exists(select 1 from public.member_story_wins where member_id=auth.uid()) then raise exception 'Own win delete failed'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.story.other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.member_story_recaps where member_id=current_setting('test.story.member')::uuid) then raise exception 'Other recap visible'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform 1 from public.member_story_goals;
  raise exception 'Anonymous access allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: own writes, account isolation, immutable goals, hidden drafts, coach-only publication, published visibility, win deletion, anonymous denial, and server timestamps. Test identities rolled back.' as result;
