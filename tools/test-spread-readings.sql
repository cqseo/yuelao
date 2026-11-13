-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 牌陣解讀（kind = 'spread'）的結算、退款與生成租約：
-- 首次發放、重複事件、同付款另一事件、金額不足、冒用他人、部分退款、全額退款、拒付、
-- 退款後重買、亂序（退款先到再來付款事件）、租約領取／完成／過期、退款後不能領也不能讀、權限、訂單形狀。
insert into auth.users(id) values
  ('00000000-0000-4000-8000-0000000000c1'), ('00000000-0000-4000-8000-0000000000c2')
  on conflict do nothing;
insert into public.profiles(id,email) values
  ('00000000-0000-4000-8000-0000000000c1','spread-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000c2','spread-b@example.invalid')
  on conflict do nothing;
insert into public.orders(id,user_id,product_id,product_kind,amount,currency,status,locale,spread) values
  ('00000000-0000-4000-8000-0000000002c1','00000000-0000-4000-8000-0000000000c1','spread_1','spread',299,'USD','pending','zh-Hant','tarot:Cups_02,06~,04|0123456789abcdef'),
  ('00000000-0000-4000-8000-0000000002c2','00000000-0000-4000-8000-0000000000c1','spread_1','spread',299,'USD','pending','zh-Hant','lnm:15,19,07|0123456789abcdef'),
  ('00000000-0000-4000-8000-0000000002c3','00000000-0000-4000-8000-0000000000c1','spread_1','spread',299,'USD','pending','zh-Hant','tarot:00,01,02|fedcba9876543210'),
  ('00000000-0000-4000-8000-0000000002c4','00000000-0000-4000-8000-0000000000c1','spread_1','spread',299,'USD','pending','zh-Hant','tarot:Cups_02,06~,04|0123456789abcdef'),
  ('00000000-0000-4000-8000-0000000002c5','00000000-0000-4000-8000-0000000000c1','spread_1','spread',299,'USD','pending','zh-Hant','lnm:01,02,03|aaaaaaaaaaaaaaaa'),
  ('00000000-0000-4000-8000-0000000002c6','00000000-0000-4000-8000-0000000000c1','spread_1','spread',299,'USD','pending','zh-Hant','lnm:04,05,06|bbbbbbbbbbbbbbbb');
do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000c1';
  b uuid := '00000000-0000-4000-8000-0000000000c2';
  o1 uuid := '00000000-0000-4000-8000-0000000002c1';
  o2 uuid := '00000000-0000-4000-8000-0000000002c2';
  o3 uuid := '00000000-0000-4000-8000-0000000002c3';
  o4 uuid := '00000000-0000-4000-8000-0000000002c4';
  o5 uuid := '00000000-0000-4000-8000-0000000002c5';
  o6 uuid := '00000000-0000-4000-8000-0000000002c6';
  s1 text := 'tarot:Cups_02,06~,04|0123456789abcdef';
  body text := repeat('牌陣解讀內文。', 30);
  r text; j jsonb; n int; failed boolean; claim uuid; unl uuid; ok boolean;
