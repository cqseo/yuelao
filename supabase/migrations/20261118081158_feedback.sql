-- 用戶意見（站長 2026-11-18）：任何人（不用登入）都能留一句意見，只有站長在後台看得到。
-- 只做加法：新表 feedback；沒有任何 anon/authenticated 政策，只經伺服器讀寫。

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('idea', 'problem', 'other')),
  message     text not null check (char_length(message) between 2 and 1000),
  contact     text check (contact is null or char_length(contact) between 3 and 120),
  page        text check (page is null or char_length(page) <= 200),
  locale      text check (locale is null or locale ~ '^[a-zA-Z-]{2,8}$'),
  device      text check (device is null or device in ('mobile', 'tablet', 'desktop')),
  user_id     uuid references public.profiles(id) on delete set null,
  status      text not null default 'new' check (status in ('new', 'read', 'done')),
  updated_at  timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id) where user_id is not null;
alter table public.feedback enable row level security;
