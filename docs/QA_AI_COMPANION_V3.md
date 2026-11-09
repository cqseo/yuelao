# 月老 AI 即時對話：服務端、成本上限與公開上線門檻

日期：2026-11-09；開發分支：`feat/yuelao-ai-companion`。

## 已實現

- POST /api/chat/ai：僅已登入的月老用戶、有明確傳送資料同意、通過同源 POST 校驗後才可呼叫。
- GET /api/chat/ai：伺服器返回 AI 是否可用及剩餘額度；停用時不出現付費模型模式選項。
- 後端直接調用 OpenAI Responses API，`store:false`，`max_output_tokens:450`，超時 23 秒。模型鑰匙永不送往瀏覽器，個人聊天原文不保存到月老資料庫，也不作原文日誌。
- `/chat` 頁面可在原免費引導模式與 AI 模式之間切換，AI 模式明確標記、同意勾選前不可送出；成功回覆後更新顯示剩餘額度，失敗會提供可返回免費引導模式的提示。
- 每筆 AI 對話發送本次訊息與最多最近 6 條對話，每條不超過 400 字；禁止任意 system/tool 角色輸入。接口不處理外部 URL 或上傳。
- 模型文化與安全提示禁止「能驗證出軌、算命絕對準確、讀取別人的真實想法」類陳述；遭遇暴力、自傷、自殺等需要以現實安全支援優先。
- 預設 `AI_CHAT_ENABLED=false`，正式 Worker 及 UI staging 的 Wrangler 設定均為 false，沒有任何 OpenAI API 網路請求與費用。
- 新移轉 `20261109064107_ai_chat_quotas.sql`：PostgreSQL 同一日 UTC 的一筆全站原子計數器和按用戶原子計數器，**每天全站最多 50 次、每個已登入帳戶最多 3 次**。即使同時發送多個請求，也不會超出資料庫硬上限。模型呼叫失敗也扣一次，優先保障成本，後續可設人工補救。
- 資料表啟用 RLS，`reserve_ai_chat_turn` 與 `get_ai_chat_turns_remaining` 的 `EXECUTE` 權限僅給 `service_role`。不保存 IP 或聊天內容，只保存 UUID、UTC 日及計數。
- 繁體預設、簡體支援；隱私頁告知 AI 的第三方資料處理及非即時對話模式的不同。

## 已驗收

```bash
pnpm lint
pnpm check
pnpm exec tsx tools/test-ai-chat.ts
bash tools/run-ai-chat-quota.sh
```

- `test-ai-chat.ts`：驗證同源/認證/明確同意、模型請求和 `store:false`、長度/角色限制、每日 3 次後 429、失敗不泄露原文、關閉時不發生呼叫。模型 fetch 使用模擬響應，**沒有真實收費**。
- `run-ai-chat-quota.sh`：啟動一次性本地 Docker PostgreSQL 17，套用新移轉，17 個合成帳戶測試 3 次/人、50 次/日全站上限、匿名角色不可直接使用 RPC，退出即銷毀資料庫。**沒有創建 Supabase 收費分支**。
- Chromium 390px、1440px 本地生產 bundle：透過攔截方式模擬 AI 已啟用和模型回答，測試同意、回答、剩餘額度、多輪上下文、切回免費對話、原模式不中斷；AI 停用時不顯示新付費模式，不出現 JS errors。
- 站點本身 TypeScript、Vite 及 Biome 檢查均通過。

## 尚未完成及不得跳過的事項

1. **實際 AI 呼叫和費用批准**：未使用任何真 OpenAI API key/model 生成，無法宣稱真實 AI 已開通。真實調用會發生按 token 計費，需要先同意成本模型、限制帳戶支出、完成壓力/防濫用評估後手動部署密鑰。
2. **真正登入**：正式站目前 email OTP 關閉；本版 AI 端點強制已認證用戶。因此正式站雖可部署代碼，但將繼續顯示原來免費引導式聊天，直到登入與資料層全部驗收。
3. **正式 DB 遷移**：只在 Docker 本地測試，未動正式 Supabase。應先處理 Issue #11 的全新 DB 初始化順序風險，再決定如何安全升級正式庫。
4. **商業支付**：Stripe 正式結帳仍刻意關閉，Stripe 測試沙盒的 Webhook 尚指向正式站；不要在支付路徑尚未驗收時開啟。
5. **成本 hard cap 不代表美元成本固定**：50 次是資料庫對 API 呼叫次數的嚴格上限，並非 USD 金額配額。API 模型價格、輸入/輸出、重試成本可能波動，需另設供應商帳戶/項目預算和告警後才可公開使用。
6. **第三方模型的安全日誌**：`store:false` 關閉 Responses API 的一般應用狀態保存，但不保證完全沒有提供方的安全日誌或法規保留。依實際供應商最新 Data Controls 明確告知用戶。
7. **對話本機資料**：聊天歷史只在 React 頁面內存，不跨裝置、不能恢復。每日簽到仍是 localStorage，未和充值銅錢混用。

## 回滾

- API: `AI_CHAT_ENABLED=false` 即關閉。
- UI: 關閉狀態無 AI 模式切換，保留原免費引導對話。
- SQL: 暫不部署正式環境，不執行生產 DROP。
