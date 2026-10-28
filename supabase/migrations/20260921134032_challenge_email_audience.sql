-- Extend email history without changing membership or newsletter subscriptions.
alter table public.communication_campaigns
  drop constraint communication_campaigns_audience_check;
alter table public.communication_campaigns
  add constraint communication_campaigns_audience_check
  check (audience in ('all_active', 'two_day', 'three_day', 'wednesday_note', 'free_challenge'));
