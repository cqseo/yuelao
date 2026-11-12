import { defineSite } from '@yuelao/core/site';

// All config for this site. Prices use minor currency units.
// Checkout charges in USD for every visitor, independent of Traditional/Simplified locale.
// TODO(launch): brand name is a placeholder — see BUILD_PLAN §9.
//   url is the live preview address (yuelao.cqseo.workers.dev); it becomes the
//   brand domain when that decision lands — one change here updates canonical,
//   sitemap and OG everywhere.
// Prices (2026-11-12, owner decision: one currency, USD): single deep reading
//   US$2.99; pack-3 US$6.99; pack-8 US$14.99. Both locales carry the same price —
//   the `prices` map is locale-keyed for historical reasons. Amounts are a
//   proposal pending owner sign-off; change them here only. Do not change
//   product ids after launch.
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
      prices: {
        'zh-Hant': { amount: 299, currency: 'USD' },
        'zh-Hans': { amount: 299, currency: 'USD' },
      },
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: {
        'zh-Hant': { amount: 699, currency: 'USD' },
        'zh-Hans': { amount: 699, currency: 'USD' },
      },
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      uses: 8,
      prices: {
        'zh-Hant': { amount: 1499, currency: 'USD' },
        'zh-Hans': { amount: 1499, currency: 'USD' },
      },
    },
  ],
  supportEmail: 'support@example.com',
  billing: { provider: 'stripe', automaticTax: false },
  analytics: {},
});
