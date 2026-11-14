import assert from 'node:assert/strict';
import { parseSpread } from '../packages/core/src/spread';
import {
  generateSpreadReading,
  parseSpreadGeneration,
  SPREAD_INSTRUCTIONS,
  spreadUserInput,
} from '../packages/core/src/spread-reading';
import { drawThree } from '../sites/yuelao/src/ritual/lenormand';
import { drawTarot, TAROT } from '../sites/yuelao/src/ritual/tarot';

const h = '0123456789abcdef';
// 形狀
assert.ok(parseSpread(`tarot:Cups_02,06~,04|${h}`));
assert.ok(parseSpread(`lnm:15,19,07|${h}`));
assert.equal(parseSpread(`tarot:Cups_15,06,04|${h}`), null, 'no 15th rank');
assert.equal(parseSpread(`tarot:22,06,04|${h}`), null, 'no 22nd major');
assert.equal(parseSpread(`tarot:06,06,04|${h}`), null, 'cards must differ');
assert.equal(parseSpread(`tarot:06,04|${h}`), null, 'exactly three');
assert.equal(parseSpread(`lnm:15~,19,07|${h}`), null, 'lenormand has no reversals');
assert.equal(parseSpread(`lnm:37,19,07|${h}`), null, 'only 36 cards');
assert.equal(parseSpread(`lnm:15,19,07|${h.toUpperCase()}`), null, 'lowercase hash');
assert.equal(parseSpread(`lnm:15,19,07`), null, 'hash required');
assert.equal(parseSpread(123), null);
console.log('PASS: spread keys are strictly shaped');

// 前端每一張塔羅牌的檔名都是伺服器認得的牌
for (const c of TAROT)
  assert.ok(
    parseSpread(`tarot:${c.img},${c.img === '00' ? '01' : '00'}~,${c.img === '02' ? '03' : '02'}|${h}`),
    c.img,
  );
// 前端抽出來的任何一把牌都能組成合法的 key
for (let i = 0; i < 200; i++) {
  const t = drawTarot(`q${i}`, 'single', '2026-11-13');
  assert.ok(parseSpread(`tarot:${t.map((d) => d.card.img + (d.rev ? '~' : '')).join(',')}|${h}`));
  const l = drawThree(`q${i}`, 'single', '2026-11-13');
  assert.ok(parseSpread(`lnm:${l.map((d) => String(d.n).padStart(2, '0')).join(',')}|${h}`));
}
console.log('PASS: every client draw maps to a valid server spread key');

// 生成輸入
assert.equal(parseSpreadGeneration({ spread: `lnm:15,19,07|${h}`, locale: 'zh-Hant', consent: false }), null);
assert.equal(
  parseSpreadGeneration({
    spread: `lnm:15,19,07|${h}`,
    locale: 'zh-Hant',
    consent: true,
    question: 'x'.repeat(401),
  }),
  null,
);
const input = parseSpreadGeneration({
  spread: `tarot:Cups_02,06~,04|${h}`,
  locale: 'zh-Hant',
  consent: true,
  question: '他最近忽冷忽熱，這段關係會怎麼走',
  sit: 'crush',
});
assert.ok(input);
const ui = JSON.parse(spreadUserInput(input));
assert.deepEqual(
  ui.cards.map(
    (c: { card: string; position: string; orientation?: string }) => `${c.position}${c.card}${c.orientation}`,
  ),
  ['過去聖杯二正位', '現在戀人逆位', '未來皇帝正位'],
);
assert.equal(ui.situation, '曖昧中');
assert.match(SPREAD_INSTRUCTIONS, /不要提到自己是 AI/);
console.log('PASS: generation input names the cards, positions and orientation');

// 非中文介面：解讀改用該語言寫；清單外的值當沒給
assert.equal(ui.outputLanguage, '繁體中文');
const en = parseSpreadGeneration({ spread: input.spread.key, locale: 'zh-Hant', consent: true, ui: 'en' });
assert.ok(en);
assert.equal(JSON.parse(spreadUserInput(en)).outputLanguage, 'English');
const odd = parseSpreadGeneration({ spread: input.spread.key, locale: 'zh-Hant', consent: true, ui: 'xx' });
assert.equal(odd?.ui, undefined);
assert.match(SPREAD_INSTRUCTIONS, /outputLanguage 不是中文/);
console.log('PASS: spread readings follow the interface language');

// 生成流程：用假的資料庫與假的模型
const body = `【三張牌湊在一起】${'牌面解讀。'.repeat(40)}\n\n牌義解讀供自我反思，不代表現實預測。`;
const user = { id: '00000000-0000-4000-8000-0000000000c1', email: 'a@example.invalid' } as never;
const calls: string[] = [];
function db(claimState: string) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      assert.ok(!JSON.stringify(args).includes('忽冷忽熱'), 'the question never reaches the database');
      if (name === 'claim_spread_reading')
        return {
          data:
            claimState === 'claimed'
              ? {
                  state: 'claimed',
                  claimId: '00000000-0000-4000-8000-00000000aaaa',
                  unlockId: '00000000-0000-4000-8000-00000000bbbb',
                }
              : { state: claimState },
          error: null,
        };
      if (name === 'finish_spread_reading') return { data: true, error: null };
      if (name === 'fail_spread_reading') return { data: true, error: null };
      return { data: null, error: { message: 'unexpected' } };
    },
  } as never;
}
let modelCalls = 0;
const okFetch: typeof fetch = async (_u, o) => {
  modelCalls++;
  const sent = JSON.parse(String(o?.body));
  assert.equal(sent.store, false);
  assert.match(sent.input, /忽冷忽熱/);
  return new Response(
    JSON.stringify({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: body }] }],
    }),
  );
};
const ai = { apiKey: 'sk-test', model: 'test-model', baseUrl: null, fetchImpl: okFetch };

let res = await generateSpreadReading(user, input, db('not_unlocked'), ai);
assert.equal(res.status, 403);
res = await generateSpreadReading(user, input, db('processing'), ai);
assert.equal(res.status, 202);
res = await generateSpreadReading(user, input, db('ready'), ai);
assert.equal(res.status, 200);
assert.equal(modelCalls, 0, 'no model call unless a fresh claim was granted');
console.log('PASS: unpaid, in-progress and finished spreads never call the model');

calls.length = 0;
res = await generateSpreadReading(user, input, db('claimed'), ai);
assert.equal(res.status, 200);
assert.equal(modelCalls, 1);
assert.deepEqual(calls, ['claim_spread_reading', 'finish_spread_reading']);
console.log('PASS: a paid claim generates once and saves');

calls.length = 0;
const badFetch: typeof fetch = async () => new Response('nope', { status: 500 });
res = await generateSpreadReading(user, input, db('claimed'), { ...ai, fetchImpl: badFetch });
assert.equal(res.status, 503);
assert.deepEqual(calls, ['claim_spread_reading', 'fail_spread_reading']);
console.log('PASS: a failed model call releases the claim for a free retry');
