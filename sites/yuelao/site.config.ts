import { defineSite } from '@yuelao/core/site';

// All config for this site. Prices are in the smallest currency unit (TWD/HKD cents).
// TODO(launch): brand name is a placeholder — see BUILD_PLAN §9.
//   url is the live preview address (yuelao.cqseo.workers.dev); it becomes the
//   brand domain when that decision lands — one change here updates canonical,
//   sitemap and OG everywhere.
// Prices (P9, copied from kaucim.ai): single deep reading HK$18; pack-3 HK$48;
//   pack-8 HK$108. TWD is the HKD price at 4.15, rounded to whole dollars
//   (18 -> NT$75, 48 -> NT$199, 108 -> NT$448). Do not change product ids
//   after launch.
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
        'zh-Hant': { amount: 7500, currency: 'TWD' },
        'zh-Hans': { amount: 1800, currency: 'HKD' },
      },
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: {
        'zh-Hant': { amount: 19900, currency: 'TWD' },
        'zh-Hans': { amount: 4800, currency: 'HKD' },
      },
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      uses: 8,
      prices: {
        'zh-Hant': { amount: 44800, currency: 'TWD' },
        'zh-Hans': { amount: 10800, currency: 'HKD' },
      },
    },
  ],
  supportEmail: 'support@example.com',
  billing: { provider: 'stripe', automaticTax: false },
  analytics: {},
});
