#!/usr/bin/env bash
# This test protects any pre-existing canonical stick row from a retrofit
# migration. No Supabase, Stripe or OpenAI cloud API is contacted.
set -euo pipefail
cd "$(dirname "$0")/.."
name="yuelao-db-retrofit-$$"
password="$(openssl rand -hex 16)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --rm -d --name "$name" -e "POSTGRES_PASSWORD=$password" postgres:17-alpine >/dev/null
for i in $(seq 1 50); do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep .2
done
sleep 2
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create role anon;
create role authenticated;
create role service_role;
SQL

apply() {
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres \
    < "supabase/migrations/$1" >/dev/null
}

for migration in \
  20261105000001_profiles_sticks.sql \
  20261105000002_draws_journal_jiao.sql \
  20261105000003_billing.sql \
  20261105000004_rpc.sql
do
  apply "$migration"
done

# Simulates an existing production row already displayed to customers.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
insert into public.sticks
(id,no,grade,level,knot,knot_name,poem,verdict_him,verdict_single,verdict_reunion)
values
(1,'第一籤','上吉籤',4,'tongxin','同心結',
 'DO_NOT_OVERWRITE_EXISTING_POEM','keep him','keep single','keep reunion');
SQL

# This migration must INSERT absent sticks but leave existing rows untouched.
apply 20261105235959_bootstrap_canonical_sticks.sql
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
do $$
declare v_poem text;
begin
  select poem into v_poem from public.sticks where id=1;
  if v_poem <> 'DO_NOT_OVERWRITE_EXISTING_POEM' then
    raise exception 'Existing customer-facing stick was overwritten: %', v_poem;
  end if;
  if (select count(*) from public.sticks) <> 100 then
    raise exception 'Retrofit did not supply all 100 sticks';
  end if;
  raise notice 'PASS: retrofit preserves existing live rows and inserts missing canonical rows';
end;
$$;
SQL

for migration in supabase/migrations/*.sql; do
  case "$(basename "$migration")" in
    20261105000001_*|20261105000002_*|20261105000003_*|20261105000004_*|20261105235959_*) continue ;;
  esac
  apply "$(basename "$migration")"
done

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
do $$
begin
  if (select count(*) from public.sticks) <> 100 or
     (select count(*) from public.stick_locales where locale='zh-Hans') <> 100 then
    raise exception 'Migration dependencies broken after applying retrofit';
  end if;
  if (select poem from public.sticks where id=1) <> 'DO_NOT_OVERWRITE_EXISTING_POEM' then
    raise exception 'Later migration overwrote existing live content';
  end if;
  if to_regclass('public.paid_ai_readings') is null or
     to_regclass('public.ai_chat_user_daily') is null then
    raise exception 'Billing/AI schemas missing';
  end if;
  raise notice 'PASS: production-like existing rows preserved; locale and AI schema installed';
end;
$$;
SQL
echo 'ALL EXISTING-DATABASE RETROFIT TESTS PASSED'
