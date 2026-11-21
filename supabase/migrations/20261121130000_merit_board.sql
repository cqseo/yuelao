-- 功德排行榜（2026-11-21）：功德台敲木魚、撥念珠的次數上榜，比誰的功德多，讓人每天回來。
--
-- 不用登入：每台瀏覽器有一把隨機的「裝置鑰匙」（只存在那台瀏覽器），Worker 只存它的 SHA-256，
-- 別人拿不到鑰匙就冒充不了。榜上只顯示自己取的法號，不顯示任何帳號或聯絡資料。
--
-- 防灌水：
--   * 客戶端只能送「增加了幾下」，不能直接設定總數。
--   * 每次最多加 600 下；和上次比，平均每秒最多 12 下（再給 30 下緩衝）。超過的部分不算。
--   * 一台裝置一天最多 30000 下。
--   * 站長可以把某個法號藏起來（hidden），之後不上榜。
-- 一天以台北時間（UTC+8）的日期為準：台灣、香港的客人在午夜一起換日。
--
-- 三張表都開 RLS、不給 client 角色任何權限；讀寫一律經 Worker 呼叫下面的 RPC（只給 service_role）。
-- 這個遷移只做加法。

create table if not exists public.merit_players (
  device_hash text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  nickname    text not null check (char_length(nickname) between 1 and 10 and nickname !~ '[\r\n]'),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.merit_scores (
  device_hash text not null references public.merit_players(device_hash) on delete cascade,
  day         date not null,
  count       integer not null default 0 check (count between 0 and 30000),
  updated_at  timestamptz not null default now(),
  primary key (device_hash, day)
);
create index if not exists merit_scores_day_idx on public.merit_scores (day, count desc);

alter table public.merit_players enable row level security;
alter table public.merit_scores enable row level security;
revoke all on public.merit_players from public, anon, authenticated;
revoke all on public.merit_scores from public, anon, authenticated;

create or replace function public.merit_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Taipei')::date;
$$;

-- 送分：p_delta 是這次增加的下數；p_nickname 為空就沿用舊的（新裝置給預設名）。
-- 回傳 {"today": 今天累計, "accepted": 這次算進去幾下}
create or replace function public.submit_merit(p_device_hash text, p_nickname text, p_delta integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := public.merit_today();
  v_row public.merit_scores%rowtype;
  v_allow integer;
  v_add integer;
  v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if p_device_hash !~ '^[0-9a-f]{64}$' or p_delta is null or p_delta < 0 then
    return jsonb_build_object('error', 'invalid');
  end if;
  if v_nick is not null and (char_length(v_nick) > 10 or v_nick ~ '[\r\n]') then
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into public.merit_players (device_hash, nickname)
  values (p_device_hash, coalesce(v_nick, '無名善信'))
  on conflict (device_hash) do update
    set nickname = coalesce(v_nick, public.merit_players.nickname),
        updated_at = case when v_nick is null then public.merit_players.updated_at else now() end;

  select * into v_row from public.merit_scores
   where device_hash = p_device_hash and day = v_day
   for update;

  if not found then
    v_allow := 600;
    v_add := least(p_delta, v_allow, 30000);
    insert into public.merit_scores (device_hash, day, count) values (p_device_hash, v_day, v_add);
    return jsonb_build_object('today', v_add, 'accepted', v_add);
  end if;

  -- 平均每秒最多 12 下，另給 30 下緩衝；一次最多 600 下；一天最多 30000 下
  v_allow := least(600, ceil(extract(epoch from (now() - v_row.updated_at)) * 12)::integer + 30);
  v_add := greatest(0, least(p_delta, v_allow, 30000 - v_row.count));
  update public.merit_scores
     set count = count + v_add, updated_at = now()
   where device_hash = p_device_hash and day = v_day;
  return jsonb_build_object('today', v_row.count + v_add, 'accepted', v_add);
end;
$$;

-- 排行榜：p_range = 'day'（今天）| 'week'（最近 7 天）| 'all'（全部）。
-- 回傳前 50 名的法號與功德，以及這台裝置自己的名次（沒上過榜就是 null）。
create or replace function public.merit_board(p_range text, p_device_hash text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date;
  v_top jsonb;
  v_me jsonb;
begin
  v_from := case p_range
    when 'day' then public.merit_today()
    when 'week' then public.merit_today() - 6
    when 'all' then date '2000-01-01'
    else null end;
  if v_from is null then
    return jsonb_build_object('error', 'invalid');
  end if;

  with totals as (
    select s.device_hash, sum(s.count)::integer as total, max(s.updated_at) as last_at
      from public.merit_scores s
      join public.merit_players p on p.device_hash = s.device_hash and not p.hidden
     where s.day >= v_from
     group by s.device_hash
    having sum(s.count) > 0
  ), ranked as (
    select t.*, rank() over (order by t.total desc) as rnk,
           row_number() over (order by t.total desc, t.last_at asc) as rn
      from totals t
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'nickname', p.nickname, 'total', r.total,
                                                  'me', r.device_hash = p_device_hash) order by r.rn)
                from ranked r join public.merit_players p using (device_hash)
               where r.rn <= 50), '[]'::jsonb),
    (select jsonb_build_object('rank', r.rnk, 'total', r.total, 'players', (select count(*) from ranked))
       from ranked r where r.device_hash = p_device_hash)
    into v_top, v_me;

  return jsonb_build_object('top', v_top, 'me', v_me,
                            'players', (select count(*) from totals),
                            'day', public.merit_today());
end;
$$;

revoke all on function public.merit_today() from public, anon, authenticated;
revoke all on function public.submit_merit(text, text, integer) from public, anon, authenticated;
revoke all on function public.merit_board(text, text) from public, anon, authenticated;
grant execute on function public.submit_merit(text, text, integer) to service_role;
grant execute on function public.merit_board(text, text) to service_role;
grant execute on function public.merit_today() to service_role;
