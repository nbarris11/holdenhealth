-- The webhook ingestion surface is write-only. The trigger discards rows after
-- processing, and no public role may read or modify it.

revoke all on table public.resend_webhook_ingest from public, anon, authenticated;
grant insert on table public.resend_webhook_ingest to anon;