begin
  -- 1. 首次付款：發一筆牌陣解鎖
  select public.settle_stripe_payment('evt_s1','checkout.session.completed','stripe','pi_s1','pi_s1',
    a,o1,'spread_1',299,'usd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.spread_unlocks where user_id=a and spread=s1 and not revoked;
  if r <> 'granted' or n <> 1 then raise exception 'first grant: %, %', r, n; end if;
  raise notice 'PASS: first payment grants exactly one spread unlock';

  -- 2. 同一事件 ID 重送
  select public.settle_stripe_payment('evt_s1','checkout.session.completed','stripe','pi_s1','pi_s1',
    a,o1,'spread_1',299,'usd',true,0,null,null,null,null,now(),now()) into r;
  if r <> 'duplicate_event' then raise exception 'duplicate event: %', r; end if;
  raise notice 'PASS: duplicate event id is ignored';

  -- 3. 同一筆付款的另一個事件
  select public.settle_stripe_payment('evt_s1b','charge.updated','stripe','pi_s1','pi_s1',
    a,o1,'spread_1',299,'usd',true,0,null,null,null,null,now(),now()+interval '2 second') into r;
  select count(*) into n from public.spread_unlocks where user_id=a;
  if r <> 'already_settled_or_expired' or n <> 1 then raise exception 'replay: %, %', r, n; end if;
  raise notice 'PASS: a second event for the same payment grants nothing more';

  -- 4. 金額不足
  failed := false;
  begin
    perform public.settle_stripe_payment('evt_s2low','checkout.session.completed','stripe','pi_s2','pi_s2',
      a,o2,'spread_1',100,'usd',true,0,null,null,null,null,now(),now());
  exception when others then failed := true; end;
  select count(*) into n from public.spread_unlocks where order_id=o2;
  if not failed or n <> 0 then raise exception 'underpaid order granted'; end if;
  raise notice 'PASS: underpaid spread order is rejected';

  -- 5. 別人拿這張訂單來結算
  failed := false;
  begin
    perform public.settle_stripe_payment('evt_s2b','checkout.session.completed','stripe','pi_s2b','pi_s2b',
      b,o2,'spread_1',299,'usd',true,0,null,null,null,null,now(),now());
  exception when others then failed := true; end;
  select count(*) into n from public.spread_unlocks where user_id=b;
  if not failed or n <> 0 then raise exception 'cross-user order granted'; end if;
  raise notice 'PASS: another user cannot settle this order';

  -- 6. 生成租約：領取 → 讀到 unlocked → 完成 → 讀到 ready
  j := public.claim_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'claimed' then raise exception 'claim: %', j; end if;
  claim := (j->>'claimId')::uuid; unl := (j->>'unlockId')::uuid;
  j := public.claim_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'processing' then raise exception 'second claim should wait: %', j; end if;
  j := public.get_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'unlocked' then raise exception 'get before ready: %', j; end if;
  ok := public.finish_spread_reading(a, unl, gen_random_uuid(), body, 'test-model');
  if ok then raise exception 'finish with wrong claim id accepted'; end if;
  ok := public.finish_spread_reading(a, unl, claim, body, 'test-model');
  if not ok then raise exception 'finish failed'; end if;
  j := public.get_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'ready' or j->>'body' <> body then raise exception 'get after ready: %', j; end if;
  j := public.claim_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'ready' then raise exception 'claim after ready: %', j; end if;
  raise notice 'PASS: claim / processing / finish / ready lifecycle';

  -- 7. 別人讀不到、也領不到
  j := public.get_spread_reading(b, s1, 'zh-Hant');
  if j->>'state' <> 'none' then raise exception 'other user can read: %', j; end if;
  j := public.claim_spread_reading(b, s1, 'zh-Hant');
  if j->>'state' <> 'not_unlocked' then raise exception 'other user can claim: %', j; end if;
  j := public.claim_spread_reading(a, 'bad spread', 'zh-Hant');
  if j->>'state' <> 'invalid' then raise exception 'bad spread accepted: %', j; end if;
  raise notice 'PASS: other users and malformed spreads get nothing';

  -- 8. 部分退款即收回；收回後讀不到正文、不能再領
  select public.revoke_for_refund('pi_s1', 50, null) into r;
  select count(*) into n from public.spread_unlocks where order_id=o1 and revoked;
  if r <> 'revoked' or n <> 1 then raise exception 'partial refund: %, %', r, n; end if;
  j := public.get_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'none' then raise exception 'refunded reading still readable: %', j; end if;
  j := public.claim_spread_reading(a, s1, 'zh-Hant');
  if j->>'state' <> 'not_unlocked' then raise exception 'refunded reading claimable: %', j; end if;
  raise notice 'PASS: partial refund revokes the spread unlock and hides the reading';

  -- 9. 退款後重買同一個牌陣：同一列改回有效、指向新訂單
  select public.settle_stripe_payment('evt_s4','checkout.session.completed','stripe','pi_s4','pi_s4',
    a,o4,'spread_1',299,'usd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.spread_unlocks where user_id=a and spread=s1 and not revoked and order_id=o4;
  if r <> 'granted' or n <> 1 then raise exception 'rebuy: %, %', r, n; end if;
  raise notice 'PASS: buying again after a refund restores the same unlock';

  -- 10. 全額退款
  select public.settle_stripe_payment('evt_s3','checkout.session.completed','stripe','pi_s3','pi_s3',
    a,o3,'spread_1',299,'usd',true,0,null,null,null,null,now(),now()) into r;
  select public.revoke_for_refund('pi_s3', 299, null) into r;
  select count(*) into n from public.spread_unlocks where order_id=o3 and revoked;
  if r <> 'revoked' or n <> 1 then raise exception 'full refund: %, %', r, n; end if;
  raise notice 'PASS: full refund revokes the spread unlock';

  -- 11. 拒付
  select public.settle_stripe_payment('evt_s5','checkout.session.completed','stripe','pi_s5','pi_s5',
    a,o5,'spread_1',299,'usd',true,0,null,null,null,null,now(),now()) into r;
  select public.revoke_for_refund('pi_s5', 0, 'open') into r;
  select count(*) into n from public.spread_unlocks where order_id=o5 and revoked;
  if r <> 'revoked' or n <> 1 then raise exception 'dispute: %, %', r, n; end if;
  raise notice 'PASS: an open dispute revokes the spread unlock';

  -- 12. 亂序：付款事件帶著已退款金額才到，不發
  select public.settle_stripe_payment('evt_s6','charge.refunded','stripe','pi_s6','pi_s6',
    a,o6,'spread_1',299,'usd',true,299,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.spread_unlocks where order_id=o6;
  if r <> 'recorded_not_eligible' or n <> 0 then raise exception 'out of order refund granted: %, %', r, n; end if;
  raise notice 'PASS: a payment that arrives already refunded grants nothing';

  -- 13. 訂單形狀：spread 訂單一定要有合格的 spread；其他訂單不能帶
  failed := false;
  begin
    insert into public.orders(user_id,product_id,product_kind,amount,currency,status,locale)
      values (a,'spread_1','spread',299,'USD','pending','zh-Hant');
  exception when others then failed := true; end;
  if not failed then raise exception 'spread order without spread accepted'; end if;
  failed := false;
  begin
    insert into public.orders(user_id,product_id,product_kind,amount,currency,status,locale,spread)
      values (a,'pack_3','pack',699,'USD','pending','zh-Hant','lnm:01,02,03|aaaaaaaaaaaaaaaa');
  exception when others then failed := true; end;
  if not failed then raise exception 'pack order with spread accepted'; end if;
  raise notice 'PASS: order shape is enforced';
end $$;

-- 14. 權限：client 角色不能呼叫任何牌陣 RPC、讀不到正文表
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.claim_spread_reading(uuid,text,text)',
    'public.finish_spread_reading(uuid,uuid,uuid,text,text)',
    'public.fail_spread_reading(uuid,uuid,uuid)',
    'public.get_spread_reading(uuid,text,text)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'client role can execute %', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'service_role cannot execute %', fn;
    end if;
  end loop;
  raise notice 'PASS: spread RPCs are service_role only';
end $$;
