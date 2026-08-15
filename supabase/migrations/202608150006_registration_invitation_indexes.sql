create index if not exists member_invitations_invited_by_idx
  on public.member_invitations (invited_by);

create index if not exists member_invitations_claimed_by_idx
  on public.member_invitations (claimed_by);

create index if not exists registration_requests_reviewed_by_idx
  on public.registration_requests (reviewed_by);
