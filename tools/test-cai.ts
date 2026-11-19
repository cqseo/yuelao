// 財神殿．求財籤：籤文完整、識別字串、付費提示帶籤內容、沒有籤內容就不領租約、結帳只收 cai_1。全離線。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTestCheckout } from '../packages/core/src/billing/checkout';
import type { PaymentProvider } from '../packages/core/src/billing/provider';
import { CAI_STICK_COUNT, parseSpread, spreadProductKind } from '../packages/core/src/spread';
import {
  CAI_INSTRUCTIONS,
  generateSpreadReading,
  parseSpreadGeneration,
  spreadUserInput,
} from '../packages/core/src/spread-reading';
import site from '../sites/yuelao/site.config';
import { CAI_STICKS, caiContext } from '../sites/yuelao/src/ritual/caishen';

assert.equal(CAI_STICKS.length, CAI_STICK_COUNT);
CAI_STICKS.forEach((s, i) => {
  assert.equal(s.no, i + 1);
  assert.equal(s.poem.length, 4, `第 ${s.no} 籤要四句`);
  for (const line of s.poem) assert.equal([...line].length, 7, `第 ${s.no} 籤每句七字：${line}`);
  for (const f of [s.plain, s.career, s.wealth, s.advice]) assert.ok(f.length >= 6, `第 ${s.no} 籤欄位太短`);
});
assert.equal(new Set(CAI_STICKS.map((s) => s.poem.join())).size, CAI_STICKS.length, 'poems are unique');
const grades = CAI_STICKS.reduce<Record<string, number>>(
  (m, s) => ({ ...m, [s.grade]: (m[s.grade] ?? 0) + 1 }),
  {},
);
assert.ok((grades.下籤 ?? 0) <= 6 && (grades.上上 ?? 0) <= 6, JSON.stringify(grades));
console.log('PASS: 36 original sticks, four seven-character lines each', grades);

const h = '0123456789abcdef';
assert.deepEqual(parseSpread(`cai:007_w|${h}`), {
  key: `cai:007_w|${h}`,
  deck: 'cai',
  no: 7,
  topic: 'wealth',
});
assert.equal(parseSpread(`cai:007_c|${h}`)?.deck, 'cai');
assert.equal(parseSpread(`cai:037_w|${h}`), null, 'only 36 sticks');
assert.equal(parseSpread(`cai:000_w|${h}`), null);
assert.equal(parseSpread(`cai:07_w|${h}`), null, 'three digits');
assert.equal(parseSpread(`cai:007_x|${h}`), null);
assert.equal(spreadProductKind(`cai:007_w|${h}`), 'cai');
console.log('PASS: cai keys are strictly shaped');

const input = parseSpreadGeneration({
  spread: `cai:022_c|${h}`,
  locale: 'zh-Hant',
  consent: true,
  question: '明年適合換工作嗎',
});
assert.ok(input);
const sent = JSON.parse(spreadUserInput(input, caiContext));
assert.equal(sent.topic, 'career');
assert.equal(sent.stick.no, 22);
assert.equal(sent.stick.grade, '上上');
assert.match(sent.stick.poem, /寶鼎香煙上九霄/);
assert.match(CAI_INSTRUCTIONS, /不提任何股票/);
assert.match(CAI_INSTRUCTIONS, /本站原創/);
console.log('PASS: the paid prompt carries the stick shown on the page');

const calls: string[] = [];
const db = {
  rpc: async (name: string) => {
    calls.push(name);
    return { data: { state: 'not_unlocked' }, error: null };
  },
} as never;
const user = { id: '00000000-0000-4000-8000-0000000000c1', email: 'a@example.invalid' } as never;
const ai = {
  apiKey: 'sk-test',
  model: 'm',
  baseUrl: null,
  fetchImpl: (async () => new Response('x')) as typeof fetch,
};
assert.equal((await generateSpreadReading(user, input, db, ai)).status, 503, 'no stick context → no claim');
assert.deepEqual(calls, []);
assert.equal((await generateSpreadReading(user, input, db, ai, caiContext)).status, 403);
assert.deepEqual(calls, ['claim_spread_reading']);
console.log('PASS: without stick content the claim is never taken');

const fakeDb = {
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
    database: fakeDb,
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' },
    baseUrl: 'https://yuelao.example',
  });
assert.equal((await buy('cai_1', `cai:007_w|${h}`)).status, 201);
assert.match(successUrl, /\/market#caishen$/);
assert.equal((await buy('spread_1', `cai:007_w|${h}`)).status, 400);
assert.equal((await buy('cai_1', `lnm:15,19,07|${h}`)).status, 400);
console.log('PASS: cai_1 only buys a wealth stick and returns to the shrine');
