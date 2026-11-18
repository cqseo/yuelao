// 追問月老：輸入檢查、轉介標記、結帳前檢查、生成流程（假資料庫、假模型；全離線）。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoreEnv } from '../packages/core/src/env';
import {
  askFollowupRequest,
  FOLLOWUP_INSTRUCTIONS,
  followupCheckoutBlock,
  followupStatusRequest,
  isRedirect,
  parseFollowupInput,
} from '../packages/core/src/reading-followup';
import { stickContext } from '../sites/yuelao/src/ritual/stick-context';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id: U(1), email: 'a@example.invalid' };
const sel = { stickId: 67, category: 'reunion' as const, locale: 'zh-Hant' as const };

// ---------- 輸入 ----------
assert.ok(parseFollowupInput({ ...sel, question: '  他會回來嗎？ ' }));
assert.equal(parseFollowupInput({ ...sel, question: '  ' }), null, 'empty');
assert.equal(parseFollowupInput({ ...sel, question: 'x'.repeat(201) }), null, 'too long');
assert.equal(parseFollowupInput({ ...sel, stickId: 0, question: 'q' }), null);
assert.equal(parseFollowupInput({ ...sel, ui: 'en', question: 'q' })?.ui, 'en');
assert.equal(parseFollowupInput({ ...sel, ui: 'xx', question: 'q' })?.ui, undefined);
assert.ok(isRedirect('【另求一籤】\n一事一籤'));
assert.ok(isRedirect('  【先照顧自己】\n…'));
assert.ok(!isRedirect('孩子，【另求一籤】不是這樣用的'));
assert.ok(FOLLOWUP_INSTRUCTIONS.includes('【另求一籤】') && FOLLOWUP_INSTRUCTIONS.includes('【先照顧自己】'));
console.log('PASS: follow-up input and redirect markers');

// ---------- 假資料庫 ----------
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>, rpc: (name: string, args: Row) => unknown) {
  const calls: string[] = [];
  const db = {
    calls,
    rpc: async (name: string, args: Row) => {
      calls.push(name);
      return { data: rpc(name, args), error: null };
    },
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let head = false;
      const q = {
        select(_c: string, opts?: { head?: boolean }) {
          head = Boolean(opts?.head);
          return q;
        },
        eq(k: string, v: unknown) {
          rows = rows.filter((r) => r[k] === v);
          return q;
        },
        gte(k: string, v: string) {
          rows = rows.filter((r) => String(r[k]) >= v);
          return q;
        },
        order() {
          return q;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then(res: (v: unknown) => void) {
          res(head ? { count: rows.length, error: null } : { data: rows, error: null });
        },
      };
      return q;
    },
  };
  return db as typeof db & SupabaseClient;
}
const unlock = {
  id: U(10),
  user_id: user.id,
  stick_id: 67,
  category: 'reunion',
  locale: 'zh-Hant',
  revoked: false,
};
const reading = {
  unlock_id: U(10),
  user_id: user.id,
  status: 'ready',
  body: '【這支籤對你這件事的定調】\n要看清。',
};
const now = new Date().toISOString();
const fu = (n: number, status: string, body: string | null = null) => ({
  id: U(100 + n),
  unlock_id: U(10),
  user_id: user.id,
  revoked: false,
  status,
  body,
  answered_at: body ? now : null,
});
const pendingOrder = {
  id: U(200),
  user_id: user.id,
  followup_unlock: U(10),
  status: 'pending',
  created_at: now,
};

// ---------- 結帳前檢查 ----------
const block = async (t: Record<string, Row[]>) =>
  followupCheckoutBlock(
    fakeDb(t, () => null),
    user,
    sel,
  );
assert.deepEqual(await block({ unlocks: [], paid_ai_readings: [] }), {
  error: 'reading_not_unlocked',
  status: 403,
});
assert.deepEqual(
  await block({ unlocks: [unlock], paid_ai_readings: [{ ...reading, status: 'failed', body: null }] }),
  {
    error: 'reading_not_ready',
    status: 409,
  },
);
assert.deepEqual(
  await block({ unlocks: [unlock], paid_ai_readings: [reading], reading_followups: [fu(1, 'open')] }),
  {
    error: 'followup_credit_open',
    status: 409,
  },
);
const two = [fu(1, 'ready', 'a'.repeat(80)), fu(2, 'ready', 'b'.repeat(80))];
assert.deepEqual(await block({ unlocks: [unlock], paid_ai_readings: [reading], reading_followups: two }), {
  unlockId: U(10),
});
assert.deepEqual(
  await block({
    unlocks: [unlock],
    paid_ai_readings: [reading],
    reading_followups: two,
    orders: [pendingOrder],
  }),
  { error: 'followup_limit', status: 409 },
  'a checkout in progress holds the last slot',
);
console.log('PASS: checkout needs a ready reading, no unused credit and a free slot');

