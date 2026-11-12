-- 付費地基：第四種商品——「永久擁有的物品」（kind = 'item'）。
-- 第一批用在集市的付費外觀；之後的髮飾、手持物、套裝都走同一條路，不必再改結算。
--
-- 這個遷移只做加法：
--   1. orders.product_kind 多收一個值 'item'
--   2. 新表 owned_items（誰擁有哪件物品、來自哪張訂單、是否因退款收回）
--   3. settle_stripe_payment：付款成立時，item 訂單發一筆擁有權（其餘分支一字未改）
--   4. revoke_for_refund：退款／爭議時，一併收回該訂單發出的物品（其餘一字未改）
-- 既有的訂單、解鎖、次數包資料完全不動。

alter table public.orders drop constraint if exists orders_product_kind_check;
alter table public.orders add constraint orders_product_kind_check
  check (product_kind in ('unlock', 'pack', 'subscription', 'item'));

create table if not exists public.owned_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null,                      -- = orders.product_id，對應 site.config.ts
  order_id    uuid not null references public.orders(id),
  revoked     boolean not null default false,     -- 退款／拒付後為 true
  created_at  timestamptz not null default now(),
  unique (user_id, item_id)                       -- 同一件只擁有一次；退款後重買會沿用這一列
);
-- 一張訂單只發一件：重複或亂序的 webhook 不會多發。
create unique index if not exists owned_items_order_unique_idx on public.owned_items(order_id);
create index if not exists owned_items_user_idx on public.owned_items (user_id);
alter table public.owned_items enable row level security;
-- 使用者只能讀自己的；所有寫入都經 Worker + RPC。
drop policy if exists "owned_items_select_own" on public.owned_items;
create policy "owned_items_select_own" on public.owned_items for select using (auth.uid() = user_id);

