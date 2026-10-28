-- Run inside BEGIN/ROLLBACK; all records are synthetic.
insert into auth.users(id,email,raw_user_meta_data) values
('72100000-0000-4000-8000-000000000001','qa-withdraw-member@example.invalid','{"full_name":"TEST Withdrawal"}'),
('72100000-0000-4000-8000-000000000002','qa-withdraw-admin@example.invalid','{"full_name":"TEST Withdrawal Admin"}');
insert into public.staff_roles(user_id,role) values('72100000-0000-4000-8000-000000000002','admin');
insert into public.coaching_relationships(id,member_id,coach_id,status) values('72200000-0000-4000-8000-000000000001','72100000-0000-4000-8000-000000000001','72100000-0000-4000-8000-000000000002','active');
insert into public.personal_training_appointments(relationship_id,session_date,session_time) values
('72200000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date-1,'10:00'),
('72200000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date,'10:00'),
('72200000-0000-4000-8000-000000000001',(now() at time zone 'America/Detroit')::date+1,'10:00');
set local role authenticated;
select set_config('request.jwt.claim.sub','72100000-0000-4000-8000-000000000001',true);
do $$ begin
 begin perform public.withdraw_personal_training('72100000-0000-4000-8000-000000000001','72200000-0000-4000-8000-000000000001'); raise exception 'Member could withdraw'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','72100000-0000-4000-8000-000000000002',true);
select public.withdraw_personal_training('72100000-0000-4000-8000-000000000001','72200000-0000-4000-8000-000000000001');
select public.withdraw_personal_training('72100000-0000-4000-8000-000000000001','72200000-0000-4000-8000-000000000001');
do $$ begin
 if (select status from public.coaching_relationships where id='72200000-0000-4000-8000-000000000001')<>'withdrawn' then raise exception 'Status not changed'; end if;
 if (select count(*) from public.personal_training_appointments where relationship_id='72200000-0000-4000-8000-000000000001')<>1 then raise exception 'Wrong appointments removed'; end if;
 if not exists(select 1 from public.profiles where id='72100000-0000-4000-8000-000000000001') then raise exception 'Profile removed'; end if;
end $$;
reset role;
select 'Withdrawal authorization, idempotency, appointment cleanup and history checks passed' as result;
