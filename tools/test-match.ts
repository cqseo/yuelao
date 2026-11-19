// 算命攤．合緣配對：生肖關係、星座、識別字串、付費提示、結帳只收對應商品。全離線。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTestCheckout } from '../packages/core/src/billing/checkout';
import type { PaymentProvider } from '../packages/core/src/billing/provider';
import {
  matchIds,
  matchOf,
  matchTitle,
  signOf,
  signRelation,
  zodiacRelation,
} from '../packages/core/src/match';
import { parseSpread } from '../packages/core/src/spread';
import {
  MATCH_INSTRUCTIONS,
  parseSpreadGeneration,
  SPREAD_INSTRUCTIONS,
  spreadUserInput,
} from '../packages/core/src/spread-reading';
import site from '../sites/yuelao/site.config';
import { personOf, zodiacOf } from '../sites/yuelao/src/ritual/match';

// 生肖：1 鼠 … 12 豬
const Z = (name: string) => '鼠牛虎兔龍蛇馬羊猴雞狗豬'.indexOf(name) + 1;
const rel = (a: string, b: string) => zodiacRelation(Z(a), Z(b));
assert.equal(rel('鼠', '牛'), 'liuhe');
assert.equal(rel('虎', '豬'), 'liuhe');
assert.equal(rel('蛇', '猴'), 'liuhe', '巳申 is both 合 and 刑; 合 wins');
assert.equal(rel('猴', '龍'), 'sanhe');
assert.equal(rel('兔', '羊'), 'sanhe');
assert.equal(rel('鼠', '馬'), 'chong');
assert.equal(rel('虎', '猴'), 'chong', '寅申 is both 沖 and 刑; 沖 wins');
assert.equal(rel('牛', '羊'), 'chong');
assert.equal(rel('虎', '蛇'), 'hai', '寅巳 is both 害 and 刑; 害 wins');
assert.equal(rel('鼠', '羊'), 'hai');
assert.equal(rel('鼠', '兔'), 'xing');
assert.equal(rel('牛', '狗'), 'xing');
assert.equal(rel('龍', '龍'), 'same');
assert.equal(rel('鼠', '虎'), 'plain');
// 每一組都有答案，而且對稱
for (let a = 1; a <= 12; a++)
  for (let b = 1; b <= 12; b++) assert.equal(zodiacRelation(a, b), zodiacRelation(b, a));
console.log('PASS: zodiac relations follow 合 > 三合 > 沖 > 害 > 刑 > 同肖 > 平, symmetrically');

// 星座分界
const S = (m: number, d: number) => signOf(m, d);
assert.deepEqual(
  [
    S(1, 19),
    S(1, 20),
    S(2, 18),
    S(2, 19),
    S(3, 20),
    S(3, 21),
    S(6, 21),
    S(7, 23),
    S(12, 21),
    S(12, 22),
    S(12, 31),
  ],
  [10, 11, 11, 12, 12, 1, 4, 5, 9, 10, 10],
);
assert.equal(signRelation(1, 5), 'same', '牡羊+獅子 fire');
assert.equal(signRelation(1, 3), 'comp', 'fire+air');
assert.equal(signRelation(2, 4), 'comp', 'earth+water');
assert.equal(signRelation(1, 4), 'rub', 'fire+water');
assert.equal(matchTitle('liuhe', 'comp'), '天作之合');
assert.equal(matchTitle('plain', 'rub'), '慢火細燉');
assert.equal(matchTitle('chong', 'same'), '好事多磨');
assert.equal(matchTitle('sanhe', 'rub'), '相輔相成');
console.log('PASS: star signs and titles');

// 生肖以立春換年（前端用萬年曆）
assert.equal(zodiacOf(1995, 2, 3), Z('狗'), '1995-02-03 is still 甲戌');
assert.equal(zodiacOf(1995, 2, 5), Z('豬'));
assert.equal(zodiacOf(2000, 1, 1), Z('兔'));
assert.equal(zodiacOf(1984, 6, 1), Z('鼠'));
assert.deepEqual(personOf('1995-02-03'), { zodiac: Z('狗'), sign: 11 });
assert.equal(personOf('1995-02-30'), null, 'no such day');
assert.equal(personOf('1800-01-01'), null, 'out of range');
console.log('PASS: client zodiac switches at 立春');

// 識別字串
const h = '0123456789abcdef';
const key = `match:${matchIds({ zodiac: 1, sign: 3 }, { zodiac: 7, sign: 11 })}|${h}`;
assert.equal(key, `match:01_03,07_11|${h}`);
const parsed = parseSpread(key);
assert.ok(parsed && parsed.deck === 'match');
assert.deepEqual(parsed.a, { zodiac: 1, sign: 3 });
assert.equal(parseSpread(`match:13_03,07_11|${h}`), null);
assert.equal(parseSpread(`match:01_00,07_11|${h}`), null);
assert.equal(parseSpread(`match:01_03|${h}`), null);
assert.equal(parseSpread(`match:01_03,07_11,02_02|${h}`), null);
assert.equal(parseSpread(`bazi:01_03,07_11|${h}`), null, 'a match id is not a bazi id');
console.log('PASS: match keys are strictly shaped');

// 付費提示
const input = parseSpreadGeneration({
  spread: key,
  locale: 'zh-Hant',
  consent: true,
  question: '我們會不會一直吵下去',
  sit: 'dating',
});
assert.ok(input);
const sent = JSON.parse(spreadUserInput(input));
assert.equal(sent.match.you.zodiac, '子鼠');
assert.equal(sent.match.partner.zodiac, '午馬');
assert.equal(sent.match.zodiacRelation, '六沖');
assert.equal(sent.match.signRelation, '同頻', '雙子 and 水瓶 are both air');
assert.equal(sent.match.overall, matchOf({ zodiac: 1, sign: 3 }, { zodiac: 7, sign: 11 }).title);
assert.equal(sent.situation, '交往中');
assert.ok(!JSON.stringify(sent).match(/\d{4}-\d\d/), 'no birthday in the prompt');
assert.match(MATCH_INSTRUCTIONS, /不給分數、百分比或成功機率/);
assert.notEqual(MATCH_INSTRUCTIONS, SPREAD_INSTRUCTIONS);
console.log('PASS: the paid prompt carries relations, not birthdays');

// 結帳：match 只用 match_1 買；塔羅只用 spread_1 買
function fakeDb() {
  const tables: string[] = [];
  const db = {
    from(table: string) {
      tables.push(table);
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
  return db;
}
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
    database: fakeDb(),
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' },
    baseUrl: 'https://yuelao.example',
  });
assert.equal((await buy('match_1', key)).status, 201);
assert.match(successUrl, /\/market#bazi$/);
assert.equal((await buy('spread_1', key)).status, 400, 'tarot price cannot buy a match');
assert.equal((await buy('match_1', `lnm:15,19,07|${h}`)).status, 400, 'match price cannot buy tarot');
assert.equal((await buy('spread_1', `lnm:15,19,07|${h}`)).status, 201);
assert.match(successUrl, /\/market#tarot$/);
console.log('PASS: each spread product only buys its own kind and returns to its own room');
