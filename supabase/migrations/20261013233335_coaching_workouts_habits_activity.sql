-- Individual assignments reuse the existing structured workout/player and log snapshots.
alter table public.challenge_workouts add column relationship_id uuid references public.coaching_relationships(id);
alter table public.challenge_workouts drop constraint workout_one_program;
alter table public.challenge_workouts add constraint workout_one_program check (num_nonnulls(challenge_id,session_id,relationship_id)=1);
create index personal_workouts_schedule_idx on public.challenge_workouts(relationship_id,publish_on) where relationship_id is not null;
alter table public.challenge_workout_logs add column relationship_id uuid references public.coaching_relationships(id);
alter table public.challenge_workout_logs drop constraint workout_log_one_membership;
alter table public.challenge_workout_logs add constraint workout_log_one_membership check (num_nonnulls(participant_id,enrollment_id,relationship_id)=1);
create index personal_workout_logs_date_idx on public.challenge_workout_logs(relationship_id,performed_on) where relationship_id is not null;
create or replace function private.validate_workout_program() returns trigger language plpgsql set search_path='' as $$
declare program_start date; program_end date;
begin
 if tg_op='UPDATE' and (new.challenge_id is distinct from old.challenge_id or new.session_id is distinct from old.session_id or new.relationship_id is distinct from old.relationship_id) then raise exception 'A saved workout cannot move to another program'; end if;
 if new.session_id is not null then
  select starts_on,ends_on into program_start,program_end from public.sessions where id=new.session_id;
 elsif new.relationship_id is not null then
  select starts_on,'9999-12-31'::date into program_start,program_end from public.coaching_relationships where id=new.relationship_id;
 else return new; end if;
 if program_start is null or new.publish_on < program_start or new.publish_on > program_end then raise exception 'Invalid release date'; end if;
 return new;
end $$;
create policy personal_workout_read on public.challenge_workouts for select to authenticated using (
 published and not archived and publish_on <= (now() at time zone 'America/Detroit')::date and
 exists(select 1 from public.coaching_relationships r where r.id=relationship_id and r.member_id=(select auth.uid()) and r.status in ('active','paused','completed')));
create policy personal_workout_log_read on public.challenge_workout_logs for select to authenticated using (
 exists(select 1 from public.coaching_relationships r where r.id=relationship_id and r.member_id=(select auth.uid())));
create policy personal_workout_log_insert on public.challenge_workout_logs for insert to authenticated with check (
 exists(select 1 from public.coaching_relationships r join public.challenge_workouts w on w.relationship_id=r.id
 where r.id=challenge_workout_logs.relationship_id and r.member_id=(select auth.uid()) and r.status='active'
 and w.id=workout_id and w.published and not w.archived and performed_on=(now() at time zone 'America/Detroit')::date
 and performed_on>=greatest(r.starts_on,w.publish_on)));

-- A habit week belongs to a class enrollment OR an individual coaching relationship.
alter table public.class_habit_weeks alter column enrollment_id drop not null;
alter table public.class_habit_weeks add column relationship_id uuid references public.coaching_relationships(id) on delete cascade;
alter table public.class_habit_weeks add column version integer not null default 1;
alter table public.class_habit_weeks drop constraint class_habit_weeks_week_number_check;
alter table public.class_habit_weeks add constraint habit_week_number check(week_number between 1 and 10000 and (enrollment_id is null or week_number<=6));
alter table public.class_habit_weeks add constraint habit_week_owner check(num_nonnulls(enrollment_id,relationship_id)=1);
create unique index personal_habit_week_unique on public.class_habit_weeks(relationship_id,week_number) where relationship_id is not null;
create table public.habit_week_revisions (
 id uuid primary key default gen_random_uuid(),week_id uuid not null references public.class_habit_weeks(id) on delete cascade,
 habits text[] not null,marks jsonb not null,version integer not null,created_at timestamptz not null default now(),unique(week_id,version));
alter table public.habit_week_revisions enable row level security;
revoke all on public.habit_week_revisions from anon,authenticated;
grant select on public.habit_week_revisions to authenticated;
grant all on public.habit_week_revisions to service_role;
create policy habit_revision_read on public.habit_week_revisions for select to authenticated using (exists(select 1 from public.class_habit_weeks w where w.id=week_id));
create policy personal_habit_week_read on public.class_habit_weeks for select to authenticated using (
 (select private.is_admin()) or exists(select 1 from public.coaching_relationships r where r.id=relationship_id and r.member_id=(select auth.uid())));
