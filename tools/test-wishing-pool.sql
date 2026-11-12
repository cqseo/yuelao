-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 許願池：一人一天一個、全站上限、列表不洩漏身份、待審只有作者看得到、同願去重、
-- 檢舉滿三收起、作者撤下、人工審核、權限。
insert into auth.users(id) values
  ('00000000-0000-4000-8000-0000000000b1'), ('00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000b3'), ('00000000-0000-4000-8000-0000000000b4')
  on conflict do nothing;
insert into public.profiles(id, email) select id, id::text || '@example.invalid' from auth.users
  on conflict do nothing;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000b1';
  b uuid := '00000000-0000-4000-8000-0000000000b2';
  c uuid := '00000000-0000-4000-8000-0000000000b3';
  d uuid := '00000000-0000-4000-8000-0000000000b4';
  stranger uuid := '00000000-0000-4000-8000-0000000000ff';
  r text; wa uuid; wb uuid; n int; cols text;
begin
  -- 1. 許願：公開
  r := public.make_wish(a, '  願今年遇見對的人  ', 'seek', 'zh-Hant', 'shown');
  if r !~ '^ok:' then raise exception 'make shown: %', r; end if;
  wa := substr(r, 4)::uuid;
  select count(*) into n from public.wishes where id = wa and body = '願今年遇見對的人' and decided_by = 'auto';
  if n <> 1 then raise exception 'body not trimmed or decided_by missing'; end if;
  raise notice 'PASS: a wish is stored trimmed and shown';

  -- 2. 同一天第二個
  r := public.make_wish(a, '再許一個', 'self', 'zh-Hant', 'shown');
  if r <> 'daily_limit' then raise exception 'daily limit: %', r; end if;
  raise notice 'PASS: one wish per person per day';

  -- 3. 不合法輸入
  if public.make_wish(b, '', 'seek', 'zh-Hant', 'shown') <> 'invalid'
     or public.make_wish(b, repeat('長', 41), 'seek', 'zh-Hant', 'shown') <> 'invalid'
     or public.make_wish(b, E'兩\n行', 'seek', 'zh-Hant', 'shown') <> 'invalid'
     or public.make_wish(b, '好', 'money', 'zh-Hant', 'shown') <> 'invalid'
     or public.make_wish(b, '好', 'seek', 'en', 'shown') <> 'invalid'
     or public.make_wish(b, '好', 'seek', 'zh-Hant', 'hidden') <> 'invalid' then
    raise exception 'invalid input accepted';
  end if;
  if public.make_wish(stranger, '沒有帳號', 'seek', 'zh-Hant', 'shown') <> 'no_profile' then
    raise exception 'wish without profile accepted';
  end if;
  raise notice 'PASS: empty, too long, multi-line, bad tag/locale/status and unknown users are refused';

  -- 4. 待審：只有作者看得到
  r := public.make_wish(b, '希望他平安', 'others', 'zh-Hans', 'pending');
  wb := substr(r, 4)::uuid;
  select count(*) into n from public.list_wishes(null, 120) where id = wb;
  if n <> 0 then raise exception 'pending wish visible to public'; end if;
  select count(*) into n from public.list_wishes(c, 120) where id = wb;
  if n <> 0 then raise exception 'pending wish visible to other user'; end if;
  select count(*) into n from public.list_wishes(b, 120) where id = wb and mine and status = 'pending';
  if n <> 1 then raise exception 'author cannot see own pending wish'; end if;
  raise notice 'PASS: pending wishes are visible only to their author';

  -- 5. 列表不帶身份欄位
  select string_agg(a2.attname, ',' order by a2.attnum) into cols
  from pg_proc p cross join lateral unnest(p.proargnames, p.proargmodes) with ordinality as a2(attname, mode, attnum)
  where p.proname = 'list_wishes' and a2.mode = 't';
  if cols ~ '(^|,)user_id(,|$)' then raise exception 'list_wishes exposes user_id: %', cols; end if;
  raise notice 'PASS: the public list carries no user id';

  -- 6. 同願
  if public.bless_wish(b, wa) <> 'blessed' then raise exception 'bless'; end if;
  if public.bless_wish(b, wa) <> 'already' then raise exception 'double bless'; end if;
  if public.bless_wish(a, wa) <> 'own' then raise exception 'self bless'; end if;
  if public.bless_wish(c, wb) <> 'not_found' then raise exception 'bless pending'; end if;
  select blessings into n from public.wishes where id = wa;
  if n <> 1 then raise exception 'blessings count %', n; end if;
  select count(*) into n from public.list_wishes(b, 120) where id = wa and blessed;
  if n <> 1 then raise exception 'blessed flag missing'; end if;
  raise notice 'PASS: blessing counts once per person, not for own or hidden wishes';

  -- 7. 檢舉：滿三收起
  if public.report_wish(b, wa, 'spam') <> 'reported' then raise exception 'report 1'; end if;
  if public.report_wish(b, wa, 'spam') <> 'already' then raise exception 'double report'; end if;
  if public.report_wish(a, wa, 'spam') <> 'own' then raise exception 'self report'; end if;
  if public.report_wish(c, wa, 'free text') <> 'invalid' then raise exception 'reason check'; end if;
  if public.report_wish(c, wa, 'harassment') <> 'reported' then raise exception 'report 2'; end if;
  if public.report_wish(d, wa, 'personal_info') <> 'hidden' then raise exception 'report 3'; end if;
  select count(*) into n from public.list_wishes(null, 120) where id = wa;
  if n <> 0 then raise exception 'hidden wish still public'; end if;
  select count(*) into n from public.list_wishes(a, 120) where id = wa and status = 'pending';
  if n <> 1 then raise exception 'author should see hidden wish as pending'; end if;
  raise notice 'PASS: three distinct reports hide a wish pending review';

  -- 8. 人工審核
  if public.review_wish(wa, 'shown') <> 'shown' then raise exception 'review'; end if;
  if public.review_wish(wa, 'pending') <> 'invalid' then raise exception 'review status check'; end if;
  select count(*) into n from public.list_wishes(null, 120) where id = wa;
  if n <> 1 then raise exception 'reviewed wish not public'; end if;
  raise notice 'PASS: manual review can restore a wish';

  -- 9. 作者撤下；別人撤不了
  if public.withdraw_wish(c, wa) <> 'not_found' then raise exception 'withdraw by other'; end if;
  if public.withdraw_wish(a, wa) <> 'removed' then raise exception 'withdraw'; end if;
  select count(*) into n from public.list_wishes(a, 120) where id = wa;
  if n <> 0 then raise exception 'removed wish still listed'; end if;
  if public.make_wish(a, '撤了再寫', 'seek', 'zh-Hant', 'shown') <> 'daily_limit' then
    raise exception 'withdraw refunded the daily slot';
  end if;
  raise notice 'PASS: authors can withdraw their own wish; the daily slot is not refunded';

  -- 10. 刪帳號連帶清掉
  delete from public.profiles where id = d;
  select count(*) into n from public.wish_reports where user_id = d;
  if n <> 0 then raise exception 'reports survived profile deletion'; end if;
  raise notice 'PASS: deleting a profile deletes its reports';
