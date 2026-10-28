-- Private coach-created one-class plans. Public registration still only accepts 2/3.
alter table public.enrollments drop constraint enrollments_weekly_commitment_check;
alter table public.enrollments add constraint enrollments_weekly_commitment_check check (weekly_commitment in (1,2,3));
alter table public.member_invitations drop constraint member_invitations_weekly_commitment_check;
alter table public.member_invitations add constraint member_invitations_weekly_commitment_check check (weekly_commitment in (1,2,3));
alter table public.checkout_orders drop constraint checkout_orders_weekly_commitment_check;
alter table public.checkout_orders add constraint checkout_orders_weekly_commitment_check check (weekly_commitment in (1,2,3));

create table public.private_signup_offers (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.sessions(id),
 full_name text not null check (length(full_name) between 2 and 140),
 email text not null check (email=lower(trim(email)) and length(email)<=254),
 class_meeting_ids uuid[] not null check (cardinality(class_meeting_ids)>0),
 class_assignments_synced_at timestamptz,
 attendance_time text not null check (attendance_time in ('Tuesday 6:00 AM','Wednesday 7:00 PM','Saturday 7:30 AM','Saturday 9:00 AM')),
 amount_cents integer not null check (amount_cents between 100 and 1000000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 email_sent_at timestamptz,
 checkout_order_id uuid references public.checkout_orders(id),
 unique(session_id,email)
);
alter table public.private_signup_offers enable row level security;
revoke all on public.private_signup_offers from public,anon,authenticated;
grant select,insert,update on public.private_signup_offers to service_role;
create index private_signup_offers_created_by_idx on public.private_signup_offers(created_by);
create index private_signup_offers_order_idx on public.private_signup_offers(checkout_order_id);

-- Service-only: caller checks safety/policy consent before reserving. Price,
-- identity and attendance always come from the coach's saved offer.
create function public.reserve_private_signup_checkout(p_offer_id uuid,p_phone text)
returns public.checkout_orders language plpgsql security invoker set search_path='' as $$
declare o public.private_signup_offers%rowtype; s public.sessions%rowtype; result public.checkout_orders%rowtype; n integer;
begin
 select * into o from public.private_signup_offers where id=p_offer_id;
 if o.id is null then raise exception 'Offer unavailable'; end if;
 -- Same session lock as public checkout prevents overselling between both paths.
 select * into s from public.sessions where id=o.session_id for update;
 select * into o from public.private_signup_offers where id=p_offer_id for update;
 if o.expires_at<=now() or s.status not in ('enrolling','active') or s.ends_on<(now() at time zone 'America/Detroit')::date then raise exception 'Offer unavailable'; end if;
 if not exists(select 1 from public.class_meetings where id=any(o.class_meeting_ids) and session_id=o.session_id and not cancelled and starts_at>now()) then raise exception 'Scheduled classes unavailable'; end if;
 if p_phone is null or length(trim(p_phone)) not between 7 and 40 then raise exception 'Invalid phone'; end if;
 if o.checkout_order_id is not null then
   select * into result from public.checkout_orders where id=o.checkout_order_id;
   if result.status in ('paid','payment_processing') then raise exception 'Payment already submitted'; end if;
   if result.status='reserved' then return result; end if;
 end if;
 if exists(select 1 from public.checkout_orders where session_id=o.session_id and email=o.email and status in ('reserved','payment_processing','paid'))
 or exists(select 1 from public.registration_requests where session_id=o.session_id and email=o.email and status in ('pending','approved'))
 or exists(select 1 from public.member_invitations where session_id=o.session_id and email=o.email and enrollment_status in ('invited','active','completed'))
 or exists(select 1 from public.enrollments e join public.member_contacts c on c.user_id=e.member_id where e.session_id=o.session_id and c.email=o.email and e.status in ('invited','active','completed'))
 then raise exception 'Enrollment already in progress'; end if;
 select
 (select count(*) from public.enrollments where session_id=o.session_id and status in ('invited','active')) +
 (select count(*) from public.member_invitations where session_id=o.session_id and claimed_at is null and enrollment_status in ('invited','active')) +
 (select count(*) from public.checkout_orders where session_id=o.session_id and ((status='reserved' and expires_at>now()) or status='payment_processing')) +
 (select count(*) from public.registration_requests where session_id=o.session_id and status='pending' and payment_method is not null)
 into n;
 if n>=s.capacity then raise exception 'Session full'; end if;
 insert into public.checkout_orders(session_id,full_name,email,phone,weekly_commitment,attendance_interest,amount_cents,adult_confirmed,exercise_clearance_confirmed,health_clearance_confirmed,policies_confirmed,expires_at)
 values(o.session_id,o.full_name,o.email,trim(p_phone),1,array[o.attendance_time],o.amount_cents+400,true,true,true,true,now()+interval '1 hour') returning * into result;
 update public.private_signup_offers set checkout_order_id=result.id where id=o.id;
 return result;
end $$;
revoke all on function public.reserve_private_signup_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_private_signup_checkout(uuid,text) to service_role;


-- Idempotent assignment after verified payment. New members are assigned after
-- their invitation creates their account; the paid offer covers the roster meantime.
create function public.sync_private_signup_classes(p_order_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare o public.private_signup_offers%rowtype; order_row public.checkout_orders%rowtype; target_enrollment_id uuid; assigned integer;
begin
 select * into o from public.private_signup_offers where checkout_order_id=p_order_id for update;
 if o.id is null or o.class_assignments_synced_at is not null then return 0; end if;
 select * into order_row from public.checkout_orders where id=p_order_id;
 if order_row.status<>'paid' then return 0; end if;
 select e.id into target_enrollment_id from public.enrollments e
 join public.member_invitations i on i.claimed_by=e.member_id and i.session_id=e.session_id
 where i.id=order_row.member_invitation_id and e.status in ('invited','active');
 if target_enrollment_id is null then return 0; end if;
 insert into public.attendance_selections(enrollment_id,meeting_id)
 select target_enrollment_id,m.id from public.class_meetings m
 where m.id=any(o.class_meeting_ids) and m.session_id=o.session_id and not m.cancelled and m.starts_at>now()
 on conflict (enrollment_id,meeting_id) do nothing;
 get diagnostics assigned=row_count;
 update public.private_signup_offers set class_assignments_synced_at=now() where id=o.id;
 return assigned;
end $$;
revoke all on function public.sync_private_signup_classes(uuid) from public,anon,authenticated;
grant execute on function public.sync_private_signup_classes(uuid) to service_role;
