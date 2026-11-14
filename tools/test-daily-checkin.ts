import assert from 'node:assert/strict';
import { dailyCheckinRequest } from '../packages/core/src/daily-checkin';
import { emptyDailyRecord, syncDailyRecord } from '../sites/yuelao/src/site/daily';

// 每日簽到 API：未登入 401、資料庫不可用 503、GET 形狀、POST 同源與 JSON、補登上限、壞日期。
const user = { id: '00000000-0000-4000-8000-0000000000d1', email: 'a@example.invalid' } as never;
type Call = { fn: string; args: Record<string, unknown> };
const fakeDb = (reply: unknown, calls: Call[] = []) =>
  ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: reply, error: null };
    },
  }) as never;
const state = { streak: 3, lastDate: '2026-11-14', checkedDates: ['2026-11-12', '2026-11-13', '2026-11-14'] };
const origin = 'https://yuelao.example';
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}/api/account/daily`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

(async () => {
  let r = await dailyCheckinRequest(
    new Request(`${origin}/api/account/daily?today=2026-11-14`),
    fakeDb(state),
    null,
  );
  assert.equal(r.status, 401);
  r = await dailyCheckinRequest(new Request(`${origin}/api/account/daily?today=2026-11-14`), null, user);
  assert.equal(r.status, 503);
  console.log('PASS: guest gets 401, missing database gets 503');

  const calls: Call[] = [];
  r = await dailyCheckinRequest(
    new Request(`${origin}/api/account/daily?today=2026-11-14`),
    fakeDb(state, calls),
    user,
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), state);
  assert.equal(calls[0]?.fn, 'daily_checkin_state');
  assert.equal(calls[0]?.args.p_user_id, user.id);
  r = await dailyCheckinRequest(new Request(`${origin}/api/account/daily?today=nope`), fakeDb(state), user);
  assert.equal(r.status, 400);
  console.log('PASS: GET returns the state for the signed-in user only; bad day is 400');

  r = await dailyCheckinRequest(
    post({ today: '2026-11-14', check: true }, { origin: 'https://evil.example' }),
    fakeDb(state),
    user,
  );
  assert.equal(r.status, 403);
  r = await dailyCheckinRequest(
    post({ today: '2026-11-14', check: true }, { 'content-type': 'text/plain' }),
    fakeDb(state),
    user,
  );
  assert.equal(r.status, 403);
  console.log('PASS: POST needs same origin and JSON');

  const c2: Call[] = [];
  const many = Array.from({ length: 50 }, (_, i) => `2026-10-${String((i % 28) + 1).padStart(2, '0')}`);
  r = await dailyCheckinRequest(
    post({ today: '2026-11-14', check: true, backfill: [...many, 'x', 7] }),
    fakeDb(state, c2),
    user,
  );
  assert.equal(r.status, 200);
  assert.equal(c2[0]?.fn, 'record_daily_checkin');
  assert.equal(c2[0]?.args.p_check, true);
  const bf = c2[0]?.args.p_backfill;
  assert.ok(Array.isArray(bf));
  assert.equal(bf.length, 30, 'backfill capped at 30, junk dropped');
  console.log('PASS: POST records with check flag and a capped, cleaned backfill');

  r = await dailyCheckinRequest(
    post({ today: '2026-11-20', check: true }),
    fakeDb({ error: 'invalid_day' }),
    user,
  );
  assert.equal(r.status, 400);
  console.log('PASS: a day the database rejects comes back as 400');

  // 前端：沒登入（401 且換不到新登入）回 null，照舊用瀏覽器紀錄
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) =>
    new Response('{}', { status: String(url).includes('refresh') ? 401 : 401 })) as typeof fetch;
  assert.equal(await syncDailyRecord(emptyDailyRecord(), '2026-11-14', true), null);
  // 登入：用伺服器的紀錄
  globalThis.fetch = (async () => new Response(JSON.stringify(state), { status: 200 })) as typeof fetch;
  assert.deepEqual(await syncDailyRecord(emptyDailyRecord(), '2026-11-14', true), state);
  // 伺服器掛了：回 null
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  assert.equal(await syncDailyRecord(emptyDailyRecord(), '2026-11-14', false), null);
  globalThis.fetch = realFetch;
  console.log('PASS: the browser falls back to its own record when not signed in or offline');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
