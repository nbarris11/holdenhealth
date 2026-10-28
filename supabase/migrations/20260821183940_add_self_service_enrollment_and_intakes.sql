-- Self-service ACH enrollment, capacity-safe checkout reservations, and secure member intake.

alter type public.payment_method add value if not exists 'stripe_ach';

-- System-created invitations do not have a staff actor. Admin-created invitations still
-- provide invited_by and remain protected by their existing RLS policies.
alter table public.member_invitations alter column invited_by drop not null;

create table public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 140),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text not null check (char_length(phone) between 7 and 40),
  weekly_commitment smallint not null check (weekly_commitment in (2, 3)),
  attendance_interest text[] not null default '{}',
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'payment_processing', 'paid', 'payment_failed', 'expired', 'cancelled')),
  adult_confirmed boolean not null default false check (adult_confirmed),
  exercise_clearance_confirmed boolean not null default false check (exercise_clearance_confirmed),
  health_clearance_confirmed boolean not null default false check (health_clearance_confirmed),
  policies_confirmed boolean not null default false check (policies_confirmed),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  member_invitation_id uuid references public.member_invitations(id) on delete set null,
  expires_at timestamptz not null,
  paid_at timestamptz,
  portal_invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index checkout_orders_open_email_idx
  on public.checkout_orders (session_id, email)
  where status in ('reserved', 'payment_processing', 'paid');
create index checkout_orders_session_capacity_idx
  on public.checkout_orders (session_id, status, expires_at);
create index checkout_orders_payment_intent_idx
  on public.checkout_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create trigger checkout_orders_set_updated_at before update on public.checkout_orders
for each row execute function public.set_updated_at();

alter table public.checkout_orders enable row level security;
revoke all on public.checkout_orders from public, anon, authenticated;
grant select, insert, update on public.checkout_orders to service_role;

create or replace function public.reserve_checkout_order(
  p_session_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_weekly_commitment smallint,
  p_attendance_interest text[]
)
returns public.checkout_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  reserved_count integer;
  expected_amount integer;
  new_order public.checkout_orders%rowtype;
begin
  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if session_row.id is null or not session_row.published or session_row.status <> 'enrolling' then
    raise exception 'This session is not accepting online enrollment.';
  end if;

  if p_weekly_commitment = 2 then
    expected_amount := session_row.two_day_price_cents;
  elsif p_weekly_commitment = 3 then
    expected_amount := session_row.three_day_price_cents;
  end if;

  if expected_amount is null then
    raise exception 'That plan is not available for this session.';
  end if;

  if exists (
    select 1 from public.checkout_orders
    where session_id = p_session_id and email = lower(trim(p_email))
      and status in ('reserved', 'payment_processing', 'paid')
  ) then
    raise exception 'An enrollment is already in progress for this email address.';
  end if;

  select
    (select count(*) from public.enrollments
      where session_id = p_session_id and status in ('invited', 'active'))
    +
    (select count(*) from public.member_invitations
      where session_id = p_session_id and claimed_at is null
        and enrollment_status in ('invited', 'active'))
    +
    (select count(*) from public.checkout_orders
      where session_id = p_session_id
        and (
          (status = 'reserved' and expires_at > now())
          or status = 'payment_processing'
        ))
  into reserved_count;

  if reserved_count >= session_row.capacity then
    raise exception 'This session is currently full.';
  end if;

  insert into public.checkout_orders (
    session_id, full_name, email, phone, weekly_commitment, attendance_interest,
    amount_cents, adult_confirmed, exercise_clearance_confirmed,
    health_clearance_confirmed, policies_confirmed, expires_at
  ) values (
    p_session_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone),
    p_weekly_commitment, p_attendance_interest, expected_amount,
    true, true, true, true, now() + interval '30 minutes'
  ) returning * into new_order;

  return new_order;
end;
$$;

revoke all on function public.reserve_checkout_order(uuid, text, text, text, smallint, text[]) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order(uuid, text, text, text, smallint, text[]) to service_role;

create table public.member_intakes (
  enrollment_id uuid primary key references public.enrollments(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  health_review_required boolean not null default false,
  acknowledgment_version text not null,
  signed_name text not null check (char_length(signed_name) between 2 and 140),
  signed_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_intakes_member_idx on public.member_intakes(member_id);
create index member_intakes_review_queue_idx
  on public.member_intakes(health_review_required, submitted_at)
  where reviewed_at is null;
create index member_intakes_reviewer_idx on public.member_intakes(reviewed_by)
  where reviewed_by is not null;
create trigger member_intakes_set_updated_at before update on public.member_intakes
for each row execute function public.set_updated_at();

alter table public.member_intakes enable row level security;

create policy "member_intakes_select_self_or_admin" on public.member_intakes
for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));

create policy "member_intakes_member_insert" on public.member_intakes
for insert to authenticated
with check (
  member_id = (select auth.uid())
  and reviewed_at is null
  and reviewed_by is null
  and exists (
    select 1 from public.enrollments enrollment
    where enrollment.id = member_intakes.enrollment_id
      and enrollment.member_id = (select auth.uid())
      and enrollment.status in ('invited', 'active')
  )
);

create policy "member_intakes_admin_update" on public.member_intakes
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, insert, update on public.member_intakes to authenticated;

comment on table public.member_intakes is
  'Member-submitted coaching and health intake. Health details must not be copied into email notifications.';
