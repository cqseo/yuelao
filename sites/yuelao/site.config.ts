import { defineSite } from '@yuelao/core/site';

// Prices use fixed HKD minor units; HK$18 = 1800.
// Both Traditional and Simplified visitors pay in HKD; no FX conversion at checkout.
// 2026-11-19 起：單次 HK$12；次數包 5 次 HK$38、12 次 HK$68（舊 3 次 HK$48、8 次 HK$108 下架）。
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
      // 站長 2026-11-19：HK$18 → HK$12（同行占了么單次約 ¥9.9）。已付的舊訂單照原價記錄。
      id: 'unlock_1',
      kind: 'unlock',
      name: '深度解讀 · 單次解鎖',
      prices: hkd(1200),
    },
    {
      // 塔羅館（塔羅／雷諾曼三張）的完整解讀，單次購買；不扣次數包。
      id: 'spread_1',
      kind: 'spread',
      name: '完整解讀 · 塔羅館單次',
      prices: hkd(1800),
    },
    {
      // 算命攤．合緣配對的完整解讀（站長 2026-11-19 擬定 HK$12，上線前可改）。上線後 id 不改。
      id: 'match_1',
      kind: 'spread',
      name: '合緣配對 · 完整解讀',
      prices: hkd(1200),
      decks: ['match'],
    },
    {
      // 算命攤．個人姻緣盤的完整解讀（站長 2026-11-19 擬定 HK$18，上線前可改）。上線後 id 不改。
      id: 'love_1',
      kind: 'spread',
      name: '個人姻緣盤 · 完整解讀',
      prices: hkd(1800),
      decks: ['love'],
    },
    {
      // 算命攤．八字命盤（感情、事業、財運三個主題同價）的完整解讀（站長 2026-11-19 擬定 HK$28，上線前可改）。上線後 id 不改。
      id: 'bazi_1',
      kind: 'spread',
      name: '八字命盤 · 完整解讀',
      prices: hkd(2800),
      decks: ['bazi'],
    },
    {
      // 算命攤．八字年運（2027 丁未年等，站長 2026-11-19 擬定 HK$38）。上線後 id 不改。
      id: 'year_1',
      kind: 'spread',
      name: '八字年運 · 完整報告',
      prices: hkd(3800),
      decks: ['bazi-year'],
    },
    {
      // 財神殿．求財籤的付費解籤（站長 2026-11-19 擬定 HK$12，和月老單次解籤同價）。上線後 id 不改。
      id: 'cai_1',
      kind: 'spread',
      name: '求財籤 · 完整解籤',
      prices: hkd(1200),
      decks: ['cai'],
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
    // 次數包（站長 2026-11-19 改版）：5 次 HK$38（最多人選）、12 次 HK$68。
    // 舊的 3 次／8 次包下架但保留 id，已經買到的次數照常可用。
    {
      id: 'pack_5',
      kind: 'pack',
      name: '問事包 · 5 次',
      uses: 5,
      prices: hkd(3800),
    },
    {
      id: 'pack_12',
      kind: 'pack',
      name: '問事包 · 12 次',
      uses: 12,
      prices: hkd(6800),
    },
    {
      id: 'pack_3',
      kind: 'pack',
      name: '問事包 · 3 次',
      uses: 3,
      prices: hkd(4800),
      retired: true,
    },
    {
      id: 'pack_8',
      kind: 'pack',
      name: '問事包 · 8 次',
      uses: 8,
      prices: hkd(10800),
      retired: true,
    },
  ],
  supportEmail: 'support@yuexia.app',
  // 後台權限要明列：不設時只認 supportEmail，2026-11-18 把聯絡信箱換成 support@yuexia.app 後，站長的 Gmail 就被擋在後台外。
  adminEmails: ['yunhuazhang99@gmail.com', 'support@yuexia.app'],
  // taxCode：深度解讀是 AI 線上生成的個人用數位內容（AI as a Service - Cloud Based - Personal Use）。
  // Managed Payments 已在程式裡關掉（2026-11-15，站長選擇自己當賣方，換取微信支付／支付寶）：
  // Stripe 不再代算代繳各地消費稅，稅務由站長自行負責；automaticTax 維持 false。
  // taxBehavior：站長決定標價含稅（2026-11-13）——買家按 HKD 標價結帳。
  billing: { provider: 'stripe', automaticTax: false, taxCode: 'txcd_10105001', taxBehavior: 'inclusive' },
  analytics: {},
});
