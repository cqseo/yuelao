import { defineSite } from '@yuelao/core/site';

// All config for this site. Prices use minor currency units.
// Checkout charges in USD for every visitor, independent of Traditional/Simplified locale.
// TODO(launch): brand name is a placeholder — see BUILD_PLAN §9.
//   url is the live preview address (yuelao.cqseo.workers.dev); it becomes the
//   brand domain when that decision lands — one change here updates canonical,
//   sitemap and OG everywhere.
// Prices (2026-11-12, owner decision: one currency, USD): the HKD price list in
//   the product plan converted at the peg, 7.8 HKD = 1 USD, rounded to the cent.
//   HK$18 -> US$2.31, HK$48 -> US$6.15, HK$108 -> US$13.85; outfits HK$18/28/38
//   -> US$2.31/3.59/4.87. Both locales carry the same price — the `prices` map is
//   locale-keyed for historical reasons. Do not change product ids after launch.
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
      prices: usd(231),
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: usd(615),
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      uses: 8,
      prices: usd(1385),
    },
    // 集市的付費外觀（kind: 'item'，買了永久擁有）。id = 'outfit_' + 引擎裡的外觀代號。
    { id: 'outfit_peach', kind: 'item', name: '外觀 · 桃夭', prices: usd(231) },
    { id: 'outfit_ink', kind: 'item', name: '外觀 · 墨金', prices: usd(359) },
    { id: 'outfit_bride', kind: 'item', name: '外觀 · 霞帔', prices: usd(487) },
  ],
  supportEmail: 'support@example.com',
  billing: { provider: 'stripe', automaticTax: false },
  analytics: {},
});
