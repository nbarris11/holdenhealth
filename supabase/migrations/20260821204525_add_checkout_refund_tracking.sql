alter table public.checkout_orders
  add column stripe_refund_id text unique,
  add column refund_status text
    check (refund_status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
  add column refund_amount_cents integer check (refund_amount_cents >= 0),
  add column refund_requested_at timestamptz,
  add column refund_requested_by uuid references auth.users(id) on delete set null,
  add column refunded_at timestamptz,
  add column refund_email_sent_at timestamptz;

create index checkout_orders_refund_requested_by_idx
  on public.checkout_orders(refund_requested_by)
  where refund_requested_by is not null;
