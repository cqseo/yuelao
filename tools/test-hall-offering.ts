import assert from 'node:assert/strict';
import { hallOfferingRequest } from '../packages/core/src/hall-offering';

// 大殿上香計數 API：同源 JSON、visitor 格式、雜湊後才送資料庫、資料庫不可用。
const origin = 'https://yuelao.example';
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}/api/plaza/offering`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const calls: Record<string, unknown>[] = [];
const db = {
  rpc: async (_fn: string, args: Record<string, unknown>) => {
    calls.push(args);
    return { data: 7, error: null };
  },
} as never;

(async () => {
  let r = await hallOfferingRequest(
    post({ visitor: 'abc123xyz' }, { origin: 'https://evil.example' }),
    db,
    'yuelao',
  );
  assert.equal(r.status, 403);
  r = await hallOfferingRequest(post({ visitor: 'abc123xyz' }), null, 'yuelao');
  assert.equal(r.status, 503);
  r = await hallOfferingRequest(post({ visitor: 'a<b' }), db, 'yuelao');
  assert.equal(r.status, 400);
  console.log('PASS: needs same origin, a database and a well-formed visitor');
  r = await hallOfferingRequest(post({ visitor: 'abc123xyz' }), db, 'yuelao');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { count: 7 });
  const sent = String(calls.at(-1)?.p_visitor);
  assert.match(sent, /^[0-9a-f]{64}$/);
  assert.ok(!sent.includes('abc123xyz'), 'raw visitor never reaches the database');
  console.log('PASS: the visitor is hashed before it reaches the database; count comes back');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
