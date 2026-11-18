-- 分銷（站長 2026-11-18）：推廣人拿專屬連結（?ref=代號）去發，帶來的顧客「第一筆付款」記在他名下。
-- 佣金 = （實收 − Stripe 手續費）× 分成比例（預設 0.5，五五分）；退款或爭議的單不算。
-- 月底站長按後台數字手動結算（站外轉帳）。
--
-- 只做加法：
--   1. 新表 partners：代號、名稱、分成比例、數據頁私密連結的雜湊（明文只在建立時顯示一次）
--   2. orders.ref_partner：結帳時帶進來的推廣人代號（只記在這位顧客還沒付過款時）
--   3. payments.fee_amount / net_amount / fee_currency：Stripe 手續費與實收（報表第一次用到時從 Stripe 取回存下）
-- 既有的訂單、付款資料完全不動。

create table if not exists public.partners (
  code        text primary key check (code ~ '^[a-z0-9]{3,16}$'),
  name        text not null check (char_length(name) between 1 and 60),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  share       numeric(4,3) not null default 0.5 check (share > 0 and share <= 1),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.partners enable row level security;
-- 沒有任何 anon/authenticated 政策：只經伺服器讀寫。

alter table public.orders add column if not exists ref_partner text references public.partners(code);
create index if not exists orders_ref_partner_idx on public.orders (ref_partner, created_at)
  where ref_partner is not null;

alter table public.payments add column if not exists fee_amount bigint check (fee_amount is null or fee_amount >= 0);
alter table public.payments add column if not exists net_amount bigint;
alter table public.payments add column if not exists fee_currency text;