create policy personal_habit_week_insert on public.class_habit_weeks for insert to authenticated with check (
 exists(select 1 from public.coaching_relationships r where r.id=relationship_id and r.member_id=(select auth.uid()) and r.status='active'));
grant update(habits) on public.class_habit_weeks to authenticated;
create policy habit_week_update on public.class_habit_weeks for update to authenticated using (
 exists(select 1 from public.enrollments e where e.id=enrollment_id and e.member_id=(select auth.uid()) and e.status in ('invited','active')) or
 exists(select 1 from public.coaching_relationships r where r.id=relationship_id and r.member_id=(select auth.uid()) and r.status='active')) with check (
 exists(select 1 from public.enrollments e where e.id=enrollment_id and e.member_id=(select auth.uid()) and e.status in ('invited','active')) or
 exists(select 1 from public.coaching_relationships r where r.id=relationship_id and r.member_id=(select auth.uid()) and r.status='active'));
create policy personal_habit_marks_read on public.class_habit_marks for select to authenticated using (
 exists(select 1 from public.class_habit_weeks w join public.coaching_relationships r on r.id=w.relationship_id where w.id=week_id and (r.member_id=(select auth.uid()) or (select private.is_admin()))));
create policy personal_habit_marks_insert on public.class_habit_marks for insert to authenticated with check (
 exists(select 1 from public.class_habit_weeks w join public.coaching_relationships r on r.id=w.relationship_id where w.id=week_id and r.member_id=(select auth.uid()) and r.status='active'));
create policy personal_habit_marks_delete on public.class_habit_marks for delete to authenticated using (
 exists(select 1 from public.class_habit_weeks w join public.coaching_relationships r on r.id=w.relationship_id where w.id=week_id and r.member_id=(select auth.uid()) and r.status='active'));
create or replace function public.validate_class_habit_week() returns trigger language plpgsql set search_path='' as $$
declare program_start date; program_end date; week_start date; today date := (now() at time zone 'America/Detroit')::date;
begin
 if new.relationship_id is not null then
  select starts_on,'9999-12-31'::date into program_start,program_end from public.coaching_relationships where id=new.relationship_id;
  if cardinality(new.habits)<>3 then raise exception 'Choose exactly three habits'; end if;
 else select s.starts_on,s.ends_on into program_start,program_end from public.enrollments e join public.sessions s on s.id=e.session_id where e.id=new.enrollment_id; end if;
 week_start:=date_trunc('week',program_start::timestamp)::date+(new.week_number-1)*7;
 if program_start is null or week_start>program_end or (new.week_number>1 and week_start>today) or program_end<today
 or (tg_op='UPDATE' and today>week_start+6)
 or exists(select 1 from unnest(new.habits) h where length(btrim(h))<3 or length(h)>100)
 or (select count(distinct lower(btrim(h))) from unnest(new.habits) h)<>cardinality(new.habits) then raise exception 'Invalid weekly habit plan'; end if;
 return new;
end $$;
create trigger validate_class_habit_week_before_update before update on public.class_habit_weeks for each row execute function public.validate_class_habit_week();
-- The trigger archives the previous definition and marks atomically before resetting changed slots.
create function private.revise_habit_week() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.habits is not distinct from old.habits then return new; end if;
 insert into public.habit_week_revisions(week_id,habits,marks,version)
 values(old.id,old.habits,coalesce((select jsonb_agg(jsonb_build_object('day',m.day,'habit_index',m.habit_index)) from public.class_habit_marks m where m.week_id=old.id),'[]'::jsonb),old.version);
 delete from public.class_habit_marks m where m.week_id=old.id and old.habits[m.habit_index+1] is distinct from new.habits[m.habit_index+1];
 new.version:=old.version+1;
 return new;
end $$;
revoke all on function private.revise_habit_week() from public,anon,authenticated;
create trigger zz_revise_habit_week before update on public.class_habit_weeks for each row execute function private.revise_habit_week();
create or replace function public.validate_class_habit_mark() returns trigger language plpgsql set search_path='' as $$
declare w public.class_habit_weeks; program_start date; program_end date; week_start date;
begin
 select * into w from public.class_habit_weeks where id=new.week_id for update;
 if w.relationship_id is not null then select starts_on,'9999-12-31'::date into program_start,program_end from public.coaching_relationships where id=w.relationship_id;
 else select s.starts_on,s.ends_on into program_start,program_end from public.enrollments e join public.sessions s on s.id=e.session_id where e.id=w.enrollment_id; end if;
 week_start:=date_trunc('week',program_start::timestamp)::date+(w.week_number-1)*7;
 if program_start is null or new.day<greatest(week_start,program_start) or new.day>least(week_start+6,program_end) or new.day>(now() at time zone 'America/Detroit')::date or new.habit_index>=cardinality(w.habits) then raise exception 'Invalid habit checkmark'; end if;
 return new;
