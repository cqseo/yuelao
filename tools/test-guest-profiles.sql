-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 訪客帳號（20261118000001_guest_profiles）：匿名使用者也有 profile，綁信箱後同一列補上信箱。
do $$
declare n int; e text;
begin
  insert into auth.users(id, email, is_anonymous) values ('00000000-0000-4000-8000-0000000000a1', null, true);
  select count(*), max(email) into n, e from public.profiles where id = '00000000-0000-4000-8000-0000000000a1';
  if n <> 1 or e is not null then raise exception 'guest profile missing or has an email: % %', n, e; end if;
  raise notice 'PASS: a new guest (anonymous user) gets a profile with no email';

  update auth.users set email = 'Guest@Example.invalid', is_anonymous = false where id = '00000000-0000-4000-8000-0000000000a1';
  select count(*), max(email) into n, e from public.profiles where id = '00000000-0000-4000-8000-0000000000a1';
  if n <> 1 or e is distinct from 'guest@example.invalid' then raise exception 'binding did not fill the same profile: % %', n, e; end if;
  raise notice 'PASS: binding an email fills in the same profile row (same id, lower-cased)';

  insert into auth.users(id, email, is_anonymous) values ('00000000-0000-4000-8000-0000000000a2', null, false);
  select count(*) into n from public.profiles where id = '00000000-0000-4000-8000-0000000000a2';
  if n <> 0 then raise exception 'non-guest user without email got a profile'; end if;
  raise notice 'PASS: a non-guest user without email still gets no profile';

  -- 伺服器建訪客時也會自己補一列（觸發器沒生效的保險）：重複不出錯
  insert into public.profiles (id, email) values ('00000000-0000-4000-8000-0000000000a1', null) on conflict (id) do nothing;
  select email into e from public.profiles where id = '00000000-0000-4000-8000-0000000000a1';
  if e is distinct from 'guest@example.invalid' then raise exception 'server upsert overwrote the bound email'; end if;
  raise notice 'PASS: the server-side profile upsert never overwrites a bound email';

  if has_function_privilege('anon', 'public.ensure_profile_for_user()', 'execute')
     or has_function_privilege('authenticated', 'public.ensure_profile_for_user()', 'execute') then
    raise exception 'client roles can call the trigger function';
  end if;
  raise notice 'PASS: client roles still cannot call the trigger function';
end;
$$;
