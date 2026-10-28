-- Separate, private story records; no changes to existing coaching tables.
create table public.member_story_goals (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.profiles(id) on delete cascade,
 goal text not null check (length(btrim(goal)) between 3 and 600),
 created_at timestamptz not null default now()
);
create index member_story_goals_member_date on public.member_story_goals(member_id,created_at desc);

create table public.member_story_wins (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (length(btrim(body)) between 3 and 1200),
 created_at timestamptz not null default now()
);
create index member_story_wins_member_date on public.member_story_wins(member_id,created_at desc);

create table public.member_story_recaps (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.profiles(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id),
 body text not null check (length(btrim(body)) between 3 and 3000),
 goal_snapshot text not null default '' check (length(goal_snapshot)<=600),
 period_start date not null,
 period_end date not null,
 summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary)='object' and octet_length(summary::text)<5000),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (period_end >= period_start and period_end-period_start <= 41)
);
create index member_story_recaps_member_date on public.member_story_recaps(member_id,published_at desc);
create index member_story_recaps_author on public.member_story_recaps(author_id);
create unique index member_story_one_draft on public.member_story_recaps(member_id) where published_at is null;

alter table public.member_story_goals enable row level security;
alter table public.member_story_wins enable row level security;
alter table public.member_story_recaps enable row level security;
revoke all on public.member_story_goals,public.member_story_wins,public.member_story_recaps from anon,authenticated;
grant select,insert on public.member_story_goals to authenticated;
grant select,insert,delete on public.member_story_wins to authenticated;
grant select,insert,update,delete on public.member_story_recaps to authenticated;

create policy story_goal_read on public.member_story_goals for select to authenticated
 using (member_id=(select auth.uid()) or (select private.is_admin()));
create policy story_goal_add on public.member_story_goals for insert to authenticated
 with check (member_id=(select auth.uid()));
create policy story_win_read on public.member_story_wins for select to authenticated
 using (member_id=(select auth.uid()) or (select private.is_admin()));
create policy story_win_add on public.member_story_wins for insert to authenticated
 with check (member_id=(select auth.uid()));
create policy story_win_remove on public.member_story_wins for delete to authenticated
 using (member_id=(select auth.uid()));
create policy story_recap_read on public.member_story_recaps for select to authenticated
 using ((member_id=(select auth.uid()) and published_at is not null) or (select private.is_admin()));
create policy story_recap_add on public.member_story_recaps for insert to authenticated
 with check ((select private.is_admin()) and author_id=(select auth.uid()));
create policy story_recap_edit_draft on public.member_story_recaps for update to authenticated
 using ((select private.is_admin()) and published_at is null)
 with check ((select private.is_admin()) and author_id=(select auth.uid()));
create policy story_recap_remove_draft on public.member_story_recaps for delete to authenticated
 using ((select private.is_admin()) and published_at is null);

-- Server times and immutable ownership; published recaps are historical records.
create function private.stamp_member_story() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.created_at:=now(); end if;
 if TG_TABLE_NAME='member_story_recaps' then
   if TG_OP='UPDATE' then
     if old.published_at is not null then raise exception 'Published recaps cannot be changed'; end if;
     new.id:=old.id; new.member_id:=old.member_id; new.created_at:=old.created_at;
   end if;
   new.author_id:=auth.uid();
   new.updated_at:=now();
   if new.published_at is not null then new.published_at:=now(); end if;
 end if;
 return new;
end; $$;
revoke all on function private.stamp_member_story() from public,anon,authenticated;
create trigger stamp_story_goal before insert on public.member_story_goals for each row execute function private.stamp_member_story();
create trigger stamp_story_win before insert on public.member_story_wins for each row execute function private.stamp_member_story();
create trigger stamp_story_recap before insert or update on public.member_story_recaps for each row execute function private.stamp_member_story();
