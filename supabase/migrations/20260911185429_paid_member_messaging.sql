-- Free challenges do not confer messaging. Class payment records also cover cash/Venmo/check.
create function private.chat_paid_member(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select uid is not null and (
 exists(select 1 from public.enrollments e join public.payment_records p on p.enrollment_id=e.id where e.member_id=uid and e.status::text in ('active','completed') and p.status::text='paid' and p.amount_cents>0)
 or exists(select 1 from public.coaching_relationships r where r.member_id=uid and r.status='active')
 );
$$;
revoke all on function private.chat_paid_member(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.chat_paid_member(uuid) to service_role;
create function public.chat_has_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or private.chat_paid_member(auth.uid()));
$$;
revoke all on function public.chat_has_access() from public,anon;
grant execute on function public.chat_has_access() to authenticated;
-- Service-only helper for recipient filtering and coach-started conversations.
create function public.chat_eligible_members(user_ids uuid[]) returns setof uuid language sql stable security invoker set search_path='' as $$
 select uid from unnest(user_ids) uid where private.chat_paid_member(uid) or exists(select 1 from public.staff_roles s where s.user_id=uid and s.role::text='admin');
$$;
revoke all on function public.chat_eligible_members(uuid[]) from public,anon,authenticated;
grant execute on function public.chat_eligible_members(uuid[]) to service_role;
create or replace function private.chat_can_read(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
 select 1 from public.chat_conversations c where c.id=cid and c.challenge_id is null and (
 private.is_admin()
 or (c.member_id=auth.uid() and private.chat_paid_member(auth.uid()))
 or exists(select 1 from public.enrollments e join public.payment_records p on p.enrollment_id=e.id where e.session_id=c.session_id and e.member_id=auth.uid() and e.status::text in ('active','completed') and p.status::text='paid' and p.amount_cents>0)
 ));
$$;
create or replace function private.chat_can_write(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.chat_can_read(cid) and exists (
 select 1 from public.chat_conversations c where c.id=cid and not c.closed and c.challenge_id is null and (
 (c.member_id is not null and private.chat_paid_member(c.member_id))
 or exists(select 1 from public.sessions s where s.id=c.session_id and s.ends_on >= (now() at time zone 'America/Detroit')::date and s.status::text in ('enrolling','full','active') and (private.is_admin() or exists(select 1 from public.enrollments e where e.session_id=s.id and e.member_id=auth.uid() and e.status::text='active')))
 ));
$$;
-- Keep existing history intact, but stop creating challenge rooms.
drop trigger if exists chat_sync_challenge on public.habit_challenges;
create or replace function private.chat_sync_program() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='sessions' then
 insert into public.chat_conversations(session_id,title) values(new.id,new.name) on conflict(session_id) do update set title=excluded.title;
 end if; return new;
end $$;
