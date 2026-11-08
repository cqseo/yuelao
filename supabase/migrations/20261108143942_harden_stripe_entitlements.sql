-- YueLao billing hardening (V2, staged only): payment snapshots must not grant
-- entitlements twice when Stripe sends distinct events for the same payment.
-- Apply only after QA on staging. This migration does not touch existing orders.
-- Needed for stable, per-user Stripe customer identity. Existing projects may
-- already have it; fresh installs must have the same schema.
alter table public.profiles add column if not exists stripe_customer_id text;

create unique index if not exists entitlements_order_unique_idx
  on public.entitlements(order_id) where order_id is not null;

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
  end if;
  return 'granted';
end;
$$;

-- This deliberately fails closed for *any* refund (including partial), or a
-- disputed payment. Manual review is required before restoring any entitlement.
-- Losing only a portion of credits automatically would require a verified,
-- product-specific proration policy; never assume a partial refund was harmless.
drop function if exists public.revoke_for_refund(text, bigint);
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
  where id = v_payment.id;

  if coalesce(p_refund_amount,0) > 0 or p_dispute in ('open','lost') then
    update public.unlocks set revoked = true
    where order_id = v_payment.order_id and source = 'order' and not revoked;
    update public.entitlements set used_uses = greatest(used_uses, total_uses)
    where order_id = v_payment.order_id;
    return 'revoked';
  end if;
  return 'unchanged';
end;
$$;

-- Privileged settlement functions must not be directly callable through
-- unauthenticated/authenticated PostgREST clients.
revoke all on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.settle_stripe_payment(
  text,text,text,text,text,uuid,uuid,text,bigint,text,boolean,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz
) to service_role;

revoke all on function public.revoke_for_refund(text,bigint,text) from public, anon, authenticated;
grant execute on function public.revoke_for_refund(text,bigint,text) to service_role;
