#!/usr/bin/env bash
# Reproducible, zero-cloud-cost YueLao integration test. Use Docker locally only.
# It never connects to hosted Supabase, a real Stripe account or OpenAI.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for isolated local QA" >&2
  exit 1
fi
if [[ ! -x node_modules/.bin/tsx ]]; then
  echo "Install workspace dependencies with pnpm install first" >&2
  exit 1
fi

name="yuelao-local-e2e-$$"
password="$(openssl rand -hex 16)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$name" \
  -p 127.0.0.1::5432 -e "POSTGRES_PASSWORD=$password" postgres:17-alpine >/dev/null
ready=false
for i in $(seq 1 50); do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep .2
done
if [[ "$ready" != true ]]; then
  echo "Disposable PostgreSQL container never became ready" >&2
  exit 1
fi
port="$(docker port "$name" 5432/tcp | head -1 | awk -F: '{print $NF}')"
if [[ ! "$port" =~ ^[0-9]+$ ]]; then
  echo "Refusing database connection without a local ephemeral port" >&2
  exit 1
fi
sleep 2  # post-init temporary Postgres can briefly report ready, then restart
echo "Local QA PostgreSQL ready on localhost (ephemeral port)"

# Only a minimal Supabase Auth shim is used. No hosted user data is copied.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid primary key);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
SQL

apply_migration() {
  local file="$1"
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres \
    < "supabase/migrations/$file" >/dev/null
  echo "  applied $file"
}
# Mimic Supabase db reset EXACTLY: all migrations in chronological order,
# followed by seed.sql. No special manual reordering.
for migration in supabase/migrations/*.sql; do
  apply_migration "$(basename "$migration")"
done
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < supabase/seed.sql >/dev/null
echo "  seeded 100 canonical fortune sticks after all migrations"

export LOCAL_QA_DATABASE_URL="postgresql://postgres:$password@127.0.0.1:$port/postgres"
node_modules/.bin/tsx tools/test-local-payment-e2e.mjs
echo "Local QA completed; disposable database will now be destroyed."
