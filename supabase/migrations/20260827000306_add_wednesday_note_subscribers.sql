-- Store Wednesday Note readers separately from program members and allow the
-- existing communication composer to email either audience.

create table public.wednesday_note_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  source text check (char_length(source) <= 200),
  email_opt_in boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index wednesday_note_subscribers_subscribed_at_idx
on public.wednesday_note_subscribers(subscribed_at desc);

alter table public.wednesday_note_subscribers enable row level security;

create policy "wednesday_note_subscribers_admin_select"
on public.wednesday_note_subscribers
for select to authenticated
using ((select private.is_admin()));

grant select on public.wednesday_note_subscribers to authenticated;

alter table public.communication_campaigns
drop constraint communication_campaigns_audience_check;

alter table public.communication_campaigns
add constraint communication_campaigns_audience_check
check (audience in ('all_active', 'two_day', 'three_day', 'wednesday_note'));

alter table public.communication_deliveries
drop constraint communication_deliveries_campaign_id_member_id_key;

alter table public.communication_deliveries
alter column member_id drop not null,
add column subscriber_id uuid references public.wednesday_note_subscribers(id) on delete cascade,
add constraint communication_deliveries_recipient_check
check (num_nonnulls(member_id, subscriber_id) = 1);

create unique index communication_deliveries_campaign_member_unique
on public.communication_deliveries(campaign_id, member_id)
where member_id is not null;

create unique index communication_deliveries_campaign_subscriber_unique
on public.communication_deliveries(campaign_id, subscriber_id)
where subscriber_id is not null;

create index communication_deliveries_subscriber_idx
on public.communication_deliveries(subscriber_id)
where subscriber_id is not null;

create or replace function private.process_communication_unsubscribe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_contacts
  set email_opt_in = false, unsubscribed_at = now(), updated_at = now()
  where unsubscribe_token = new.token and email_opt_in = true;

  update public.wednesday_note_subscribers
  set email_opt_in = false, unsubscribed_at = now(), updated_at = now()
  where unsubscribe_token = new.token and email_opt_in = true;

  return null;
end;
$$;

revoke all on function private.process_communication_unsubscribe() from public, anon, authenticated;
