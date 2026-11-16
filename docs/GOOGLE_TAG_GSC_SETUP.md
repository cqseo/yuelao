# 月下 Google Tag Manager / Google Analytics / GSC 驗證

## 網站已安裝的代碼

- 容器 ID：`GTM-KW3PZC25`
- production 頁面 `<head>` 中載入站長提供的 `gtm.js` + `dataLayer/gtag('js')`。
- `<body>` 緊接著放 `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KW3PZC25">...</iframe></noscript>`，以滿足 GSC 使用 GTM 驗證時的要求。
- `sites/yuelao/src/server.ts` CSP 對 GTM / Google Analytics 相關網域設白名單；其他第三方腳本仍不允許。
- 停用 dev/staging 的 GTM 載入，測試流量不計入正式統計。
- 隱私政策已說明第三方標籤及可能的數據處理。

## Google Analytics 4（資料真正進 GA4 的必要操作）

**GTM ID 不是 GA4 衡量 ID。** GTM 容器已嵌入，不代表 GA4 自動開始接收資料。

1. 進入 https://tagmanager.google.com/ 找到 `GTM-KW3PZC25`。
2. 若尚未設定，新增 Google tag / GA4，填入既有 GA4 網站串流的 `G-XXXXXXXXXX` 衡量 ID，設定 All Pages 觸發。
3. 預覽（Tag Assistant）確認 Google tag 會觸發、沒有兩份 GA4 page_view，**提交並發佈容器**。
4. 在 GA4 即時報表／DebugView 檢查是否收到訪問及 `page_view`。SPA 前端換頁的量測需另在 GTM 配置 History Change 或其他適當的頁面瀏覽觸發，避免重複計數。
5. **不要將 Email、問事內容、付款內容等個人資訊作為分析參數送到 Google。**

## Google Search Console 驗證

1. 用具有該 GTM 容器 **Publish 或 Admin 權限**的 **同一個 Google 帳號**登入 https://search.google.com/search-console 。
2. 新增或選擇**網址前置字元（URL-prefix）**資源：`https://yuexia.app/`。
3. 選擇 **Google Tag Manager** 驗證，按「驗證」；若容器未發佈，先在 GTM 發佈，再重試。
4. GSC 要求可公開訪問的首頁含 GTM 標籤，且 `noscript` iframe 緊貼 `<body>` 起始位置；上線後請用 **查看頁面原始碼**確認。
5. 如要建立涵蓋所有子域的 **網域（Domain）資源**，GTM 不適用：必須向 GSC 取得專屬 `google-site-verification=...` DNS TXT 記錄，再新增到 Cloudflare DNS。**沒有真實驗證值不要猜或添加 TXT。**
6. 驗證後在 GSC 提交 `https://yuexia.app/sitemap.xml`，透過「網址審查」檢查首頁及簽文頁。

Google 說明：
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/tagmanager/answer/14847097
