-- P0 skeleton migration 4/4: money-settlement RPCs (SECURITY DEFINER, one function = one transaction).
-- Only the Worker (service_role) calls these. PostgREST never writes money tables directly.
-- Idempotency: webhook_events unique key + ON CONFLICT DO NOTHING; payment snapshots are
-- monotonic (only newer fetched_at wins). A failed call rolls everything back, so a
-- retried webhook can settle cleanly.

-- keep updated_at fresh on the two tables that carry it
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- settle_stripe_payment: webhook dedup → upsert payment snapshot → mark order paid → grant.
-- Grant source is the order row (product_kind / stick_id / category / locale / pack_uses),
-- written by the checkout route (P4) before the Stripe session is created.
-- Subscription products record payment + order only; subscription lifecycle rows are a v2 concern.
create or replace function settle_stripe_payment(
  p_event_id text,
  p_type text,
  p_provider text,
  p_payment_ref text,
  p_charge_ref text,
  p_user_id uuid,
  p_order_id uuid,
  p_product_id text,
  p_amount bigint,
  p_currency text,
  p_paid boolean,
  p_amount_refunded bigint,
  p_dispute text,
  p_subscription_ref text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_paid_at timestamptz,
  p_fetched_at timestamptz
) returns text
language plpgsql security definer as $$
declare
  v_order record;
begin
  insert into webhook_events (provider, event_id, type)
  values (p_provider, p_event_id, p_type)
  on conflict (provider, event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if p_user_id is null then
    raise exception 'settle_stripe_payment: missing user_id (unattributed money is never settled)';
  end if;

  insert into payments (
    provider, payment_ref, charge_ref, user_id, order_id, subscription_ref,
    product_id, amount, currency, amount_refunded, dispute_status,
    period_start, period_end, fetched_at
  ) values (
    p_provider, p_payment_ref, p_charge_ref, p_user_id, p_order_id, p_subscription_ref,
    p_product_id, p_amount, p_currency, p_amount_refunded, p_dispute,
    p_period_start, p_period_end, p_fetched_at
  )
  on conflict (provider, payment_ref) do update set
    amount_refunded = greatest(payments.amount_refunded, excluded.amount_refunded),
    dispute_status = excluded.dispute_status,
    fetched_at = excluded.fetched_at,
    updated_at = now()
  where payments.fetched_at < excluded.fetched_at;

  if p_paid and p_order_id is not null then
    select * into v_order from orders where id = p_order_id for update;
    if found then
      update orders set status = 'paid', paid_at = coalesce(paid_at, p_paid_at)
      where id = p_order_id;
      if v_order.product_kind = 'unlock' then
        insert into unlocks (user_id, stick_id, category, locale, source, order_id)
        values (v_order.user_id, v_order.stick_id, v_order.category, v_order.locale, 'order', v_order.id)
        on conflict (user_id, stick_id, category, locale) do nothing;
      elsif v_order.product_kind = 'pack' then
        insert into entitlements (user_id, product_id, order_id, total_uses)
        values (v_order.user_id, v_order.product_id, v_order.id, coalesce(v_order.pack_uses, 0));
      end if;
    end if;
  end if;

  return 'ok';
end;
$$;

-- consume_pack_use: spend one pack use and create the unlock. Row is locked for the check,
-- so two concurrent consumes cannot overspend the pack.
create or replace function consume_pack_use(
  p_user_id uuid,
  p_pack_id uuid,
  p_stick_id smallint,
  p_category text,
  p_locale text
) returns uuid
language plpgsql security definer as $$
declare
  v_pack record;
  v_unlock_id uuid;
begin
  select * into v_pack from entitlements
  where id = p_pack_id and user_id = p_user_id for update;
  if not found then
    raise exception 'pack_not_found';
  end if;
  if v_pack.used_uses >= v_pack.total_uses then
    raise exception 'pack_exhausted';
  end if;
  update entitlements set used_uses = used_uses + 1 where id = p_pack_id;
  insert into unlocks (user_id, stick_id, category, locale, source, pack_id)
  values (p_user_id, p_stick_id, p_category, p_locale, 'pack', p_pack_id)
  on conflict (user_id, stick_id, category, locale) do nothing
  returning id into v_unlock_id;
  if v_unlock_id is null then
    -- The unlock already existed (same stick + category); the use is still spent,
    -- the user chose to spend it. Return the existing unlock.
    select id into v_unlock_id from unlocks
    where user_id = p_user_id and stick_id = p_stick_id and category = p_category and locale = p_locale;
  end if;
  return v_unlock_id;
end;
$$;

-- revoke_for_refund: refund / chargeback clawback.
-- Full refund: revoke the single unlocks this payment bought and freeze its packs
-- (all uses consumed). Partial refunds only update the amount; deciding which unlock
-- a partial refund claws back is P4 hardening (see BUILD_PLAN §4.3).
create or replace function revoke_for_refund(
  p_payment_ref text,
  p_refund_amount bigint
) returns text
language plpgsql security definer as $$
declare
  v_payment record;
begin
  select * into v_payment from payments where payment_ref = p_payment_ref for update;
  if not found then
    return 'no_payment';
  end if;
  update payments
  set amount_refunded = greatest(amount_refunded, p_refund_amount), updated_at = now()
  where payment_ref = p_payment_ref;

  if p_refund_amount >= v_payment.amount then
    update unlocks set revoked = true
    where order_id = v_payment.order_id and source = 'order' and revoked = false;
    update entitlements set used_uses = total_uses
    where order_id = v_payment.order_id;
  end if;
  return 'ok';
end;
$$;

-- get_deep_reading: return the paid deep-reading body only when the caller holds
-- a non-revoked unlock. Called by the Worker with the verified user id; the table
-- itself has no client SELECT policy, so there is no other way to read it.
create or replace function get_deep_reading(
  p_user_id uuid,
  p_stick_id smallint,
  p_category text,
  p_locale text
) returns text
language plpgsql security definer as $$
declare
  v_body text;
begin
  if not exists (
    select 1 from unlocks
    where user_id = p_user_id and stick_id = p_stick_id
      and category = p_category and locale = p_locale and revoked = false
  ) then
    raise exception 'not_unlocked';
  end if;
  select body into v_body from deep_readings
  where stick_id = p_stick_id and category = p_category and locale = p_locale;
  if v_body is null then
    raise exception 'reading_not_found';
  end if;
  return v_body;
end;
$$;
