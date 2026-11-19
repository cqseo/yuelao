// 算命攤．八字命盤：四柱、五行、配偶星、識別字串、付費提示、結帳。全離線。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { baziChart, baziIds, baziLines, parseBaziIds, pillarName, roleOf } from '../packages/core/src/bazi';
import { createTestCheckout } from '../packages/core/src/billing/checkout';
import type { PaymentProvider } from '../packages/core/src/billing/provider';
import { parseSpread } from '../packages/core/src/spread';
import {
  BAZI_INSTRUCTIONS,
  parseSpreadGeneration,
  spreadUserInput,
} from '../packages/core/src/spread-reading';
import site from '../sites/yuelao/site.config';
import { baziKey, baziOf } from '../sites/yuelao/src/ritual/match';

// 1990-07-10 未時：庚午 癸未 丙子 乙未（萬年曆）
const b = baziOf('1990-07-10', 7, 'f', 2026);
assert.ok(b);
assert.deepEqual([b.year, b.month, b.day, b.hour!].map(pillarName), ['庚午', '癸未', '丙子', '乙未']);
// 1995-02-03 子時：立春前仍是甲戌年；子時以零點換日
const c2 = baziOf('1995-02-03', 0, 'm', 2026);
assert.equal(pillarName(c2!.year), '甲戌');
assert.equal(baziOf('1990-07-10', null, 'n', 2026)?.hour, null);
assert.equal(baziOf('1990-02-30', null, 'n', 2026), null);
console.log('PASS: four pillars from the calendar (立春 year, 子時 at midnight)');

const c = baziChart(b);
assert.equal(c.dayMaster, '火');
assert.deepEqual(c.counts, { 木: 1, 火: 2, 土: 2, 金: 1, 水: 2 });
assert.deepEqual(c.missing, []);
assert.deepEqual(c.spouseStars, ['水'], 'female: 官殺 is what controls the day master');
assert.equal(c.spouseStarCount, 2);
assert.equal(c.title, '熱烈真誠');
assert.equal(c.strength, '中和', '未 holds 丁 and 乙 that help 丙; 月令 weighs double');
assert.equal(c.flowRole, '比劫', '2026 丙 is fire, same as 丙 day master');
assert.equal(roleOf('木', '水'), '印');
assert.equal(roleOf('木', '火'), '食傷');
assert.equal(roleOf('木', '土'), '財');
assert.equal(roleOf('木', '金'), '官殺');
assert.deepEqual(baziChart({ ...b, gender: 'm' }).spouseStars, ['金']);
assert.deepEqual(baziChart({ ...b, gender: 'n' }).spouseStars, ['水', '金']);
assert.equal(baziLines(c).length, 4);
console.log('PASS: elements, spouse stars and flow-year role');

const ids = baziIds(b);
assert.equal(ids, '6g,9h,2a,1h_2026_f');
assert.deepEqual(parseBaziIds(ids), b);
assert.equal(parseBaziIds('6g,9h,2a,xx_2026_n')?.hour, null);
assert.equal(parseBaziIds('6h,9h,2a,xx_2026_n'), null, '庚未 is not a real pillar');
assert.equal(parseBaziIds('6g,9h,2a,xx_2026_x'), null);
assert.equal(parseBaziIds('6g,9h,2a_2026_f'), null);
const k = await baziKey('1990-07-10', 7, 'f', 2026, 'single', '明年會遇到人嗎');
assert.match(k ?? '', /^bazi:6g,9h,2a,1h_2026_f\|[0-9a-f]{16}$/);
assert.ok(parseSpread(k));
console.log('PASS: bazi keys are strictly shaped and carry no birthday');

