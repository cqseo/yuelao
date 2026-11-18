import { defineSite } from '@yuelao/core/site';

// Prices use fixed HKD minor units; HK$18 = 1800.
// Both Traditional and Simplified visitors pay in HKD; no FX conversion at checkout.
// Restore historical HKD tiers: single HK$18, pack 3 HK$48, pack 8 HK$108.
// Tarot single HK$18; incense HK$18/HK$28, pending final price approval.
// Historical USD orders keep their original currency and entitlements.
const hkd = (amount: number) => ({
  'zh-Hant': { amount, currency: 'HKD' },
  'zh-Hans': { amount, currency: 'HKD' },
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
      prices: hkd(1800),
    },
    {
      // 塔羅館（塔羅／雷諾曼三張）的完整解讀，單次購買；不扣次數包。
      id: 'spread_1',
      kind: 'spread',
      name: '完整解讀 · 塔羅館單次',
      prices: hkd(1800),
    },
    {
      // 追問月老：買過付費解籤後，就同一件事再問一句（站長 2026-11-18 定價 HK$8，一份解籤最多 3 次）。
      // 上線後 id 不改。
      id: 'followup_1',
      kind: 'followup',
      name: '追問月老 · 一次',
      prices: hkd(800),
    },
    {
      // 大殿靜心上香的高階供品：永久擁有，只換香的樣子（煙色、落花），不改籤運。
      // 價位照站長給的 item 價位（港幣固定價）。上線後 id 不改。
      id: 'incense_lotus',
      kind: 'item',
      name: '九品金蓮香',
      prices: hkd(1800),
    },
    {
      id: 'incense_aurora',
      kind: 'item',
      name: '七彩極光香',
      prices: hkd(2800),
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: hkd(4800),
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      uses: 8,
      prices: hkd(10800),
    },
  ],
  supportEmail: 'support@yuexia.app',
  // taxCode：深度解讀是 AI 線上生成的個人用數位內容（AI as a Service - Cloud Based - Personal Use）。
  // Managed Payments 已在程式裡關掉（2026-11-15，站長選擇自己當賣方，換取微信支付／支付寶）：
  // Stripe 不再代算代繳各地消費稅，稅務由站長自行負責；automaticTax 維持 false。
  // taxBehavior：站長決定標價含稅（2026-11-13）——買家按 HKD 標價結帳。
  billing: { provider: 'stripe', automaticTax: false, taxCode: 'txcd_10105001', taxBehavior: 'inclusive' },
  analytics: {},
});
