import assert from 'node:assert/strict';
import {
  aiGenerationEnabled,
  generatePaidReading,
  generateWithOpenAI,
  parseGenerationInput,
} from '../packages/core/src/ai-reading';

const report = [
  '籤詩意象：這支籤的象徵，是把不確定感轉化成具體的溝通問題，不是對未來的保證。',
  '關係觀察：從對方是否尊重你們的約定、是否願意傾聽等事實出發，避免替別人的心思下定論。',
  '可以嘗試的一步：選一個平靜的時刻，以自己的感受和需求開始對話。',
  '界線提醒：尊重他人的拒絕，也保留自己的獨立生活。此解讀是 AI 生成的文化與自我反思內容，不代表現實預測。',
].join('\n\n');
assert.ok(report.length > 100);
assert.equal(parseGenerationInput({ stickId: 1, category: 'him', locale: 'zh-Hant', consent: false }), null);
assert.equal(
  parseGenerationInput({
    stickId: 1,
    category: 'him',
    locale: 'zh-Hant',
    consent: true,
    question: 'x'.repeat(401),
  }),
  null,
);
assert.equal(parseGenerationInput({ stickId: 101, category: 'him', locale: 'zh-Hant', consent: true }), null);
assert.equal(
  parseGenerationInput({ stickId: 1, category: 'him', locale: 'zh-Hant', consent: true })?.question,
  '',
);
assert.equal(
  aiGenerationEnabled({
    AI_ENABLE_TEST_GENERATION: 'false',
    OPENAI_API_KEY: 'sk-test',
    OPENAI_MODEL: 'test-model',
  } as never),
  false,
);
assert.equal(
  aiGenerationEnabled({
    AI_ENABLE_TEST_GENERATION: 'true',
    OPENAI_API_KEY: 'sk-test',
    OPENAI_MODEL: 'test-model',
  } as never),
  true,
);
console.log('PASS: opt-in, strict selectors, length limits and default-off gate');

const input = {
  stickId: 1,
  category: 'him' as const,
  locale: 'zh-Hant' as const,
  question: '如何在不施壓的情況下談談？',
};
let called = 0;
const mockFetch: typeof fetch = async (url, options) => {
  called++;
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal((options!.headers as Record<string, string>).authorization, 'Bearer sk-test');
  const body = JSON.parse(options?.body as string);
  assert.equal(body.store, false);
  assert.equal(body.model, 'test-model');
  assert.equal(body.max_output_tokens, 1600);
  assert.equal(body.input.includes(input.question), true);
  assert.equal(typeof body.instructions, 'string');
  assert.equal(body.instructions.includes('不診斷'), true);
  return new Response(
    JSON.stringify({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: report }] }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};
const output = await generateWithOpenAI(
  input,
  { no: '第一籤', grade: '中平籤', poem: '詩文', verdict: '白話判詞' },
  'sk-test',
  'test-model',
  mockFetch,
);
assert.equal(output, report);
console.log('PASS: OpenAI response parsed, store=false, system safety prompt and no real network calls');

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' };
const claimId = '00000000-0000-4000-8000-000000000020';
const unlockId = '00000000-0000-4000-8000-000000000021';
let failCount = 0;
let storedText = '';
let currentState = 'claimed';
const database = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'claim_paid_ai_reading')
      return {
        data: currentState === 'claimed' ? { state: 'claimed', claimId, unlockId } : { state: currentState },
        error: null,
      };
    if (name === 'finish_paid_ai_reading') {
      assert.equal(args.p_user_id, user.id);
      assert.equal(args.p_unlock_id, unlockId);
      storedText = args.p_body as string;
      assert.equal('p_question' in args, false);
      return { data: true, error: null };
    }
    if (name === 'fail_paid_ai_reading') {
      failCount++;
      return { data: true, error: null };
    }
    throw Error(`unexpected rpc ${name}`);
  },
  from: (name: string) => {
    if (name !== 'sticks') throw Error(`unexpected table: ${name}`);
    return {
      select: (_fields: string) => ({
        eq: (_key: string, _value: unknown) => ({
          single: async () => ({
            data: {
              no: '第一籤',
              grade: '中平籤',
              poem: '詩文',
              verdict_him: '白話判詞',
              verdict_single: '單身白話',
              verdict_reunion: '復合白話',
            },
            error: null,
          }),
        }),
      }),
    };
  },
} as never;
const result = await generatePaidReading({
  user,
  input,
  database,
  apiKey: 'sk-test',
  model: 'test-model',
  fetchImpl: mockFetch,
});
assert.equal(result.status, 200);
assert.equal((await result.json()).status, 'ready');
assert.equal(storedText, report);
assert.equal(called, 2);
assert.equal(failCount, 0);
console.log('PASS: authorized claimed report generated once and only output persisted');

currentState = 'processing';
const busy = await generatePaidReading({
  user,
  input,
  database,
  apiKey: 'sk-test',
  model: 'test-model',
  fetchImpl: mockFetch,
});
assert.equal(busy.status, 202);
assert.equal(called, 2);
currentState = 'ready';
const ready = await generatePaidReading({
  user,
  input,
  database,
  apiKey: 'sk-test',
  model: 'test-model',
  fetchImpl: mockFetch,
});
assert.equal(ready.status, 200);
assert.equal(called, 2);
currentState = 'not_unlocked';
const denied = await generatePaidReading({
  user,
  input,
  database,
  apiKey: 'sk-test',
  model: 'test-model',
  fetchImpl: mockFetch,
});
assert.equal(denied.status, 403);
assert.equal(called, 2);
console.log('PASS: processing/ready/revoked states never spend extra AI tokens');

currentState = 'claimed';
const failingFetch: typeof fetch = async () => new Response('unavailable', { status: 500 });
const failed = await generatePaidReading({
  user,
  input,
  database,
  apiKey: 'sk-test',
  model: 'test-model',
  fetchImpl: failingFetch,
});
assert.equal(failed.status, 503);
assert.equal(failCount, 1);
console.log('PASS: failed provider request releases generation claim for retry');
