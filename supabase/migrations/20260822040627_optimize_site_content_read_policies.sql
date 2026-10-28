drop policy if exists "site_content_published_read" on public.site_content;
drop policy if exists "site_content_admin_read" on public.site_content;

create policy "site_content_public_read"
on public.site_content for select
to anon
using (published);

create policy "site_content_authenticated_read"
on public.site_content for select
to authenticated
using (published or (select private.is_admin()));
