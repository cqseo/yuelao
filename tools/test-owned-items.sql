-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 付費物品（kind = 'item'）的結算與退款：首次發放、重複事件、亂序事件、金額不足、
-- 冒用他人、部分退款、全額退款、拒付、退款後重買、權限。
insert into auth.users(id) values
  ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000a2')
  on conflict do nothing;
insert into public.profiles(id,email) values
  ('00000000-0000-4000-8000-0000000000a1','items-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a2','items-b@example.invalid')
  on conflict do nothing;
insert into public.orders(id,user_id,product_id,product_kind,amount,currency,status,locale) values
  ('00000000-0000-4000-8000-0000000001a1','00000000-0000-4000-8000-0000000000a1','outfit_peach','item',231,'USD','pending','zh-Hant'),
  ('00000000-0000-4000-8000-0000000001a2','00000000-0000-4000-8000-0000000000a1','outfit_ink','item',359,'USD','pending','zh-Hant'),
  ('00000000-0000-4000-8000-0000000001a3','00000000-0000-4000-8000-0000000000a1','outfit_bride','item',487,'USD','pending','zh-Hant'),
  ('00000000-0000-4000-8000-0000000001a4','00000000-0000-4000-8000-0000000000a1','outfit_peach','item',231,'USD','pending','zh-Hant'),
  ('00000000-0000-4000-8000-0000000001a5','00000000-0000-4000-8000-0000000000a1','outfit_ink','item',359,'USD','pending','zh-Hant');
do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  b uuid := '00000000-0000-4000-8000-0000000000a2';
  o1 uuid := '00000000-0000-4000-8000-0000000001a1';
  o2 uuid := '00000000-0000-4000-8000-0000000001a2';
  o3 uuid := '00000000-0000-4000-8000-0000000001a3';
  o4 uuid := '00000000-0000-4000-8000-0000000001a4';
  o5 uuid := '00000000-0000-4000-8000-0000000001a5';
  r text; n int; failed boolean;
