#!/usr/bin/env bash
# Offline database test only; no hosted Supabase or AI requests.
set -euo pipefail
cd "$(dirname "$0")/.."
name="yuelao-ai-quota-$$"
password="$(openssl rand -hex 16)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$name" -e "POSTGRES_PASSWORD=$password" postgres:17-alpine >/dev/null
for i in $(seq 1 60); do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep .2
done
sleep 1
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres >/dev/null <<'SQL'
create schema auth;
create table auth.users(id uuid primary key);
create role anon;
create role authenticated;
create role service_role;
SQL
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < supabase/migrations/20261109064107_ai_chat_quotas.sql >/dev/null
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < tools/test-ai-chat-quota.sql
echo 'ALL OFFLINE AI CHAT QUOTA TESTS PASSED'
