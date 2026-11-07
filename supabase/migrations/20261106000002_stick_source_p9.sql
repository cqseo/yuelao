-- P9: sticks.source 欄（籤詩典故出處）+ 欄位註解更新（吉凶改五檔）。
-- NOT applied to the live database by this change (remote migrations need
-- explicit user confirmation).
alter table sticks add column if not exists source text;
comment on column sticks.grade is '上上籤 / 上吉籤 / 中吉籤 / 中平籤 / 下下籤（P9 傳統月老靈籤 100 首：18 / 27 / 20 / 30 / 5）';
comment on column sticks.poem is '籤文（傳統月老靈籤 100 首，繁體原文；行數不定，1–4 行）';
comment on column sticks.source is '籤詩典故出處（如 詩經·周南·關雎）；無出處者為 null';
