import { defineSite } from '@yuelao/core/site';

// All config for this site. Prices use minor currency units.
// Checkout charges in USD for every visitor, independent of Traditional/Simplified locale.
// TODO(launch): brand name is a placeholder — see BUILD_PLAN §9.
//   url is the live preview address (yuelao.cqseo.workers.dev); it becomes the
//   brand domain when that decision lands — one change here updates canonical,
//   sitemap and OG everywhere.
// Prices (2026-11-12, owner decision): one currency, USD, at tidy price points —
//   single deep reading US$2.99, pack-3 US$6.99, pack-8 US$13.99. Both locales
//   carry the same price (the `prices` map is locale-keyed for historical reasons).
//   Outfits are free for now. When a paid item is added later, list it here as
//   `kind: 'item'` (owner's price points for those: US$2.99 / 3.99 / 4.99) — the
//   checkout, settlement and wardrobe already handle that kind.
//   Do not change product ids after launch.
const usd = (amount: number) => ({
  'zh-Hant': { amount, currency: 'USD' },
  'zh-Hans': { amount, currency: 'USD' },
});

export default defineSite({
  id: 'yuelao',
  name: '月老',
  url: 'https://yuelao.cqseo.workers.dev',
  locales: ['zh-Hant', 'zh-Hans'],
  defaultLocale: 'zh-Hant',
  products: [
    {
      id: 'unlock_1',
      kind: 'unlock',
      name: '深度解讀 · 單次解鎖',
      prices: usd(299),
    },
    {
      // 塔羅館（塔羅／雷諾曼三張）的完整解讀，單次購買；不扣次數包。
      id: 'spread_1',
      kind: 'spread',
      name: '完整解讀 · 塔羅館單次',
      prices: usd(299),
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: usd(699),
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      uses: 8,
      prices: usd(1399),
    },
  ],
  supportEmail: 'yunhuazhang99@gmail.com',
  // taxCode：深度解讀是 AI 線上生成的個人用數位內容（AI as a Service - Cloud Based - Personal Use）。
  // Stripe 帳戶預設開 Managed Payments，沒有稅務分類碼會拒絕建立結帳。
  // taxBehavior：站長決定標價含稅（2026-11-13）——買家在哪都只付 US$2.99，各地消費稅從收入裡扣。
  billing: { provider: 'stripe', automaticTax: false, taxCode: 'txcd_10105001', taxBehavior: 'inclusive' },
  analytics: {},
});
