-- 許願池：走到池邊寫一句願望、繫一條紅線，樹上掛出所有人的願望牌。
--
-- 願望是使用者寫的、所有人可見，所以：
--   * 三張表都開 RLS 且不給任何 client 角色權限；讀寫一律經 Worker 呼叫下面的 RPC（只給 service_role）。
--   * 公開列表只回願望文字、類別、同願數、日期；不回 user_id，也不回任何可以認出是誰的欄位。
--   * 寫入前 Worker 先做文字過濾與自動審核，決定進來的 status；沒有通過自動審核的停在 pending，
--     只有作者自己看得到，等人工在後台用 review_wish 放行。
--   * 一人一天一個願望；全站一天上限 300 個；同一則願望被三個不同的人檢舉就自動收起來待審。
--
-- 這個遷移只做加法，不碰既有的表和函式。

create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 40 and body !~ '[\r\n]'),
  tag         text not null check (tag in ('seek', 'keep', 'reunion', 'self', 'others')),
  locale      text not null check (locale in ('zh-Hant', 'zh-Hans')),
  -- pending：待審（只有作者看得到）；shown：公開掛在樹上；hidden：被檢舉或審核收起；removed：作者撤下或人工刪除
  status      text not null default 'pending' check (status in ('pending', 'shown', 'hidden', 'removed')),
  -- 由誰放行／收起：auto（Worker 自動審核）、manual（人工）、reports（檢舉滿額）、author（作者撤下）
  decided_by  text check (decided_by in ('auto', 'manual', 'reports', 'author')),
  blessings   integer not null default 0 check (blessings >= 0),
  reports     integer not null default 0 check (reports >= 0),
  day_utc     date not null default ((now() at time zone 'utc')::date),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, day_utc)                              -- 一人一天一個
);
create index if not exists wishes_shown_recent_idx on public.wishes (created_at desc) where status = 'shown';
create index if not exists wishes_day_idx on public.wishes (day_utc);
create index if not exists wishes_pending_idx on public.wishes (created_at) where status in ('pending', 'hidden');

-- 「同願」：替別人的願望也繫一條紅線。一人對一則只算一次。
create table if not exists public.wish_blessings (
  wish_id     uuid not null references public.wishes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wish_id, user_id)
);
create index if not exists wish_blessings_user_idx on public.wish_blessings (user_id);

-- 檢舉：一人對一則只算一次，理由只收固定幾種，不收自由文字。
create table if not exists public.wish_reports (
  wish_id     uuid not null references public.wishes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('personal_info', 'harassment', 'sexual', 'spam', 'other')),
  created_at  timestamptz not null default now(),
  primary key (wish_id, user_id)
);

alter table public.wishes enable row level security;
alter table public.wish_blessings enable row level security;
alter table public.wish_reports enable row level security;
revoke all on public.wishes from public, anon, authenticated;
revoke all on public.wish_blessings from public, anon, authenticated;
revoke all on public.wish_reports from public, anon, authenticated;

