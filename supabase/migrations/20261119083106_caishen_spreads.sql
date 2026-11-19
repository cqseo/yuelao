-- 財神殿．求財籤（站長 2026-11-19）：付費解籤沿用牌陣解讀那一套（spread_unlocks／spread_ai_readings），
-- 只把識別字串前綴再放寬一個 cai（cai:<籤號三位>_<c|w>|<雜湊>）。問題不進訂單、不存。
-- 和 20261119063400 一樣只改三處格式檢查，其他一字未改。

alter table public.orders drop constraint if exists orders_spread_shape;
alter table public.orders add constraint orders_spread_shape check (
  (product_kind = 'spread' and spread is not null
    and spread ~ '^(tarot|lnm|match|love|bazi|cai):[A-Za-z0-9_~,]{5,80}\|[0-9a-f]{16}$')
  or (product_kind <> 'spread' and spread is null)
);

alter table public.spread_unlocks drop constraint if exists spread_unlocks_spread_check;
alter table public.spread_unlocks add constraint spread_unlocks_spread_check
  check (spread ~ '^(tarot|lnm|match|love|bazi|cai):[A-Za-z0-9_~,]{5,80}\|[0-9a-f]{16}$');

-- 與 20261119063400 的版本逐行相同，只有格式檢查多收 cai。
create or replace function public.claim_spread_reading(
  p_user_id uuid, p_spread text, p_locale text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_unlock uuid;
  v_row public.spread_ai_readings%rowtype;
  v_lease uuid;
begin
  if p_user_id is null
    or p_spread is null or p_spread !~ '^(tarot|lnm|match|love|bazi|cai):[A-Za-z0-9_~,]{5,80}\|[0-9a-f]{16}$'
    or p_locale not in ('zh-Hant','zh-Hans') then
    return jsonb_build_object('state','invalid');
  end if;
  -- 鎖住這筆解鎖，與退款收回互斥。
  select id into v_unlock from public.spread_unlocks
  where user_id = p_user_id and spread = p_spread and locale = p_locale and revoked = false
  for update;
  if v_unlock is null then
    return jsonb_build_object('state','not_unlocked');
  end if;

  insert into public.spread_ai_readings(unlock_id, user_id)
  values(v_unlock, p_user_id)
  on conflict (unlock_id) do nothing;
  select * into v_row from public.spread_ai_readings
    where unlock_id = v_unlock and user_id = p_user_id for update;
  if v_row.status = 'ready' then
    return jsonb_build_object('state','ready');
  end if;
  if v_row.status = 'generating' and v_row.lease_until > now() then
    return jsonb_build_object('state','processing');
  end if;

  v_lease := gen_random_uuid();
  update public.spread_ai_readings
    set status='generating', body=null, lease_id=v_lease,
        lease_until=now() + interval '110 seconds', updated_at=now()
    where unlock_id=v_unlock;
  return jsonb_build_object('state','claimed','claimId',v_lease,'unlockId',v_unlock);
end;
$$;

revoke all on function public.claim_spread_reading(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_spread_reading(uuid,text,text) to service_role;
