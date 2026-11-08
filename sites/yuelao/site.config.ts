import { defineSite } from '@yuelao/core/site';

// All config for this site.
// TODO(launch): brand name is a placeholder — see BUILD_PLAN §9.
//   url is the live preview address (yuelao.cqseo.workers.dev); it becomes the
//   brand domain when that decision lands — one change here updates canonical,
//   sitemap and OG everywhere.
// Price (P9, copied from kaucim.ai): single deep reading HK$18; pack-3 HK$48;
//   pack-8 HK$108. One currency for every visitor — we don't fork HKD/TWD by
//   locale any more; Stripe Checkout localizes the displayed amount for the
//   buyer itself (Adaptive Pricing, a Stripe Dashboard setting). Do not change
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
      shortName: '單次',
      price: { amount: 1800, currency: 'HKD' },
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      shortName: '3 次包',
      uses: 3,
      price: { amount: 4800, currency: 'HKD' },
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      shortName: '8 次包',
      uses: 8,
      price: { amount: 10800, currency: 'HKD' },
    },
  ],
  supportEmail: 'foxigaoqian@163.com',
  billing: { provider: 'stripe', automaticTax: false },
  analytics: {},
});
