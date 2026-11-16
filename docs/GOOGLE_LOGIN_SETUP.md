# Google 一鍵登入接入與驗收（yuexia.app）

**狀態：等待站長完成 Google Cloud OAuth + Supabase Google Provider 設定。**
代碼在 `feat/google-oauth-pkce-login` 分支，`GOOGLE_AUTH_ENABLED=false`，此時不會在前端顯示 Google 按鈕。

## 站長在 Google Cloud 上操作

1. 打開 https://console.cloud.google.com/auth/overview，建立／選擇 Google Cloud 專案。
2. 設定 Branding：應用名稱 YUEXIA（月下）、聯絡信箱、網站 https://yuexia.app、私隱政策 https://yuexia.app/privacy、服務條款 https://yuexia.app/terms，並按 Google 要求完成網域驗證。
3. Audience 選 External；測試期加入測試者信箱。準備公開給一般 Google 使用者後再發布至 Production。
4. Clients 建立 Web application OAuth client：
   - Authorized JavaScript origins：`https://yuexia.app`
   - Authorized redirect URIs：`https://ichsqdfrwymlizqgxnqw.supabase.co/auth/v1/callback`
   - 使用 openid / email / profile 的基本權限，不要求額外敏感 scope。

## 站長在 Supabase 上操作

1. 現有專案 `yuelao`：https://supabase.com/dashboard/project/ichsqdfrwymlizqgxnqw/auth/providers
2. Google Provider 打開，輸入 Google Cloud 產生的 Client ID、Client Secret，保存。**Client Secret 只留在 Supabase；不要傳到 GitHub、聊天室或前端。**
3. Auth → URL Configuration：https://supabase.com/dashboard/project/ichsqdfrwymlizqgxnqw/auth/url-configuration
   - Site URL：`https://yuexia.app`
   - Additional Redirect URLs：`https://yuexia.app/api/auth/google/callback`

注意：Google Cloud 的 redirect 是 **Supabase** `/auth/v1/callback`；Supabase 的 redirect allowlist 是 **網站** `/api/auth/google/callback`。

## 程式路徑與安全邊界

- POST `/api/auth/google/start`：同源請求，產生 PKCE verifier（`HttpOnly`、`SameSite=Lax`、短期 Cookie），回傳 Supabase 授權 URL。
- GET `/api/auth/google/callback`：服務端交換一次性 code，成功後沿用 `__Host-yl_access` 和 `__Host-yl_refresh` Session Cookie，清理 PKCE Cookie，303 到 `/login/complete`。
- `/login/complete`：用 sessionStorage 中的**固定**狀態選擇 `/account`、`/market` 或 `/market#yuelao`；只允許固定的語言前綴，禁止傳入外部目標。
- Google 服務從 Supabase Auth 身份系統獲取使用者，**不建另一張用戶表，不改付費訂單的 user_id 關聯**。
- 未接好 Provider 前 `GOOGLE_AUTH_ENABLED=false`，前端不顯示新按鈕；準備正式上線時只將 `sites/yuelao/wrangler.jsonc` 正式環境的開關改為 `true`，不開 staging。

## 合併及上線前驗收

1. 完成 Google OAuth 配置後，在測試帳戶上打開開關，檢查 Google Consent Screen、登入成功、HTTPOnly Cookie 和退出登入。
2. 使用**已存在且驗證郵箱**的 OTP 帳號，以相同 Google 郵箱登入：核對 Supabase user_id 是否相同，以及原有訂單／已購解簽權益是否能讀取。
3. 用不同 Google 郵箱測試：應創建新帳號，不能看到其他使用者的已購資料。
4. 集市 `market-pending` 及 `market-back` 兩種狀態登入後能返回原流程。
5. 中途取消或拒絕授權：跳回登入頁，不建立會話、沒有洩漏 code/token；重新使用 OTP 仍可正常登入。
6. 測試繁體、簡體、EN、JA、KO、TH：按鈕文案正確，路由前綴不錯亂。
7. 回調及授權 API 回應必須 `Cache-Control: private, no-store`，不得返回 access/refresh token JSON。
8. 按倉庫規範跑 `pnpm --filter @yuelao/core check` 與 `pnpm --filter ./sites/yuelao check`。
9. 合併 PR 到 main 會自動觸發生產部署；必須在測試與站長同意後進行。
