-- 資料庫效能（Supabase advisor）：只改寫法，不改誰能看什麼。
--
-- 1. RLS：auth.uid() 改成 (select auth.uid())，讓 Postgres 每次查詢只算一次，而不是每一列算一次。
--    用 ALTER POLICY 只換條件式；指令（select/insert/update）與適用角色維持原樣。
-- 2. 替沒有索引的外鍵補索引（刪除使用者、查訂單與解鎖時用得到）。
-- 全部可重複執行。

alter policy draws_insert_own on public.draws with check ((select auth.uid()) = user_id);
alter policy draws_select_own on public.draws using ((select auth.uid()) = user_id);
alter policy entitlements_select_own on public.entitlements using ((select auth.uid()) = user_id);
alter policy jiao_insert_own on public.jiao_sessions with check ((select auth.uid()) = user_id);
alter policy jiao_select_own on public.jiao_sessions using ((select auth.uid()) = user_id);
alter policy jiao_update_own on public.jiao_sessions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy orders_select_own on public.orders using ((select auth.uid()) = user_id);
alter policy owned_items_select_own on public.owned_items using ((select auth.uid()) = user_id);
alter policy payments_select_own on public.payments using ((select auth.uid()) = user_id);
alter policy profiles_insert_own on public.profiles with check ((select auth.uid()) = id);
alter policy profiles_select_own on public.profiles using ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy seven_day_insert_own on public.seven_day_journal with check ((select auth.uid()) = user_id);
alter policy seven_day_select_own on public.seven_day_journal using ((select auth.uid()) = user_id);
alter policy seven_day_update_own on public.seven_day_journal using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy subscriptions_select_own on public.subscriptions using ((select auth.uid()) = user_id);
alter policy unlocks_select_own on public.unlocks using ((select auth.uid()) = user_id);

create index if not exists draws_stick_id_idx on public.draws (stick_id);
create index if not exists jiao_sessions_draw_id_idx on public.jiao_sessions (draw_id);
create index if not exists orders_stick_id_idx on public.orders (stick_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists unlocks_order_id_idx on public.unlocks (order_id);
create index if not exists unlocks_pack_id_idx on public.unlocks (pack_id);
create index if not exists unlocks_stick_id_idx on public.unlocks (stick_id);
create index if not exists wish_reports_user_id_idx on public.wish_reports (user_id);
