-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 算命攤（20261119063400）：match: 識別字串走同一套牌陣解鎖；格式不對的仍然擋下。
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000f1') on conflict do nothing;
insert into public.profiles(id,email) values ('00000000-0000-4000-8000-0000000000f1','fortune@example.invalid')
  on conflict do nothing;
insert into public.orders(id,user_id,product_id,product_kind,amount,currency,status,locale,spread) values
  ('00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000000f1','match_1','spread',1200,'HKD','pending','zh-Hant','match:01_03,07_11|0123456789abcdef');
do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000f1';
  o uuid := '00000000-0000-4000-8000-0000000002f1';
  s text := 'match:01_03,07_11|0123456789abcdef';
  r text; j jsonb; n int; failed boolean; ok boolean;
begin
  select public.settle_stripe_payment('evt_f1','checkout.session.completed','stripe','pi_f1','pi_f1',
    a,o,'match_1',1200,'hkd',true,0,null,null,null,null,now(),now()) into r;
  select count(*) into n from public.spread_unlocks where user_id=a and spread=s and not revoked;
  if r <> 'granted' or n <> 1 then raise exception 'match grant: %, %', r, n; end if;
  raise notice 'PASS: a match order grants a spread unlock';

  j := public.claim_spread_reading(a, s, 'zh-Hant');
  if j->>'state' <> 'claimed' then raise exception 'match claim: %', j; end if;
  select public.finish_spread_reading(a, (j->>'unlockId')::uuid, (j->>'claimId')::uuid,
    repeat('合緣解讀內文。', 30), 'test-model') into ok;
  j := public.get_spread_reading(a, s, 'zh-Hant');
  if not ok or j->>'state' <> 'ready' then raise exception 'match ready: %', j; end if;
  raise notice 'PASS: a match reading is claimed, saved and read back';

  j := public.claim_spread_reading(a, 'zodiac:01_03,07_11|0123456789abcdef', 'zh-Hant');
  if j->>'state' <> 'invalid' then raise exception 'unknown prefix claim: %', j; end if;
  failed := false;
  begin
    insert into public.orders(user_id,product_id,product_kind,amount,currency,status,locale,spread)
      values (a,'match_1','spread',1200,'HKD','pending','zh-Hant','zodiac:01_03|0123456789abcdef');
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'unknown prefix order accepted'; end if;
  raise notice 'PASS: unknown prefixes are still rejected';
end $$;
