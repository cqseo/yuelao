-- YueLao V2: a private, single-use AI report for an already granted unlock.
-- Deploy to staging with the Worker; do not enable paid checkout without delivery tests.
-- The optional user question is intentionally never stored, even during generation.

create table if not exists public.paid_ai_readings (
  unlock_id uuid primary key references public.unlocks(id) on delete cascade,
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
  constraint paid_ai_readings_ready_body check (
    (status = 'ready' and body is not null and char_length(body) between 100 and 8000)
    or (status <> 'ready' and body is null)
  )
);
create index if not exists paid_ai_readings_user_idx
  on public.paid_ai_readings (user_id, created_at desc);
alter table public.paid_ai_readings enable row level security;
-- No anon/authenticated policies: only privileged server-side RPCs read/write reports.

create or replace function public.claim_paid_ai_reading(
  p_user_id uuid, p_stick_id smallint, p_category text, p_locale text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_unlock uuid;
  v_row public.paid_ai_readings%rowtype;
  v_lease uuid;
begin
  if p_user_id is null or p_stick_id not between 1 and 100
    or p_category not in ('him','single','reunion')
    or p_locale not in ('zh-Hant','zh-Hans') then
    return jsonb_build_object('state','invalid');
  end if;
  -- Also serializes with refund revocation of this unlock.
  select id into v_unlock from public.unlocks
  where user_id = p_user_id and stick_id = p_stick_id
    and category = p_category and locale = p_locale and revoked = false
  for update;
  if v_unlock is null then
    return jsonb_build_object('state','not_unlocked');
  end if;

  insert into public.paid_ai_readings(unlock_id, user_id)
  values(v_unlock, p_user_id)
  on conflict (unlock_id) do nothing;
  select * into v_row from public.paid_ai_readings
    where unlock_id = v_unlock and user_id = p_user_id for update;
  if v_row.status = 'ready' then
    return jsonb_build_object('state','ready');
  end if;
  if v_row.status = 'generating' and v_row.lease_until > now() then
    return jsonb_build_object('state','processing');
  end if;

  v_lease := gen_random_uuid();
  update public.paid_ai_readings
    set status='generating', body=null, lease_id=v_lease,
        lease_until=now() + interval '110 seconds', updated_at=now()
    where unlock_id=v_unlock;
  return jsonb_build_object('state','claimed','claimId',v_lease,'unlockId',v_unlock);
end;
$$;

create or replace function public.finish_paid_ai_reading(
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
  select id into v_unlock from public.unlocks
  where id=p_unlock_id and user_id=p_user_id and revoked=false for update;
  if v_unlock is null then return false; end if;

  update public.paid_ai_readings
    set body=p_body, status='ready', model=p_model,
        lease_id=null, lease_until=null, generated_at=now(), updated_at=now()
    where unlock_id=p_unlock_id and user_id=p_user_id
      and status='generating' and lease_id=p_claim_id and lease_until>now();
  return found;
end;
$$;

create or replace function public.fail_paid_ai_reading(
  p_user_id uuid, p_unlock_id uuid, p_claim_id uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.paid_ai_readings
    set status='failed', body=null, lease_id=null, lease_until=null, updated_at=now()
  where unlock_id=p_unlock_id and user_id=p_user_id
    and status='generating' and lease_id=p_claim_id;
  return found;
end;
$$;

create or replace function public.get_paid_ai_reading(
  p_user_id uuid, p_stick_id smallint, p_category text, p_locale text
) returns text language sql stable security definer set search_path = ''
as $$
  select r.body from public.unlocks u
    join public.paid_ai_readings r on r.unlock_id=u.id and r.user_id=u.user_id
  where u.user_id=p_user_id and u.stick_id=p_stick_id
    and u.category=p_category and u.locale=p_locale
    and u.revoked=false and r.status='ready'
  limit 1;
$$;

-- A spend must never consume a credit when this unlock already exists.
-- At the database layer a user cannot consume one pack use twice for the
-- same stick/category/locale, even if requests race.
create or replace function public.consume_pack_use(
  p_user_id uuid, p_pack_id uuid, p_stick_id smallint,
  p_category text, p_locale text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_pack public.entitlements%rowtype;
  v_existing public.unlocks%rowtype;
  v_unlock_id uuid;
begin
  if p_stick_id not between 1 and 100
     or p_category not in ('him','single','reunion')
     or p_locale not in ('zh-Hant','zh-Hans') then
    raise exception 'invalid_selection';
  end if;

  select * into v_pack from public.entitlements
    where id=p_pack_id and user_id=p_user_id for update;
  if not found or v_pack.used_uses >= v_pack.total_uses
    or (v_pack.expires_at is not null and v_pack.expires_at <= now()) then
    raise exception 'pack_unavailable';
  end if;

  select * into v_existing from public.unlocks
    where user_id=p_user_id and stick_id=p_stick_id
      and category=p_category and locale=p_locale for update;
  if found then
    if v_existing.revoked then raise exception 'previous_unlock_revoked'; end if;
    return v_existing.id; -- no use spent
  end if;

  update public.entitlements set used_uses=used_uses+1 where id=p_pack_id;
  insert into public.unlocks (user_id, stick_id, category, locale, source, pack_id)
  values (p_user_id, p_stick_id, p_category, p_locale, 'pack', p_pack_id)
  on conflict (user_id, stick_id, category, locale) do nothing
  returning id into v_unlock_id;

  if v_unlock_id is null then
    -- Another pack redeemed the same item concurrently; restore this use.
    update public.entitlements set used_uses=used_uses-1 where id=p_pack_id;
    select * into v_existing from public.unlocks
      where user_id=p_user_id and stick_id=p_stick_id
        and category=p_category and locale=p_locale for update;
    if not found or v_existing.revoked then raise exception 'unlock_unavailable'; end if;
    return v_existing.id;
  end if;
  return v_unlock_id;
end;
$$;

-- All privileged functions are server-only. Revoke the default PUBLIC EXECUTE.
revoke all on function public.claim_paid_ai_reading(uuid,smallint,text,text) from public,anon,authenticated;
revoke all on function public.finish_paid_ai_reading(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.fail_paid_ai_reading(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_paid_ai_reading(uuid,smallint,text,text) from public,anon,authenticated;
revoke all on function public.consume_pack_use(uuid,uuid,smallint,text,text) from public,anon,authenticated;
grant execute on function public.claim_paid_ai_reading(uuid,smallint,text,text) to service_role;
grant execute on function public.finish_paid_ai_reading(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.fail_paid_ai_reading(uuid,uuid,uuid) to service_role;
grant execute on function public.get_paid_ai_reading(uuid,smallint,text,text) to service_role;
grant execute on function public.consume_pack_use(uuid,uuid,smallint,text,text) to service_role;

-- Checkout only proceeds when the separate AI delivery migration is present.
create or replace function public.paid_ai_delivery_ready()
returns boolean language sql stable security definer set search_path = ''
as $$
  select to_regclass('public.paid_ai_readings') is not null;
$$;
revoke all on function public.paid_ai_delivery_ready() from public, anon, authenticated;
grant execute on function public.paid_ai_delivery_ready() to service_role;

-- Refunds and chargebacks must invalidate unlocks redeemed from a refunded pack,
-- not just freeze its unused credits. Otherwise a customer could refund a pack
-- after redeeming it and keep every paid report.
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
    return 'revoked';
  end if;
  return 'unchanged';
end;
$$;
revoke all on function public.revoke_for_refund(text,bigint,text)
  from public, anon, authenticated;
grant execute on function public.revoke_for_refund(text,bigint,text) to service_role;

