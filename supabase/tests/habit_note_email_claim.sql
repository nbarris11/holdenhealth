-- Synthetic fixtures only. Run as postgres; everything is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('74100000-0000-4000-8000-000000000001','qa-note-email-a@example.invalid','{"full_name":"TEST Note A"}'),
 ('74100000-0000-4000-8000-000000000002','qa-note-email-b@example.invalid','{"full_name":"TEST Note B"}'),
 ('74100000-0000-4000-8000-000000000003','qa-note-email-c@example.invalid','{"full_name":"TEST Note C"}');
insert into public.member_contacts(user_id,email) values
 ('74100000-0000-4000-8000-000000000001','qa-note-email-a@example.invalid'),
 ('74100000-0000-4000-8000-000000000002','qa-note-email-b@example.invalid'),
 ('74100000-0000-4000-8000-000000000003','qa-note-email-c@example.invalid')
on conflict (user_id) do update set email=excluded.email, email_opt_in=true, unsubscribed_at=null, is_test=false;
update public.member_contacts set email_opt_in=false where user_id='74100000-0000-4000-8000-000000000002';
update public.member_contacts set is_test=true where user_id='74100000-0000-4000-8000-000000000003';
do $$ begin
 -- First claim returns the address; a second claim inside 12 hours returns nothing.
 if public.claim_habit_note_email('74100000-0000-4000-8000-000000000001') is distinct from 'qa-note-email-a@example.invalid' then raise exception 'First claim should return the email'; end if;
 if public.claim_habit_note_email('74100000-0000-4000-8000-000000000001') is not null then raise exception 'Second claim within 12 hours should be empty'; end if;
 -- The window counts from the last email, so it reopens 12 hours after it, however many notes came in between.
 update public.member_contacts set habit_note_emailed_at=now()-interval '12 hours 1 minute' where user_id='74100000-0000-4000-8000-000000000001';
 if public.claim_habit_note_email('74100000-0000-4000-8000-000000000001') is distinct from 'qa-note-email-a@example.invalid' then raise exception 'Claim should reopen after 12 hours'; end if;
 if public.claim_habit_note_email('74100000-0000-4000-8000-000000000002') is not null then raise exception 'Opted-out member was emailed'; end if;
 if public.claim_habit_note_email('74100000-0000-4000-8000-000000000003') is not null then raise exception 'Test account was emailed'; end if;
 if public.claim_habit_note_email('74100000-0000-4000-8000-0000000000ff') is not null then raise exception 'Unknown member returned an email'; end if;
end $$;
-- Signed-in users cannot call it; only the server (service role) can.
set local role authenticated;
do $$ begin
 begin perform public.claim_habit_note_email('74100000-0000-4000-8000-000000000001'); raise exception 'Member could claim'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: habit note email claim throttles from the last email, respects opt-out and test accounts, server-only' as verification;