end $$;
create function public.set_weekly_habit_mark(p_week_id uuid,p_version integer,p_day date,p_index integer,p_checked boolean) returns void language plpgsql security invoker set search_path='' as $$
declare w public.class_habit_weeks;
begin
 select * into w from public.class_habit_weeks where id=p_week_id for update;
 if w.id is null or w.version<>p_version then raise exception 'Habits changed. Reload before checking off a habit.'; end if;
 if p_checked then insert into public.class_habit_marks(week_id,day,habit_index) values(p_week_id,p_day,p_index) on conflict do nothing;
 else delete from public.class_habit_marks where week_id=p_week_id and day=p_day and habit_index=p_index; end if;
end $$;
revoke all on function public.set_weekly_habit_mark(uuid,integer,date,integer,boolean) from public,anon;
grant execute on function public.set_weekly_habit_mark(uuid,integer,date,integer,boolean) to authenticated;

-- Coach activity feed: inserts are generated by trusted triggers, never by clients.
create table public.coach_activity (
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('habits_chosen','habits_edited','workout_completed')),
 source_key text not null unique,href text not null,created_at timestamptz not null default now());
create index coach_activity_created_idx on public.coach_activity(created_at desc);
create index coach_activity_member_idx on public.coach_activity(member_id);
create table public.coach_activity_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 email_habits boolean not null default false,email_workouts boolean not null default false,
 read_through timestamptz,updated_at timestamptz not null default now());
