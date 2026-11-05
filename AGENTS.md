# 月老站 agent guide

一個站一個 Worker：`sites/yuelao` 部署與收款都在自己名下；共享代碼放 `packages/core`。架構與取捨見 `docs/architecture.md`。

## 1. 目錄與邊界

| 目錄            | 放什麼                                                   | 規則                                   |
| --------------- | -------------------------------------------------------- | -------------------------------------- |
| `packages/core` | 站點配置、SEO、Supabase 客戶端、Auth、Stripe、結算、分析 | 不放頁面、樣式、站點專屬邏輯           |
| `sites/yuelao`  | 完整的 TanStack Start 應用                               | 只依賴 packages；**不 import 其他站**  |
| `supabase`      | 遷移 SQL、種子數據                                       | 遷移一經應用就不改原文，有錯寫新遷移修 |
| `tools/`        | 倉庫腳本，只用 Node 內建模組                             | 改動要有基本驗證                       |
- 站點差異通過 `site.config.ts` 傳入 packages；不在 packages 裡寫站名。
- 品牌、域名、文案、價格集中在 `sites/yuelao/site.config.ts`，改一處即可。
- 頁面、組件、樣式、文案屬於站點。改樣式前先寫 `sites/yuelao/DESIGN.md`。
- 每個站必須有 DMCA 頁與聯繫郵箱。

## 2. 金錢與身份：嚴格

- Webhook 只是觸發信號：驗簽 → 去重 → 從 provider API `fetchState` 取最新狀態 → 調 Supabase RPC 一次性結算。**絕不直接用 webhook 事件內容發放解鎖**。
- 所有金錢寫操作走 Postgres RPC（`SECURITY DEFINER`），一個函數 = 一個事務；冪等靠唯一約束 + `ON CONFLICT DO NOTHING`。
- `SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` 只放 `wrangler secret`，**絕不進倉庫、絕不進瀏覽器 bundle、絕不進聊天記錄**。
- `deep_readings` 表禁止任何 client 角色直接讀；只能由 Worker 經 RPC 驗證解鎖後返回正文。
- 改結算、退款/拒付扣回邏輯前，先寫清測試場景（重複 webhook、亂序事件、部分退款、全額退款、拒付），改完跑一遍。

## 3. 語言

- 繁體中文是主站語言，簡體是第二語言；`messages/` 只有 `zh-Hant` / `zh-Hans` 兩套。
- 簡體版走 `/hk/` 路徑前綴（P1 落地）；P0 只做中間件分流（cookie + 預設語言），前綴路由待設計。
- 不要用英文文案頂替中文；不要把簡體文案機器轉換後不經人審就上線。

## 4. 驗證

```bash
pnpm --filter @yuelao/core check        # 改 core：typecheck
pnpm --filter ./sites/yuelao check      # 改站點：typecheck + build + 站點檢查
pnpm lint                                # 改工具或配置後
```

- 只跑受影響的範圍；不要全倉庫 build。
- 不要提交生成文件（`routeTree.gen.ts`、`worker-configuration.d.ts`、`src/paraglide/`）。
- 遷移文件用時間戳編號；不要手改已應用的遷移。

## 5. 預覽與部署

- 預覽：站點目錄裡 `pnpm deploy:preview`（`wrangler versions upload`），不動生產。
- **生產部署只從 main、一次一個站、需要用戶明確確認。**
- 遠程遷移（`supabase db push`）、建雲資源、配支付/密鑰，都需要用戶明確確認。

## 6. 儀式體驗鐵律（從原型繼承，一個字別改）

- 搖簽前筒口不露任何單支主簽；主簽搖後才出現，籤號只在掉簽落定那一刻揭示。
- 掉簽與筊杯落定後一律凍結不動；重擲才從落點姿態起步。
- 筊杯面標記：金色嵌線，直線 = 平面、弧線 = 凸面；笑筊兩凸、陰筊兩平。
- 首屏零等待：首頁打開立即可用，不等任何模型/大圖。
