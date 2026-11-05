# 本地開發

## 準備

```bash
pnpm install
cp sites/yuelao/.dev.vars.example sites/yuelao/.dev.vars
# 填入你自己的值（不要提交真值）：
#   SUPABASE_URL / SUPABASE_ANON_KEY —— Supabase Dashboard → Settings → API
#   SUPABASE_SERVICE_ROLE_KEY —— 同上（只放 .dev.vars，不進倉庫）
#   STRIPE_SECRET_KEY —— test key（sk_test_…）
#   STRIPE_WEBHOOK_SECRET —— 本地聯調時由 tools/stripe-listen.mjs 寫回
#   APP_URL —— 本地地址，如 http://localhost:5173（dev-port 會自動定端口）
```

沒有 Supabase project / Stripe key 也能跑：首頁、儀式頁（P1 後）、SEO 路由都不依賴它們；登錄、購買、webhook 會明確報錯，不會靜默失敗。

## 常用命令

```bash
cd sites/yuelao
pnpm dev            # 本地開發（dev-port 定端口）
pnpm check          # typecheck + build + 站點檢查
pnpm deploy:preview # vite build && wrangler versions upload（預覽，不動生產）
pnpm run deploy     # 生產部署（只從 main、用戶確認後）
```

## Supabase 遷移

```bash
# 用戶建好 project 後（二選一）：
supabase link --project-ref <ref>
supabase db push              # 應用 supabase/migrations/*.sql
# 或 Dashboard → SQL Editor 粘貼遷移 + seed.sql 執行
```

遷移文件用時間戳編號；已應用的遷移不改原文，有錯寫新遷移修。

## 籤數據

100 支籤的唯一來源是搖簽原型 artifact 的最新構建：

```bash
# 1. 重新導出 artifact（artifact.export，slug yao-qian-yuan-xing）
# 2. 重新生成種子與前端數據：
node tools/generate-sticks.mjs ~/workspace/your_files/yao-qian-yuan-xing/yao-qian-yuan-xing.html
# 生成 supabase/seed.sql + sites/yuelao/src/ritual/sticks.ts（兩份同一數據源）
```

不要手寫 100 支籤，也不要用舊導出（只有 8 支）。

## Stripe 本地聯調（P4）

```bash
node tools/stripe-listen.mjs   # 在 sites/yuelao 目錄下跑，轉發到本地 webhook
```
