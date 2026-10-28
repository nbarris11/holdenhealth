-- Coach comments on one habit on one day, with member replies.
-- habit_text is a snapshot so threads still read correctly after a habit edit.
create table public.habit_comments (
 id uuid primary key default gen_random_uuid(),
 week_id uuid not null references public.class_habit_weeks(id) on delete cascade,
 day date not null,
 habit_index smallint not null check(habit_index between 0 and 5),
 habit_text text not null default '',
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 1000),
 member_read_at timestamptz,
 created_at timestamptz not null default now());
create index habit_comments_thread_idx on public.habit_comments(week_id,day,habit_index,created_at);
create index habit_comments_author_idx on public.habit_comments(author_id);

create function private.habit_week_member(p_week_id uuid) returns uuid language sql stable security definer set search_path='' as $$
 select coalesce(
  (select r.member_id from public.class_habit_weeks w join public.coaching_relationships r on r.id=w.relationship_id where w.id=p_week_id),
  (select e.member_id from public.class_habit_weeks w join public.enrollments e on e.id=w.enrollment_id where w.id=p_week_id));
$$;
revoke all on function private.habit_week_member(uuid) from public,anon;
grant execute on function private.habit_week_member(uuid) to authenticated;

-- Same day rules as checkmarks. Author is always set by the server. A reply to an existing
-- thread keeps that thread's habit text; a new thread takes the week's current habit text.
create function private.validate_habit_comment() returns trigger language plpgsql security definer set search_path='' as $$
declare w public.class_habit_weeks; program_start date; program_end date; week_start date;
begin
 select * into w from public.class_habit_weeks where id=new.week_id;
 if w.relationship_id is not null then select starts_on,'9999-12-31'::date into program_start,program_end from public.coaching_relationships where id=w.relationship_id;
 else select s.starts_on,s.ends_on into program_start,program_end from public.enrollments e join public.sessions s on s.id=e.session_id where e.id=w.enrollment_id; end if;
 week_start:=date_trunc('week',program_start::timestamp)::date+(w.week_number-1)*7;
 if program_start is null or new.day<greatest(week_start,program_start) or new.day>least(week_start+6,program_end)
  or new.day>(now() at time zone 'America/Detroit')::date then
  raise exception 'Invalid habit comment';
 end if;
 if not exists(select 1 from public.habit_comments c where c.week_id=new.week_id and c.day=new.day and c.habit_index=new.habit_index and c.habit_text=new.habit_text) then
  if new.habit_index>=cardinality(w.habits) then raise exception 'Invalid habit comment'; end if;
  new.habit_text:=w.habits[new.habit_index+1];
 end if;
 new.author_id:=auth.uid();
 new.body:=btrim(new.body);
 new.member_read_at:=null;
 return new;
end $$;
revoke all on function private.validate_habit_comment() from public,anon,authenticated;
create trigger validate_habit_comment_before_insert before insert on public.habit_comments for each row execute function private.validate_habit_comment();

alter table public.habit_comments enable row level security;
revoke all on public.habit_comments from anon,authenticated;
grant select,insert on public.habit_comments to authenticated;
grant all on public.habit_comments to service_role;
create policy habit_comments_read on public.habit_comments for select to authenticated using (
 (select private.is_admin()) or private.habit_week_member(week_id)=(select auth.uid()));
create policy habit_comments_coach_insert on public.habit_comments for insert to authenticated with check (
 (select private.is_admin()) and author_id=(select auth.uid()));
-- Members reply only inside a thread Kelsey started on their own week.
-- Definer helper avoids the policy reading its own table (RLS recursion).
create function private.habit_thread_started(p_week_id uuid,p_day date,p_index smallint,p_text text,p_member uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.habit_comments c where c.week_id=p_week_id and c.day=p_day and c.habit_index=p_index and c.habit_text=p_text and c.author_id<>p_member);
$$;
revoke all on function private.habit_thread_started(uuid,date,smallint,text,uuid) from public,anon;
grant execute on function private.habit_thread_started(uuid,date,smallint,text,uuid) to authenticated;
create policy habit_comments_member_reply on public.habit_comments for insert to authenticated with check (
 author_id=(select auth.uid()) and private.habit_week_member(week_id)=(select auth.uid())
 and private.habit_thread_started(week_id,day,habit_index,habit_text,(select auth.uid())));

create function public.mark_habit_comments_read(p_week_id uuid) returns void language sql security definer set search_path='' as $$
 update public.habit_comments set member_read_at=now()
 where week_id=p_week_id and member_read_at is null and author_id<>auth.uid()
  and private.habit_week_member(p_week_id)=auth.uid();
$$;
revoke all on function public.mark_habit_comments_read(uuid) from public,anon;
grant execute on function public.mark_habit_comments_read(uuid) to authenticated;

-- Member replies appear in the coach activity feed. No email deliveries are created.
alter table public.coach_activity drop constraint coach_activity_kind_check;
alter table public.coach_activity add constraint coach_activity_kind_check check(kind in ('habits_chosen','habits_edited','workout_completed','habit_comment_reply'));
create function private.record_habit_comment_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare w public.class_habit_weeks; member uuid := private.habit_week_member(new.week_id); destination text;
begin
 if member is null or new.author_id<>member then return new; end if;
 select * into w from public.class_habit_weeks where id=new.week_id;
 if w.relationship_id is not null then destination:='/admin/training/'||member||'/habits';
 else select '/admin/programs/'||e.session_id||'/habits' into destination from public.enrollments e where e.id=w.enrollment_id; end if;
 insert into public.coach_activity(member_id,kind,source_key,href) values(member,'habit_comment_reply','habit-comment:'||new.id,destination) on conflict(source_key) do nothing;
 return new;
end $$;
revoke all on function private.record_habit_comment_activity() from public,anon,authenticated;
create trigger record_habit_comment_activity after insert on public.habit_comments for each row execute function private.record_habit_comment_activity();
