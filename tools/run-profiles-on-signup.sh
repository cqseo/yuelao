#!/usr/bin/env bash
# Offline database test only; no hosted Supabase requests.
set -euo pipefail
cd "$(dirname "$0")/.."
name="yuelao-profiles-$$"
password="$(openssl rand -hex 16)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$name" -e "POSTGRES_PASSWORD=$password" postgres:17-alpine >/dev/null
for i in $(seq 1 60); do docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break; sleep .2; done
sleep 1
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create role anon;
create role authenticated;
create role service_role;
SQL
for f in 20261105000001_profiles_sticks.sql 20261112150001_profiles_on_signup.sql; do
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < "supabase/migrations/$f" >/dev/null
done
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < tools/test-profiles-on-signup.sql
echo 'ALL OFFLINE PROFILE-ON-SIGNUP TESTS PASSED'
