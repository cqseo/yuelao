-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
insert into public.profiles(id,email) values ('00000000-0000-4000-8000-000000000001','local-test@example.invalid');
insert into public.sticks(id,no,grade,level,knot,knot_name,poem,verdict_him,verdict_single,verdict_reunion)
values (1,'第一籤','上上籤',5,'tongxin','同心結','測試籤','測試','測試','測試');
insert into public.orders(id,user_id,product_id,product_kind,amount,currency,status,locale,pack_uses)
values ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','pack_3','pack',4800,'HKD','pending','zh-Hant',3),
       ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','pack_8','pack',10800,'HKD','pending','zh-Hant',8),
       ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','pack_3','pack',4800,'HKD','pending','zh-Hant',3);
do $$
declare v_result text; v_count int;
begin
  select public.settle_stripe_payment('evt_first','checkout.session.completed','stripe',
    'pi_good','pi_good','00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid,'pack_3',4800,'hkd',true,0,
    null,null,null,null,now(),now()) into v_result;
  if v_result <> 'granted' then raise exception 'first grant: %', v_result; end if;
  select count(*) into v_count from public.entitlements
    where order_id='00000000-0000-4000-8000-000000000101'::uuid;
  if v_count <> 1 then raise exception 'wrong first grant count: %', v_count; end if;
  raise notice 'PASS: first payment grants exactly one pack';

  select public.settle_stripe_payment('evt_second','charge.updated','stripe',
    'pi_good','pi_good','00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid,'pack_3',4800,'hkd',true,0,
    null,null,null,null,now(),now()+interval '2 second') into v_result;
  select count(*) into v_count from public.entitlements
    where order_id='00000000-0000-4000-8000-000000000101'::uuid;
  if v_result <> 'already_settled_or_expired' or v_count <> 1 then
    raise exception 'replayed grant not idempotent: %, %', v_result,v_count;
  end if;
  raise notice 'PASS: a second event for the same payment cannot duplicate pack';

  select public.settle_stripe_payment('evt_second','charge.updated','stripe',
    'pi_good','pi_good','00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid,'pack_3',4800,'hkd',true,0,
    null,null,null,null,now(),now()+interval '3 second') into v_result;
  if v_result <> 'duplicate_event' then raise exception 'duplicate event response: %', v_result; end if;
  raise notice 'PASS: repeat event ID rejected';

  begin
    perform public.settle_stripe_payment('evt_wrong_price','checkout.session.completed','stripe',
      'pi_bad','pi_bad','00000000-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000102'::uuid,'pack_8',100,'hkd',true,0,
      null,null,null,null,now(),now());
    raise exception 'wrong price was incorrectly accepted';
  exception when others then
    if SQLERRM not like '%paid_order_mismatch%' then raise; end if;
  end;
  raise notice 'PASS: underpayment rejected without granting';

  begin
    perform public.settle_stripe_payment('evt_wrong_user','checkout.session.completed','stripe',
      'pi_bad2','pi_bad2','00000000-0000-4000-8000-000000000002'::uuid,
      '00000000-0000-4000-8000-000000000102'::uuid,'pack_8',10800,'hkd',true,0,
      null,null,null,null,now(),now());
    raise exception 'wrong user was incorrectly accepted';
  exception when others then
    if SQLERRM not like '%paid_order_mismatch%' then raise; end if;
  end;
  raise notice 'PASS: wrong user rejected';

  select public.revoke_for_refund('pi_good',100,null) into v_result;
  if v_result <> 'revoked' then raise exception 'partial refund response: %',v_result; end if;
  select count(*) into v_count from public.entitlements where order_id='00000000-0000-4000-8000-000000000101'::uuid and used_uses=total_uses;
  if v_count <> 1 then raise exception 'refund did not freeze pack'; end if;
  raise notice 'PASS: partial refund conservatively freezes entitlement';

  select public.settle_stripe_payment('evt_disputed','checkout.session.completed','stripe',
    'pi_disputed','pi_disputed','00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid,'pack_3',4800,'hkd',true,0,
    'open',null,null,null,now(),now()) into v_result;
  select count(*) into v_count from public.entitlements where order_id='00000000-0000-4000-8000-000000000103'::uuid;
  if v_count <> 0 or v_result <> 'recorded_not_eligible' then raise exception 'disputed grant was allowed'; end if;
  raise notice 'PASS: disputed payment cannot grant pack';

  if has_function_privilege('anon','public.settle_stripe_payment(text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'anon can execute privileged settlement';
  end if;
  raise notice 'PASS: anonymous role denied privileged settlement';
end $$;
