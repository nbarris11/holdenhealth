create table public.workout_library (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 kind text not null check (kind in ('exercise','block','workout')),
 content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 250000),
 created_at timestamptz not null default now()
);
alter table public.workout_library enable row level security;
revoke all on public.workout_library from anon, authenticated;
grant select, insert, delete on public.workout_library to authenticated;
create policy library_read on public.workout_library for select to authenticated using ((select private.is_admin()));
create policy library_save on public.workout_library for insert to authenticated with check ((select private.is_admin()));
create policy library_delete on public.workout_library for delete to authenticated using ((select private.is_admin()));
