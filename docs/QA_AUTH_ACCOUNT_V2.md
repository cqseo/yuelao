# 月老 2.0 第三階段：登入、姻緣簿、付費正文保護

分支：`feat/yuelao-auth-account`；以 PR #4 的測試 Checkout 安全底座為基礎。**尚未合併及部署，不可宣稱真實付款已可使用。**

## 已實作

- `/login`：繁體／簡體的六位郵箱 OTP 登入 UI，不持久化 OTP 或登入 JWT 到 LocalStorage。
- `POST /api/auth/send`：Supabase `signInWithOtp`，驗證電子信箱格式，依 Supabase Auth 自帶的 email OTP 限流（公開發佈前需另加 Cloudflare Turnstile 與 IP/帳戶速率限制）。
- `POST /api/auth/verify`：`verifyOtp({type:'email'})`，成功後以 `HttpOnly; Secure; SameSite=Lax; Path=/` 的 Host-only cookies 保存 access/refresh tokens，正式 HTTPS 使用 `__Host-` prefix。
- `POST /api/auth/refresh`：伺服器用 refresh cookie 換新 session 並旋轉 cookies；`POST /api/auth/logout`：嘗試服務端撤銷當前 refresh session 並清除 cookies。
- 所有 POST 都要求完全相同的 Origin，避免第三方網站帶 cookies 跨站操作。GET 用於讀取帳戶，但沒有更改資源的能力。
- 伺服器 `getUserFromRequest` 對 HttpOnly cookie 的 access token 重新向 Supabase Auth 驗證，不信任瀏覽器提交的 User ID / Email。
- `/account`：查看自己的訂單、問事包剩餘次數及已解鎖籤文。服務端 service_role 查詢每個資料表均加 `user_id=verified_user.id`；沒有公開客戶付款/身份令牌。
- 測試套餐價格由服務端 site config 確定。登入介面可獨立選 HKD/TWD，但只有 PR #4 測試 Checkout 的所有環境條件滿足時才可點擊。
- `/account/reading` + `GET /api/account/reading`：經過身份與 RPC 權益驗證才可取得付費深度正文。未登入 401；無權限、正文未生成均不會返回正文。
- 帳戶與深度正文頁面設有 `noindex`；JSON 錯誤/成功回應 `no-store`。

## 實測

- Node 24 依 `pnpm check` 的 TS + Vite/Cloudflare Build + site check 成功；`pnpm lint` 零錯誤零警告。
- `tools/test-auth-guards.ts` 驗證同源 POST、跨站拒絕、Host/HttpOnly/Secure cookies、清除 session、未登入帳戶與付費正文拒絕。
- 隔離 preview：`/login`、`/account` 均 HTTP 200；`/api/account/status` 未登入 HTTP 401；跨站 OTP 與付款請求 HTTP 403；Supabase 未配置時不發出郵件，返回 503。
- Headless Chromium 實測：390px 手機登入頁、匿名帳戶提示、模擬有個人訂單的帳戶資料渲染／已購次數／付款禁用／TWD 切換、1440px 桌面均通過，無未捕獲 JS error。
- 經由原有字型子集工具確認新增文案字符由 Noto Serif TC / SC 聯集覆蓋。
- 2026-11-08 Supabase 公開 schema 只讀檢查：`sticks` 100，`deep_readings` 0，`orders` 0，`entitlements` 0。因 **沒有任何付費正文，嚴禁先開放真實充值**。

## 上線阻礙（必須先完成）

1. **Supabase Email OTP 模板**：Supabase 預設有可能發 Magic Link，需把 `Authentication → Email Templates → Magic Link` 中的內容改為 `{{ .Token }}` 六位代碼；針對 staging 設置 Sender/SMTP、郵件限流、送達與驗證期。不能假設模板已設置。
2. 對實際配置的 Supabase Auth 跑完整「發信 → 六位驗證碼 → cookies → refresh → logout → 再登入」E2E；本 PR 沒有使用真實郵箱／用戶進行任何真實 OTP 發信。
3. Cloudflare Turnstile、WAF/速率限制、會話保護、登入與支付安全評估，尤其需要處理刷新 token 競態及管理員登出錯誤記錄。
4. 補齊 `deep_readings` 正文或引入合規的 AI 深度解讀履約；本 PR 僅提供授權後的讀取接口，不生成付費內容。
5. 對 staging Stripe Test Mode 執行測試付款、Webhook、訂單/包次數、撤銷/退款、併發與 API 壓測；成功回跳不能作為付款成功證據。
6. 設定正式品牌域名、有效客服信箱、退款政策、隱私政策（說明驗證郵件、HttpOnly Cookie、訂單保留期間、帳戶刪除流程）。
7. 正式上線先合併/驗收 PR #3（情感測驗），再 PR #4（測試支付），最後本階段 PR。勿直接改當前生產環境。

## 重要限制

- 未實測的業務流程不能視為已完成；目前的帳戶 UI 有正常的假資料瀏覽器測試，但沒有真正完成 OTP 登入。
- 開發用同源 HTTP cookie 使用不同前綴，以免錯誤使用 HTTPS 專用 `__Host-` Cookie 名稱；正式站必須全站 HTTPS。
- 未實施付款後才生成 AI 正文的任務排程，因此尚無自動交付或退款保證。
