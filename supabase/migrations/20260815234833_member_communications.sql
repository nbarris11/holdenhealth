-- Branded member communications, recipient preferences, and delivery history.

create table public.member_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  email_opt_in boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete set null,
  kind text not null check (kind in ('newsletter', 'session_update', 'reminder')),
  audience text not null check (audience in ('all_active', 'two_day', 'three_day')),
  subject text not null check (char_length(subject) between 1 and 140),
  preheader text not null default '' check (char_length(preheader) <= 180),
  heading text not null check (char_length(heading) between 1 and 180),
  body text not null check (char_length(body) between 1 and 6000),
  cta_label text check (char_length(cta_label) <= 80),
  cta_url text check (char_length(cta_url) <= 700),
  status text not null default 'sending' check (status in ('sending', 'sent', 'partial', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_by uuid not null references auth.users(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.communication_campaigns(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null check (status in ('sent', 'failed')),
  provider_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, member_id)
);

create index communication_campaigns_created_at_idx on public.communication_campaigns(created_at desc);
create index communication_campaigns_session_idx on public.communication_campaigns(session_id);
create index communication_deliveries_campaign_idx on public.communication_deliveries(campaign_id);
create index communication_deliveries_member_idx on public.communication_deliveries(member_id);

alter table public.member_contacts enable row level security;
alter table public.communication_campaigns enable row level security;
alter table public.communication_deliveries enable row level security;

create policy "member_contacts_admin_select" on public.member_contacts
for select to authenticated using ((select private.is_admin()));

create policy "campaigns_admin_select" on public.communication_campaigns
for select to authenticated using ((select private.is_admin()));
create policy "campaigns_admin_insert" on public.communication_campaigns
for insert to authenticated with check ((select private.is_admin()) and created_by = (select auth.uid()));
create policy "campaigns_admin_update" on public.communication_campaigns
for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "deliveries_admin_select" on public.communication_deliveries
for select to authenticated using ((select private.is_admin()));
create policy "deliveries_admin_insert" on public.communication_deliveries
for insert to authenticated with check ((select private.is_admin()));

grant select on public.member_contacts to authenticated;
grant select, insert, update on public.communication_campaigns to authenticated;
grant select, insert on public.communication_deliveries to authenticated;

create or replace function private.sync_member_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  insert into public.member_contacts (user_id, email)
  values (new.id, lower(new.email))
  on conflict (user_id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

revoke all on function private.sync_member_contact() from public, anon, authenticated;

create trigger sync_member_contact_from_auth
after insert or update of email on auth.users
for each row execute function private.sync_member_contact();

insert into public.member_contacts (user_id, email)
select id, lower(email) from auth.users where email is not null
on conflict (user_id) do update set email = excluded.email, updated_at = now();

create or replace function public.unsubscribe_member_communications(token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_contacts
  set email_opt_in = false, unsubscribed_at = now(), updated_at = now()
  where unsubscribe_token = token and email_opt_in = true;
  return found;
end;
$$;

revoke all on function public.unsubscribe_member_communications(uuid) from public;
grant execute on function public.unsubscribe_member_communications(uuid) to anon, authenticated;
