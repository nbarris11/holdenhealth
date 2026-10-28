-- Existing class enrollments keep their original intake requirements.
-- Enrollments created after this migration require a class risk agreement.
alter table public.enrollments add column risk_agreement_required boolean not null default false;
alter table public.enrollments alter column risk_agreement_required set default true;

create table public.risk_agreements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  context text not null check (context in ('personal_training', 'group_class')),
  relationship_id uuid unique references public.coaching_relationships(id) on delete cascade,
  enrollment_id uuid unique references public.enrollments(id) on delete cascade,
  document_version text not null check (char_length(document_version) between 8 and 100),
  document_text text not null check (char_length(document_text) > 500),
  client_name text not null check (char_length(client_name) between 2 and 140),
  phone text not null,
  email text not null,
  emergency_contact text not null,
  emergency_contact_phone text not null,
  preferred_communication text not null check (preferred_communication in ('Text', 'Email', 'Phone')),
  acknowledgments jsonb not null check (jsonb_typeof(acknowledgments) = 'array' and jsonb_array_length(acknowledgments) = 6),
  printed_name text not null check (char_length(printed_name) between 2 and 140),
  signature text not null check (char_length(signature) between 2 and 140),
  signed_on date not null,
  signed_at timestamptz not null default now(),
  representative_name text,
  representative_signed_on date,
  representative_signed_at timestamptz,
  check ((relationship_id is null) <> (enrollment_id is null)),
  check ((context = 'personal_training' and relationship_id is not null) or
         (context = 'group_class' and enrollment_id is not null))
);

create index risk_agreements_member_idx on public.risk_agreements(member_id);
alter table public.risk_agreements enable row level security;
revoke all on public.risk_agreements from public, anon, authenticated;

create policy "risk_agreements_read_self_or_admin" on public.risk_agreements
for select to authenticated
using (member_id = (select auth.uid()) or (select private.is_admin()));

create policy "risk_agreements_member_sign" on public.risk_agreements
for insert to authenticated
with check (
  member_id = (select auth.uid())
  and representative_name is null and representative_signed_on is null and representative_signed_at is null
  and (
    (context = 'personal_training' and exists (
      select 1 from public.coaching_relationships r
      join public.personal_training_intakes i on i.relationship_id = r.id
      where r.id = risk_agreements.relationship_id and r.member_id = (select auth.uid())
        and r.status in ('invited', 'active')
    ))
    or
    (context = 'group_class' and exists (
      select 1 from public.enrollments e
      join public.member_intakes i on i.enrollment_id = e.id
      where e.id = risk_agreements.enrollment_id and e.member_id = (select auth.uid())
        and e.risk_agreement_required and e.status in ('invited', 'active')
    ))
  )
);

create policy "risk_agreements_admin_countersign" on public.risk_agreements
for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

grant select, insert, update on public.risk_agreements to authenticated;

comment on table public.risk_agreements is
  'Signed risk agreement per personal-training relationship or new class enrollment. document_text preserves the exact wording the client accepted.';
