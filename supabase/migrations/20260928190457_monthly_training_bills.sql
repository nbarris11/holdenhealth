-- Monthly bills are manually issued and paid. No subscriptions or scheduled charges.
create table public.training_bills (
 id uuid primary key default gen_random_uuid(),
 relationship_id uuid not null references public.coaching_relationships(id),
 member_id uuid not null references public.profiles(id),
 billing_month date not null check (extract(day from billing_month)=1),
 description text not null check (length(description) between 1 and 500),
 amount_cents integer not null check (amount_cents between 100 and 1000000),
 customer_email text not null,
 due_on date not null,
 status text not null default 'unpaid' check(status in ('unpaid','processing','paid','void')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 emailed_at timestamptz,
 paid_at timestamptz,
 payment_method text check(payment_method in ('stripe_card','cash','check','venmo')),
 stripe_payment_intent_id text unique
);
create unique index training_bills_one_month on public.training_bills(relationship_id,billing_month) where status <> 'void';
create index training_bills_member on public.training_bills(member_id,billing_month desc);
alter table public.training_bills enable row level security;
revoke all on public.training_bills from anon, authenticated;
grant select on public.training_bills to authenticated;
grant all on public.training_bills to service_role;
create policy training_bills_read on public.training_bills for select to authenticated using (
 member_id=(select auth.uid()) or exists(select 1 from public.staff_roles where user_id=(select auth.uid()) and role='admin')
);

create table public.training_bill_checkouts (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.training_bills(id),
 state text not null default 'creating' check(state in ('creating','open','processing','paid','expired','failed')),
 stripe_session_id text unique,
 expires_at timestamptz not null default now()+interval '31 minutes',
 created_at timestamptz not null default now()
);
create unique index training_bill_active_checkout on public.training_bill_checkouts(bill_id) where state in ('creating','open','processing');
alter table public.training_bill_checkouts enable row level security;
revoke all on public.training_bill_checkouts from anon, authenticated;
grant all on public.training_bill_checkouts to service_role;

create function public.reserve_training_bill_checkout(p_bill_id uuid,p_member_id uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare b training_bills; a training_bill_checkouts;
begin
 select * into b from training_bills where id=p_bill_id and member_id=p_member_id for update;
 if not found or b.status <> 'unpaid' then raise exception 'Bill is not available for payment.'; end if;
 -- Unattached sessions never reach the client. Explicit Stripe expiry makes recovery safe.
 update training_bill_checkouts set state='expired' where bill_id=b.id and state='creating' and stripe_session_id is null and expires_at < now();
 select * into a from training_bill_checkouts where bill_id=b.id and state in ('creating','open','processing');
 if not found then insert into training_bill_checkouts(bill_id) values(b.id) returning * into a; end if;
 return jsonb_build_object('bill',to_jsonb(b),'attempt',to_jsonb(a));
end $$;

create function public.update_training_bill_checkout(p_attempt_id uuid,p_session_id text,p_state text,p_total integer,p_intent text default null) returns void
language plpgsql security invoker set search_path=public as $$
declare b training_bills; a training_bill_checkouts; bid uuid;
begin
 select bill_id into bid from training_bill_checkouts where id=p_attempt_id;
 select * into b from training_bills where id=bid for update;
 select * into a from training_bill_checkouts where id=p_attempt_id for update;
 if a.id is null or p_total <> b.amount_cents+400 or p_total is null then raise exception 'Checkout does not match bill.'; end if;
 if a.stripe_session_id is not null and a.stripe_session_id <> p_session_id then raise exception 'Checkout session mismatch.'; end if;
 if p_session_id is null or p_state not in ('open','processing','paid','expired','failed') then raise exception 'Invalid checkout update.'; end if;
 if b.status in ('paid','void') or a.state='paid' then return; end if;
 -- An old closed attempt cannot overwrite a new attempt or a manual payment.
 if a.state in ('expired','failed') then return; end if;
 if p_state='open' and a.state <> 'creating' then return; end if;
 update training_bill_checkouts set stripe_session_id=p_session_id,state=p_state where id=a.id;
 if p_state='paid' then
   if p_intent is null then raise exception 'Missing payment reference.'; end if;
   update training_bills set status='paid',paid_at=now(),payment_method='stripe_card',stripe_payment_intent_id=p_intent where id=b.id;
 elsif p_state='processing' then update training_bills set status='processing' where id=b.id;
 elsif p_state in ('expired','failed') then update training_bills set status='unpaid' where id=b.id;
 end if;
end $$;

create function public.close_training_bill(p_bill_id uuid,p_method text) returns void
language plpgsql security invoker set search_path=public as $$
declare b training_bills;
begin
 select * into b from training_bills where id=p_bill_id for update;
 if not found or b.status <> 'unpaid' then raise exception 'Only an unpaid bill can be changed.'; end if;
 update training_bill_checkouts set state='expired' where bill_id=b.id and state='creating' and stripe_session_id is null and expires_at < now();
 if exists(select 1 from training_bill_checkouts where bill_id=b.id and state in ('creating','open','processing')) then raise exception 'Checkout is active. Refresh payment status and try again.'; end if;
 if p_method='void' then update training_bills set status='void' where id=b.id;
 elsif p_method in ('cash','check','venmo') then update training_bills set status='paid',paid_at=now(),payment_method=p_method where id=b.id;
 else raise exception 'Invalid payment method.';
 end if;
end $$;
revoke all on function public.reserve_training_bill_checkout(uuid,uuid) from public,anon,authenticated;
revoke all on function public.update_training_bill_checkout(uuid,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.close_training_bill(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_training_bill_checkout(uuid,uuid) to service_role;
grant execute on function public.update_training_bill_checkout(uuid,text,text,integer,text) to service_role;
grant execute on function public.close_training_bill(uuid,text) to service_role;