-- 與 20261108143942 的版本逐行相同，只在最後的發放分支多一個 'item'。
create or replace function public.settle_stripe_payment(
  p_event_id text, p_type text, p_provider text, p_payment_ref text,
  p_charge_ref text, p_user_id uuid, p_order_id uuid, p_product_id text,
  p_amount bigint, p_currency text, p_paid boolean, p_amount_refunded bigint,
  p_dispute text, p_subscription_ref text, p_period_start timestamptz,
  p_period_end timestamptz, p_paid_at timestamptz, p_fetched_at timestamptz
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.payments%rowtype;
  v_newly_paid uuid;
begin
  if p_user_id is null or p_payment_ref is null or p_payment_ref = '' then
    raise exception 'payment_identity_missing';
  end if;

  -- A payment ref cannot be reassigned to another user or order through a later event.
  select * into v_existing from public.payments
  where provider = p_provider and payment_ref = p_payment_ref for update;
  if found and (
    v_existing.user_id is distinct from p_user_id
    or v_existing.order_id is distinct from p_order_id
    or v_existing.product_id is distinct from p_product_id
  ) then
    raise exception 'payment_identity_mismatch';
  end if;

  -- If Stripe says "paid", verify the authoritative, server-priced order.
  if p_paid then
    if p_order_id is null or p_amount is null or p_amount <= 0 then
      raise exception 'paid_order_missing';
    end if;
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then
      raise exception 'order_not_found';
    end if;
    if v_order.user_id is distinct from p_user_id
       or v_order.product_id is distinct from p_product_id
       or v_order.provider is distinct from p_provider
       or upper(v_order.currency) is distinct from upper(p_currency)
       or p_amount < v_order.amount then
      raise exception 'paid_order_mismatch';
    end if;
  end if;

  insert into public.webhook_events (provider, event_id, type)
  values (p_provider, p_event_id, p_type)
  on conflict (provider, event_id) do nothing;
  if not found then return 'duplicate_event'; end if;

  insert into public.payments (
    provider, payment_ref, charge_ref, user_id, order_id, subscription_ref,
    product_id, amount, currency, amount_refunded, dispute_status,
    period_start, period_end, fetched_at
  ) values (
    p_provider, p_payment_ref, p_charge_ref, p_user_id, p_order_id, p_subscription_ref,
    p_product_id, p_amount, p_currency, p_amount_refunded, p_dispute,
    p_period_start, p_period_end, p_fetched_at
  )
  on conflict (provider, payment_ref) do update set
    amount = excluded.amount,
    currency = excluded.currency,
    amount_refunded = greatest(payments.amount_refunded, excluded.amount_refunded),
    dispute_status = excluded.dispute_status,
    fetched_at = excluded.fetched_at,
    updated_at = now()
  where public.payments.fetched_at < excluded.fetched_at;

  -- Refunded/disputed payments may be recorded but cannot grant entitlements.
  if not p_paid or p_order_id is null then return 'recorded_unpaid'; end if;
  if coalesce(p_amount_refunded, 0) > 0 or p_dispute in ('open', 'lost') then
    return 'recorded_not_eligible';
  end if;

  -- A status transition is the *only* grant trigger. Row lock makes competing
  -- event IDs serialize; unique entitlements.order_id guards against bugs.
  update public.orders set status = 'paid', paid_at = coalesce(paid_at, p_paid_at)
    where id = p_order_id and status = 'pending'
    returning id into v_newly_paid;
  if v_newly_paid is null then return 'already_settled_or_expired'; end if;

  if v_order.product_kind = 'unlock' then
    insert into public.unlocks (user_id, stick_id, category, locale, source, order_id)
    values (v_order.user_id, v_order.stick_id, v_order.category, v_order.locale, 'order', v_order.id)
    on conflict (user_id, stick_id, category, locale) do nothing;
  elsif v_order.product_kind = 'pack' then
    insert into public.entitlements (user_id, product_id, order_id, total_uses)
    values (v_order.user_id, v_order.product_id, v_order.id, v_order.pack_uses)
    on conflict (order_id) where order_id is not null do nothing;
  elsif v_order.product_kind = 'item' then
    -- 新買：新增一列。退款後重買：把同一列改回有效並指向新訂單。
    -- 仍有效的擁有權不會被覆蓋（結帳前已擋掉重複購買；這裡再守一次）。
    insert into public.owned_items (user_id, item_id, order_id)
    values (v_order.user_id, v_order.product_id, v_order.id)
    on conflict (user_id, item_id) do update set
      revoked = false, order_id = excluded.order_id, created_at = now()
    where public.owned_items.revoked;
  end if;
  return 'granted';
end;
$$;

-- 與 20261109000001 的版本逐行相同，只多收回 owned_items 一句。
create or replace function public.revoke_for_refund(
  p_payment_ref text, p_refund_amount bigint, p_dispute text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments
    where payment_ref = p_payment_ref for update;
  if not found then return 'no_payment'; end if;
  update public.payments set
    amount_refunded = greatest(amount_refunded, coalesce(p_refund_amount,0)),
    dispute_status = p_dispute,
    updated_at = now()
  where id=v_payment.id;

  if coalesce(p_refund_amount,0)>0 or p_dispute in ('open','lost') then
    update public.unlocks set revoked=true
      where order_id=v_payment.order_id and source='order' and not revoked;
    update public.unlocks set revoked=true
      where source='pack' and not revoked
        and pack_id in (
          select id from public.entitlements where order_id=v_payment.order_id
        );
    update public.entitlements set used_uses=total_uses
      where order_id=v_payment.order_id;
    update public.owned_items set revoked=true
      where order_id=v_payment.order_id and not revoked;
    return 'revoked';
  end if;
  return 'unchanged';
end;
$$;

-- 權限照舊：結算函式只給 service_role。
revoke all on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) to service_role;
revoke all on function public.revoke_for_refund(text,bigint,text) from public, anon, authenticated;
grant execute on function public.revoke_for_refund(text,bigint,text) to service_role;