end;
$$;

-- 11. 全站上限：塞滿當天 300 則
do $$
declare r text; i int;
begin
  for i in 1..300 loop
    insert into auth.users(id) values (gen_random_uuid()) on conflict do nothing;
  end loop;
  insert into public.profiles(id, email) select id, id::text || '@example.invalid' from auth.users
    on conflict do nothing;
  insert into public.wishes(user_id, body, tag, locale, status)
    select p.id, '填充', 'self', 'zh-Hant', 'shown' from public.profiles p
    where not exists (select 1 from public.wishes w where w.user_id = p.id
                      and w.day_utc = (now() at time zone 'utc')::date)
    limit greatest(0, 300 - (select count(*) from public.wishes
                             where day_utc = (now() at time zone 'utc')::date));
  insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000c9');
  insert into public.profiles(id, email) values ('00000000-0000-4000-8000-0000000000c9', 'late@example.invalid');
  r := public.make_wish('00000000-0000-4000-8000-0000000000c9', '晚來的', 'seek', 'zh-Hant', 'shown');
  if r <> 'site_cap' then raise exception 'site cap: %', r; end if;
  raise notice 'PASS: the site-wide daily cap holds';
end;
$$;

-- 12. 權限：client 角色碰不到表和函式
do $$
declare role_name text; fn text; tbl text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    foreach tbl in array array['public.wishes', 'public.wish_blessings', 'public.wish_reports'] loop
      if has_table_privilege(role_name, tbl, 'select') or has_table_privilege(role_name, tbl, 'insert') then
        raise exception '% can touch %', role_name, tbl;
      end if;
    end loop;
    foreach fn in array array[
      'public.make_wish(uuid,text,text,text,text)', 'public.list_wishes(uuid,integer)',
      'public.bless_wish(uuid,uuid)', 'public.report_wish(uuid,uuid,text)',
      'public.withdraw_wish(uuid,uuid)', 'public.review_wish(uuid,text)'] loop
      if has_function_privilege(role_name, fn, 'execute') then
        raise exception '% can execute %', role_name, fn;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role', 'public.make_wish(uuid,text,text,text,text)', 'execute') then
    raise exception 'service_role cannot make wishes';
  end if;
  raise notice 'PASS: only service_role can reach the wishing pool';
end;
$$;