begin
  -- 1. 首次付款：發一件
  select public.settle_stripe_payment('evt_i1','checkout.session.completed','stripe','pi_i1','pi_i1',
    a,o1,'outfit_peach',231,'usd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.owned_items where user_id=a and item_id='outfit_peach' and not revoked;
  if r <> 'granted' or n <> 1 then raise exception 'first grant: %, %', r, n; end if;
  raise notice 'PASS: first payment grants exactly one item';

  -- 2. 同一事件 ID 重送
  select public.settle_stripe_payment('evt_i1','checkout.session.completed','stripe','pi_i1','pi_i1',
    a,o1,'outfit_peach',231,'usd',true,0,null,null,null,null,now(),now()) into r;
  if r <> 'duplicate_event' then raise exception 'duplicate event: %', r; end if;
  raise notice 'PASS: duplicate event id is ignored';

  -- 3. 同一筆付款的另一個事件（不同 ID）
  select public.settle_stripe_payment('evt_i1b','charge.updated','stripe','pi_i1','pi_i1',
    a,o1,'outfit_peach',231,'usd',true,0,null,null,null,null,now(),now()+interval '2 second') into r;
  select count(*) into n from public.owned_items where user_id=a;
  if r <> 'already_settled_or_expired' or n <> 1 then raise exception 'replay: %, %', r, n; end if;
  raise notice 'PASS: a second event for the same payment grants nothing more';

  -- 4. 金額低於訂單
  failed := false;
  begin
    perform public.settle_stripe_payment('evt_i2low','checkout.session.completed','stripe','pi_i2','pi_i2',
      a,o2,'outfit_ink',100,'usd',true,0,null,null,null,null,now(),now());
  exception when others then failed := true; end;
  select count(*) into n from public.owned_items where item_id='outfit_ink';
  if not failed or n <> 0 then raise exception 'underpaid order granted'; end if;
  raise notice 'PASS: underpaid order is rejected';

  -- 5. 另一個人拿這張訂單來結算
  failed := false;
  begin
    perform public.settle_stripe_payment('evt_i2other','checkout.session.completed','stripe','pi_i2x','pi_i2x',
      b,o2,'outfit_ink',359,'usd',true,0,null,null,null,null,now(),now());
  exception when others then failed := true; end;
  select count(*) into n from public.owned_items where user_id=b;
  if not failed or n <> 0 then raise exception 'wrong user granted'; end if;
  raise notice 'PASS: another user cannot settle this order';

  -- 6. 亂序：退款事件先到（付款事實已含退款額）→ 不發
  select public.settle_stripe_payment('evt_i3refundfirst','charge.refunded','stripe','pi_i3','pi_i3',
    a,o3,'outfit_bride',487,'usd',true,487,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.owned_items where item_id='outfit_bride';
  if r <> 'recorded_not_eligible' or n <> 0 then raise exception 'refund-first: %, %', r, n; end if;
  raise notice 'PASS: out-of-order refunded payment grants nothing';

  -- 7. 部分退款：收回（從嚴）
  select public.settle_stripe_payment('evt_i2','checkout.session.completed','stripe','pi_i2','pi_i2',
    a,o2,'outfit_ink',359,'usd',true,0,null,null,null,null,now(),now()) into r;
  if r <> 'granted' then raise exception 'ink grant: %', r; end if;
  select public.revoke_for_refund('pi_i2', 100, null) into r;
  select count(*) into n from public.owned_items where item_id='outfit_ink' and not revoked;
  if r <> 'revoked' or n <> 0 then raise exception 'partial refund: %, %', r, n; end if;
  raise notice 'PASS: partial refund revokes the item';

  -- 8. 全額退款：收回；別件不受影響（這時 peach 仍在）
  select public.revoke_for_refund('pi_i1', 231, null) into r;
  select count(*) into n from public.owned_items where user_id=a and not revoked;
  if r <> 'revoked' or n <> 0 then raise exception 'full refund: %, %', r, n; end if;
  raise notice 'PASS: full refund revokes the item';

  -- 9. 退款後重買同一件：同一列改回有效、指向新訂單
  select public.settle_stripe_payment('evt_i4','checkout.session.completed','stripe','pi_i4','pi_i4',
    a,o4,'outfit_peach',231,'usd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.owned_items
    where user_id=a and item_id='outfit_peach' and not revoked and order_id=o4;
  if r <> 'granted' or n <> 1 then raise exception 'rebuy: %, %', r, n; end if;
  if (select count(*) from public.owned_items where user_id=a and item_id='outfit_peach') <> 1 then
    raise exception 'rebuy created a second row';
  end if;
  raise notice 'PASS: buying again after a refund restores the item on the new order';

  -- 10. 舊訂單再退一次款（重送）不會收回新買的那件
  select public.revoke_for_refund('pi_i1', 231, null) into r;
  select count(*) into n from public.owned_items where user_id=a and item_id='outfit_peach' and not revoked;
  if n <> 1 then raise exception 'replayed old refund revoked the new purchase'; end if;
  raise notice 'PASS: a replayed refund of the old order leaves the new purchase alone';

  -- 11. 拒付（爭議開啟）：收回
  select public.settle_stripe_payment('evt_i5','checkout.session.completed','stripe','pi_i5','pi_i5',
    a,o5,'outfit_ink',359,'usd',true,0,null,null,null,null,now(),now()) into r;
  select public.revoke_for_refund('pi_i5', 0, 'open') into r;
  select count(*) into n from public.owned_items where item_id='outfit_ink' and not revoked;
  if r <> 'revoked' or n <> 0 then raise exception 'dispute: %, %', r, n; end if;
  raise notice 'PASS: an open dispute revokes the item';

  -- 12. 一般角色不能直接呼叫結算、也不能寫 owned_items
  if has_function_privilege('anon',
      'public.settle_stripe_payment(text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','execute')
     or has_function_privilege('authenticated','public.revoke_for_refund(text,bigint,text)','execute') then
    raise exception 'money RPC callable by client role';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.owned_items'::regclass) then
    raise exception 'owned_items has no RLS';
  end if;
  if (select count(*) from pg_policies where tablename='owned_items' and cmd <> 'SELECT') <> 0 then
    raise exception 'owned_items has a client write policy';
  end if;
  raise notice 'PASS: client roles cannot call money RPCs or write owned_items';
end;
$$;
