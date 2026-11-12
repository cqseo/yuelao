// 許願池服務層：輸入驗證、本地過濾、自動審核、登入與來源檢查、RPC 回傳的對應。
// 不連任何雲端服務：Supabase 與 OpenAI 都是假的。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoreEnv } from '../packages/core/src/env';
import {
  listWishesResponse,
  moderateWish,
  parseWish,
  screenWish,
  wishActionRequest,
} from '../packages/core/src/wishes';

const origin = 'https://local.example.invalid';
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'local@test.invalid' };
const baseEnv: CoreEnv = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  EMAIL_FROM: '',
  WISHES_ENABLED: 'true',
};
const post = (body: unknown, o: { crossOrigin?: boolean; raw?: string } = {}) =>
  new Request(`${origin}/api/wishes`, {
    method: 'POST',
    headers: { origin: o.crossOrigin ? 'https://evil.invalid' : origin, 'content-type': 'application/json' },
    body: o.raw ?? JSON.stringify(body),
  });

type Call = { fn: string; args: Record<string, unknown> };
function fakeDb(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: 'x' } };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
const moderation = (result: unknown, ok = true) =>
  (async () => new Response(JSON.stringify(result), { status: ok ? 200 : 500 })) as unknown as typeof fetch;
const neverFetch = (async () => {
  throw new Error('should not call the network');
}) as unknown as typeof fetch;
const wish = { action: 'make', body: '願今年遇見對的人', tag: 'seek', locale: 'zh-Hant' };

