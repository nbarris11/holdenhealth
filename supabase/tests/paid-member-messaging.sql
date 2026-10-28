begin;
select set_config('test.chat.member',gen_random_uuid()::text,true);
select set_config('test.chat.other',gen_random_uuid()::text,true);
select set_config('test.chat.coach',gen_random_uuid()::text,true);
select set_config('test.chat.session',gen_random_uuid()::text,true);
select set_config('test.chat.dm',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) select current_setting('test.chat.'||v)::uuid,'chat-'||v||'-'||gen_random_uuid()||'@example.invalid','{"full_name":"TEST Chat"}'::jsonb from unnest(array['member','other','coach']) v;
insert into public.profiles(id,full_name) select current_setting('test.chat.'||v)::uuid,'TEST Chat '||v from unnest(array['member','other','coach']) v on conflict(id) do update set full_name=excluded.full_name;
insert into public.staff_roles(user_id,role) values(current_setting('test.chat.coach')::uuid,'admin');
insert into public.sessions(id,name,slug,starts_on,ends_on,status,address_line,capacity,new_member_price_cents) values(current_setting('test.chat.session')::uuid,'TEST Chat program','test-chat-'||gen_random_uuid(),current_date-20,current_date+10,'active','TEST only',20,10000);
insert into public.enrollments(session_id,member_id,status) values(current_setting('test.chat.session')::uuid,current_setting('test.chat.member')::uuid,'active');
insert into public.payment_records(enrollment_id,status,amount_cents) select id,'paid',10000 from public.enrollments where session_id=current_setting('test.chat.session')::uuid;
insert into public.chat_conversations(id,member_id,title) values(current_setting('test.chat.dm')::uuid,current_setting('test.chat.member')::uuid,'TEST Private');
select set_config('test.chat.group',(select id::text from public.chat_conversations where session_id=current_setting('test.chat.session')::uuid),true);
select set_config('test.chat.challenge',gen_random_uuid()::text,true);
select set_config('test.chat.free_dm',gen_random_uuid()::text,true);
insert into public.habit_challenges(id,title,starts_on,ends_on,published) values(current_setting('test.chat.challenge')::uuid,'TEST free challenge',current_date,current_date+20,true);
do $$ begin
 if exists(select 1 from public.chat_conversations where challenge_id=current_setting('test.chat.challenge')::uuid) then raise exception 'Challenge auto-created a chat'; end if;
end $$;
insert into public.challenge_participants(challenge_id,user_id,display_name,goals,weekly_workouts) select current_setting('test.chat.challenge')::uuid,current_setting('test.chat.'||v)::uuid,'TEST',array['Walk','Sleep','Water'],3 from unnest(array['member','other'])v;
-- Legacy rooms and history must also become inaccessible.
insert into public.chat_conversations(challenge_id,title) values(current_setting('test.chat.challenge')::uuid,'TEST legacy challenge chat');
insert into public.chat_conversations(id,member_id,title) values(current_setting('test.chat.free_dm')::uuid,current_setting('test.chat.other')::uuid,'TEST free private');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.other'),'role','authenticated')::text,true);
do $$ begin
 if public.chat_has_access() or exists(select 1 from public.chat_inbox()) then raise exception 'Free member has chat access'; end if;
 begin
 insert into public.chat_messages(conversation_id,sender_id,client_id,body) values(current_setting('test.chat.free_dm')::uuid,auth.uid(),gen_random_uuid(),'Forbidden free DM');
 raise exception 'Free member can send'; exception when insufficient_privilege then null; end;
 begin
 perform public.chat_eligible_members(array[auth.uid()]);
 raise exception 'Member can invoke service eligibility lookup'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
 if current_setting('test.chat.other')::uuid in (select public.chat_eligible_members(array[current_setting('test.chat.other')::uuid])) then raise exception 'Free member eligible for push'; end if;
 if not exists(select 1 from public.chat_eligible_members(array[current_setting('test.chat.member')::uuid])) then raise exception 'Paid member missing from push'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.member'),'role','authenticated')::text,true);