-- ---------- 許願 ----------
-- p_status 由 Worker 的審核結果決定，只能是 shown 或 pending。
-- 回傳：'ok:<uuid>'、'daily_limit'、'site_cap'、'no_profile'、'invalid'
create or replace function public.make_wish(
  p_user_id uuid, p_body text, p_tag text, p_locale text, p_status text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_body text := btrim(coalesce(p_body, ''));
  v_count integer;
  v_id uuid;
begin
  if p_user_id is null or p_status not in ('shown', 'pending')
     or char_length(v_body) not between 1 and 40 or v_body ~ '[\r\n]'
     or p_tag not in ('seek', 'keep', 'reunion', 'self', 'others')
     or p_locale not in ('zh-Hant', 'zh-Hans') then
    return 'invalid';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then return 'no_profile'; end if;

  -- 全站上限：同一天的許願互相排隊，計數不會被併發繞過。
  perform pg_advisory_xact_lock(hashtext('wishes:' || v_today::text));
  select count(*) into v_count from public.wishes where day_utc = v_today;
  if v_count >= 300 then return 'site_cap'; end if;

  insert into public.wishes (user_id, body, tag, locale, status, decided_by, day_utc)
  values (p_user_id, v_body, p_tag, p_locale, p_status,
          case when p_status = 'shown' then 'auto' end, v_today)
  on conflict (user_id, day_utc) do nothing
  returning id into v_id;
  if v_id is null then return 'daily_limit'; end if;
  return 'ok:' || v_id::text;
end;
$$;

-- ---------- 樹上的願望牌 ----------
-- 公開的最新 p_limit 則，加上這位使用者自己最近七則沒撤下的願望（含待審）。不回 user_id。
create or replace function public.list_wishes(p_user_id uuid, p_limit integer)
returns table (
  id uuid, body text, tag text, blessings integer, created_at timestamptz,
  status text, mine boolean, blessed boolean
)
language sql stable security definer set search_path = ''
as $$
  with picked as (
    (select w.* from public.wishes w
      where w.status = 'shown'
      order by w.created_at desc
      limit greatest(1, least(coalesce(p_limit, 120), 200)))
    union
    (select w.* from public.wishes w
      where p_user_id is not null and w.user_id = p_user_id and w.status in ('shown', 'pending', 'hidden')
      order by w.created_at desc
      limit 7)
  )
  select p.id, p.body, p.tag, p.blessings, p.created_at,
         -- 對外只分「公開」與「待審」；被檢舉收起的在作者那邊也顯示成待審
         case when p.status = 'shown' then 'shown' else 'pending' end,
         p_user_id is not null and p.user_id = p_user_id,
         p_user_id is not null and exists (
           select 1 from public.wish_blessings b where b.wish_id = p.id and b.user_id = p_user_id)
  from picked p
  order by p.created_at desc;
$$;

-- ---------- 同願 ----------
-- 回傳：'blessed'、'already'、'own'、'not_found'
create or replace function public.bless_wish(p_user_id uuid, p_wish_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_wish public.wishes%rowtype;
begin
  select * into v_wish from public.wishes where id = p_wish_id and status = 'shown' for update;
  if not found or p_user_id is null then return 'not_found'; end if;
  if v_wish.user_id = p_user_id then return 'own'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then return 'not_found'; end if;
  insert into public.wish_blessings (wish_id, user_id) values (p_wish_id, p_user_id)
    on conflict do nothing;
  if not found then return 'already'; end if;
  update public.wishes set blessings = blessings + 1, updated_at = now() where id = p_wish_id;
  return 'blessed';
end;
$$;

-- ---------- 檢舉 ----------
-- 三個不同的人檢舉就收起來（hidden），等人工 review_wish 決定。
-- 回傳：'reported'、'hidden'、'already'、'own'、'not_found'、'invalid'
create or replace function public.report_wish(p_user_id uuid, p_wish_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_wish public.wishes%rowtype;
begin
  if p_reason not in ('personal_info', 'harassment', 'sexual', 'spam', 'other') then return 'invalid'; end if;
  select * into v_wish from public.wishes where id = p_wish_id and status = 'shown' for update;
  if not found or p_user_id is null then return 'not_found'; end if;
  if v_wish.user_id = p_user_id then return 'own'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then return 'not_found'; end if;
  insert into public.wish_reports (wish_id, user_id, reason) values (p_wish_id, p_user_id, p_reason)
    on conflict do nothing;
  if not found then return 'already'; end if;
  update public.wishes set reports = reports + 1, updated_at = now() where id = p_wish_id;
  if v_wish.reports + 1 >= 3 then
    update public.wishes set status = 'hidden', decided_by = 'reports', updated_at = now() where id = p_wish_id;
    return 'hidden';
  end if;
  return 'reported';
end;
$$;

-- ---------- 作者撤下 ----------
-- 回傳：'removed'、'not_found'。當天的名額不退（避免撤了重寫刷版面）。
create or replace function public.withdraw_wish(p_user_id uuid, p_wish_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  update public.wishes set status = 'removed', decided_by = 'author', updated_at = now()
    where id = p_wish_id and user_id = p_user_id and status <> 'removed';
  if not found then return 'not_found'; end if;
  return 'removed';
end;
$$;

-- ---------- 人工審核（後台 SQL 編輯器裡用） ----------
-- select public.review_wish('<id>', 'shown');   放行
-- select public.review_wish('<id>', 'removed'); 刪除
create or replace function public.review_wish(p_wish_id uuid, p_status text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('shown', 'hidden', 'removed') then return 'invalid'; end if;
  update public.wishes set status = p_status, decided_by = 'manual', updated_at = now()
    where id = p_wish_id;
  if not found then return 'not_found'; end if;
  return p_status;
end;
$$;

revoke all on function public.make_wish(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.list_wishes(uuid, integer) from public, anon, authenticated;
revoke all on function public.bless_wish(uuid, uuid) from public, anon, authenticated;
revoke all on function public.report_wish(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.withdraw_wish(uuid, uuid) from public, anon, authenticated;
revoke all on function public.review_wish(uuid, text) from public, anon, authenticated;
grant execute on function public.make_wish(uuid, text, text, text, text) to service_role;
grant execute on function public.list_wishes(uuid, integer) to service_role;
grant execute on function public.bless_wish(uuid, uuid) to service_role;
grant execute on function public.report_wish(uuid, uuid, text) to service_role;
grant execute on function public.withdraw_wish(uuid, uuid) to service_role;
grant execute on function public.review_wish(uuid, text) to service_role;

-- 服務層必須先驗證登入狀態才把 p_user_id 傳進來；不可信的 client 絕不能直接呼叫這些 RPC。
