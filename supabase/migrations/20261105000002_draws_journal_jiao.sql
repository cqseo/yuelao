-- P0 skeleton migration 2/4: draws, seven-day journal, jiao sessions.
-- All three are per-user; RLS requires auth.uid() = user_id for every client operation.

create table draws (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  stick_id    smallint not null references sticks(id),
  category    text not null check (category in ('him', 'single', 'reunion')),
  jiao_result text not null check (jiao_result in ('sheng', 'xiao', 'yin')),
  note_to_him text,                              -- 求緣七日起點：寫下想對他說的一句話
  locale      text not null default 'zh-Hant',
  created_at  timestamptz not null default now()
);
create index draws_user_created_idx on draws (user_id, created_at desc);
alter table draws enable row level security;
create policy "draws_select_own" on draws for select using (auth.uid() = user_id);
create policy "draws_insert_own" on draws for insert with check (auth.uid() = user_id);

-- seven_day_journal: 求緣七日回訪（第 3 天 / 第 7 天各一條）。
create table seven_day_journal (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  draw_id     uuid not null references draws(id) on delete cascade,
  due_day     smallint not null check (due_day in (3, 7)),
  content     text,                              -- 用戶寫的當日記錄（關係有什麼變化）
  done_at     timestamptz,                       -- null = 待回訪
  created_at  timestamptz not null default now(),
  unique (draw_id, due_day)
);
create index seven_day_user_idx on seven_day_journal (user_id, done_at);
alter table seven_day_journal enable row level security;
create policy "seven_day_select_own" on seven_day_journal for select using (auth.uid() = user_id);
create policy "seven_day_insert_own" on seven_day_journal for insert with check (auth.uid() = user_id);
create policy "seven_day_update_own" on seven_day_journal for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- jiao_sessions: 擲筊對話的「月老會議記錄」。
create table jiao_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  draw_id     uuid references draws(id) on delete set null,
  question    text not null,                      -- 稟報的問題
  conditions  jsonb not null default '[]'::jsonb, -- 條件完整度檢查的結果
  rounds      jsonb not null default '[]'::jsonb, -- 逐題擲筊記錄 [{q, result}]
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index jiao_user_idx on jiao_sessions (user_id, created_at desc);
alter table jiao_sessions enable row level security;
create policy "jiao_select_own" on jiao_sessions for select using (auth.uid() = user_id);
create policy "jiao_insert_own" on jiao_sessions for insert with check (auth.uid() = user_id);
create policy "jiao_update_own" on jiao_sessions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
