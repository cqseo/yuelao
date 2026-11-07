-- Lock down money-settlement RPCs: only the Worker (service_role) may execute them.
-- Fixes: SECURITY DEFINER functions were executable by PUBLIC/anon/authenticated via /rest/v1/rpc.
-- Also pins search_path on every public function (linter 0011).

revoke execute on function public.settle_stripe_payment(
  text, text, text, text, text, uuid, uuid, text, bigint, text, boolean, bigint, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.settle_stripe_payment(
  text, text, text, text, text, uuid, uuid, text, bigint, text, boolean, bigint, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz
) to service_role;

revoke execute on function public.consume_pack_use(uuid, uuid, smallint, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_pack_use(uuid, uuid, smallint, text, text)
  to service_role;

revoke execute on function public.revoke_for_refund(text, bigint)
  from public, anon, authenticated;
grant execute on function public.revoke_for_refund(text, bigint)
  to service_role;

revoke execute on function public.get_deep_reading(uuid, smallint, text, text)
  from public, anon, authenticated;
grant execute on function public.get_deep_reading(uuid, smallint, text, text)
  to service_role;

-- trigger helper: not an RPC; no client role needs EXECUTE on it
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- pin search_path so definer functions cannot be hijacked by objects in other schemas
alter function public.settle_stripe_payment(
  text, text, text, text, text, uuid, uuid, text, bigint, text, boolean, bigint, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz
) set search_path = public, pg_temp;
alter function public.consume_pack_use(uuid, uuid, smallint, text, text) set search_path = public, pg_temp;
alter function public.revoke_for_refund(text, bigint) set search_path = public, pg_temp;
alter function public.get_deep_reading(uuid, smallint, text, text) set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;

-- future functions created by postgres in public are not callable by client roles by default.
-- A function meant for clients must be granted explicitly in its own migration.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
