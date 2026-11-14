-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
-- 大殿上香計數：同一人同一天只算一次、不同人各算一次、壞的 visitor 被拒、30 天前會被清、權限。
do $$
declare
  a text := repeat('a', 64);
  b text := repeat('b', 64);
  today date := (now() at time zone 'Asia/Taipei')::date;
  n int;
begin
  n := public.record_hall_offering(a);
  if n <> 1 then raise exception 'first: %', n; end if;
  n := public.record_hall_offering(a);
  if n <> 1 then raise exception 'same visitor twice: %', n; end if;
  raise notice 'PASS: one visitor counts once a day';
  n := public.record_hall_offering(b);
  if n <> 2 then raise exception 'second visitor: %', n; end if;
  raise notice 'PASS: another visitor adds one';
  if public.record_hall_offering('not-a-hash') is not null then raise exception 'bad visitor accepted'; end if;
  if public.record_hall_offering(null) is not null then raise exception 'null visitor accepted'; end if;
  select count(*) into n from public.hall_offerings;
  if n <> 2 then raise exception 'bad visitor stored: %', n; end if;
  raise notice 'PASS: malformed visitors are rejected';
  insert into public.hall_offerings(day, visitor) values (today - 40, repeat('c', 64));
  -- 清理是機率觸發：多叫幾次直到清掉（最多 2000 次）
  for i in 1..2000 loop
    perform public.record_hall_offering(a);
    exit when not exists (select 1 from public.hall_offerings where day = today - 40);
  end loop;
  if exists (select 1 from public.hall_offerings where day = today - 40) then raise exception 'old rows not cleaned'; end if;
  raise notice 'PASS: rows older than 30 days get cleaned';
end $$;
do $$
begin
  if has_function_privilege('anon', 'public.record_hall_offering(text)', 'execute')
     or has_function_privilege('authenticated', 'public.record_hall_offering(text)', 'execute') then
    raise exception 'client role can execute record_hall_offering';
  end if;
  if not has_function_privilege('service_role', 'public.record_hall_offering(text)', 'execute') then
    raise exception 'service_role cannot execute';
  end if;
  raise notice 'PASS: only service_role can call record_hall_offering';
end $$;
