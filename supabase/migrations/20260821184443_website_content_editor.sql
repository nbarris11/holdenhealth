create table public.website_content (
  page_key text primary key check (page_key = 'homepage'),
  hero_eyebrow text not null,
  hero_heading text not null,
  hero_body text not null,
  primary_cta_label text not null,
  primary_cta_url text not null,
  secondary_cta_label text not null,
  secondary_cta_url text not null,
  offer_eyebrow text not null,
  offer_heading text not null,
  offer_body text not null,
  offer_cta_label text not null,
  offer_cta_url text not null,
  final_heading text not null,
  final_body text not null,
  final_cta_label text not null,
  final_cta_url text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.website_content enable row level security;

create policy "website_content_public_read"
on public.website_content for select
to anon, authenticated
using (true);

create policy "website_content_admin_update"
on public.website_content for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select on public.website_content to anon, authenticated;
grant update on public.website_content to authenticated;

insert into public.website_content (
  page_key,
  hero_eyebrow,
  hero_heading,
  hero_body,
  primary_cta_label,
  primary_cta_url,
  secondary_cta_label,
  secondary_cta_url,
  offer_eyebrow,
  offer_heading,
  offer_body,
  offer_cta_label,
  offer_cta_url,
  final_heading,
  final_body,
  final_cta_label,
  final_cta_url
) values (
  'homepage',
  'Focus on You · October 14–November 21 · Plymouth',
  'Come get stronger with people who''ll be glad you showed up.',
  'Six weeks of total-body training, practical nutrition support, and real accountability with me, Kelsey. Choose two or three classes each week and come as you are.',
  'See the first 6-week session',
  'coaching.html',
  'Ask Kelsey about it',
  'book.html',
  'Now enrolling · October 14–November 21',
  'Six weeks. Your choice of two or three days. One supportive room.',
  'Join up to 25 people for one-hour, total-body sessions in Plymouth. Choose any two weekly classes for $199 or attend all three for $249.',
  'See dates, prices & details',
  'coaching.html',
  'October is where Focus on You begins.',
  'The first six-week session runs October 14–November 21 in Plymouth. Choose two days per week for $199 or three for $249.',
  'Request a place',
  'https://portal.holden.health/register'
);
