-- 追問月老（站長 2026-11-18）：買過付費解籤的人，可以就同一件事再問月老一句。
-- 一份解籤最多追問 3 次，每次單獨付款（商品 kind = 'followup'）。
-- 問題照舊不存，只存月老的回答。
--
-- 只做加法：
--   1. orders.product_kind 多收 'followup'；orders 多一欄 followup_unlock（只有追問訂單有值）
--   2. 新表 reading_followups：一筆 = 一次付了錢的追問（open 未用、generating 生成中、ready 已答）
--   3. claim / finish / release 三個 RPC（只給 service_role）；release 把名額還回去
--      （生成失敗、問了別的事、需要先照顧安全時，都不算用掉）
--   4. settle_stripe_payment：付款成立時發一筆追問（名額未滿才發）
--   5. revoke_for_refund：退款／爭議時一併收回該訂單的追問
-- 既有的訂單、解鎖、解讀資料完全不動。

alter table public.orders drop constraint if exists orders_product_kind_check;
alter table public.orders add constraint orders_product_kind_check
  check (product_kind in ('unlock', 'pack', 'subscription', 'item', 'spread', 'followup'));

alter table public.orders add column if not exists followup_unlock uuid references public.unlocks(id);
alter table public.orders drop constraint if exists orders_followup_shape;
alter table public.orders add constraint orders_followup_shape check (
  (product_kind = 'followup') = (followup_unlock is not null)
);
create index if not exists orders_followup_unlock_idx on public.orders (followup_unlock)
  where followup_unlock is not null;

create table if not exists public.reading_followups (
  id          uuid primary key default gen_random_uuid(),
  unlock_id   uuid not null references public.unlocks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid not null unique references public.orders(id),  -- 一張訂單只發一次
  status      text not null default 'open' check (status in ('open', 'generating', 'ready')),
  body        text,
  model       text,
  lease_id    uuid,
  lease_until timestamptz,
  revoked     boolean not null default false,                      -- 退款／拒付後為 true
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  updated_at  timestamptz not null default now(),
  constraint reading_followups_ready_body check (
    (status = 'ready' and body is not null and char_length(body) between 60 and 4000)
    or (status <> 'ready' and body is null)
  )
);
create index if not exists reading_followups_unlock_idx
  on public.reading_followups (unlock_id, created_at);
create index if not exists reading_followups_user_idx on public.reading_followups (user_id);
alter table public.reading_followups enable row level security;
-- 沒有任何 anon/authenticated 政策：只經伺服器讀寫。

-- 領一個未用的名額來生成。processing：已有一則在生成；no_credit：沒有未用的名額。
create or replace function public.claim_reading_followup(
  p_user_id uuid, p_unlock_id uuid
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_lease uuid;
begin
  if p_user_id is null or p_unlock_id is null then
    return jsonb_build_object('state','invalid');
  end if;
  perform 1 from public.unlocks
    where id = p_unlock_id and user_id = p_user_id and not revoked
    for update;
  if not found then return jsonb_build_object('state','not_unlocked'); end if;

  perform 1 from public.reading_followups
    where unlock_id = p_unlock_id and user_id = p_user_id and not revoked
      and status = 'generating' and lease_until > now();
  if found then return jsonb_build_object('state','processing'); end if;

  select id into v_id from public.reading_followups
    where unlock_id = p_unlock_id and user_id = p_user_id and not revoked
      and (status = 'open' or (status = 'generating' and lease_until <= now()))
    order by created_at
    limit 1
    for update;
  if v_id is null then return jsonb_build_object('state','no_credit'); end if;

  v_lease := gen_random_uuid();
  update public.reading_followups
    set status = 'generating', lease_id = v_lease,
        lease_until = now() + interval '80 seconds', updated_at = now()
    where id = v_id;
  return jsonb_build_object('state','claimed','claimId',v_lease,'followupId',v_id);
end;
$$;

create or replace function public.finish_reading_followup(
  p_user_id uuid, p_followup_id uuid, p_claim_id uuid, p_body text, p_model text
) returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id is null or p_followup_id is null or p_claim_id is null
    or char_length(p_body) not between 60 and 4000
    or char_length(coalesce(p_model,'')) not between 1 and 80 then
    return false;
  end if;
  update public.reading_followups
    set body = p_body, status = 'ready', model = p_model,
        lease_id = null, lease_until = null, answered_at = now(), updated_at = now()
    where id = p_followup_id and user_id = p_user_id and not revoked
      and status = 'generating' and lease_id = p_claim_id and lease_until > now();
  return found;
end;
$$;

-- 不算用掉：名額還回去，下次可以再問。
create or replace function public.release_reading_followup(
  p_user_id uuid, p_followup_id uuid, p_claim_id uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.reading_followups
    set status = 'open', lease_id = null, lease_until = null, updated_at = now()
    where id = p_followup_id and user_id = p_user_id
      and status = 'generating' and lease_id = p_claim_id;
  return found;
end;
$$;

-- 與 20261113200001 的版本逐行相同，只多：declare v_n，發放分支多一個 'followup'。
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
  v_n int;
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
  elsif v_order.product_kind = 'followup' then
    -- 追問一次：鎖住那份解鎖（與退款收回、其他追問付款互斥），名額未滿才發。
    -- 結帳前已擋掉額滿；這裡再守一次，額滿時付款照記，但不發（站長退款）。
    perform 1 from public.unlocks
      where id = v_order.followup_unlock and user_id = v_order.user_id and not revoked
      for update;
    if not found then return 'followup_unlock_gone'; end if;
    select count(*) into v_n from public.reading_followups
      where unlock_id = v_order.followup_unlock and not revoked;
    if v_n >= 3 then return 'followup_full'; end if;
    insert into public.reading_followups (unlock_id, user_id, order_id)
    values (v_order.followup_unlock, v_order.user_id, v_order.id)
    on conflict (order_id) do nothing;
  end if;
  return 'granted';
end;
$$;

-- 與 20261113200001 的版本逐行相同，只多收回該訂單的追問。
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
    update public.reading_followups set revoked=true
      where order_id=v_payment.order_id and not revoked;
    return 'revoked';
  end if;
  return 'unchanged';
end;
$$;

-- 權限：全部只給 service_role。
revoke all on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) to service_role;
revoke all on function public.revoke_for_refund(text,bigint,text) from public, anon, authenticated;
grant execute on function public.revoke_for_refund(text,bigint,text) to service_role;
revoke all on function public.claim_reading_followup(uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_reading_followup(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.release_reading_followup(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_reading_followup(uuid,uuid) to service_role;
grant execute on function public.finish_reading_followup(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.release_reading_followup(uuid,uuid,uuid) to service_role;
