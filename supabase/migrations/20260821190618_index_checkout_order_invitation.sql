create index checkout_orders_member_invitation_idx
  on public.checkout_orders(member_invitation_id)
  where member_invitation_id is not null;