// ---------- 生成 ----------
const env = {
  AI_ENABLE_TEST_GENERATION: 'true',
  OPENAI_API_KEY: 'relay-test-key-0123456789abcdef',
  OPENAI_MODEL: 'deepseek-v4.1-flash',
  OPENAI_BASE_URL: 'https://relay.example.com/v1',
} as unknown as CoreEnv;
const post = (body: unknown) =>
  new Request('https://yuexia.app/api/account/followups/ask', {
    method: 'POST',
    headers: { origin: 'https://yuexia.app', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
let sent: { system: string; user: Record<string, unknown> } | null = null;
const model = (reply: string) =>
  (async (_u: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body));
    sent = { system: b.messages[0].content, user: JSON.parse(b.messages[1].content) };
    return new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }));
  }) as unknown as typeof fetch;
const claimed = { state: 'claimed', claimId: U(300), followupId: U(101) };
const answer = '孩子，茍有可觀，皆有可樂。'.repeat(12);

{
  const db = fakeDb(
    {
      unlocks: [unlock],
      paid_ai_readings: [reading],
      reading_followups: [fu(1, 'generating'), fu(0, 'ready', 'earlier answer '.repeat(6))],
    },
    (name) => (name === 'claim_reading_followup' ? claimed : true),
  );
  const res = await askFollowupRequest(
    post({ ...sel, question: '他會回來嗎' }),
    db,
    user,
    env,
    stickContext,
    model(answer),
  );
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { status: string }).status, 'ready');
  assert.deepEqual(db.calls, ['claim_reading_followup', 'finish_reading_followup']);
  assert.equal(sent!.system, FOLLOWUP_INSTRUCTIONS);
  assert.equal(sent!.user.reading, reading.body, 'the paid reading is the context');
  assert.equal((sent!.user.stick as { poem: string }).poem, stickContext(67, 'reunion', 'zh-Hant')!.poem);
  assert.equal((sent!.user.earlierAnswers as string[]).length, 1);
  assert.equal(sent!.user.questionUntrusted, '他會回來嗎');
  console.log('PASS: a follow-up answer uses the stick, the paid reading and earlier answers, then saves');
}
{
  const db = fakeDb({ unlocks: [unlock], paid_ai_readings: [reading], reading_followups: [] }, (name) =>
    name === 'claim_reading_followup' ? claimed : true,
  );
  const res = await askFollowupRequest(
    post({ ...sel, question: '我下個月考試會過嗎' }),
    db,
    user,
    env,
    stickContext,
    model(`【另求一籤】\n${'一事一籤，考試的事要另外到殿前求一支籤來問。'.repeat(4)}`),
  );
  const out = (await res.json()) as { status: string };
  assert.equal(out.status, 'redirected');
  assert.deepEqual(db.calls, ['claim_reading_followup', 'release_reading_followup'], 'credit goes back');
  console.log('PASS: another matter is redirected and the credit is kept');
}
{
  const db = fakeDb({ unlocks: [unlock], paid_ai_readings: [reading], reading_followups: [] }, (name) =>
    name === 'claim_reading_followup' ? claimed : true,
  );
  const broken = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
  const res = await askFollowupRequest(post({ ...sel, question: 'q' }), db, user, env, stickContext, broken);
  assert.equal(res.status, 503);
  assert.deepEqual(db.calls, ['claim_reading_followup', 'release_reading_followup']);
  console.log('PASS: a failed model call keeps the credit');
}
{
  const db = fakeDb({ unlocks: [unlock], paid_ai_readings: [reading] }, () => ({ state: 'no_credit' }));
  const res = await askFollowupRequest(
    post({ ...sel, question: 'q' }),
    db,
    user,
    env,
    stickContext,
    model(answer),
  );
  assert.equal(res.status, 402);
  const none = await askFollowupRequest(
    post({ ...sel, question: 'q' }),
    fakeDb({ unlocks: [] }, () => null),
    user,
    env,
    stickContext,
    model(answer),
  );
  assert.equal(none.status, 403);
  const foreign = new Request('https://yuexia.app/api/account/followups/ask', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ ...sel, question: 'q' }),
  });
  assert.equal((await askFollowupRequest(foreign, db, user, env, stickContext, model(answer))).status, 403);
  assert.equal(
    (await askFollowupRequest(post({ ...sel, question: 'q' }), db, null, env, stickContext, model(answer)))
      .status,
    401,
  );
  console.log('PASS: no unpaid, foreign-origin or signed-out questions');
}
{
  const db = fakeDb(
    {
      unlocks: [unlock],
      paid_ai_readings: [reading],
      reading_followups: [fu(1, 'open'), fu(2, 'ready', 'answer '.repeat(12))],
    },
    () => null,
  );
  const res = await followupStatusRequest(
    new Request('https://yuexia.app/api/account/followups?stickId=67&category=reunion&locale=zh-Hant'),
    db,
    user,
    env,
  );
  const s = (await res.json()) as {
    open: number;
    remaining: number;
    answers: unknown[];
    readingReady: boolean;
  };
  assert.deepEqual([s.open, s.remaining, s.answers.length, s.readingReady], [1, 1, 1, true]);
  console.log('PASS: status reports open, remaining and answered');
}
