-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 追問月老（kind = 'followup'）：發放、重複事件、名額上限 3、租約領取／完成／歸還、退款收回、訂單形狀、權限。
insert into auth.users(id) values
  ('00000000-0000-4000-8000-0000000000f1'), ('00000000-0000-4000-8000-0000000000f2')
  on conflict do nothing;
insert into public.profiles(id,email) values
  ('00000000-0000-4000-8000-0000000000f1','follow-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000f2','follow-b@example.invalid')
  on conflict do nothing;
insert into public.unlocks(id,user_id,stick_id,category,locale,source) values
  ('00000000-0000-4000-8000-0000000003f1','00000000-0000-4000-8000-0000000000f1',67,'reunion','zh-Hant','order');
insert into public.orders(id,user_id,product_id,product_kind,amount,currency,status,locale,followup_unlock)
select ('00000000-0000-4000-8000-00000000040' || n)::uuid, '00000000-0000-4000-8000-0000000000f1',
  'followup_1','followup',800,'HKD','pending','zh-Hant','00000000-0000-4000-8000-0000000003f1'
from generate_series(1,5) n;
do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000f1';
  b uuid := '00000000-0000-4000-8000-0000000000f2';
  u uuid := '00000000-0000-4000-8000-0000000003f1';
  txt text := repeat('月老的回答。', 20);
  r text; j jsonb; n int; failed boolean; claim uuid; fid uuid; ok boolean;
  o uuid;