async function main() {
  // parseWish
  assert.deepEqual(parseWish({ body: '  願　平安  ', tag: 'self', locale: 'zh-Hans' }), {
    body: '願 平安',
    tag: 'self',
    locale: 'zh-Hans',
  });
  assert.equal(parseWish({ body: '', tag: 'self', locale: 'zh-Hant' }), null);
  assert.equal(parseWish({ body: '長'.repeat(41), tag: 'self', locale: 'zh-Hant' }), null);
  assert.ok(parseWish({ body: '長'.repeat(40), tag: 'self', locale: 'zh-Hant' }));
  assert.equal(parseWish({ body: '好', tag: 'money', locale: 'zh-Hant' }), null);
  assert.equal(parseWish({ body: '好', tag: 'self', locale: 'en' }), null);
  assert.equal(parseWish({ body: 'a‮b', tag: 'self', locale: 'zh-Hant' }), null);
  console.log('PASS: wish input is trimmed, length-limited and type-checked');

  // screenWish
  assert.equal(screenWish('願今年遇見對的人'), 'ok');
  assert.equal(screenWish('5201314 一生一世'), 'ok');
  assert.equal(screenWish('希望 2026 年能結婚'), 'ok');
  assert.equal(screenWish('加我微信 abc123'), 'contact');
  assert.equal(screenWish('打給我 0912-345-678'), 'contact');
  assert.equal(screenWish('１３８ １２３４ ５６７８'), 'contact');
  assert.equal(screenWish('找我 me@example.com'), 'contact');
  assert.equal(screenWish('追蹤 @yuelao_fan'), 'contact');
  assert.equal(screenWish('看這裡 example.com'), 'link');
  assert.equal(screenWish('https://t.co/x'), 'link');
  assert.equal(screenWish('約炮嗎'), 'abuse');
  assert.equal(screenWish('有時候真的不想活了'), 'care');
  console.log('PASS: contact details, links, abuse and self-harm mentions are caught; 5201314 passes');

  // moderateWish
  assert.equal(
    await moderateWish('x', 'sk-t', moderation({ results: [{ flagged: false, categories: {} }] })),
    'pass',
  );
  assert.equal(
    await moderateWish(
      'x',
      'sk-t',
      moderation({ results: [{ flagged: true, categories: { harassment: true } }] }),
    ),
    'flagged',
  );
  assert.equal(
    await moderateWish(
      'x',
      'sk-t',
      moderation({ results: [{ flagged: true, categories: { 'self-harm/intent': true } }] }),
    ),
    'care',
  );
  assert.equal(await moderateWish('x', 'sk-t', moderation({}, false)), 'unavailable');
  assert.equal(await moderateWish('x', 'sk-t', moderation({ results: [] })), 'unavailable');
  console.log('PASS: moderation verdicts map to pass / flagged / care / unavailable');

  // disabled, origin, login
  {
    const { db } = fakeDb({});
    let r = await wishActionRequest(post(wish), db, user, { ...baseEnv, WISHES_ENABLED: 'false' });
    assert.equal(r.status, 503);
    r = await wishActionRequest(post(wish, { crossOrigin: true }), db, user, baseEnv);
    assert.equal(r.status, 403);
    r = await wishActionRequest(post(wish), db, null, baseEnv);
    assert.equal(r.status, 401);
    r = await wishActionRequest(post(null, { raw: '{bad' }), db, user, baseEnv);
    assert.equal(r.status, 400);
    r = await wishActionRequest(
      post(null, { raw: JSON.stringify({ ...wish, body: '長'.repeat(900) }) }),
      db,
      user,
      baseEnv,
    );
    assert.equal(r.status, 413);
    const listed = await listWishesResponse(db, user, { ...baseEnv, WISHES_ENABLED: 'false' });
    assert.equal(((await listed.json()) as { enabled: boolean }).enabled, false);
    console.log('PASS: disabled pool, cross-origin, anonymous, malformed and oversized requests are refused');
  }

  // make: without auto moderation → pending, network untouched
  {
    const { db, calls } = fakeDb({ make_wish: 'ok:00000000-0000-4000-8000-0000000000aa' });
    const r = await wishActionRequest(
      post(wish),
      db,
      user,
      { ...baseEnv, OPENAI_API_KEY: 'sk-x' },
      neverFetch,
    );
    assert.equal(r.status, 201);
    assert.equal(((await r.json()) as { status: string }).status, 'pending');
    assert.equal(calls[0]?.args.p_status, 'pending');
    assert.equal(calls[0]?.args.p_user_id, user.id);
    console.log('PASS: without opt-in, wishes wait for review and nothing is sent to OpenAI');
  }
  // make: auto moderation pass → shown; failure → pending; flagged → 422 and no insert
  {
    const env = { ...baseEnv, OPENAI_API_KEY: 'sk-x', WISH_AUTO_MODERATION: 'true' };
    let f = fakeDb({ make_wish: 'ok:00000000-0000-4000-8000-0000000000ab' });
    let r = await wishActionRequest(
      post(wish),
      f.db,
      user,
      env,
      moderation({ results: [{ flagged: false, categories: {} }] }),
    );
    assert.equal(r.status, 201);
    assert.equal(f.calls[0]?.args.p_status, 'shown');
    f = fakeDb({ make_wish: 'ok:00000000-0000-4000-8000-0000000000ac' });
    r = await wishActionRequest(post(wish), f.db, user, env, moderation({}, false));
    assert.equal(f.calls[0]?.args.p_status, 'pending');
    f = fakeDb({ make_wish: 'ok:x' });
    r = await wishActionRequest(
      post(wish),
      f.db,
      user,
      env,
      moderation({ results: [{ flagged: true, categories: {} }] }),
    );
    assert.equal(r.status, 422);
    assert.equal(f.calls.length, 0);
    console.log('PASS: auto moderation shows passes, fails closed to pending, and blocks flagged text');
  }
  // make: local filter rejects before anything else; care carries a flag
  {
    const f = fakeDb({ make_wish: 'ok:x' });
    let r = await wishActionRequest(post({ ...wish, body: '加我 line 好嗎' }), f.db, user, baseEnv);
    assert.equal(r.status, 422);
    assert.equal(((await r.json()) as { error: { code: string } }).error.code, 'wish_contact');
    r = await wishActionRequest(post({ ...wish, body: '真的不想活了' }), f.db, user, baseEnv);
    const care = (await r.json()) as { error: { code: string; care?: boolean } };
    assert.equal(care.error.code, 'wish_care');
    assert.equal(care.error.care, true);
    assert.equal(f.calls.length, 0);
    console.log('PASS: filtered wishes never reach the database');
  }
  // make: limits
  {
    let r = await wishActionRequest(post(wish), fakeDb({ make_wish: 'daily_limit' }).db, user, baseEnv);
    assert.equal(r.status, 429);
    r = await wishActionRequest(post(wish), fakeDb({ make_wish: 'site_cap' }).db, user, baseEnv);
    assert.equal(r.status, 429);
    r = await wishActionRequest(post(wish), fakeDb({}).db, user, baseEnv);
    assert.equal(r.status, 503);
    console.log('PASS: daily and site limits map to 429; database errors to 503');
  }
  // bless / report / withdraw
  {
    const id = '00000000-0000-4000-8000-0000000000ad';
    let f = fakeDb({ bless_wish: 'blessed' });
    let r = await wishActionRequest(post({ action: 'bless', wishId: id }), f.db, user, baseEnv);
    assert.equal(((await r.json()) as { result: string }).result, 'blessed');
    r = await wishActionRequest(post({ action: 'bless', wishId: 'nope' }), f.db, user, baseEnv);
    assert.equal(r.status, 400);
    f = fakeDb({ report_wish: 'reported' });
    r = await wishActionRequest(post({ action: 'report', wishId: id, reason: 'spam' }), f.db, user, baseEnv);
    assert.equal(r.status, 200);
    r = await wishActionRequest(
      post({ action: 'report', wishId: id, reason: '他是壞人' }),
      f.db,
      user,
      baseEnv,
    );
    assert.equal(r.status, 400);
    r = await wishActionRequest(
      post({ action: 'withdraw', wishId: id }),
      fakeDb({ withdraw_wish: 'not_found' }).db,
      user,
      baseEnv,
    );
    assert.equal(r.status, 404);
    r = await wishActionRequest(post({ action: 'burn', wishId: id }), f.db, user, baseEnv);
    assert.equal(r.status, 400);
    console.log('PASS: bless, report and withdraw validate ids and reasons');
  }
  // list: no identity leaks, canWish
  {
    const today = new Date().toISOString();
    const rows = [
      {
        id: 'a',
        body: '甲',
        tag: 'seek',
        blessings: 2,
        created_at: today,
        status: 'shown',
        mine: false,
        blessed: true,
        user_id: 'leak',
      },
      {
        id: 'b',
        body: '乙',
        tag: 'self',
        blessings: 0,
        created_at: today,
        status: 'pending',
        mine: true,
        blessed: false,
      },
    ];
    const r = await listWishesResponse(fakeDb({ list_wishes: rows }).db, user, baseEnv);
    const data = (await r.json()) as { canWish: boolean; wishes: Record<string, unknown>[] };
    assert.equal(data.canWish, false);
    assert.ok(!JSON.stringify(data).includes('leak'));
    const anon = (await (await listWishesResponse(fakeDb({ list_wishes: [] }).db, null, baseEnv)).json()) as {
      loginRequired: boolean;
      canWish: boolean;
    };
    assert.equal(anon.loginRequired, true);
    assert.equal(anon.canWish, false);
    console.log('PASS: the list carries no identity fields and reports whether you can still wish today');
  }
  console.log('ALL WISHING POOL SERVICE TESTS PASSED');
}

void main();
