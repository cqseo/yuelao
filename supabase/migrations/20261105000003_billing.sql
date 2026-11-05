-- P0 skeleton migration 3/4: orders, payments, unlocks, entitlements, subscriptions, webhook_events.
-- Translated from the shipwords D1 billing schema (field meanings unchanged; SQLite
-- integer timestamps become timestamptz / bigint).
-- Two small additions vs BUILD_PLAN §4.4 (both needed for settlement, see the RPC file):
--   orders.product_kind / orders.stick_id / orders.category / orders.locale / orders.pack_uses
--   entitlements.order_id — so refunds can find the pack an order created.

create table orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id),
  product_id    text not null,                    -- matches site.config.ts; never change after launch
  product_kind  text not null check (product_kind in ('unlock', 'pack', 'subscription')),
  provider      text not null default 'stripe',
  amount        bigint not null,                  -- smallest currency unit (TWD cents / HKD cents)
  currency      text not null,                    -- 'TWD' | 'HKD'
  status        text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  checkout_ref  text,                             -- Stripe Checkout Session id
  stick_id      smallint references sticks(id),   -- unlock orders only: which stick
  category      text check (category in ('him', 'single', 'reunion')),
  locale        text not null default 'zh-Hant',
  pack_uses     int,                              -- pack orders only: uses granted
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);
create index orders_user_idx on orders (user_id, created_at desc);
alter table orders enable row level security;
-- Client reads its own orders; all writes go through the Worker + RPC.
create policy "orders_select_own" on orders for select using (auth.uid() = user_id);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null default 'stripe',
  payment_ref     text not null,                  -- Stripe: one-time = PaymentIntent, subscription = Invoice
  charge_ref      text,                           -- refund/chargeback lookup: always the PaymentIntent
  user_id         uuid not null references profiles(id),
  order_id        uuid references orders(id),
  subscription_ref text,
  product_id      text not null,
  amount          bigint not null,
  currency        text not null,
  amount_refunded bigint not null default 0,
  dispute_status  text,
  unlocks_granted int not null default 0,
  unlocks_revoked int not null default 0,
  adjust_seq      int not null default 0,        -- +1 per adjustment, part of the idempotency key
  period_start    timestamptz,
  period_end      timestamptz,
  fetched_at      timestamptz not null default now(),  -- only newer provider snapshots are accepted
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (provider, payment_ref)
);
create index payments_user_idx on payments (user_id);
alter table payments enable row level security;
create policy "payments_select_own" on payments for select using (auth.uid() = user_id);

-- entitlements: remaining pack uses (3 / 8), never expire.
-- (Created before unlocks: unlocks.pack_id references entitlements(id).)
create table entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  product_id  text not null,
  order_id    uuid references orders(id),
  total_uses  int not null,
  used_uses   int not null default 0 check (used_uses <= total_uses),
  expires_at  timestamptz,                       -- packs: null (never expire)
  created_at  timestamptz not null default now()
);
create index entitlements_user_idx on entitlements (user_id);
alter table entitlements enable row level security;
create policy "entitlements_select_own" on entitlements for select using (auth.uid() = user_id);

-- unlocks: one deep-reading unlock (created by a single purchase, or by consuming a pack use).
create table unlocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  stick_id    smallint not null references sticks(id),
  category    text not null check (category in ('him', 'single', 'reunion')),
  locale      text not null default 'zh-Hant',
  source      text not null check (source in ('order', 'pack')),
  order_id    uuid references orders(id),
  pack_id     uuid references entitlements(id),
  revoked     boolean not null default false,     -- true after refund / chargeback
  created_at  timestamptz not null default now(),
  unique (user_id, stick_id, category, locale)
);
create index unlocks_user_idx on unlocks (user_id, created_at desc);
alter table unlocks enable row level security;
create policy "unlocks_select_own" on unlocks for select using (auth.uid() = user_id);

-- subscriptions: V1 creates the table but sells no subscription product (v2 enables it).
create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null default 'stripe',
  subscription_ref text not null,
  user_id         uuid not null references profiles(id),
  product_id      text not null,
  status          text not null,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  fetched_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (provider, subscription_ref)
);
alter table subscriptions enable row level security;
create policy "subscriptions_select_own" on subscriptions for select using (auth.uid() = user_id);

-- webhook_events: webhook dedup (provider + event_id unique).
-- No policy at all: RLS is on and nothing is granted, so no client role can read or write it.
create table webhook_events (
  provider    text not null,
  event_id    text not null,
  type        text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);
alter table webhook_events enable row level security;
