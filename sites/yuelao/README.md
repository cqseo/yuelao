# 月老站（sites/yuelao）

線上月老求籤站的正式站代碼。產品三件套：搖簽儀式、擲筊對話、姻緣簿 + 求緣七日。

> 狀態：P0 骨架（2026-11-05）。空首頁 + SEO/GEO 路由骨架 + Stripe webhook 入口；儀式頁（P1）、姻緣簿（P2）、擲筊對話（P3）、Stripe 結賬（P4）按 `docs/architecture.md` 與 BUILD_PLAN 順序接。

## 關鍵事實

- **語言**：繁體中文主站（台灣，TWD），簡體香港版（HKD）；Paraglide `zh-Hant`（預設）+ `zh-Hans`。簡體 `/hk/` 前綴路由 P1 落地。
- **身份**：郵箱 OTP，無密碼（Supabase Auth）。訪客先存 localStorage，登錄後同步。
- **支付**：Stripe。產品只有 `unlock`（單次解鎖）與 `pack`（問事包）；同一產品分 TWD/HKD 兩檔價。訂閱是第二版。
- **數據**：全部在 Supabase（`supabase/migrations`）。`deep_readings` 禁止 client 直接讀。
- **籤數據**：100 支籤唯一來源是搖簽原型 artifact 最新構建，見 `tools/generate-sticks.mjs`；不要手寫。

## 常用命令（在本站目錄下）

```bash
pnpm dev            # 本地開發
pnpm check          # typecheck + build + 站點檢查
pnpm deploy:preview # 預覽部署，不動生產
pnpm run deploy     # 生產部署（只從 main、用戶確認後）
```

## 待定（臨時值，見 site.config.ts）

品牌名 / 域名 / 籤詩底本 / 定價。`url` 目前是佔位值，上線前必須換成真實域名。
