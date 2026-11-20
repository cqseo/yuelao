// 付費解籤第二版：籤內容來自籤頁（不是資料庫舊籤文）、版本切換、站長預覽。全離線（假模型、假資料庫）。
import assert from 'node:assert/strict';
import {
  generatePaidReading,
  previewReadingRequest,
  READING_INSTRUCTIONS,
  READING_INSTRUCTIONS_V1,
  READING_INSTRUCTIONS_V2,
  readingInstructions,
  readingUserInput,
} from '../packages/core/src/ai-reading';
import type { CoreEnv } from '../packages/core/src/env';
import { stickContext } from '../sites/yuelao/src/ritual/stick-context';
import { stickById } from '../sites/yuelao/src/ritual/sticks';

const HEADINGS = [
  '【這支籤對你這件事的定調】',
  '【原典給你的提示】',
  '【對著你的問題】',
  '【眼下該做與不該做】',
  '【對方那一邊】',
  '【三天內可以做的一步】',
  '【留給你的一句話】',
];

// 版本
assert.equal(READING_INSTRUCTIONS, READING_INSTRUCTIONS_V1, 'old name stays v1');
assert.equal(readingInstructions(undefined), READING_INSTRUCTIONS_V1);
assert.equal(readingInstructions('1'), READING_INSTRUCTIONS_V1);
assert.equal(readingInstructions('2'), READING_INSTRUCTIONS_V2);
for (const h of HEADINGS) {
  assert.ok(READING_INSTRUCTIONS_V1.includes(h), `v1 ${h}`);
  assert.ok(READING_INSTRUCTIONS_V2.includes(h), `v2 ${h}`);
}
assert.ok(READING_INSTRUCTIONS_V2.includes('籤詩解讀供自我反思，不代表現實預測。'));
console.log('PASS: prompt versions keep the seven promised headings');

// 籤內容 = 籤頁上的那一份（第 67 支：資料庫是舊籤「心病還須心藥醫」）
const s67 = stickContext(67, 'reunion', 'zh-Hant');
assert.ok(s67);
assert.equal(s67.poem, stickById(67)!.poem);
assert.ok(!s67.poem.includes('心病還須心藥醫'), 'not the old DB poem');
assert.equal(s67.verdict, stickById(67)!.verdict.reunion);
assert.ok(s67.plain && s67.origin && s67.love && s67.actions && s67.practice, 'full context');
for (let id = 1; id <= 100; id++)
  for (const c of ['him', 'single', 'reunion'] as const)
    for (const l of ['zh-Hant', 'zh-Hans'] as const) assert.ok(stickContext(id, c, l)?.poem, `stick ${id}`);
assert.equal(stickContext(999, 'him', 'zh-Hant'), null);
console.log('PASS: site provides the shown stick content for all 100 sticks');

const input = {
  stickId: 67,
  category: 'reunion' as const,
  locale: 'zh-Hant' as const,
  question: '［想復合］分開半年，還有機會嗎',
};
const data = JSON.parse(readingUserInput(input, s67));
assert.equal(data.stick.poem, s67.poem);
assert.equal(data.stick.plainMeaning, s67.plain);
assert.equal(data.free.threeDays, s67.actions);
assert.equal(data.freeVerdict, s67.verdict, 'v1 field still sent');
assert.match(data.category, /複合/);
console.log('PASS: model input carries poem, source, plain, origin, love and free advice');

