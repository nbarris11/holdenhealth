-- A full program still has active enrolled members who can chat.
create or replace function private.chat_can_write(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.chat_can_read(cid) and exists (
 select 1 from public.chat_conversations c where c.id=cid and not c.closed and (
 c.member_id is not null
 or exists(select 1 from public.sessions s where s.id=c.session_id and s.ends_on >= (now() at time zone 'America/Detroit')::date and s.status::text in ('enrolling','full','active') and (private.is_admin() or exists(select 1 from public.enrollments e where e.session_id=s.id and e.member_id=auth.uid() and e.status::text='active')))
 or exists(select 1 from public.habit_challenges h where h.id=c.challenge_id and not h.archived and h.ends_on >= (now() at time zone 'America/Detroit')::date)
 ));
$$;
