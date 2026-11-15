import { defineSite } from '@yuelao/core/site';

// All config for this site. Prices use minor currency units.
// Checkout charges in USD for every visitor, independent of Traditional/Simplified locale.
// Brand domain (2026-11-15): yuexia.app — the whole market, not just Yuelao,
// so the domain stays generic as more shops are added. One change here
// updates canonical, sitemap and OG everywhere.
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
  url: 'https://yuexia.app',
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
      // 大殿靜心上香的高階供品：永久擁有，只換香的樣子（煙色、落花），不改籤運。
      // 價位照站長給的 item 價位（US$2.99 / 3.99 / 4.99）。上線後 id 不改。
      id: 'incense_lotus',
      kind: 'item',
      name: '九品金蓮香',
      prices: usd(299),
    },
    {
      id: 'incense_aurora',
      kind: 'item',
      name: '七彩極光香',
      prices: usd(399),
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
  // Managed Payments 已在程式裡關掉（2026-11-15，站長選擇自己當賣方，換取微信支付／支付寶）：
  // Stripe 不再代算代繳各地消費稅，稅務由站長自行負責；automaticTax 維持 false。
  // taxBehavior：站長決定標價含稅（2026-11-13）——買家在哪都只付 US$2.99。
  billing: { provider: 'stripe', automaticTax: false, taxCode: 'txcd_10105001', taxBehavior: 'inclusive' },
  analytics: {},
});
