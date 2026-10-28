-- Conversations are scoped to one program or one member and the coaching team.
create table public.chat_conversations (
 id uuid primary key default gen_random_uuid(),
 session_id uuid unique references public.sessions(id) on delete cascade,
 challenge_id uuid unique references public.habit_challenges(id) on delete cascade,
 member_id uuid unique references public.profiles(id) on delete cascade,
 title text not null,
 closed boolean not null default false,
 created_at timestamptz not null default now(),
 check (num_nonnulls(session_id,challenge_id,member_id)=1)
);
create table public.chat_messages (
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 client_id uuid not null,
 sender_name text not null default '',
 body text not null check (char_length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 removed boolean not null default false,
 pinned boolean not null default false,
 unique(sender_id,client_id)
);
create index chat_messages_conversation_idx on public.chat_messages(conversation_id,id desc);
create index chat_messages_sender_idx on public.chat_messages(sender_id,created_at desc);
create table public.chat_preferences (
 user_id uuid not null references public.profiles(id) on delete cascade,
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 last_read_id bigint not null default 0,
 muted boolean not null default false,
 primary key(user_id,conversation_id)
);
create index chat_preferences_conversation_idx on public.chat_preferences(conversation_id);
create table public.chat_push_subscriptions (
 endpoint text primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 subscription jsonb not null,
 created_at timestamptz not null default now()
);
create index chat_push_user_idx on public.chat_push_subscriptions(user_id);
create table public.chat_push_jobs (
 message_id bigint primary key references public.chat_messages(id) on delete cascade,
 attempts integer not null default 0,
 available_at timestamptz not null default now()
);
-- Definer lookups are private and check the authenticated identity explicitly;
-- they avoid exposing other members' enrollments or profile contact details.
create function private.chat_can_read(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
 select 1 from public.chat_conversations c where c.id=cid and (
 private.is_admin() or c.member_id=auth.uid()
 or exists(select 1 from public.enrollments e where e.session_id=c.session_id and e.member_id=auth.uid() and e.status::text in ('active','completed'))
 or exists(select 1 from public.challenge_participants p where p.challenge_id=c.challenge_id and p.user_id=auth.uid())
 ));
$$;
create function private.chat_can_write(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.chat_can_read(cid) and exists (
 select 1 from public.chat_conversations c where c.id=cid and not c.closed and (
 c.member_id is not null
 or exists(select 1 from public.sessions s where s.id=c.session_id and s.ends_on >= (now() at time zone 'America/Detroit')::date and s.status::text in ('enrolling','active') and (private.is_admin() or exists(select 1 from public.enrollments e where e.session_id=s.id and e.member_id=auth.uid() and e.status::text='active')))
 or exists(select 1 from public.habit_challenges h where h.id=c.challenge_id and not h.archived and h.ends_on >= (now() at time zone 'America/Detroit')::date)
 ));
$$;
revoke all on function private.chat_can_read(uuid),private.chat_can_write(uuid) from public,anon;
grant execute on function private.chat_can_read(uuid),private.chat_can_write(uuid) to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_preferences enable row level security;
alter table public.chat_push_subscriptions enable row level security;
alter table public.chat_push_jobs enable row level security;
revoke all on public.chat_conversations,public.chat_messages,public.chat_preferences,public.chat_push_subscriptions,public.chat_push_jobs from anon,authenticated;
grant select on public.chat_conversations,public.chat_messages,public.chat_preferences to authenticated;
grant insert(conversation_id,sender_id,client_id,body) on public.chat_messages to authenticated;
grant update(body,removed,pinned) on public.chat_messages to authenticated;
grant update(closed) on public.chat_conversations to authenticated;
grant insert(user_id,conversation_id,last_read_id,muted),update(last_read_id,muted) on public.chat_preferences to authenticated;
grant usage on sequence public.chat_messages_id_seq to authenticated;
grant all on public.chat_conversations,public.chat_messages,public.chat_preferences,public.chat_push_subscriptions,public.chat_push_jobs to service_role;
create policy chat_conversations_read on public.chat_conversations for select to authenticated using(private.chat_can_read(id));
create policy chat_conversations_moderate on public.chat_conversations for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy chat_messages_read on public.chat_messages for select to authenticated using(private.chat_can_read(conversation_id));
create policy chat_messages_send on public.chat_messages for insert to authenticated with check(sender_id=(select auth.uid()) and private.chat_can_write(conversation_id));
create policy chat_messages_moderate on public.chat_messages for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy chat_preferences_read on public.chat_preferences for select to authenticated using(user_id=(select auth.uid()) and private.chat_can_read(conversation_id));
create policy chat_preferences_insert on public.chat_preferences for insert to authenticated with check(user_id=(select auth.uid()) and private.chat_can_read(conversation_id));
create policy chat_preferences_update on public.chat_preferences for update to authenticated using(user_id=(select auth.uid()) and private.chat_can_read(conversation_id)) with check(user_id=(select auth.uid()) and private.chat_can_read(conversation_id));

create function private.chat_stamp_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.sender_id<>auth.uid() or not private.chat_can_write(new.conversation_id) then raise insufficient_privilege using message='Conversation is not available for messages.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,0));
 if (select count(*) from public.chat_messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=20 then raise exception 'Please wait a minute before sending more messages.'; end if;
 new.sender_name := case when private.is_admin() then 'Kelsey · Coach' else coalesce((select nullif(full_name,'') from public.profiles where id=auth.uid()),'Member') end;
 new.created_at := clock_timestamp(); new.body:=btrim(new.body); new.removed:=false; new.pinned:=false;
 return new;
end $$;
create trigger chat_stamp_message before insert on public.chat_messages for each row execute function private.chat_stamp_message();
create function private.chat_queue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 insert into public.chat_push_jobs(message_id) values(new.id); return new;
end $$;
create trigger chat_queue_push after insert on public.chat_messages for each row execute function private.chat_queue_push();
create function private.chat_preference_guard() returns trigger language plpgsql set search_path='' as $$
begin
 new.last_read_id:=least(greatest(new.last_read_id,case when TG_OP='UPDATE' then old.last_read_id else 0 end),coalesce((select max(id) from public.chat_messages where conversation_id=new.conversation_id),0)); return new;
end $$;
create trigger chat_preference_guard before insert or update on public.chat_preferences for each row execute function private.chat_preference_guard();

-- Automatically create/update program rooms; no manual roster maintenance.
create function private.chat_sync_program() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='sessions' then
 insert into public.chat_conversations(session_id,title) values(new.id,new.name) on conflict(session_id) do update set title=excluded.title;
 else
 insert into public.chat_conversations(challenge_id,title) values(new.id,new.title) on conflict(challenge_id) do update set title=excluded.title;
 end if; return new;
end $$;
create trigger chat_sync_session after insert or update of name on public.sessions for each row execute function private.chat_sync_program();
create trigger chat_sync_challenge after insert or update of title on public.habit_challenges for each row execute function private.chat_sync_program();
insert into public.chat_conversations(session_id,title) select id,name from public.sessions;
insert into public.chat_conversations(challenge_id,title) select id,title from public.habit_challenges;
revoke all on function private.chat_stamp_message(),private.chat_queue_push(),private.chat_preference_guard(),private.chat_sync_program() from public,anon,authenticated;

create function public.chat_inbox() returns table(id uuid,title text,member_id uuid,closed boolean,can_write boolean,muted boolean,last_id bigint,last_body text,last_at timestamptz,unread bigint) language sql stable security invoker set search_path='' as $$
 select c.id,c.title,c.member_id,c.closed,private.chat_can_write(c.id),coalesce(p.muted,false),m.id,m.body,m.created_at,
 (select count(*) from public.chat_messages u where u.conversation_id=c.id and u.id>coalesce(p.last_read_id,0) and u.sender_id<>auth.uid() and not u.removed)
 from public.chat_conversations c
 left join public.chat_preferences p on p.conversation_id=c.id and p.user_id=auth.uid()
 left join lateral (select x.id,x.body,x.created_at from public.chat_messages x where x.conversation_id=c.id order by x.id desc limit 1) m on true
 order by m.created_at desc nulls last,c.title;
$$;
revoke all on function public.chat_inbox() from public,anon;
grant execute on function public.chat_inbox() to authenticated;
