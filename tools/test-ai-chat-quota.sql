-- Run only on the disposable local Postgres instance created by the shell runner.
do $$
declare
  v_user uuid;
  v_count integer := 0;
  v_result boolean;
  v_global integer;
  v_row integer;
begin
  -- Three turns for each of 16 synthetic users = 48 total.
  for i in 1..16 loop
    v_user := ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    insert into auth.users(id) values(v_user);
    for j in 1..3 loop
      select public.reserve_ai_chat_turn(v_user) into v_result;
      if not v_result then raise exception 'unexpected deny for user % turn %', i, j; end if;
      v_count := v_count + 1;
    end loop;
    select public.reserve_ai_chat_turn(v_user) into v_result;
    if v_result then raise exception 'per-user cap exceeded for user %', i; end if;
  end loop;

  -- 17th user can spend 2 before the absolute 50/day shared limit.
  v_user := '00000000-0000-4000-8000-000000000017'::uuid;
  insert into auth.users(id) values(v_user);
  for j in 1..2 loop
    select public.reserve_ai_chat_turn(v_user) into v_result;
    if not v_result then raise exception 'unexpected global deny at count %', v_count; end if;
    v_count := v_count + 1;
  end loop;
  select public.reserve_ai_chat_turn(v_user) into v_result;
  if v_result then raise exception 'global daily cap exceeded'; end if;
  if v_count <> 50 then raise exception 'wrong spend count %', v_count; end if;

  select used into v_global from public.ai_chat_global_daily
   where day_utc = (now() at time zone 'utc')::date;
  if v_global <> 50 then raise exception 'global counter mismatch %', v_global; end if;
  select used into v_row from public.ai_chat_user_daily
    where user_id = v_user and day_utc = (now() at time zone 'utc')::date;
  if v_row <> 2 then raise exception 'last user counter mismatch %', v_row; end if;
  if public.get_ai_chat_turns_remaining(v_user) <> 0 then
    raise exception 'global cap not reflected in user status';
  end if;
  if public.reserve_ai_chat_turn(gen_random_uuid()) then
    raise exception 'missing user should be rejected';
  end if;
  raise notice 'PASS: 3 per user, 50 globally, no excess calls or missing-user access';

  if has_function_privilege('anon','public.reserve_ai_chat_turn(uuid)','EXECUTE') or
     has_function_privilege('authenticated','public.reserve_ai_chat_turn(uuid)','EXECUTE') or
     has_function_privilege('anon','public.get_ai_chat_turns_remaining(uuid)','EXECUTE') then
    raise exception 'privileged RPC exposed to web clients';
  end if;
  if not has_function_privilege('service_role','public.reserve_ai_chat_turn(uuid)','EXECUTE') then
    raise exception 'service role cannot reserve';
  end if;
  raise notice 'PASS: privileged quotas are server-only and have RLS enabled';
end;
$$;
