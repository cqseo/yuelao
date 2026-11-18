# 訪客結帳：沒登入也能付款（2026-11-18）

沒登入的人按「解鎖」時，伺服器先建一個**訪客帳號**（Supabase 匿名使用者），接著直接進 Stripe 付款。
買到的解讀記在這個訪客帳號上。之後他願意時到「我的」綁定信箱：綁定是**改這個帳號的信箱**，帳號 ID 不變，
所以已買的東西都留著；換手機用這個信箱登入就找得回來。

程式：`packages/core/src/guest-auth.ts`（建訪客、寄綁定碼、驗證綁定碼）、`packages/core/src/auth.ts`
（`getAccountUser` 讓結帳、付費解讀、帳戶狀態接受訪客；許願、簽到、後台仍只認信箱帳號）、
`sites/yuelao/src/lib/guest.ts`（結帳回 401 就先變訪客再試一次）。設計來源：PR #16。

## 開啟前，站長要在 Supabase 後台做兩件事

1. **Authentication → Sign In / Providers → Allow anonymous sign-ins：打開。**
   沒開的話，建訪客會失敗，畫面照舊請他登入（不會壞，只是沒效果）。
2. **Authentication → Emails → Change email address（改信箱）範本：換成驗證碼版。**
   主旨可用「月老｜綁定信箱驗證碼」，內文貼 `supabase/templates/email_change_otp.html`。
   一定要有 `{{ .Token }}`（六位數驗證碼）；預設範本只有確認連結，網站的綁定表單收不到碼。

建議（非必要）：**Authentication → Rate Limits** 裡匿名登入的每小時上限調高（例如 300）。
所有訪客都是從 Cloudflare Worker 去建的，Supabase 看到的來源 IP 是 Worker 的，預設上限很快就會碰到。
Worker 自己另有每個訪客 IP 一分鐘 5 個的限制（`wrangler.jsonc` 的 `GUEST_RATE_LIMITER`）。

## 開啟

1. 資料庫套用 `supabase/migrations/20261118000001_guest_profiles.sql`（profiles.email 允許空值、匿名使用者也建 profile）。
2. `wrangler.jsonc` 的 `GUEST_AUTH_ENABLED` 改成 `"true"`，合併上線。
3. 用無痕視窗走一次：求籤 → 解鎖 → 應該直接到 Stripe（不經登入頁）→ 付款 → 解讀出現，下方有「綁定信箱保存」→
   到「我的」綁信箱 → 收到六位數碼 → 綁定完成 → 換一個瀏覽器用這個信箱登入，看得到那份解讀。

## 已知限制

- 訪客在綁信箱前清掉瀏覽器資料或換手機，就找不回來。Stripe 結帳頁會請他填信箱（收據寄到那裡），
  站長可用那個信箱在 Stripe 找到訂單、再到資料庫把權益手動轉過去。
- 綁定時如果那個信箱**已經有帳號**，不能直接併過去（會變成誰知道別人信箱就能領走別人的購買）。
  畫面請他換信箱，或來信附訂單號由站長手動轉。
- 正式帳號的登入過期 30 天以上、又在結帳時按解鎖，會變成新訪客（買的東西記在新訪客上）。少見；遇到同上手動轉。
- 訪客不能許願、簽到；要用這些功能，綁信箱就行。
- 關掉 `GUEST_AUTH_ENABLED` 只會停止建新訪客；已經買過的訪客照樣看得到自己的解讀。
