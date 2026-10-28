alter table public.checkout_orders
  add column payment_submitted_notified_at timestamptz,
  add column payment_paid_notified_at timestamptz,
  add column payment_failed_notified_at timestamptz;

comment on column public.checkout_orders.payment_submitted_notified_at is
  'When the customer and coach were notified that an ACH payment was submitted.';
comment on column public.checkout_orders.payment_paid_notified_at is
  'When the customer and coach were notified that an ACH payment cleared.';
comment on column public.checkout_orders.payment_failed_notified_at is
  'When the customer and coach were notified that an ACH payment failed.';
