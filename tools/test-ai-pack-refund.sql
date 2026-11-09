-- Standalone ephemeral database test of a refunded pack's redeemed reports.
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000010') on conflict do nothing;
insert into public.profiles(id,email) values('00000000-0000-4000-8000-000000000010','refund-test@example.invalid')
  on conflict do nothing;
do $$
declare
 u uuid := '00000000-0000-4000-8000-000000000010';
 oid uuid;
 pack uuid;
 claimed jsonb;
 uid uuid;
 lease uuid;
 summary text := repeat('有些情感困惑可以透過尊重彼此的界線和真誠溝通去處理。', 10);
 result text;
begin
  insert into public.orders(user_id,product_id,product_kind,amount,currency,status,pack_uses)
  values(u,'pack_3','pack',4800,'HKD','paid',3) returning id into oid;
  insert into public.payments(provider,payment_ref,user_id,order_id,product_id,amount,currency)
  values ('stripe','pi_refund_pack_qa',u,oid,'pack_3',4800,'HKD');
  insert into public.entitlements(user_id,order_id,product_id,total_uses)
  values(u,oid,'pack_3',3) returning id into pack;
  select public.consume_pack_use(u,pack,1::smallint,'him','zh-Hant') into uid;
  select public.claim_paid_ai_reading(u,1::smallint,'him','zh-Hant') into claimed;
  if claimed->>'state' <> 'claimed' then raise exception 'cannot claim before refund'; end if;
  lease := (claimed->>'claimId')::uuid;
  if not public.finish_paid_ai_reading(u,uid,lease,summary,'model-qa') then
    raise exception 'cannot create paid report';
  end if;
  result := public.get_paid_ai_reading(u,1::smallint,'him','zh-Hant');
  if result <> summary then raise exception 'cannot see paid report before refund'; end if;
  raise notice 'PASS: pack-redeemed report visible before refund';

  if public.revoke_for_refund('pi_refund_pack_qa',100,null)<>'revoked' then
    raise exception 'refund RPC did not revoke';
  end if;
  if not (select revoked from public.unlocks where id=uid) then
    raise exception 'pack-redeemed unlock still active';
  end if;
  if public.get_paid_ai_reading(u,1::smallint,'him','zh-Hant') is not null then
    raise exception 'pack report accessible after refund';
  end if;
  if (select used_uses from public.entitlements where id=pack) <> 3 then
    raise exception 'refunded pack remains spendable';
  end if;
  raise notice 'PASS: refund revokes pack-redeemed unlock, report and future uses';
end;
$$;
