-- Demo accounts remain available for portal previews but never appear in a
-- real member communication audience.

alter table public.member_contacts
add column is_test boolean not null default false;

update public.member_contacts
set is_test = true, updated_at = now()
where email like '%+demo.%';
