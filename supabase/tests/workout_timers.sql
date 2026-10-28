begin;
insert into public.habit_challenges(id,title,starts_on,ends_on) values ('00000000-0000-4000-8000-000000000d01','Timer test','2026-09-21','2026-10-11');
insert into public.challenge_workouts(id,challenge_id,title,minutes,plan,publish_on,timer_config) values ('00000000-0000-4000-8000-000000000d02','00000000-0000-4000-8000-000000000d01','Timer test',4,'Fixture','2026-09-21','{"mode":"interval","durationSeconds":1200,"workSeconds":20,"restSeconds":10,"rounds":8}');
do $$ begin
 if (select timer_config->>'rounds' from public.challenge_workouts where id='00000000-0000-4000-8000-000000000d02') <> '8' then raise exception 'Preset did not save'; end if;
 begin
 update public.challenge_workouts set timer_config='{"mode":"interval","durationSeconds":1200,"workSeconds":0,"restSeconds":0,"rounds":8}' where id='00000000-0000-4000-8000-000000000d02';
 raise exception 'Zero-length work allowed'; exception when check_violation then null; end;
 begin
 update public.challenge_workouts set timer_config='{}' where id='00000000-0000-4000-8000-000000000d02';
 raise exception 'Missing settings accepted'; exception when check_violation then null; end;
end $$;
update public.challenge_workouts set timer_config=null where id='00000000-0000-4000-8000-000000000d02';
rollback;
select 'PASS: timer preset persists, invalid presets rejected, optional preset can be cleared' as verification;
