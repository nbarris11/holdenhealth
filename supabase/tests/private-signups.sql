-- Run inside a transaction and roll back. No auth users, payments or emails created.
do $$
declare s uuid; o uuid; o2 uuid; coach uuid; r public.checkout_orders%rowtype; retry public.checkout_orders%rowtype; denied boolean; meeting uuid; invitation uuid; count_assigned integer;
begin
 select user_id into coach from public.staff_roles where role='admin' limit 1;
 insert into public.sessions(name,slug,address_line,starts_on,ends_on,capacity,new_member_price_cents,two_day_price_cents,three_day_price_cents,status,published)
 values('Private signup rollback test','private-signup-qa-'||gen_random_uuid(),'QA',current_date+10,current_date+52,1,19900,19900,24900,'enrolling',true) returning id into s;
 insert into public.class_meetings(session_id,starts_at,ends_at) values(s,(current_date+11)::timestamptz+interval '13 hours',(current_date+11)::timestamptz+interval '14 hours') returning id into meeting;
 insert into public.private_signup_offers(session_id,full_name,email,attendance_time,amount_cents,created_by,class_meeting_ids)
 values(s,'QA Private','private-qa@example.invalid','Saturday 9:00 AM',9995,coach,array[meeting]) returning id into o;
 perform set_config('role','service_role',true);
 r:=public.reserve_private_signup_checkout(o,'5555555555');
 assert r.amount_cents=10395 and r.weekly_commitment=1 and r.email='private-qa@example.invalid' and r.attendance_interest=array['Saturday 9:00 AM'], 'Server price/plan binding failed';
 retry:=public.reserve_private_signup_checkout(o,'5551234567');
 assert retry.id=r.id, 'Repeat request must reuse original order';
 insert into public.private_signup_offers(session_id,full_name,email,attendance_time,amount_cents,created_by,class_meeting_ids)
 values(s,'QA Other','other-qa@example.invalid','Saturday 9:00 AM',9900,coach,array[meeting]) returning id into o2;
 denied:=false;begin perform public.reserve_private_signup_checkout(o2,'5555555555');exception when others then denied:=sqlerrm like '%full%';end;
 assert denied,'Private capacity limit failed';
 denied:=false;begin perform public.reserve_checkout_order(s,'QA Public','public-qa@example.invalid','5555555555',2::smallint,array['Saturday 9:00 AM']);exception when others then denied:=sqlerrm like '%full%';end;
 assert denied,'Public/private shared capacity failed';
 update public.checkout_orders set status='payment_processing' where id=r.id;
 denied:=false;begin perform public.reserve_private_signup_checkout(o,'5555555555');exception when others then denied:=sqlerrm like '%already submitted%';end;
 assert denied,'Processing duplicate protection failed';
 update public.checkout_orders set status='paid' where id=r.id;
 denied:=false;begin perform public.reserve_private_signup_checkout(o,'5555555555');exception when others then denied:=sqlerrm like '%already submitted%';end;
 assert denied,'Paid duplicate protection failed';
 assert public.sync_private_signup_classes(r.id)=0, 'Unclaimed signup should wait for account setup';
 perform set_config('role','postgres',true);
 insert into public.member_invitations(session_id,email,full_name,invited_by,enrollment_status,weekly_commitment,payment_status,payment_method,amount_cents)
 values(s,(select lower(email) from auth.users where id=coach),'QA Private',coach,'invited',1,'paid','stripe_card',10395) returning id into invitation;
 update public.checkout_orders set member_invitation_id=invitation where id=r.id;
 perform set_config('role','service_role',true);
 count_assigned:=public.sync_private_signup_classes(r.id);
 assert count_assigned=1,'Paid class was not assigned';
 assert public.sync_private_signup_classes(r.id)=0,'Retry assigned classes again';
 assert (select count(*) from public.attendance_selections where meeting_id=meeting)=1,'Class roster missing';
 delete from public.attendance_selections where meeting_id=meeting;
 assert public.sync_private_signup_classes(r.id)=0,'Retry must not undo later member choices';
 -- Public RPC must continue to reject 1x even after the storage constraints expand.
 denied:=false;begin perform public.reserve_checkout_order(s,'QA Public','public-qa@example.invalid','5555555555',1::smallint,array['Saturday 9:00 AM']);exception when others then denied:=sqlerrm like '%plan is not available%';end;
 assert denied,'Public one-class signup was exposed';
 update public.private_signup_offers set expires_at=now()-interval '1 second' where id=o2;
 denied:=false;begin perform public.reserve_private_signup_checkout(o2,'5555555555');exception when others then denied:=sqlerrm like '%unavailable%';end;
 assert denied,'Expired offer accepted';
 assert not has_table_privilege('anon','public.private_signup_offers','select'), 'Anonymous table access';
 assert not has_table_privilege('authenticated','public.private_signup_offers','select'), 'Member table access';
 assert not has_function_privilege('anon','public.reserve_private_signup_checkout(uuid,text)','execute'), 'Anonymous RPC access';
 assert not has_function_privilege('authenticated','public.reserve_private_signup_checkout(uuid,text)','execute'), 'Member RPC access';
 assert has_function_privilege('service_role','public.reserve_private_signup_checkout(uuid,text)','execute'), 'Missing service RPC access';
 perform set_config('role','postgres',true);
end $$;
