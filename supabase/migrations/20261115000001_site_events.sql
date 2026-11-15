-- 站內行為紀錄（第一方統計，給站長後台用）：誰看了哪一頁、按了哪些關鍵按鈕。
-- 不存 IP、不存信箱；訪客只用瀏覽器裡隨機產生的 vid（訪客）與 sid（一次造訪）區分。
-- 只有 Worker 用 service_role 讀寫；前端與登入用戶都碰不到（RLS 開著、沒有任何 policy）。
create table if not exists public.site_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  vid       text not null check (char_length(vid) between 8 and 40),
  sid       text not null check (char_length(sid) between 8 and 40),
  user_id   uuid references public.profiles(id) on delete set null,
  name      text not null check (name ~ '^[a-z][a-z0-9_]{0,39}$'),
  path      text not null default '' check (char_length(path) <= 200),
  props     jsonb not null default '{}'::jsonb,
  referrer  text check (char_length(referrer) <= 120),
  device    text check (device in ('mobile', 'tablet', 'desktop')),
  country   text check (char_length(country) <= 2),
  locale    text check (char_length(locale) <= 8)
);

create index if not exists site_events_at_idx on public.site_events (at desc);
create index if not exists site_events_sid_idx on public.site_events (sid, at);
create index if not exists site_events_user_idx on public.site_events (user_id) where user_id is not null;

alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
