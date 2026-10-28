-- Track verified Resend delivery, open, and click events for member communications.

alter table public.communication_deliveries
  add column delivered_at timestamptz,
  add column first_opened_at timestamptz,
  add column last_opened_at timestamptz,
  add column open_count integer not null default 0 check (open_count >= 0),
  add column first_clicked_at timestamptz,
  add column last_clicked_at timestamptz,
  add column click_count integer not null default 0 check (click_count >= 0),
  add column last_clicked_url text check (char_length(last_clicked_url) <= 2000);

alter table public.communication_deliveries
  drop constraint communication_deliveries_status_check;

alter table public.communication_deliveries
  add constraint communication_deliveries_status_check
  check (status in ('sent', 'delivered', 'delayed', 'bounced', 'complained', 'suppressed', 'failed'));

create unique index communication_deliveries_provider_id_idx
  on public.communication_deliveries(provider_id)
  where provider_id is not null;

create table private.resend_webhook_events (
  svix_id text primary key,
  provider_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

revoke all on table private.resend_webhook_events from public, anon, authenticated;

create or replace function public.ingest_resend_email_event(
  p_ingest_key text,
  p_event_id text,
  p_provider_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_clicked_url text default null,
  p_provider_message text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_ingest_key is null or extensions.digest(p_ingest_key, 'sha256') <> decode('bdbcd5713ae4e1dffdacf19cb799ea4b34ed2f9f8a7e7dfbbad64d4df1749fa4', 'hex') then
    raise exception 'invalid ingestion key' using errcode = '42501';
  end if;

  if p_event_id is null or char_length(p_event_id) > 200
    or p_provider_id is null or char_length(p_provider_id) > 200
    or p_event_type not in (
      'email.delivered', 'email.delivery_delayed', 'email.opened', 'email.clicked',
      'email.bounced', 'email.complained', 'email.suppressed', 'email.failed'
    ) then
    raise exception 'invalid event' using errcode = '22023';
  end if;

  insert into private.resend_webhook_events (svix_id, provider_id, event_type, occurred_at)
  values (p_event_id, p_provider_id, p_event_type, p_occurred_at)
  on conflict (svix_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return 'duplicate';
  end if;

  update public.communication_deliveries
  set
    status = case p_event_type
      when 'email.delivered' then case when status in ('bounced', 'complained', 'suppressed', 'failed') then status else 'delivered' end
      when 'email.delivery_delayed' then case when status = 'sent' then 'delayed' else status end
      when 'email.bounced' then 'bounced'
      when 'email.complained' then 'complained'
      when 'email.suppressed' then 'suppressed'
      when 'email.failed' then 'failed'
      else status
    end,
    delivered_at = case when p_event_type = 'email.delivered' then coalesce(delivered_at, p_occurred_at) else delivered_at end,
    first_opened_at = case when p_event_type = 'email.opened' then least(coalesce(first_opened_at, p_occurred_at), p_occurred_at) else first_opened_at end,
    last_opened_at = case when p_event_type = 'email.opened' then greatest(coalesce(last_opened_at, p_occurred_at), p_occurred_at) else last_opened_at end,
    open_count = open_count + case when p_event_type = 'email.opened' then 1 else 0 end,
    first_clicked_at = case when p_event_type = 'email.clicked' then least(coalesce(first_clicked_at, p_occurred_at), p_occurred_at) else first_clicked_at end,
    last_clicked_at = case when p_event_type = 'email.clicked' then greatest(coalesce(last_clicked_at, p_occurred_at), p_occurred_at) else last_clicked_at end,
    click_count = click_count + case when p_event_type = 'email.clicked' then 1 else 0 end,
    last_clicked_url = case when p_event_type = 'email.clicked' then left(p_clicked_url, 2000) else last_clicked_url end,
    error_message = case
      when p_event_type in ('email.bounced', 'email.complained', 'email.suppressed', 'email.failed')
        then left(coalesce(p_provider_message, p_event_type), 500)
      else error_message
    end
  where communication_deliveries.provider_id = p_provider_id;

  if found then
    return 'processed';
  end if;

  delete from private.resend_webhook_events where svix_id = p_event_id;
  return 'unmatched';
end;
$$;

revoke all on function public.ingest_resend_email_event(text, text, text, text, timestamptz, text, text) from public;
grant execute on function public.ingest_resend_email_event(text, text, text, text, timestamptz, text, text) to anon;
