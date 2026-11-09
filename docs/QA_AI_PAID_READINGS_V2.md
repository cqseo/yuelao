# 月老 2.0｜付費 AI 深度解讀、次數包兌換與退款驗收

日期：2026-11-09。分支：`feat/yuelao-ai-paid-readings`，基於 PR #5。
**僅開發分支和離線測試。尚未部署正式 Supabase/Worker、未向 OpenAI 發送真實請求，也未進行 Stripe 真實測試交易。**

## 已做
1. DB migration `20261109000001_paid_ai_readings.sql`：每一條 `unlocks.id` 對應至多一篇私密 AI 生成報告，僅有 service_role 可呼叫內部 RPC。問事問題本身不保存。
2. Claim/finish/fail/get 四個 privileged RPC：依登入 user_id + 已解鎖籤文核對，鎖定並發生成、110 秒租約、成功存檔、超時／失敗可重試；若權益被退款撤銷，生成結果不可再存取。
3. 修復 `consume_pack_use`：同一 user + stick + category + locale 重複兌換時不重複扣次數；即使並發不同 pack 也會回滾額外扣款；已撤銷的同種解鎖禁止以套餐繞過撤銷。
4. 修復 `revoke_for_refund`：除凍結套餐剩餘次數外，亦撤銷該已退款／爭議套餐已兌換的簽文，阻止付費 AI 解讀繼續被閱讀。
5. `POST /api/account/redeem`：同源、登入、AI 測試功能旗標、資料庫 RPC；帳戶內選 1–100 籤號／問事類別，只有已擁有次數包且 AI 可履約才可兌換。
6. `POST /api/account/reading/generate`：同源、登入、未撤銷權益與使用者明確同意；選填問題最多 400 字。不保存問題原文、不傳其他人的帳戶資料；OpenAI Responses API 使用 `store:false`，僅保存解讀文字。
7. `GET /api/account/reading` 優先取個人化 AI 報告；沒有則依原有已購靜態判詞回退；全部服務端權限判斷。
8. 帳戶新增兌換頁面，解讀頁新增「自願提供問題 → 同意發送給 AI → 生成 → 自己帳戶查看」表單、正在生成狀態及重試提示。
9. 測試 Checkout 加入 `paid_ai_delivery_ready()` 預檢，DB migration 未套用或 AI 尚未配置則 503 拒絕付款。AI 測試預設 `AI_ENABLE_TEST_GENERATION=false`；不提供任何 live key 輸入入口。

## 測試
- `tools/test-ai-paid-readings.sql`：無權益拒絕、雙重 claim 排他、錯誤 claim 不能存、成功內容只能本人查閱、退款後禁止查詢、套餐重複兌換不扣雙倍、匿名／一般登入角色不可直呼 RPC。
- `tools/test-ai-pack-refund.sql`：模擬購包→兌換→生成→退款；退款前可查看，退款後簽文、正文、剩餘用次均被禁止。
- `tools/test-ai-reading.ts`：測試選項檢查與 opt-in、測試功能預設關閉、模型請求包含原籤詩與自願問題並設 `store:false`、成功生成存檔、重複 claim 不重複生成、失敗釋放租約。
- Node 24 `pnpm check` + `pnpm lint`、本地預覽和手機版視覺驗收應通過才可合併。本文件記錄最後通過狀態，不代表真實商業流程已完整驗收。

## 明確未完成 / 上線門檻
- 須使用**具權限的 staging Supabase**套用 migration，並與 matching Worker 同步部署。*不能只更新 Worker 或只套用 DB function*。
- 取得合法的 OpenAI API 密鑰，設定 `OPENAI_API_KEY`、`OPENAI_MODEL`（由工程師確認可用 model）；使用小額 staging 成本上限。禁止把密鑰放進 GitHub、Cloudflare 公開變數或對話。
- 配置 Supabase 郵箱六位 OTP 模板（含 `{{ .Token }}`）、SMTP、CAPTCHA/Turnstile、WAF / IP rate limits，才可公開登入；登入須完成真實信件驗證測試。
- 進行端對端 Stripe Test Mode 測試：登入→購買/套餐→ webhook → 簽文權益→AI 生成→帳戶重新讀取→退款/拒付撤銷及併發情境。**目前沒有驗證真實付款或 OpenAI 真實產出。**
- 開放收費前需完善報告內容品質審核、AI 錯誤/拒答時人工補救或退款流程、成本監控／預算上限、隱私政策與使用者刪除報告的能力、社群/平台與支付服務商合規檢查。
- 不可把 AI 算命視為科學事實、不能保證復合、不能做虛構出軌機率或診斷第三方，遇到虐待/自傷以安全支援優先。
- 正式站客服信箱目前是占位符，需配置真實品牌客服信箱，並完成內容來源/著作權與使用者資料告知。
- `store:false` 只是不儲存模型回應的 **API 應用狀態**，並不代表提供方完全沒有安全日誌。具體詳見 OpenAI API 的 data controls。

## 上線順序
先完成/驗收/合併 PR #3（測驗中心）→ PR #4（Stripe sandbox）→ PR #5（登入帳戶）→ 本 PR（AI 深度解讀）。全鏈路於獨立 staging 預演後，才考慮 Live 付款。
