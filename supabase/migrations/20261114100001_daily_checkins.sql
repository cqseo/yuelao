-- 每日心箋簽到存到帳號（DESIGN.md「每日簽到同步到帳號」）。
-- 沒登入的人照舊只記在瀏覽器；登入的人每次簽到寫一列，換裝置也在。
-- 只做加法：一張新表、兩個 RPC（只給 service_role）。不碰任何金錢或解鎖資料。
--
-- 「今天」由瀏覽器的當地日期決定（用戶在哪個時區，就照那裡的日子算）；
-- 伺服器只接受 UTC 今天前後一天內的日期，補登的舊紀錄只收 30 天內、最多 30 筆。

create table if not exists public.daily_checkins (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_checkins enable row level security;
-- 沒有任何 anon/authenticated 政策：只經伺服器 RPC 讀寫。

-- 目前狀態：連續天數（到今天或昨天為止連續簽到的天數）、最後一天、近 30 天簽過的日子。
create or replace function public.daily_checkin_state(p_user_id uuid, p_today date)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with anchor as (
    select case
      when exists (select 1 from public.daily_checkins where user_id = p_user_id and day = p_today) then p_today
      when exists (select 1 from public.daily_checkins where user_id = p_user_id and day = p_today - 1) then p_today - 1
    end as a
  ),
  streak as (
    select count(*)::int as n
    from (
      select c.day, row_number() over (order by c.day desc) as rn
      from public.daily_checkins c, anchor
      where c.user_id = p_user_id and anchor.a is not null and c.day <= anchor.a
    ) x, anchor
    where anchor.a - x.day = x.rn - 1
  )
  select jsonb_build_object(
    'streak', least((select n from streak), 3650),
    'lastDate', (select to_char(max(day), 'YYYY-MM-DD') from public.daily_checkins
                  where user_id = p_user_id and day <= p_today),
    'checkedDates', coalesce((
      select jsonb_agg(to_char(day, 'YYYY-MM-DD') order by day)
      from public.daily_checkins
      where user_id = p_user_id and day between p_today - 29 and p_today
    ), '[]'::jsonb)
  );
$$;

-- 簽到（p_check = true 時寫今天）並補登瀏覽器裡的舊紀錄，回傳最新狀態。
create or replace function public.record_daily_checkin(
  p_user_id uuid, p_today date, p_check boolean, p_backfill date[]
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_utc date := (now() at time zone 'utc')::date;
  d date;
  n int := 0;
begin
  if p_user_id is null or p_today is null or p_today not between v_utc - 1 and v_utc + 1 then
    return jsonb_build_object('error', 'invalid_day');
  end if;
  if p_check then
    insert into public.daily_checkins (user_id, day) values (p_user_id, p_today)
    on conflict do nothing;
  end if;
  if p_backfill is not null then
    foreach d in array p_backfill loop
      exit when n >= 30;
      n := n + 1;
      if d between p_today - 29 and p_today then
        insert into public.daily_checkins (user_id, day) values (p_user_id, d)
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return public.daily_checkin_state(p_user_id, p_today);
end;
$$;

revoke all on function public.daily_checkin_state(uuid, date) from public, anon, authenticated;
revoke all on function public.record_daily_checkin(uuid, date, boolean, date[]) from public, anon, authenticated;
grant execute on function public.daily_checkin_state(uuid, date) to service_role;
grant execute on function public.record_daily_checkin(uuid, date, boolean, date[]) to service_role;
