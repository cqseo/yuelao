# 架構（Supabase 版）

> 骨架來源：shipwords 的 TanStack Start + Workers 工程殼；數據層按 Supabase 重寫（D1/Drizzle/Better Auth/信用賬本全部丟棄）。

## 總體形態

```
用戶瀏覽器
  ├─ 儀式頁（搖簽/擲筊/判詞卡）：純客戶端，零後端調用（首屏零等待）
  ├─ 姻緣簿/求緣七日：Supabase Auth 登錄後，經 PostgREST + RLS 讀寫自己的行
  └─ 購買/解鎖：Worker API（TanStack Start server routes）
        ├─ Stripe Checkout（創建結賬）
        ├─ Stripe Webhook（驗簽 → 去重 → fetchState → 調 Supabase RPC 一次性結算）
        └─ 解鎖讀取：Worker 用 service_role 經 RPC 驗證解鎖後返回深度解讀正文

Cloudflare Worker（一個站一個 Worker）
  ├─ 靜態資源：public/（儀式圖片、字體，自託管）
  ├─ 環境變量：SUPABASE_URL、SUPABASE_ANON_KEY（vars）
  └─ Secrets：SUPABASE_SERVICE_ROLE_KEY、STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET

Supabase（一個 project，全部數據層）
  ├─ Auth：郵箱 OTP（6 位碼，無密碼）+ 可選 Google OAuth（V1 先不上）
  ├─ Postgres：supabase/migrations 的表 + RLS + RPC 函數（金錢結算）
  └─ Storage：預留桶（V1 不用）
```

## 為什麼不用 Drizzle

Drizzle + Postgres 在 Workers 裡沒有官方支持的 TCP 驅動；Supabase 官方給 Workers 的路線就是 HTTPS 的 JS 客戶端。運行時 DB 訪問統一走 `@supabase/supabase-js`（PostgREST + Auth + Storage，全是 HTTPS）。

## 計費模型：entitlements（解鎖/包次數），不要信用賬本

- `unlock`：單次解鎖（某支籤 × 某處境的深度解讀），一次付費永久查閱。
- `pack`：問事包（3 次 / 8 次），次數不過期，用一次扣一次。
- 訂閱 V1 不上架，但 `subscriptions` 表先建，第二版直接啟用。
- 每類產品兩個價格：TWD（繁體站）與 HKD（簡體站），結賬時按當前語言選價。產品 `id` 一旦上線不改。
- 退款/拒付扣回：按比例扣回已發放的解鎖/包次數（次數可扣成負數，負數時禁止新的解鎖消費；退款後解鎖行標記 `revoked`）。

## RLS 要點

1. 所有表開 RLS；沒寫 policy 的表默認拒絕一切（`deep_readings`、`webhook_events` 靠這條兜底）。
2. 用戶數據表一律 `auth.uid() = user_id`；`profiles` 行只允許本人讀寫。
3. 公開讀只給 `sticks` / `stick_locales`（免費內容要被讀、被 AI 引用）；`deep_readings` 絕不公開。
4. 金錢表不開放 client 寫；service_role 只在 Worker 服務端用，絕不進瀏覽器 bundle。
5. 訪客同步：先 OTP 登錄拿到 JWT，再按 `user_id = auth.uid()` 批量寫。

## 簡繁路由（P0 狀態）

推薦方案：同一域名，繁體是默認站，簡體用 `/hk/` 路徑前綴；語言切換只換前綴，內容、籤號、訂單全部同一套數據。

- P0 已做：Paraglide 配 `zh-Hant`（預設）+ `zh-Hans` 兩套文案；`server.ts` 的 locale 中間件生產環境也跑（修掉了模板「生產只出英文」的行為）。
- P1 待做：`/hk/` 前綴路由（TanStack Start 路由組或中間件重寫）+ canonical/sitemap 按語言分流。
