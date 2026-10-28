-- Private working copies are deliberately separate from publicly readable site_content.
create table public.website_editor_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"pages":{},"bases":{}}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint website_draft_size check (octet_length(payload::text) <= 4000000)
);
alter table public.website_editor_drafts enable row level security;
create policy website_drafts_owner on public.website_editor_drafts for all to authenticated
using (user_id = (select auth.uid()) and (select private.is_admin()))
with check (user_id = (select auth.uid()) and (select private.is_admin()));
grant select, insert, update on public.website_editor_drafts to authenticated;

create table public.website_publication_history (
  id uuid primary key default gen_random_uuid(),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  previous_records jsonb not null,
  published_records jsonb not null
);
alter table public.website_publication_history enable row level security;
create policy website_history_admin on public.website_publication_history for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
grant select, insert on public.website_publication_history to authenticated;
create index website_publication_history_author on public.website_publication_history(published_by);

create function public.save_website_editor_draft(expected_revision bigint, draft jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  insert into public.website_editor_drafts(user_id) values(auth.uid()) on conflict do nothing;
  select revision into current_revision from public.website_editor_drafts where user_id=auth.uid() for update;
  if current_revision <> expected_revision then raise exception 'DRAFT_CONFLICT'; end if;
  update public.website_editor_drafts set payload=draft, revision=revision+1, updated_at=now() where user_id=auth.uid() returning revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.save_website_editor_draft(bigint,jsonb) from public, anon;
grant execute on function public.save_website_editor_draft(bigint,jsonb) to authenticated;

create function public.publish_website_editor_draft(expected_revision bigint, changes jsonb, remaining_draft jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; item jsonb; old_row public.site_content; snapshots jsonb='[]'; result jsonb='{}'; stamp timestamptz=clock_timestamp();
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  select revision into current_revision from public.website_editor_drafts where user_id=auth.uid() for update;
  if current_revision is null or current_revision <> expected_revision then raise exception 'DRAFT_CONFLICT'; end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) not between 1 and 3 then raise exception 'Invalid publication'; end if;
  -- Serialize inserts too; row locks below also protect against older editor actions.
  perform pg_advisory_xact_lock(810272026);
  for item in select value from jsonb_array_elements(changes) order by value->>'key' loop
    if item->>'key' !~ '^website:[a-z0-9:-]+$' or jsonb_typeof(item->'value') <> 'object' then raise exception 'Invalid website record'; end if;
    select * into old_row from public.site_content where content_key=item->>'key' for update;
    if old_row.updated_at is distinct from (item->>'base')::timestamptz then raise exception 'PUBLISH_CONFLICT'; end if;
    snapshots=snapshots || jsonb_build_array(jsonb_build_object('key',item->>'key','record',case when old_row.content_key is null then null else to_jsonb(old_row) end));
    insert into public.site_content(content_key,value,published,published_at,updated_by)
      values(item->>'key',item->'value',true,stamp,auth.uid())
      on conflict(content_key) do update set value=excluded.value,published=true,published_at=stamp,updated_by=auth.uid();
    result=result || jsonb_build_object(item->>'key',(select updated_at from public.site_content where content_key=item->>'key'));
  end loop;
  insert into public.website_publication_history(published_by,previous_records,published_records) values(auth.uid(),snapshots,changes);
  update public.website_editor_drafts set payload=remaining_draft,revision=revision+1,updated_at=now() where user_id=auth.uid();
  return jsonb_build_object('revision',current_revision+1,'bases',result,'published_at',stamp);
end $$;
revoke all on function public.publish_website_editor_draft(bigint,jsonb,jsonb) from public, anon;
grant execute on function public.publish_website_editor_draft(bigint,jsonb,jsonb) to authenticated;
