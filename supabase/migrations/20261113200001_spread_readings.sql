-- 塔羅館的完整解讀：第五種商品「牌陣解讀」（kind = 'spread'）。
-- 一個「牌陣」= 牌組 + 抽到的三張（含正逆位）+ 問題的雜湊，例如
--   tarot:Cups_02,06~,04|3f2a9c0d1e5b7a64   （~ 表示逆位）
--   lnm:15,19,07|3f2a9c0d1e5b7a64
-- 問題本身照舊不存；只存它的 16 位雜湊，讓「同一組牌問不同的事」是不同的解讀。
--
-- 只做加法：
--   1. orders.product_kind 多收 'spread'；orders 多一欄 spread（只有 spread 訂單有值）
--   2. 新表 spread_unlocks（誰買了哪個牌陣的解讀、哪張訂單、是否因退款收回）
--   3. 新表 spread_ai_readings（生成的解讀正文；與 paid_ai_readings 同一套租約）
--   4. claim / finish / fail / get 四個 RPC（只給 service_role）
--   5. settle_stripe_payment：付款成立時 spread 訂單發一筆解鎖（其餘分支一字未改）
--   6. revoke_for_refund：退款／爭議時一併收回該訂單的牌陣解鎖（其餘一字未改）
-- 牌陣解讀不接受次數包，只能單次購買。既有的訂單、解鎖、次數包、物品資料完全不動。

alter table public.orders drop constraint if exists orders_product_kind_check;
alter table public.orders add constraint orders_product_kind_check
  check (product_kind in ('unlock', 'pack', 'subscription', 'item', 'spread'));

alter table public.orders add column if not exists spread text;
alter table public.orders drop constraint if exists orders_spread_shape;
alter table public.orders add constraint orders_spread_shape check (
  (product_kind = 'spread' and spread is not null
    and spread ~ '^(tarot|lnm):[A-Za-z0-9_~,]{5,80}\|[0-9a-f]{16}$')
  or (product_kind <> 'spread' and spread is null)
);

create table if not exists public.spread_unlocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  spread      text not null check (spread ~ '^(tarot|lnm):[A-Za-z0-9_~,]{5,80}\|[0-9a-f]{16}$'),
  locale      text not null check (locale in ('zh-Hant', 'zh-Hans')),
  order_id    uuid not null references public.orders(id),
  revoked     boolean not null default false,     -- 退款／拒付後為 true
  created_at  timestamptz not null default now(),
  unique (user_id, spread, locale)                -- 同一個牌陣只買一次；退款後重買沿用這一列
);
-- 一張訂單只發一次：重複或亂序的 webhook 不會多發。
create unique index if not exists spread_unlocks_order_unique_idx on public.spread_unlocks(order_id);
create index if not exists spread_unlocks_user_idx on public.spread_unlocks (user_id);
alter table public.spread_unlocks enable row level security;
drop policy if exists "spread_unlocks_select_own" on public.spread_unlocks;
create policy "spread_unlocks_select_own" on public.spread_unlocks
  for select using ((select auth.uid()) = user_id);

create table if not exists public.spread_ai_readings (
  unlock_id uuid primary key references public.spread_unlocks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','generating','ready','failed')),
  body text,
  model text,
  lease_id uuid,
  lease_until timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spread_ai_readings_ready_body check (
    (status = 'ready' and body is not null and char_length(body) between 100 and 8000)
    or (status <> 'ready' and body is null)
  )
);
create index if not exists spread_ai_readings_user_idx
  on public.spread_ai_readings (user_id, created_at desc);
alter table public.spread_ai_readings enable row level security;
-- 沒有任何 anon/authenticated 政策：正文只經伺服器 RPC 讀寫。

