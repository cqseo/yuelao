-- Stripe test-mode Checkout: reflect a failed asynchronous payment or expired
-- session in the user's order history, without ever downgrading a paid order.
-- Only the verified backend may invoke this server-only RPC.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'expired'));

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
    p_checkout_ref not like 'cs_test_%' or
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

  -- A webhook alone cannot mark a checkout failed. The server must first
  -- retrieve the session by API secret and check payment_status and status.
  update public.orders
    set status = p_state
    where id = p_order_id and checkout_ref = p_checkout_ref
      and status = 'pending';
  return 'updated';
end;
$$;

revoke all on function public.mark_checkout_unpaid(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.mark_checkout_unpaid(uuid,text,text)
  to service_role;
