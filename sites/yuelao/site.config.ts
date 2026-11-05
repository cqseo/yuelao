import { defineSite } from '@yuelao/core/site';

// All config for this site. Prices are in the smallest currency unit (TWD/HKD cents).
// TODO(launch): brand name, url and prices are placeholders — see BUILD_PLAN §9.
//   url must be the real domain before launch; prices (NT$199 unlock / NT$99 pack-3)
//   are the V1 proposal, not yet approved. Do not change product ids after launch.
export default defineSite({
  id: 'yuelao',
  name: '月老',
  url: 'https://yuelao.example.com',
  locales: ['zh-Hant', 'zh-Hans'],
  defaultLocale: 'zh-Hant',
  products: [
    {
      id: 'unlock_1',
      kind: 'unlock',
      name: '深度解讀 · 單次解鎖',
      prices: {
        'zh-Hant': { amount: 19900, currency: 'TWD' },
        'zh-Hans': { amount: 4800, currency: 'HKD' },
      },
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: {
        'zh-Hant': { amount: 9900, currency: 'TWD' },
        'zh-Hans': { amount: 2400, currency: 'HKD' },
      },
    },
  ],
  supportEmail: 'support@example.com',
  billing: { provider: 'stripe', automaticTax: false },
  analytics: {},
});