begin
  -- 1. 付款成立：發一則追問（open）
  select public.settle_stripe_payment('evt_f1','checkout.session.completed','stripe','pi_f1','pi_f1',
    a,'00000000-0000-4000-8000-000000000401','followup_1',800,'hkd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.reading_followups where unlock_id=u and status='open';
  if r <> 'granted' or n <> 1 then raise exception 'first grant: %, %', r, n; end if;
  raise notice 'PASS: a paid follow-up grants one open question';

  -- 2. 同一事件重送不多發
  select public.settle_stripe_payment('evt_f1','checkout.session.completed','stripe','pi_f1','pi_f1',
    a,'00000000-0000-4000-8000-000000000401','followup_1',800,'hkd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.reading_followups where unlock_id=u;
  if r <> 'duplicate_event' or n <> 1 then raise exception 'duplicate: %, %', r, n; end if;
  raise notice 'PASS: a duplicate event grants nothing more';

  -- 3. 別人不能領
  j := public.claim_reading_followup(b, u);
  if j->>'state' <> 'not_unlocked' then raise exception 'other user claim: %', j; end if;

  -- 4. 領取 → 生成中不能再領 → 歸還（不算用掉）→ 再領 → 完成
  j := public.claim_reading_followup(a, u);
  if j->>'state' <> 'claimed' then raise exception 'claim: %', j; end if;
  claim := (j->>'claimId')::uuid; fid := (j->>'followupId')::uuid;
  j := public.claim_reading_followup(a, u);
  if j->>'state' <> 'processing' then raise exception 'second claim should wait: %', j; end if;
  ok := public.release_reading_followup(a, fid, claim);
  select count(*) into n from public.reading_followups where id=fid and status='open';
  if not ok or n <> 1 then raise exception 'release did not return the credit'; end if;
  raise notice 'PASS: a released question goes back to open';
  j := public.claim_reading_followup(a, u);
  claim := (j->>'claimId')::uuid; fid := (j->>'followupId')::uuid;
  ok := public.finish_reading_followup(a, fid, gen_random_uuid(), txt, 'm');
  if ok then raise exception 'finish with a wrong claim must fail'; end if;
  ok := public.finish_reading_followup(a, fid, claim, txt, 'm');
  select count(*) into n from public.reading_followups where id=fid and status='ready' and body is not null;
  if not ok or n <> 1 then raise exception 'finish failed'; end if;
  j := public.claim_reading_followup(a, u);
  if j->>'state' <> 'no_credit' then raise exception 'no credit left: %', j; end if;
  raise notice 'PASS: claim, finish, and no credit afterwards';

  -- 5. 過期租約可以被重新領
  select public.settle_stripe_payment('evt_f2','checkout.session.completed','stripe','pi_f2','pi_f2',
    a,'00000000-0000-4000-8000-000000000402','followup_1',800,'hkd',true,0,null,null,null,null,now(),now()) into r;
  j := public.claim_reading_followup(a, u);
  fid := (j->>'followupId')::uuid;
  update public.reading_followups set lease_until=now()-interval '1 second' where id=fid;
  j := public.claim_reading_followup(a, u);
  if j->>'state' <> 'claimed' or (j->>'followupId')::uuid <> fid then raise exception 'expired lease: %', j; end if;
  ok := public.finish_reading_followup(a, fid, (j->>'claimId')::uuid, txt, 'm');
  raise notice 'PASS: an expired lease can be claimed again';

  -- 6. 第三則發得出，第四則不發（名額 3）
  select public.settle_stripe_payment('evt_f3','checkout.session.completed','stripe','pi_f3','pi_f3',
    a,'00000000-0000-4000-8000-000000000403','followup_1',800,'hkd',true,0,null,null,null,null,now(),now()) into r;
  if r <> 'granted' then raise exception 'third: %', r; end if;
  select public.settle_stripe_payment('evt_f4','checkout.session.completed','stripe','pi_f4','pi_f4',
    a,'00000000-0000-4000-8000-000000000404','followup_1',800,'hkd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.reading_followups where unlock_id=u and not revoked;
  if r <> 'followup_full' or n <> 3 then raise exception 'cap: %, %', r, n; end if;
  raise notice 'PASS: at most three follow-ups per reading';

  -- 7. 退款收回那一則，名額空出來
  select public.revoke_for_refund('pi_f3', 800, null) into r;
  select count(*) into n from public.reading_followups where order_id='00000000-0000-4000-8000-000000000403' and revoked;
  if r <> 'revoked' or n <> 1 then raise exception 'refund: %, %', r, n; end if;
  j := public.claim_reading_followup(a, u);
  if j->>'state' <> 'no_credit' then raise exception 'refunded credit must not be claimable: %', j; end if;
  select public.settle_stripe_payment('evt_f5','checkout.session.completed','stripe','pi_f5','pi_f5',
    a,'00000000-0000-4000-8000-000000000405','followup_1',800,'hkd',true,0,null,null,null,null,now(),now()) into r;
  if r <> 'granted' then raise exception 'slot after refund: %', r; end if;
  raise notice 'PASS: a refund revokes the follow-up and frees its slot';

  -- 8. 退掉整份解籤後，追問也領不到
  update public.unlocks set revoked=true where id=u;
  j := public.claim_reading_followup(a, u);
  if j->>'state' <> 'not_unlocked' then raise exception 'revoked unlock: %', j; end if;
  raise notice 'PASS: no follow-up on a revoked reading';

  -- 9. 訂單形狀：追問訂單一定要指向一份解鎖，其他訂單不能帶
  failed := false;
  begin
    insert into public.orders(user_id,product_id,product_kind,amount,currency,locale)
    values (a,'followup_1','followup',800,'HKD','zh-Hant');
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'followup order without unlock'; end if;
  failed := false;
  begin
    insert into public.orders(user_id,product_id,product_kind,amount,currency,locale,stick_id,category,followup_unlock)
    values (a,'unlock_1','unlock',1800,'HKD','zh-Hant',1,'him',u);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'unlock order with followup_unlock'; end if;
  raise notice 'PASS: order shape is enforced';
end $$;

-- 權限：只有 service_role 能呼叫
do $$
begin
  if has_function_privilege('authenticated','public.claim_reading_followup(uuid,uuid)','execute')
    or has_function_privilege('anon','public.finish_reading_followup(uuid,uuid,uuid,text,text)','execute')
    or has_function_privilege('authenticated','public.release_reading_followup(uuid,uuid,uuid)','execute')
    or not has_function_privilege('service_role','public.claim_reading_followup(uuid,uuid)','execute') then
    raise exception 'follow-up RPC privileges are wrong';
  end if;
  raise notice 'PASS: follow-up RPCs are service_role only';
end $$;