insert into public.chat_messages(conversation_id,sender_id,client_id,body) values(current_setting('test.chat.group')::uuid,auth.uid(),gen_random_uuid(),'TEST Group hello'),(current_setting('test.chat.dm')::uuid,auth.uid(),gen_random_uuid(),'TEST Private hello');
do $$ begin
 if (select count(*) from public.chat_messages)<>2 then raise exception 'Own messages missing'; end if;
 if (select count(*) from public.chat_inbox())<>2 then raise exception 'Wrong inbox access'; end if;
 if exists(select 1 from public.chat_messages where sender_name<>'TEST Chat member') then raise exception 'Sender name incorrect'; end if;
 begin
 insert into public.chat_messages(conversation_id,sender_id,client_id,body) values(current_setting('test.chat.dm')::uuid,current_setting('test.chat.other')::uuid,gen_random_uuid(),'Forged sender');
 raise exception 'Sender spoofing allowed'; exception when insufficient_privilege then null; end;
 begin
 insert into public.chat_messages(conversation_id,sender_id,client_id,body,created_at) values(current_setting('test.chat.dm')::uuid,auth.uid(),gen_random_uuid(),'Forged time','2000-01-01');
 raise exception 'Timestamp spoofing allowed'; exception when insufficient_privilege then null; end;
 update public.chat_messages set body='Illegal edit';
 if exists(select 1 from public.chat_messages where body='Illegal edit') then raise exception 'Member moderation allowed'; end if;
end $$;
insert into public.chat_preferences(user_id,conversation_id,muted,last_read_id) values(auth.uid(),current_setting('test.chat.group')::uuid,true,9223372036854775807);
do $$ begin
 if (select last_read_id from public.chat_preferences)<>(select max(id) from public.chat_messages where conversation_id=current_setting('test.chat.group')::uuid) then raise exception 'Future read cursor accepted'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.chat_messages) or exists(select 1 from public.chat_conversations) or exists(select 1 from public.chat_preferences) then raise exception 'Cross-member data visible'; end if;
 begin
 insert into public.chat_messages(conversation_id,sender_id,client_id,body) values(current_setting('test.chat.dm')::uuid,auth.uid(),gen_random_uuid(),'Break into DM');
 raise exception 'Cross-member send allowed'; exception when insufficient_privilege then null; end;
 begin
 select * from public.chat_push_subscriptions;
 raise exception 'Push endpoints exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.coach'),'role','authenticated')::text,true);
insert into public.chat_messages(conversation_id,sender_id,client_id,body) values(current_setting('test.chat.dm')::uuid,auth.uid(),gen_random_uuid(),'TEST Coach reply');
update public.chat_messages set pinned=true where conversation_id=current_setting('test.chat.group')::uuid;
update public.chat_messages set body='Message removed by Kelsey.',removed=true,pinned=false where conversation_id=current_setting('test.chat.group')::uuid;
update public.chat_conversations set closed=true where id=current_setting('test.chat.dm')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.member'),'role','authenticated')::text,true);
do $$ begin
 if not exists(select 1 from public.chat_messages where sender_name='Kelsey · Coach') then raise exception 'Coach reply missing'; end if;
 if private.chat_can_write(current_setting('test.chat.dm')::uuid) then raise exception 'Closed conversation writable'; end if;
 begin
 insert into public.chat_messages(conversation_id,sender_id,client_id,body) values(current_setting('test.chat.dm')::uuid,auth.uid(),gen_random_uuid(),'Write to closed DM');
 raise exception 'Closed send allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.sessions set ends_on=current_date-1 where id=current_setting('test.chat.session')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.member'),'role','authenticated')::text,true);
do $$ begin
 if not private.chat_can_read(current_setting('test.chat.group')::uuid) or private.chat_can_write(current_setting('test.chat.group')::uuid) then raise exception 'Ended program not read-only'; end if;
end $$;
reset role;
update public.enrollments set status='withdrawn' where session_id=current_setting('test.chat.session')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.member'),'role','authenticated')::text,true);
do $$ begin
 if private.chat_can_read(current_setting('test.chat.group')::uuid) then raise exception 'Withdrawn member retains access'; end if;
end $$;
reset role;
insert into public.coaching_relationships(member_id,coach_id,status) values(current_setting('test.chat.other')::uuid,current_setting('test.chat.coach')::uuid,'active');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.other'),'role','authenticated')::text,true);
do $$ begin
 if not public.chat_has_access() or not private.chat_can_write(current_setting('test.chat.free_dm')::uuid) then raise exception 'Active training member blocked'; end if;
 if (select count(*) from public.chat_inbox())<>1 then raise exception 'Training gained challenge room'; end if;
end $$;
reset role;
update public.coaching_relationships set status='paused' where member_id=current_setting('test.chat.other')::uuid;
update public.enrollments set status='active' where session_id=current_setting('test.chat.session')::uuid;
update public.payment_records set status='refunded' where enrollment_id in (select id from public.enrollments where session_id=current_setting('test.chat.session')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.member'),'role','authenticated')::text,true);
do $$ begin
 if public.chat_has_access() or exists(select 1 from public.chat_inbox()) then raise exception 'Refunded member retains access'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.chat.other'),'role','authenticated')::text,true);
do $$ begin
 if public.chat_has_access() then raise exception 'Paused training retains access'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin select * from public.chat_messages;raise exception 'Anonymous access allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
