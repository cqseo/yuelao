# 切換 Stripe 正式收款（2026-11-14）

程式預設是**測試模式**：只收測試金鑰、結帳只開給 `BILLING_TEST_ALLOWED_EMAILS`。
`BILLING_MODE="live"` 才進正式模式：只收正式金鑰（`sk_live_`／`rk_live_`）、所有登入的人都能結帳、webhook 只收 `livemode=true` 的事件。兩種模式絕不混用：金鑰和模式不符時，結帳與 webhook 一律關閉。邏輯在 `packages/core/src/billing/mode.ts`，測試 `pnpm test:billing:mode`、`pnpm test:stripe:webhook`。

## 站長要做（金鑰不經過 Claude、不貼進對話）

1. Stripe 後台完成正式帳戶啟用：商家資料、身分驗證、收款銀行帳戶。
2. 正式模式建立金鑰。建議用**受限金鑰**（`rk_live_…`），只開：Checkout Sessions（寫）、PaymentIntents（讀）、Charges（讀）、Refunds（讀）、Customers（寫）、Invoices／Subscriptions（讀）。
3. 正式模式建立 webhook 端點：`https://yuelao.cqseo.workers.dev/api/webhooks/stripe`。事件：
   - `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`checkout.session.expired`
   - `charge.refunded`、`charge.dispute.created`、`charge.dispute.closed`
   - 取得簽名密鑰 `whsec_…`。
4. Cloudflare → Workers → yuelao → Settings → Variables and Secrets，把下面兩個**改成正式的值**（類型選 Secret）：
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
5. 同一頁把 `BILLING_MODE` 設成 `live`（Text）。或請 Claude 改 `sites/yuelao/wrangler.jsonc` 的 vars 後合併。
6. 自己用真卡買一次最便宜的（US$2.99），確認解鎖、生成正常，再到 Stripe 後台退款，確認解鎖被收回。

## 切換前請確認

- 付費解讀靠 AI 生成：`AI_ENABLE_TEST_GENERATION`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 都在、中轉站額度夠。否則會付了錢拿不到解讀（程式會先擋下結帳，但請確認額度）。
- 退款政策頁 `/refunds` 的內容符合實際做法。
- 要退回測試：把 `BILLING_MODE` 刪掉或改成別的值，金鑰換回測試的。
