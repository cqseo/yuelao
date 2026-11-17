-- Fix production Stripe checkout expiration events. The older RPC accepted only
-- cs_test_* and rejected signed, server-verified cs_live_* notifications.
-- Webhook handler fetches the actual Checkout from Stripe with a secret key
-- and checks payment_status='unpaid' + status='expired' or 'complete'
-- BEFORE calling this privileged RPC. Clients must never call this function.

create or replace function public.mark_checkout_unpaid(
  p_order_id uuid,
  p_checkout_ref text,
  p_state text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_order_id is null or p_checkout_ref is null or
    (p_checkout_ref not like 'cs_test_%' and p_checkout_ref not like 'cs_live_%') or
    p_state not in ('failed', 'expired') then
    raise exception 'invalid_checkout_failure';
  end if;

  select * into v_order
    from public.orders
    where id = p_order_id and checkout_ref = p_checkout_ref
    for update;
  if not found then return 'order_not_found'; end if;

  if v_order.status = 'paid' then return 'already_paid'; end if;
  if v_order.status in ('expired', 'failed') then return 'already_final'; end if;

  update public.orders
    set status = p_state
    where id = p_order_id and checkout_ref = p_checkout_ref
      and status = 'pending';
  return 'updated';
end;
$$;

-- SECURITY DEFINER + Data API is dangerous without role restrictions.
-- Keep only the trusted backend service role able to execute this function.
revoke all on function public.mark_checkout_unpaid(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.mark_checkout_unpaid(uuid,text,text)
  to service_role;