const input = parseSpreadGeneration({
  spread: k,
  locale: 'zh-Hant',
  consent: true,
  question: '明年會遇到人嗎',
  sit: 'single',
});
assert.ok(input);
const sent = JSON.parse(spreadUserInput(input));
assert.equal(sent.chart.pillars.day, '丙子');
assert.equal(sent.chart.gender, '女');
assert.equal(sent.chart.thisYear.ganzhi, '丙午');
assert.ok(!/1990|07-10/.test(JSON.stringify(sent)), 'no birthday in the prompt');
assert.match(BAZI_INSTRUCTIONS, /不說「剋夫」/);
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
assert.equal((await buy('bazi_1', k!)).status, 201);
assert.match(successUrl, /\/market#bazi$/);
assert.equal((await buy('love_1', k!)).status, 400);
assert.equal((await buy('bazi_1', 'love:07_04_2026|0123456789abcdef')).status, 400);
console.log('PASS: bazi_1 only buys a bazi chart and returns to the stall');

// 主題（2026-11-19）：事業、財運、年運；舊的感情識別字串不變
{
  const { reportYear } = await import('../sites/yuelao/src/ritual/match');
  assert.equal(reportYear(new Date(2026, 10, 19)), 2027, 'from October, the report is for next year');
  assert.equal(reportYear(new Date(2027, 0, 20)), 2027, 'before 立春 it is still the coming year');
  assert.equal(reportYear(new Date(2027, 5, 1)), 2027);
  const love = baziOf('1990-07-10', 7, 'f', 2026)!;
  assert.equal(baziIds(love), '6g,9h,2a,1h_2026_f', 'love keys keep the phase-3 shape');
  const career = baziOf('1990-07-10', 7, 'f', 2026, 'career')!;
  assert.equal(baziIds(career), '6g,9h,2a,1h_2026_f_c');
  assert.equal(parseBaziIds('6g,9h,2a,1h_2026_f_c')?.topic, 'career');
  assert.equal(parseBaziIds('6g,9h,2a,1h_2026_f_x'), null);
  const cc = baziChart(career);
  assert.deepEqual(cc.roles, { 比劫: 2, 印: 1, 食傷: 2, 財: 1, 官殺: 2 });
  assert.equal(cc.title, '可擔大任');
  assert.equal(baziChart({ ...career, topic: 'wealth' }).title, '才藝生財', '食傷 2 generates wealth');
  const yr = baziChart(baziOf('1990-07-10', 7, 'f', 2027, 'year')!);
  assert.equal(yr.flowRole, '比劫', '2027 丁 is fire like 丙');
  assert.equal(yr.title, '同氣相求');
  assert.equal(yr.flowToZodiac, '六合', '2027 未 and 午 combine');
  assert.equal(yr.flowToDay, '六害', '未 and 子 harm');
  for (const t of ['career', 'wealth', 'year'] as const)
    assert.ok(baziLines(baziChart({ ...career, topic: t })).every((l) => l.text.length > 10));

  const ky = await baziKey('1990-07-10', 7, 'f', 2027, 'single', '', 'year');
  assert.match(ky ?? '', /^bazi:6g,9h,2a,1h_2027_f_y\|/);
  const kc = await baziKey('1990-07-10', 7, 'f', 2026, 'single', '', 'career');
  assert.notEqual(kc, await baziKey('1990-07-10', 7, 'f', 2026, 'single', '', 'love'));
  const inY = parseSpreadGeneration({ spread: ky, locale: 'zh-Hant', consent: true, sit: 'single' })!;
  const sentY = JSON.parse(spreadUserInput(inY));
  assert.equal(sentY.chart.topic, '年運');
  assert.equal(sentY.chart.thisYear.ganzhi, '丁未');
  const { BAZI_YEAR_INSTRUCTIONS, BAZI_WEALTH_INSTRUCTIONS } = await import(
    '../packages/core/src/spread-reading'
  );
  assert.match(BAZI_WEALTH_INSTRUCTIONS, /不提任何股票/);
  assert.match(BAZI_YEAR_INSTRUCTIONS, /【上半年與下半年】/);

  assert.equal((await buy('year_1', ky!)).status, 201, 'a year report is bought with year_1');
  assert.equal((await buy('bazi_1', ky!)).status, 400, 'bazi_1 cannot buy a year report');
  assert.equal((await buy('year_1', kc!)).status, 400, 'year_1 cannot buy a career reading');
  assert.equal((await buy('bazi_1', kc!)).status, 201);
  console.log('PASS: career, wealth and year topics; year_1 only buys the year report');
}
