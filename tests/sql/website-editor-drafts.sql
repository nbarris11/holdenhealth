begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.staff_roles where role='admin' limit 1),true);
set local role authenticated;
do $$
declare rev bigint; result jsonb; rejected boolean=false; original_payload jsonb; first_revision bigint;
begin
  select revision into rev from public.website_editor_drafts where user_id=auth.uid();
  rev=coalesce(rev,0);
  first_revision=public.save_website_editor_draft(rev,'{"pages":{"coaching":{"hero_heading":"private check"}},"bases":{}}');
  begin perform public.save_website_editor_draft(rev,'{}'); exception when others then rejected=sqlerrm like '%DRAFT_CONFLICT%'; end;
  if not rejected then raise exception 'stale draft write accepted'; end if;
  rejected=false;
  begin
    perform public.publish_website_editor_draft(first_revision,'[{"key":"website:qa-editor-a","base":null,"value":{"heading":"test"}},{"key":"website:qa-editor-b","base":"2000-01-01T00:00:00Z","value":{}}]','{"pages":{},"bases":{}}');
  exception when others then rejected=sqlerrm like '%PUBLISH_CONFLICT%'; end;
  if not rejected then raise exception 'stale publication accepted'; end if;
  if exists(select 1 from public.site_content where content_key='website:qa-editor-a') then raise exception 'partial publication escaped rollback'; end if;
  result=public.publish_website_editor_draft(first_revision,'[{"key":"website:qa-editor-a","base":null,"value":{"heading":"test"}}]','{"pages":{"coaching":{"hero_heading":"private check"}},"bases":{}}');
  if (result->>'revision')::bigint<>first_revision+1 then raise exception 'draft revision incorrect'; end if;
  if not exists(select 1 from public.site_content where content_key='website:qa-editor-a' and value->>'heading'='test' and published) then raise exception 'publication missing'; end if;
  select payload into original_payload from public.website_editor_drafts where user_id=auth.uid();
  if original_payload->'pages'->'coaching'->>'hero_heading'<>'private check' then raise exception 'unrelated draft lost'; end if;
  if not exists(select 1 from public.website_publication_history where published_records->0->>'key'='website:qa-editor-a') then raise exception 'recovery snapshot missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.website_editor_drafts) then raise exception 'non-admin can read drafts'; end if;
  if exists(select 1 from public.website_publication_history) then raise exception 'non-admin can read history'; end if;
end $$;
reset role;
select 'PASS: draft CAS, publication conflict, atomic rollback, publish readback, unrelated draft preservation, history, non-admin isolation' as result;
rollback;
