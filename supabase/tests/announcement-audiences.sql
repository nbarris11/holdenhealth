begin;
create temporary table announcement_qa_context as
select gen_random_uuid() as outsider, 
(select member_id from public.enrollments where status in ('invited','active','completed') and not exists(select 1 from public.staff_roles r where r.user_id=member_id and r.role='admin') limit 1) as member_id,
(select user_id from public.staff_roles where role='admin' limit 1) as admin_id;
alter table announcement_qa_context add column session_id uuid;
update announcement_qa_context c set session_id=(select e.session_id from public.enrollments e where e.member_id=c.member_id and e.status in ('invited','active','completed') limit 1);
create temporary table announcement_qa_ids (id uuid, label text);
with inserted as (
insert into public.announcements(session_id,title,body,published_at)
select null,'QA audience global','Temporary transaction-only test',now()
union all select session_id,'QA audience class','Temporary transaction-only test',now() from announcement_qa_context
union all select null,'QA audience draft','Temporary transaction-only test',null
union all select null,'QA audience future','Temporary transaction-only test',now()+interval '1 day'
returning id,title)
insert into announcement_qa_ids select id,title from inserted;
grant select on announcement_qa_ids,announcement_qa_context to authenticated;
select set_config('request.jwt.claim.sub',(select outsider::text from announcement_qa_context),true);
set local role authenticated;
do $$ begin
if (select count(*) from public.announcements where id in(select id from announcement_qa_ids)) <> 1 then raise exception 'Outsider must only see the global published post'; end if;
if exists(select 1 from public.announcements where id in(select id from announcement_qa_ids where label <> 'QA audience global')) then raise exception 'Audience leak'; end if;
begin
insert into public.announcements(title,body,published_at) values ('Unauthorized QA','Must fail',now());
raise exception 'Member insert was allowed';
exception when insufficient_privilege then null; end;
update public.announcements set body='Unauthorized' where id in(select id from announcement_qa_ids);
if found then raise exception 'Member update was allowed'; end if;
delete from public.announcements where id in(select id from announcement_qa_ids);
if found then raise exception 'Member delete was allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select member_id::text from announcement_qa_context),true);
do $$ begin
if (select count(*) from public.announcements where id in(select id from announcement_qa_ids)) <> 2 then raise exception 'Enrolled member must see global and own class post only'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select admin_id::text from announcement_qa_context),true);
do $$ begin
if (select count(*) from public.announcements where id in(select id from announcement_qa_ids)) <> 4 then raise exception 'Admin must see all posts including draft and future'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
if exists(select 1 from public.announcements where title like 'QA audience %') then raise exception 'Anonymous access allowed'; end if;
end $$;
reset role;
rollback;
select 'PASS: all-member and class audiences, drafts, future posts, admin visibility, member write denial, anonymous denial; all fixtures rolled back' as result;
