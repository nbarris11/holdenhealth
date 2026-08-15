-- Route administrator removal through a guarded function so the last admin,
-- or the active admin's own access, cannot be removed through the API.

drop policy "staff_roles_admin_only" on public.staff_roles;

create policy "staff_roles_admin_read" on public.staff_roles
for select to authenticated using ((select private.is_admin()));

create or replace function public.remove_admin(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_count integer;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot remove your own admin access';
  end if;

  select count(*) into admin_count from public.staff_roles where role = 'admin';
  if admin_count <= 1 then
    raise exception 'The last administrator cannot be removed';
  end if;

  delete from public.staff_roles where user_id = target_user_id and role = 'admin';
  return found;
end;
$$;

revoke all on function public.remove_admin(uuid) from public, anon;
grant execute on function public.remove_admin(uuid) to authenticated;
