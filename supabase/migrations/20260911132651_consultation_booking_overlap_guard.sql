create or replace function private.prevent_consultation_overlap()
returns trigger language plpgsql security definer set search_path='' as $$
declare candidate public.consultation_slots%rowtype;
begin
 if new.status <> 'booked' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(731921, 1);
 select * into candidate from public.consultation_slots where id=new.slot_id;
 if not candidate.active or candidate.starts_at<=now() then raise exception 'This time is no longer available' using errcode='23505'; end if;
 if exists(select 1 from public.consultation_bookings b join public.consultation_slots s on s.id=b.slot_id
 where b.status='booked' and b.id<>new.id
 and s.starts_at<candidate.starts_at+make_interval(mins=>candidate.duration_minutes)
 and s.starts_at+make_interval(mins=>s.duration_minutes)>candidate.starts_at)
 then raise exception 'This time overlaps another booking' using errcode='23505'; end if;
 return new;
end $$;
revoke all on function private.prevent_consultation_overlap() from public,anon,authenticated;
create trigger consultation_no_overlap before insert or update of slot_id,status on public.consultation_bookings
for each row execute function private.prevent_consultation_overlap();
