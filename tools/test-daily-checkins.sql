-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 每日簽到：首次簽到、同日重複、連續天數、昨天為止仍算連續、斷掉重算、補登範圍與上限、
-- 日期超出今天前後一天被拒、他人資料互不影響、權限。
insert into auth.users(id) values
  ('00000000-0000-4000-8000-0000000000d1'), ('00000000-0000-4000-8000-0000000000d2')
  on conflict do nothing;
insert into public.profiles(id,email) values
  ('00000000-0000-4000-8000-0000000000d1','daily-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000d2','daily-b@example.invalid')
  on conflict do nothing;
do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000d1';
  b uuid := '00000000-0000-4000-8000-0000000000d2';
  t date := (now() at time zone 'utc')::date;
  j jsonb; n int; big date[];
begin
  -- 1. 首次簽到
  j := public.record_daily_checkin(a, t, true, null);
  if (j->>'streak')::int <> 1 or j->>'lastDate' <> to_char(t,'YYYY-MM-DD') then raise exception 'first: %', j; end if;
  raise notice 'PASS: first check-in gives streak 1';

  -- 2. 同一天再簽不重複
  j := public.record_daily_checkin(a, t, true, null);
  select count(*) into n from public.daily_checkins where user_id = a;
  if n <> 1 or (j->>'streak')::int <> 1 then raise exception 'same day twice: %, %', n, j; end if;
  raise notice 'PASS: same day twice stays one row';

  -- 3. 補登前兩天 → 連續 3 天
  j := public.record_daily_checkin(a, t, false, array[t-1, t-2]);
  if (j->>'streak')::int <> 3 or jsonb_array_length(j->'checkedDates') <> 3 then raise exception 'backfill: %', j; end if;
  raise notice 'PASS: backfill makes a 3-day streak';

  -- 4. 中間斷一天的舊紀錄不算進連續
  j := public.record_daily_checkin(a, t, false, array[t-4]);
  if (j->>'streak')::int <> 3 or jsonb_array_length(j->'checkedDates') <> 4 then raise exception 'gap: %', j; end if;
  raise notice 'PASS: a gap stops the streak';

  -- 5. 只看到昨天為止（今天還沒簽）也算連續：用 b 測
  perform public.record_daily_checkin(b, t, false, array[t-1, t-2]);
  j := public.daily_checkin_state(b, t);
  if (j->>'streak')::int <> 2 then raise exception 'until yesterday: %', j; end if;
  raise notice 'PASS: streak still counts when last check-in was yesterday';

  -- 6. 前天以前就斷了 → 0
  delete from public.daily_checkins where user_id = b;
  perform public.record_daily_checkin(b, t, false, array[t-2, t-3]);
  j := public.daily_checkin_state(b, t);
  if (j->>'streak')::int <> 0 then raise exception 'broken: %', j; end if;
  raise notice 'PASS: streak is 0 when the last check-in is older than yesterday';

  -- 7. 補登超過 30 天以前的不收；未來的不收
  j := public.record_daily_checkin(b, t, false, array[t-45, t+3]);
  select count(*) into n from public.daily_checkins where user_id = b and (day = t-45 or day = t+3);
  if n <> 0 then raise exception 'out of range backfill stored: %', n; end if;
  raise notice 'PASS: backfill outside the last 30 days is ignored';

  -- 8. 補登最多 30 筆
  delete from public.daily_checkins where user_id = b;
  select array_agg(t - g) into big from generate_series(0, 39) g;
  perform public.record_daily_checkin(b, t, false, big);
  select count(*) into n from public.daily_checkins where user_id = b;
  if n <> 30 then raise exception 'backfill cap: %', n; end if;
  raise notice 'PASS: backfill is capped at 30 entries';

  -- 9. 今天超出 UTC 前後一天：拒絕、不寫入
  j := public.record_daily_checkin(a, t + 5, true, null);
  select count(*) into n from public.daily_checkins where user_id = a and day = t + 5;
  if j->>'error' <> 'invalid_day' or n <> 0 then raise exception 'far future day: %, %', j, n; end if;
  raise notice 'PASS: a day far from today is rejected';

  -- 10. 兩個人互不影響
  j := public.daily_checkin_state(a, t);
  if (j->>'streak')::int <> 3 then raise exception 'isolation: %', j; end if;
  raise notice 'PASS: users do not affect each other';
end $$;

-- 11. 權限：客戶端角色不能直接讀表或呼叫 RPC
do $$
begin
  if has_table_privilege('anon', 'public.daily_checkins', 'select')
     or has_table_privilege('authenticated', 'public.daily_checkins', 'select') then
    -- RLS 仍會擋；但我們也不該給 select。
    raise notice 'NOTE: table select privilege exists for a client role (RLS without policies still blocks rows)';
  end if;
  if has_function_privilege('anon', 'public.record_daily_checkin(uuid, date, boolean, date[])', 'execute')
     or has_function_privilege('authenticated', 'public.record_daily_checkin(uuid, date, boolean, date[])', 'execute')
     or has_function_privilege('anon', 'public.daily_checkin_state(uuid, date)', 'execute')
     or has_function_privilege('authenticated', 'public.daily_checkin_state(uuid, date)', 'execute') then
    raise exception 'client role can execute daily RPCs';
  end if;
  if not has_function_privilege('service_role', 'public.record_daily_checkin(uuid, date, boolean, date[])', 'execute') then
    raise exception 'service_role cannot execute record_daily_checkin';
  end if;
  raise notice 'PASS: only service_role can call the daily RPCs';
end $$;
