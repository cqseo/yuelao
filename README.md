# 月老 · 線上求籤

線上月老求籤站：搖一支月老籤，問他、問脫單、問複合；擲筊確認，月老親批。免費求籤，深度解讀付費解鎖。

> 狀態：P0 骨架（2026-11-05）。空首頁 + Supabase 遷移 + Stripe 打法移植，本地可跑；未部署、未接支付、未上線。

## 技術棧

- **前端**：TanStack Start + React 19 + Tailwind v4，部署在 Cloudflare Workers（`sites/yuelao`）
- **數據層**：Supabase（Postgres + Auth 郵箱 OTP + RLS + RPC），不用 D1/Drizzle/Better Auth
- **支付**：Stripe Checkout + webhook（驗簽 → 去重 → fetchState → RPC 一次性結算）
- **語言**：繁體中文為主站（台灣，TWD），簡體中文香港版（HKD），同一域名、簡體走 `/hk/` 前綴（P1 落地）
- **骨架來源**：shipwords 的 TanStack Start + Workers 工程殼（見 `docs/architecture.md`），數據層按 Supabase 重寫

## 快速開始

```bash
pnpm install
# 填 Supabase / Stripe 配置（不要提交真值）
cp sites/yuelao/.dev.vars.example sites/yuelao/.dev.vars
cd sites/yuelao
pnpm dev        # 本地開發
pnpm check      # typecheck + build + 站點檢查
```

部署與上線見 `docs/local-development.md`。生產部署、遠程遷移、建雲資源、配支付/密鑰，都需要用戶明確確認後才執行。

## 倉庫結構

```
packages/core/     # 與站點無關的共享代碼：站點配置、SEO、Supabase 客戶端、Auth、Stripe、結算
sites/yuelao/      # 正式站（TanStack Start 應用 + Worker）
supabase/          # 遷移 SQL + 種子數據（100 支籤）
tools/             # 倉庫腳本（check-site、dev-port、stripe-listen、generate-sticks）
docs/              # 架構與開發手冊
```

## 待定事項（先用臨時值頂著，見 `sites/yuelao/site.config.ts`）

- 品牌名 / 域名：站名暫用「月老」，`url` 暫為佔位值
- 籤詩底本：種子裡的 100 支籤是原型新寫的佔位文，正式底本待定後替換 `supabase/seed.sql`
- 定價：`unlock` / `pack` 的 TWD/HKD 價格是佔位值，待拍板後再改
- Supabase project、Cloudflare 登錄、Stripe 帳號：用戶建好後再聯調
