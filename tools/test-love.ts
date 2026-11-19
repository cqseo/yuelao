// 算命攤．個人姻緣盤：桃花、紅鸞、天喜、流年、識別字串、付費提示、結帳。全離線。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTestCheckout } from '../packages/core/src/billing/checkout';
import type { PaymentProvider } from '../packages/core/src/billing/provider';
import {
  hongluanOf,
  loveChart,
  loveIds,
  loveLines,
  taohuaOf,
  tianxiOf,
  yearGanzhi,
  yearZodiac,
} from '../packages/core/src/love';
import { parseSpread } from '../packages/core/src/spread';
import {
  LOVE_INSTRUCTIONS,
  parseSpreadGeneration,
  spreadUserInput,
} from '../packages/core/src/spread-reading';
import site from '../sites/yuelao/site.config';
import { flowYear, loveKey } from '../sites/yuelao/src/ritual/match';

const Z = (name: string) => '鼠牛虎兔龍蛇馬羊猴雞狗豬'.indexOf(name) + 1;
// 流年
assert.equal(yearGanzhi(2026), '丙午');
assert.equal(yearGanzhi(2027), '丁未');
assert.equal(yearGanzhi(1984), '甲子');
assert.equal(yearZodiac(2026), Z('馬'));
assert.equal(flowYear(new Date(2027, 1, 3)), 2026, 'before 立春 counts as last year');
assert.equal(flowYear(new Date(2027, 1, 4)), 2027);
// 桃花：申子辰在酉、寅午戌在卯、巳酉丑在午、亥卯未在子
for (const [z, t] of [
  ['鼠', '雞'],
  ['龍', '雞'],
  ['虎', '兔'],
  ['狗', '兔'],
  ['蛇', '馬'],
  ['牛', '馬'],
  ['豬', '鼠'],
  ['羊', '鼠'],
])
  assert.equal(taohuaOf(Z(z)), Z(t), `${z} 桃花`);
// 紅鸞：子卯、丑寅、寅丑、卯子、辰亥…；天喜與紅鸞對沖
for (const [z, h] of [
  ['鼠', '兔'],
  ['牛', '虎'],
  ['虎', '牛'],
  ['兔', '鼠'],
  ['龍', '豬'],
  ['馬', '雞'],
  ['豬', '龍'],
])
  assert.equal(hongluanOf(Z(z)), Z(h), `${z} 紅鸞`);
assert.equal(tianxiOf(Z('鼠')), Z('雞'));
console.log('PASS: flow year, 桃花, 紅鸞, 天喜 follow the folk rules');

// 1990 馬：2026 丙午是本命年；紅鸞在雞（2029）
const c = loveChart(Z('馬'), 4, 2026);
assert.equal(c.yearRelation, 'same');
assert.equal(c.title, '本命之年');
assert.ok(c.years.some((y) => y.year === 2029 && y.stars.includes('hongluan')));
// 屬馬的天喜、桃花都在兔年：兩顆都要列出，桃花的年份也要說得出來
assert.ok(c.years.some((y) => y.year === 2035 && y.stars.join() === 'tianxi,taohua'));
assert.ok(loveLines(c).every((l) => !l.text.includes('，。')));
assert.deepEqual(
  c.goodMatch.sort((a, b) => a - b),
  [Z('虎'), Z('羊'), Z('狗')],
);
assert.equal(c.hardMatch, Z('鼠'));
// 牛年生的人 2026 午年是桃花年；雞年生的人午年同時是桃花和紅鸞，紅鸞優先
assert.equal(loveChart(Z('牛'), 1, 2026).title, '桃花當令');
assert.equal(loveChart(Z('雞'), 1, 2026).title, '紅鸞星動');
// 屬鼠 2026 午年沖太歲
assert.equal(loveChart(Z('鼠'), 1, 2026).title, '宜靜不宜急');
assert.equal(loveLines(c).length, 3);
console.log('PASS: charts, titles and best matches');

const h = '0123456789abcdef';
const key = `love:${loveIds(Z('馬'), 4, 2026)}|${h}`;
assert.equal(key, `love:07_04_2026|${h}`);
const parsed = parseSpread(key);
assert.ok(parsed && parsed.deck === 'love' && parsed.year === 2026);
assert.equal(parseSpread(`love:13_04_2026|${h}`), null);
assert.equal(parseSpread(`love:07_04_1999|${h}`), null);
assert.equal(parseSpread(`love:07_04|${h}`), null);
const k = await loveKey('1990-07-10', 2026, 'single', '我什麼時候會遇到對的人');
assert.match(k ?? '', /^love:07_04_2026\|[0-9a-f]{16}$/);
assert.equal(await loveKey('1990-02-30', 2026, 'single', ''), null);
console.log('PASS: love keys are strictly shaped and carry no birthday');

const input = parseSpreadGeneration({
  spread: key,
  locale: 'zh-Hant',
  consent: true,
  question: '明年會脫單嗎',
  sit: 'single',
});
assert.ok(input);
const sent = JSON.parse(spreadUserInput(input));
assert.equal(sent.chart.you.zodiac, '午馬');
assert.equal(sent.chart.thisYear.ganzhi, '丙午');
assert.equal(sent.chart.thisYear.relationToYou, '同肖（本命年）');
assert.equal(sent.chart.hongluan, '酉雞');
assert.equal(sent.chart.overall, '本命之年');
assert.ok(!/\d{4}-\d\d-\d\d/.test(JSON.stringify(sent)), 'no birthday in the prompt');
assert.match(LOVE_INSTRUCTIONS, /不給分數、百分比或成功機率/);
console.log('PASS: the paid prompt carries the chart, not the birthday');

const db = {
  from(table: string) {
    const ops: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'upsert', 'update', 'eq', 'gte', 'is', 'single', 'maybeSingle'])
      chain[m] = () => {
        ops.push(m);
        return chain;
      };
    // biome-ignore lint/suspicious/noThenProperty: the fake must be awaitable like a Supabase query builder.
    chain.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve(
        table === 'orders' && ops.includes('insert')
          ? { data: { id: 'order-1' }, error: null }
          : table === 'profiles'
            ? { data: { stripe_customer_id: 'cus_test' }, error: null }
            : { data: null, error: null, count: 0 },
      ).then(ok);
    return chain;
  },
} as unknown as SupabaseClient;
let successUrl = '';
const provider = {
  createCustomer: async () => 'cus_test',
  createCheckout: async (r: { successUrl: string }) => {
    successUrl = r.successUrl;
    return { url: 'https://checkout.stripe.com/c/pay/x', checkoutRef: 'cs_test_1' };
  },
} as unknown as PaymentProvider;
const buy = (productId: string, spread: string) =>
  createTestCheckout({
    request: new Request('https://yuelao.example/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, currency: 'HKD', locale: 'zh-Hant', from: 'market', spread }),
    }),
    site,
    provider,
    database: db,
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' },
    baseUrl: 'https://yuelao.example',
  });
assert.equal((await buy('love_1', key)).status, 201);
assert.match(successUrl, /\/market#bazi$/);
assert.equal((await buy('match_1', key)).status, 400);
assert.equal((await buy('love_1', `match:01_03,07_11|${h}`)).status, 400);
console.log('PASS: love_1 only buys a love chart and returns to the stall');
