-- Emails about Kelsey's habit notes go out at most once per 12 hours per member, counted
-- from the last email sent. The claim is one atomic update, so simultaneous notes send one email.
alter table public.member_contacts add column habit_note_emailed_at timestamptz;

create function public.claim_habit_note_email(p_member uuid) returns text language sql security definer set search_path='' as $$
 update public.member_contacts set habit_note_emailed_at=now(), updated_at=now()
 where user_id=p_member and email_opt_in and unsubscribed_at is null and not is_test
  and (habit_note_emailed_at is null or habit_note_emailed_at < now()-interval '12 hours')
 returning email;
$$;
revoke all on function public.claim_habit_note_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_habit_note_email(uuid) to service_role;
