-- YueLao companion AI: fail-closed, server-only daily request quota.
-- User content is never inserted into these tables. Reservations are consumed
-- before any model request and NOT refunded on errors, for cost safety.
create table if not exists public.ai_chat_global_daily (
  day_utc date primary key,
  used integer not null default 0 check (used between 0 and 50),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_user_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_utc date not null,
  used integer not null default 0 check (used between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_utc)
);

alter table public.ai_chat_global_daily enable row level security;
alter table public.ai_chat_user_daily enable row level security;
revoke all on public.ai_chat_global_daily from public, anon, authenticated;
revoke all on public.ai_chat_user_daily from public, anon, authenticated;

create or replace function public.reserve_ai_chat_turn(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_global integer;
  v_user integer;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    return false;
  end if;
  insert into public.ai_chat_global_daily(day_utc, used)
    values(v_today, 0) on conflict (day_utc) do nothing;
  select used into v_global
    from public.ai_chat_global_daily where day_utc = v_today for update;
  if v_global >= 50 then return false; end if;

  insert into public.ai_chat_user_daily(user_id, day_utc, used)
    values(p_user_id, v_today, 0)
    on conflict (user_id, day_utc) do nothing;
  select used into v_user
    from public.ai_chat_user_daily
    where user_id = p_user_id and day_utc = v_today for update;
  if v_user >= 3 then return false; end if;

  update public.ai_chat_global_daily set used = used + 1, updated_at = now()
    where day_utc = v_today;
  update public.ai_chat_user_daily set used = used + 1, updated_at = now()
    where user_id = p_user_id and day_utc = v_today;
  return true;
end;
$$;

create or replace function public.get_ai_chat_turns_remaining(p_user_id uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select greatest(
    0,
    least(
      3 - coalesce((select used from public.ai_chat_user_daily
        where user_id = p_user_id and day_utc = (now() at time zone 'utc')::date), 0),
      50 - coalesce((select used from public.ai_chat_global_daily
        where day_utc = (now() at time zone 'utc')::date), 0)
    )
  )::integer;
$$;

revoke all on function public.reserve_ai_chat_turn(uuid) from public, anon, authenticated;
revoke all on function public.get_ai_chat_turns_remaining(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_chat_turn(uuid) to service_role;
grant execute on function public.get_ai_chat_turns_remaining(uuid) to service_role;

-- The service layer must verify the signed user session before passing
-- p_user_id. An untrusted client must NEVER call privileged RPCs directly.
