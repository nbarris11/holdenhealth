begin;
-- All fixture changes roll back, including the temporary bill on an existing relationship.
do $$
declare r coaching_relationships; b training_bills; a jsonb; aid uuid;
begin
 select * into r from coaching_relationships limit 1;
 if r.id is null then raise exception 'A coaching relationship is required for verification'; end if;
 insert into training_bills(relationship_id,member_id,billing_month,description,amount_cents,customer_email,due_on,created_by)
 values(r.id,r.member_id,'2098-01-01','ROLLBACK BILL TEST',20000,'qa@example.test','2098-01-05',r.coach_id) returning * into b;
 perform set_config('test.bill',b.id::text,true);
 perform set_config('test.member',r.member_id::text,true);
 begin
  insert into training_bills(relationship_id,member_id,billing_month,description,amount_cents,customer_email,due_on,created_by)
  values(r.id,r.member_id,'2098-01-01','duplicate',20000,'qa@example.test','2098-01-05',r.coach_id);
  raise exception 'Duplicate month allowed';
 exception when unique_violation then null; end;
 begin
  perform reserve_training_bill_checkout(b.id,gen_random_uuid());
  raise exception 'Wrong member allowed';
 exception when raise_exception then if sqlerrm='Wrong member allowed' then raise; end if; end;
 a:=reserve_training_bill_checkout(b.id,r.member_id); aid:=(a->'attempt'->>'id')::uuid;
 if reserve_training_bill_checkout(b.id,r.member_id)->'attempt'->>'id' <> aid::text then raise exception 'Duplicate reservation'; end if;
 begin
  perform close_training_bill(b.id,'cash'); raise exception 'Active checkout allowed offline payment';
 exception when raise_exception then if sqlerrm='Active checkout allowed offline payment' then raise; end if; end;
 begin
  perform update_training_bill_checkout(aid,'cs_rollback','paid',100,'pi_rollback'); raise exception 'Wrong amount accepted';
 exception when raise_exception then if sqlerrm='Wrong amount accepted' then raise; end if; end;
 perform update_training_bill_checkout(aid,'cs_rollback','open',20400,null);
 perform update_training_bill_checkout(aid,'cs_rollback','paid',20400,'pi_rollback');
 perform update_training_bill_checkout(aid,'cs_rollback','expired',20400,null);
 if (select status from training_bills where id=b.id)<>'paid' then raise exception 'Late event downgraded paid'; end if;
 perform update_training_bill_checkout(aid,'cs_rollback','paid',20400,'pi_rollback');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member'),true);
do $$ begin
 if (select count(*) from training_bills where id=current_setting('test.bill')::uuid)<>1 then raise exception 'Owner cannot read bill'; end if;
 begin
  update training_bills set amount_cents=100 where id=current_setting('test.bill')::uuid; raise exception 'Member changed amount';
 exception when insufficient_privilege then null; end;
 begin
  perform close_training_bill(current_setting('test.bill')::uuid,'cash'); raise exception 'Member called private RPC';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if exists(select 1 from training_bills where id=current_setting('test.bill')::uuid) then raise exception 'Other member read bill'; end if;
end $$;
reset role;
rollback;
select 'Billing state transitions, duplicate prevention, and member permissions passed; fixtures rolled back' as result;