create table public.coach_activity_deliveries (
 id uuid primary key default gen_random_uuid(),activity_id uuid not null references public.coach_activity(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempted_at timestamptz,sent_at timestamptz,created_at timestamptz not null default now(),unique(activity_id,user_id));
create index coach_activity_delivery_user_idx on public.coach_activity_deliveries(user_id);
alter table public.coach_activity enable row level security;
alter table public.coach_activity_preferences enable row level security;
alter table public.coach_activity_deliveries enable row level security;
revoke all on public.coach_activity,public.coach_activity_preferences,public.coach_activity_deliveries from anon,authenticated;
grant all on public.coach_activity,public.coach_activity_preferences,public.coach_activity_deliveries to service_role;
grant select on public.coach_activity to authenticated;
grant select,insert,update on public.coach_activity_preferences to authenticated;
create policy coach_activity_read on public.coach_activity for select to authenticated using ((select private.is_admin()));
create policy coach_activity_prefs_read on public.coach_activity_preferences for select to authenticated using(user_id=(select auth.uid()) and (select private.is_admin()));
create policy coach_activity_prefs_insert on public.coach_activity_preferences for insert to authenticated with check(user_id=(select auth.uid()) and (select private.is_admin()));
create policy coach_activity_prefs_update on public.coach_activity_preferences for update to authenticated using(user_id=(select auth.uid()) and (select private.is_admin())) with check(user_id=(select auth.uid()) and (select private.is_admin()));
create function private.record_coach_activity() returns trigger language plpgsql security definer set search_path='' as $$
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
  where (event_kind='workout_completed' and p.email_workouts) or (event_kind<>'workout_completed' and p.email_habits) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.record_coach_activity() from public,anon,authenticated;
create trigger record_habit_activity after insert or update on public.class_habit_weeks for each row execute function private.record_coach_activity();
create trigger record_workout_activity after insert on public.challenge_workout_logs for each row execute function private.record_coach_activity();
create trigger record_legacy_workout_activity after update on public.scheduled_workouts for each row execute function private.record_coach_activity();

-- Late requests quote no price and reserve no seat until coach approval.
create function public.request_late_registration(p_session_id uuid,p_full_name text,p_email text,p_phone text,p_weekly_commitment smallint,p_attendance_interest text[],p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sessions; result uuid;
begin
 select * into s from public.sessions where id=p_session_id for update;
 if s.id is null or not s.published or s.status not in ('enrolling','active') or s.starts_on>(now() at time zone 'America/Detroit')::date or s.ends_on<(now() at time zone 'America/Detroit')::date then raise exception 'Session unavailable'; end if;
 if p_weekly_commitment is null or p_weekly_commitment not in (2,3) or coalesce(length(trim(p_full_name)),0)<2 or coalesce(length(trim(p_phone)),0)<7 or p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(cardinality(p_attendance_interest),0)=0 or not p_attendance_interest <@ array['Tuesday 6:00 AM','Wednesday 7:00 PM','Saturday 7:30 AM','Saturday 9:00 AM']::text[] then raise exception 'Invalid details'; end if;
 if exists(select 1 from public.registration_requests where session_id=s.id and email=lower(trim(p_email)) and status in ('pending','approved'))
 or exists(select 1 from public.member_invitations where session_id=s.id and email=lower(trim(p_email)) and enrollment_status in ('invited','active','completed'))
 or exists(select 1 from public.checkout_orders where session_id=s.id and email=lower(trim(p_email)) and (status in ('paid','payment_processing') or (status='reserved' and expires_at>now())))
 then raise exception 'An enrollment is already in progress'; end if;
 insert into public.registration_requests(session_id,full_name,email,phone,weekly_commitment,attendance_interest,note)
 values(s.id,trim(p_full_name),lower(trim(p_email)),trim(p_phone),p_weekly_commitment,p_attendance_interest,left('Late join request. Price and space need coach approval. '||coalesce(p_note,''),1000)) returning id into result;
 return result;
end $$;
revoke all on function public.request_late_registration(uuid,text,text,text,smallint,text[],text) from public,anon,authenticated;
grant execute on function public.request_late_registration(uuid,text,text,text,smallint,text[],text) to service_role;
alter table public.registration_requests add column approved_amount_cents integer check(approved_amount_cents between 0 and 1000000),add column setup_email_sent_at timestamptz;
-- Admin-only count of reserved places includes the server-only payment ledger.
create function private.program_reserved_places(p_session_id uuid,p_request_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not private.is_admin() then raise exception 'Admin required'; end if;
 select (select count(*) from public.enrollments where session_id=p_session_id and status in ('invited','active'))+
 (select count(*) from public.member_invitations where session_id=p_session_id and claimed_at is null and enrollment_status in ('invited','active'))+
 (select count(*) from public.checkout_orders where session_id=p_session_id and ((status='reserved' and expires_at>now()) or status='payment_processing'))+
 (select count(*) from public.registration_requests where session_id=p_session_id and status='pending' and payment_method is not null and id<>p_request_id) into n;
 return n;
end $$;
revoke all on function private.program_reserved_places(uuid,uuid) from public,anon,authenticated;
grant execute on function private.program_reserved_places(uuid,uuid) to authenticated;
-- Atomic approval locks the shared program capacity row; retrying cannot overwrite a quote or payment.
create function public.approve_priced_registration(p_request_id uuid,p_amount integer) returns void language plpgsql security invoker set search_path='' as $$
declare r public.registration_requests; s public.sessions; n integer;
begin
 if not private.is_admin() then raise exception 'Admin required'; end if;
 select * into r from public.registration_requests where id=p_request_id;
 if r.id is null then raise exception 'Request unavailable'; end if;
 select * into s from public.sessions where id=r.session_id for update;
 select * into r from public.registration_requests where id=p_request_id for update;
 if p_amount is null or p_amount<0 or p_amount>1000000 then raise exception 'Invalid price'; end if;
 if r.status='approved' and r.approved_amount_cents=p_amount then return; end if;
 if r.status<>'pending' or not s.published or s.status not in ('enrolling','active','full') or s.ends_on<(now() at time zone 'America/Detroit')::date then raise exception 'Request unavailable'; end if;
 n:=private.program_reserved_places(s.id,r.id);
 if n>=s.capacity then raise exception 'Session full'; end if;
 if exists(select 1 from public.member_invitations where session_id=s.id and email=r.email) or exists(select 1 from public.enrollments e join public.member_contacts c on c.user_id=e.member_id where e.session_id=s.id and lower(c.email)=lower(r.email)) then raise exception 'Existing membership: use the member record'; end if;
 insert into public.member_invitations(email,full_name,phone,session_id,enrollment_status,weekly_commitment,returning_member,payment_status,amount_cents,invited_by)
 values(r.email,r.full_name,r.phone,r.session_id,'invited',r.weekly_commitment,r.returning_member,'pending',p_amount,auth.uid());
 update public.registration_requests set status='approved',approved_amount_cents=p_amount,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
end $$;
revoke all on function public.approve_priced_registration(uuid,integer) from public,anon;
grant execute on function public.approve_priced_registration(uuid,integer) to authenticated;

alter policy registration_requests_public_insert on public.registration_requests with check (status='pending' and reviewed_by is null and reviewed_at is null and payment_method is null and approved_amount_cents is null and setup_email_sent_at is null);
