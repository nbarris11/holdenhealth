drop policy if exists sessions_public_read on public.sessions;

create policy sessions_public_read
on public.sessions
for select
to anon, authenticated
using (published);

create policy sessions_admin_read
on public.sessions
for select
to authenticated
using ((select private.is_admin()));
