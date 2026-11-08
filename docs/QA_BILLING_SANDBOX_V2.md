# 月老 V2 · Stripe 安全加固與測試結帳（2026-11-08）

分支：`feat/yuelao-billing-guardrails`，基於 `feat/emotional-tests-v2`。**這是未部署的測試功能，不是可收真錢的版本。**

## 實作

- 新增 `POST /api/billing/checkout`。服務端預設回 503，只有 `BILLING_ENABLE_TEST_CHECKOUT=true`、Stripe `sk_test_*`、Webhook 簽名密鑰、Supabase service/anon keys **全部**配置且 JWT 真實驗證後才允許建立測試 Checkout。
- 不接受瀏覽器傳入的金額、客戶 ID、回傳地址、訂單擁有者。從 `site.config.ts` 依產品 ID 和**明確選擇**的 HKD/TWD 幣種取價；繁簡只影響文字解讀語種，不影響幣種。
- 單次籤解鎖要求 1–100 的籤號、三類情境；已有權益返回 409。套餐不需要籤號。15 分鐘內最多建立 5 筆訂單（資料庫計數；非原子，正式版還需 Worker/WAF 限流）。
- 重用 profile 的 `stripe_customer_id`，缺少時建立新 Stripe customer 再保存；訂單先進資料庫，再創建 Checkout Session，更新 `checkout_ref`。
- Checkout 成功返回頁 `/billing/return` 明確說明尚需 Webhook 確認，絕不根據用戶瀏覽器跳轉發放權益。
- 禁止 Stripe 折扣碼：當前結算邏輯仍按牌價驗證，尚未開發折扣碼對賬；不能讓客戶折扣付款卻被拒絕履約。

## 安全修補

- 以 Postgres 訂單 `pending -> paid` 狀態轉換當作唯一授權 trigger，並在資料庫 transaction 中持有訂單行鎖。
- `entitlements(order_id)` 建立 partial unique index；不同 Stripe Event ID 對同一筆付款只能發包一次。
- 嚴格比對 paid payment 的 user_id、product_id、provider、幣種與最低應付金額；不一致時交易回滾，拒絕授權。
- 同一 Stripe PaymentIntent 不能透過後來的 event 換 owner/order/product。拒絕匿名角色呼叫結算函式。
- 退款、拒付採保守做法：任意部分退款或 open/lost 爭議，即撤銷該訂單所有權益，必須人工復核後才可恢復。這是安全底線，**不是完成的按比例部分退款功能**。

## 已完成驗證

- Node 24 下 `pnpm check`、`pnpm lint` 均通過，沒有 lint 錯誤與警告。
- 隔離 Docker PostgreSQL 17 上，按順序應用原三個 schema/RPC migration + 新 migration 均成功。
- `tools/test-billing-hardening.sql` 覆蓋：首次 grant、不同事件的重送、相同事件 ID、低於原價、錯誤用戶、部分退款、交易爭議以及匿名 EXECUTE 權限。8 項均 PASS。
- Vite preview：`GET /billing/return` 回 200；未開啟 Sandbox `POST /api/billing/checkout` 返回 503（`checkout_disabled`）；錯誤頁 404。
- 本次沒有對已連結的 `yuelao` Supabase 生產專案執行寫入/遷移，也沒有發起任何 Stripe 支付交易。

## 未達正式開收款標準

1. 在正式 staging 環境套用 DB migration，做 Stripe Test Mode checkout、成功/失敗/延遲支付/重送事件以及退款測試。Webhook RPC 與 Worker 版本需要同步釋出，不能單獨切換。
2. 完成 OTP 登入界面、讀取訂單/可用套餐餘額以及真正的深度閱讀內容履約。測試模式 API 尚沒有可操作的前台付款入口。
3. 對部分退款訂立正式的權益恢復及人工審核流程，並提供清楚的客戶說明。應對配對內容、不實確定性結論實施內容政策。
4. 檢查客服地址、退款條款、產品定價，並把不同地區的幣種選擇跟 UI 聯動。現在沒有對外公開價格頁。
5. 做併發測試：相同付款不同事件 ID／同一訂單多個 checkout session／取消後異常完成支付。
6. 用戶明確確認前，不啟用 live key，不合併生產部署。

## 本地檢查

```bash
pnpm check
pnpm lint
# 工程師可使用一次性的 PostgreSQL 測試實例，依序套用基礎遷移與最新
# harden_stripe_entitlements.sql，再執行 tools/test-billing-hardening.sql。
```