// 付費生成：有站點內容就不碰資料庫的 sticks 表，且用指定版本
const KEY = 'relay-test-key-0123456789abcdef';
let sent: { system: string; user: string } | null = null;
const fakeModel = (async (_url: string, init: RequestInit) => {
  const b = JSON.parse(String(init.body));
  sent = { system: b.messages[0].content, user: b.messages[1].content };
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: HEADINGS.map((h) => `${h}\n${'籤意內文。'.repeat(30)}`).join('\n') } }],
    }),
  );
}) as unknown as typeof fetch;
const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const calls: string[] = [];
const db = {
  rpc: async (name: string) => {
    calls.push(name);
    if (name === 'claim_paid_ai_reading')
      return { data: { state: 'claimed', claimId: uuid(1), unlockId: uuid(2) }, error: null };
    return { data: true, error: null };
  },
  from: (table: string) => {
    calls.push(`from:${table}`);
    throw new Error('should not read DB sticks');
  },
};
const res = await generatePaidReading({
  // biome-ignore lint/suspicious/noExplicitAny: fake client for an offline test
  database: db as any,
  user: { id: uuid(3), email: null, guest: true },
  input,
  apiKey: KEY,
  model: 'deepseek-v4.1-flash',
  baseUrl: 'https://relay.example.com/v1',
  fetchImpl: fakeModel,
  stickContext,
  instructions: READING_INSTRUCTIONS_V2,
});
assert.equal(res.status, 200);
assert.deepEqual(calls, ['claim_paid_ai_reading', 'finish_paid_ai_reading']);
assert.ok(sent);
assert.equal(sent!.system, READING_INSTRUCTIONS_V2);
assert.equal(JSON.parse(sent!.user).stick.poem, s67.poem);
console.log('PASS: paid reading uses the site stick, never the old DB poem');

// 站長預覽：不存資料，版本照指定
const env = {
  AI_ENABLE_TEST_GENERATION: 'true',
  OPENAI_API_KEY: KEY,
  OPENAI_MODEL: 'deepseek-v4.1-flash',
  OPENAI_BASE_URL: 'https://relay.example.com/v1',
} as unknown as CoreEnv;
const post = (body: unknown, origin = 'https://yuelao.test') =>
  new Request('https://yuelao.test/api/admin/reading-preview', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
for (const v of [1, 2]) {
  const r = await previewReadingRequest(post({ ...input, version: v }), env, stickContext, fakeModel);
  assert.equal(r.status, 200);
  const out = (await r.json()) as { version: string; body: string };
  assert.equal(out.version, String(v));
  assert.equal(sent!.system, v === 2 ? READING_INSTRUCTIONS_V2 : READING_INSTRUCTIONS_V1);
}
assert.equal(
  (await previewReadingRequest(post(input, 'https://evil.test'), env, stickContext, fakeModel)).status,
  403,
);
assert.equal(
  (await previewReadingRequest(post({ ...input, stickId: 0 }), env, stickContext, fakeModel)).status,
  400,
);
assert.equal(
  (
    await previewReadingRequest(
      post(input),
      { ...env, AI_ENABLE_TEST_GENERATION: 'false' },
      stickContext,
      fakeModel,
    )
  ).status,
  503,
);
console.log('PASS: admin preview generates either version without saving');

// 第三版（2026-11-20）：第二版＋「說中」的寫法；塔羅、算命攤、財神殿同一個開關
{
  const ai = await import('../packages/core/src/ai-reading');
  const sr = await import('../packages/core/src/spread-reading');
  const { parseSpread } = await import('../packages/core/src/spread');
  assert.equal(ai.readingInstructions('3'), ai.READING_INSTRUCTIONS_V3);
  assert.ok(ai.READING_INSTRUCTIONS_V3.startsWith(ai.READING_INSTRUCTIONS_V2));
  assert.match(ai.READING_INSTRUCTIONS_V3, /每個判斷都要有出處/);
  assert.match(ai.RESONANCE_RULES, /不要捏造他沒說過的具體經歷/);
  assert.match(ai.RESONANCE_RULES, /不說日期/);
  const sp = parseSpread('match:01_03,07_11|0123456789abcdef')!;
  assert.ok(!sr.spreadInstructions(sp).includes('說中了'));
  assert.ok(sr.spreadInstructions(sp, true).includes('說中了'));
  assert.match(
    ai.nowContext(new Date('2026-11-20T05:00:00Z')),
    /^2026 年 11 月中旬（秋冬之交，離年底和春節不遠）$/,
  );
  console.log('PASS: v3 adds the resonance rules to every paid reading behind one switch');
}
