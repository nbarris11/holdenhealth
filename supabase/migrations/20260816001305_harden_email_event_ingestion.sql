-- Keep the privileged event processor private and expose only a write-only,
-- secret-validated ingestion table to the webhook route.

revoke all on function public.ingest_resend_email_event(text, text, text, text, timestamptz, text, text) from public, anon, authenticated;
drop function public.ingest_resend_email_event(text, text, text, text, timestamptz, text, text);

create table public.resend_webhook_ingest (
  ingest_key text not null,
  event_id text not null,
  provider_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  clicked_url text,
  provider_message text
);

alter table public.resend_webhook_ingest enable row level security;

create policy "resend_webhook_secret_insert"
on public.resend_webhook_ingest
for insert
to anon
with check (
  extensions.digest(ingest_key, 'sha256') = decode('bdbcd5713ae4e1dffdacf19cb799ea4b34ed2f9f8a7e7dfbbad64d4df1749fa4', 'hex')
);

grant insert on public.resend_webhook_ingest to anon;

create or replace function private.process_resend_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if new.ingest_key is null or extensions.digest(new.ingest_key, 'sha256') <> decode('bdbcd5713ae4e1dffdacf19cb799ea4b34ed2f9f8a7e7dfbbad64d4df1749fa4', 'hex') then
    raise exception 'invalid ingestion key' using errcode = '42501';
  end if;

  if new.event_id is null or char_length(new.event_id) > 200
    or new.provider_id is null or char_length(new.provider_id) > 200
    or new.event_type not in (
      'email.delivered', 'email.delivery_delayed', 'email.opened', 'email.clicked',
      'email.bounced', 'email.complained', 'email.suppressed', 'email.failed'
    ) then
    raise exception 'invalid event' using errcode = '22023';
  end if;

  insert into private.resend_webhook_events (svix_id, provider_id, event_type, occurred_at)
  values (new.event_id, new.provider_id, new.event_type, new.occurred_at)
  on conflict (svix_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return null;
  end if;

  update public.communication_deliveries
  set
    status = case new.event_type
      when 'email.delivered' then case when status in ('bounced', 'complained', 'suppressed', 'failed') then status else 'delivered' end
      when 'email.delivery_delayed' then case when status = 'sent' then 'delayed' else status end
      when 'email.bounced' then 'bounced'
      when 'email.complained' then 'complained'
      when 'email.suppressed' then 'suppressed'
      when 'email.failed' then 'failed'
      else status
    end,
    delivered_at = case when new.event_type = 'email.delivered' then coalesce(delivered_at, new.occurred_at) else delivered_at end,
    first_opened_at = case when new.event_type = 'email.opened' then least(coalesce(first_opened_at, new.occurred_at), new.occurred_at) else first_opened_at end,
    last_opened_at = case when new.event_type = 'email.opened' then greatest(coalesce(last_opened_at, new.occurred_at), new.occurred_at) else last_opened_at end,
    open_count = open_count + case when new.event_type = 'email.opened' then 1 else 0 end,
    first_clicked_at = case when new.event_type = 'email.clicked' then least(coalesce(first_clicked_at, new.occurred_at), new.occurred_at) else first_clicked_at end,
    last_clicked_at = case when new.event_type = 'email.clicked' then greatest(coalesce(last_clicked_at, new.occurred_at), new.occurred_at) else last_clicked_at end,
    click_count = click_count + case when new.event_type = 'email.clicked' then 1 else 0 end,
    last_clicked_url = case when new.event_type = 'email.clicked' then left(new.clicked_url, 2000) else last_clicked_url end,
    error_message = case
      when new.event_type in ('email.bounced', 'email.complained', 'email.suppressed', 'email.failed')
        then left(coalesce(new.provider_message, new.event_type), 500)
      else error_message
    end
  where communication_deliveries.provider_id = new.provider_id;

  if not found then
    delete from private.resend_webhook_events where svix_id = new.event_id;
    raise exception 'unmatched email provider id' using errcode = '23503';
  end if;

  return null;
end;
$$;

revoke all on function private.process_resend_webhook_event() from public, anon, authenticated;

create trigger process_resend_webhook_event
before insert on public.resend_webhook_ingest
for each row execute function private.process_resend_webhook_event();
