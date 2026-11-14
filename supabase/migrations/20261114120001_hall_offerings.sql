-- 大殿「今天已有 N 人上過香」（DESIGN.md「今天已有 N 人在大殿上過香」）。
-- 只做加法：一張計數表、一個 RPC（只給 service_role）。不碰任何金錢、帳號或解鎖資料。
--
-- 一人一天只算一次：visitor 是瀏覽器裡的隨機種子經伺服器雜湊（SHA-256），不是帳號、不能回推是誰。
-- 「今天」照台北時間（UTC+8）算，由伺服器決定，不收前端的日期。只留近 30 天。

create table if not exists public.hall_offerings (
  day        date not null,
  visitor    text not null check (visitor ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (day, visitor)
);
alter table public.hall_offerings enable row level security;
-- 沒有任何 anon/authenticated 政策：只經伺服器 RPC 讀寫。

-- 記一次上香（同一人同一天只算一次），回傳今天的總人數。
create or replace function public.record_hall_offering(p_visitor text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  n integer;
begin
  if p_visitor is null or p_visitor !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  insert into public.hall_offerings (day, visitor) values (v_day, p_visitor)
  on conflict do nothing;
  -- 偶爾順手清掉 30 天前的
  if random() < 0.02 then
    delete from public.hall_offerings where day < v_day - 30;
  end if;
  select count(*)::int into n from public.hall_offerings where day = v_day;
  return n;
end;
$$;

revoke all on function public.record_hall_offering(text) from public, anon, authenticated;
grant execute on function public.record_hall_offering(text) to service_role;
