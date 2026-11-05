-- P0 skeleton migration 1/4: identity + stick data.
-- Naming: Postgres + snake_case. All tables have RLS enabled.
-- Deviations from BUILD_PLAN §4 are called out in comments.

-- profiles: extension of Supabase Auth users (auth.users is managed by Supabase Auth).
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  locale      text not null default 'zh-Hant' check (locale in ('zh-Hant', 'zh-Hans')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- sticks: the 100 sticks, Traditional Chinese as canonical (formal 籤詩底本 still undecided).
create table sticks (
  id          smallint primary key,              -- 1–100
  no          text not null,                     -- '第一籤' … '第一百籤'
  grade       text not null,                     -- '上上籤' / '上籤' / '中平籤' / '中下籤' / '下籤' / '下下籤'
  level       smallint not null check (level between 0 and 5),
  knot        text not null,                     -- tongxin / huo / hua（結型）
  knot_name   text not null,                     -- '同心結' / '活結' / '滑結'
  poem        text not null,                     -- 籤文（七言四句，繁體）
  verdict_him     text not null,                -- 免費白話判詞：問他
  verdict_single  text not null,                -- 免費白話判詞：脫單
  verdict_reunion text not null,                -- 免費白話判詞：複合
  created_at  timestamptz not null default now()
);
alter table sticks enable row level security;
-- Free content is meant to be read (and cited by AI search).
create policy "sticks_select_all" on sticks for select using (true);

-- stick_locales: Simplified copy (Hong Kong site). Falls back to sticks when a row is missing.
create table stick_locales (
  stick_id  smallint not null references sticks(id) on delete cascade,
  locale    text not null check (locale in ('zh-Hans')),
  poem      text not null,
  verdict_him     text not null,
  verdict_single  text not null,
  verdict_reunion text not null,
  primary key (stick_id, locale)
);
alter table stick_locales enable row level security;
create policy "stick_locales_select_all" on stick_locales for select using (true);

-- deep_readings: paid "deep reading" body (per stick x category x locale).
-- RLS is enabled and NO policy is created: no client role can SELECT this table.
-- Only the Worker (service_role) reads it, via the get_deep_reading RPC after checking unlocks.
create table deep_readings (
  stick_id  smallint not null references sticks(id) on delete cascade,
  category  text not null check (category in ('him', 'single', 'reunion')),
  locale    text not null check (locale in ('zh-Hant', 'zh-Hans')),
  body      text not null,
  primary key (stick_id, category, locale)
);
alter table deep_readings enable row level security;
