create function private.chat_current_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or private.chat_paid_member(auth.uid()));
$$;
revoke all on function private.chat_current_access() from public,anon;
grant execute on function private.chat_current_access() to authenticated;
create or replace function public.chat_has_access() returns boolean language sql stable security invoker set search_path='' as $$
 select private.chat_current_access();
$$;