create or replace function public.claim_spread_reading(
  p_user_id uuid, p_spread text, p_locale text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_unlock uuid;
  v_row public.spread_ai_readings%rowtype;
  v_lease uuid;
begin
  if p_user_id is null
    or p_spread is null or p_spread !~ '^(tarot|lnm):[A-Za-z0-9_~,]{5,80}\|[0-9a-f]{16}$'
    or p_locale not in ('zh-Hant','zh-Hans') then
    return jsonb_build_object('state','invalid');
  end if;
  -- 鎖住這筆解鎖，與退款收回互斥。
  select id into v_unlock from public.spread_unlocks
  where user_id = p_user_id and spread = p_spread and locale = p_locale and revoked = false
  for update;
  if v_unlock is null then
    return jsonb_build_object('state','not_unlocked');
  end if;

  insert into public.spread_ai_readings(unlock_id, user_id)
  values(v_unlock, p_user_id)
  on conflict (unlock_id) do nothing;
  select * into v_row from public.spread_ai_readings
    where unlock_id = v_unlock and user_id = p_user_id for update;
  if v_row.status = 'ready' then
    return jsonb_build_object('state','ready');
  end if;
  if v_row.status = 'generating' and v_row.lease_until > now() then
    return jsonb_build_object('state','processing');
  end if;

  v_lease := gen_random_uuid();
  update public.spread_ai_readings
    set status='generating', body=null, lease_id=v_lease,
        lease_until=now() + interval '110 seconds', updated_at=now()
    where unlock_id=v_unlock;
  return jsonb_build_object('state','claimed','claimId',v_lease,'unlockId',v_unlock);
end;
$$;

create or replace function public.finish_spread_reading(
  p_user_id uuid, p_unlock_id uuid, p_claim_id uuid,
  p_body text, p_model text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_unlock uuid;
begin
  if p_user_id is null or p_unlock_id is null or p_claim_id is null
    or char_length(p_body) not between 100 and 8000
    or char_length(coalesce(p_model,'')) not between 1 and 80 then
    return false;
  end if;
  select id into v_unlock from public.spread_unlocks
  where id=p_unlock_id and user_id=p_user_id and revoked=false for update;
  if v_unlock is null then return false; end if;

  update public.spread_ai_readings
    set body=p_body, status='ready', model=p_model,
        lease_id=null, lease_until=null, generated_at=now(), updated_at=now()
    where unlock_id=p_unlock_id and user_id=p_user_id
      and status='generating' and lease_id=p_claim_id and lease_until>now();
  return found;
end;
$$;

create or replace function public.fail_spread_reading(
  p_user_id uuid, p_unlock_id uuid, p_claim_id uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.spread_ai_readings
    set status='failed', body=null, lease_id=null, lease_until=null, updated_at=now()
  where unlock_id=p_unlock_id and user_id=p_user_id
    and status='generating' and lease_id=p_claim_id;
  return found;
end;
$$;

-- none：沒買（或已退款）；unlocked：買了、正文還沒生成；ready：附正文。
create or replace function public.get_spread_reading(
  p_user_id uuid, p_spread text, p_locale text
) returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select case when r.status = 'ready'
              then jsonb_build_object('state','ready','body',r.body)
              else jsonb_build_object('state','unlocked') end
       from public.spread_unlocks u
       left join public.spread_ai_readings r on r.unlock_id = u.id and r.user_id = u.user_id
      where u.user_id = p_user_id and u.spread = p_spread and u.locale = p_locale
        and u.revoked = false
      limit 1),
    jsonb_build_object('state','none'));
$$;

-- 與 20261112000001 的版本逐行相同，只在最後的發放分支多一個 'spread'。
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
  elsif v_order.product_kind = 'spread' then
    -- 同上：新買新增一列；退款後重買把同一列改回有效並指向新訂單；仍有效的不覆蓋。
    insert into public.spread_unlocks (user_id, spread, locale, order_id)
    values (v_order.user_id, v_order.spread, v_order.locale, v_order.id)
    on conflict (user_id, spread, locale) do update set
      revoked = false, order_id = excluded.order_id, created_at = now()
    where public.spread_unlocks.revoked;
  end if;
  return 'granted';
end;
$$;

-- 與 20261112000001 的版本逐行相同，只多收回該訂單的牌陣解鎖。
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
    update public.spread_unlocks set revoked=true
      where order_id=v_payment.order_id and not revoked;
    return 'revoked';
  end if;
  return 'unchanged';
end;
$$;

-- 權限：全部只給 service_role。
revoke all on function public.claim_spread_reading(uuid,text,text) from public, anon, authenticated;
revoke all on function public.finish_spread_reading(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.fail_spread_reading(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.get_spread_reading(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_spread_reading(uuid,text,text) to service_role;
grant execute on function public.finish_spread_reading(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.fail_spread_reading(uuid,uuid,uuid) to service_role;
grant execute on function public.get_spread_reading(uuid,text,text) to service_role;
revoke all on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) to service_role;
revoke all on function public.revoke_for_refund(text,bigint,text) from public, anon, authenticated;
grant execute on function public.revoke_for_refund(text,bigint,text) to service_role;
