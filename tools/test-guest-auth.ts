// 訪客帳號（packages/core/src/guest-auth.ts）：沒登入也能付款，之後綁信箱。
// 不連任何雲端服務：Supabase Auth、資料庫、Stripe 都是假的。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccountUser, getUserFromRequest } from '../packages/core/src/auth';
import { createTestCheckout } from '../packages/core/src/billing/checkout';
import type { PaymentProvider } from '../packages/core/src/billing/provider';
import type { CoreEnv } from '../packages/core/src/env';
import { createGuestRequest, sendGuestBindCode, verifyGuestBindCode } from '../packages/core/src/guest-auth';
import site from '../sites/yuelao/site.config';

const ORIGIN = 'https://yuexia.example';
const GUEST_ID = '00000000-0000-4000-8000-0000000000a1';
const OTHER_ID = '00000000-0000-4000-8000-0000000000b2';
const env = (on = true, limiter?: CoreEnv['GUEST_RATE_LIMITER']) =>
  ({
    SUPABASE_URL: 'https://fake.supabase.invalid',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    EMAIL_FROM: '',
    GUEST_AUTH_ENABLED: on ? 'true' : 'false',
    GUEST_RATE_LIMITER: limiter,
  }) as CoreEnv;

const session = (id: string, anonymous: boolean) => ({
  access_token: `access-${id}`,
  refresh_token: `refresh-${id}`,
  expires_in: 3600,
  user: { id, is_anonymous: anonymous, email: anonymous ? undefined : 'x@example.invalid' },
});

function post(path: string, body: unknown, cookie = '', origin = ORIGIN) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

type Calls = Record<string, unknown[][]>;
function fakeAnon(overrides: Record<string, (...a: unknown[]) => unknown> = {}) {
  const calls: Calls = {};
  const track =
    (name: string, fn: (...a: unknown[]) => unknown) =>
    async (...args: unknown[]) => {
      calls[name] = [...(calls[name] ?? []), args];
      return fn(...args);
    };
  const defaults: Record<string, (...a: unknown[]) => unknown> = {
    getUser: () => ({ data: { user: null }, error: { status: 401 } }),
    refreshSession: () => ({ data: { session: null }, error: { status: 400 } }),
    signInAnonymously: () => {
      const s = session(GUEST_ID, true);
      return { data: { session: s, user: s.user }, error: null };
    },
    setSession: () => ({ data: { user: session(GUEST_ID, true).user }, error: null }),
    updateUser: () => ({ data: {}, error: null }),
    verifyOtp: () => {
      const s = session(GUEST_ID, false);
      return { data: { session: s, user: s.user }, error: null };
    },
  };
  const auth = Object.fromEntries(
    Object.entries({ ...defaults, ...overrides }).map(([k, fn]) => [k, track(k, fn)]),
  );
  return { client: { auth } as unknown as SupabaseClient, calls };
}

function fakeService() {
  const upserts: unknown[] = [];
  const db = {
    from: () => ({
      upsert: async (row: unknown) => {
        upserts.push(row);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, upserts };
}

const cookieNames = (r: Response) => r.headers.getSetCookie().map((c) => c.split('=')[0]);

// ---------- 建訪客 ----------
{
  const a = fakeAnon();
  const s = fakeService();
  const off = await createGuestRequest(post('/api/auth/guest', {}), env(false), () => a.client, s.db);
  assert.equal(off.status, 404);
  const foreign = await createGuestRequest(
    post('/api/auth/guest', {}, '', 'https://evil.invalid'),
    env(),
    () => a.client,
    s.db,
  );
  assert.equal(foreign.status, 403);
  assert.equal(a.calls.signInAnonymously, undefined);
  console.log('PASS: guests are off unless enabled, and only same-origin requests may create one');
}
{
  const a = fakeAnon();
  const s = fakeService();
  const res = await createGuestRequest(post('/api/auth/guest', {}), env(), () => a.client, s.db);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { created: true, guest: true });
  assert.ok(!text.includes('access-'), 'tokens never appear in the JSON body');
  assert.equal(a.calls.signInAnonymously?.length, 1);
  assert.deepEqual(cookieNames(res).sort(), ['__Host-yl_access', '__Host-yl_refresh', 'yl_guest']);
  const marker = res.headers.getSetCookie().find((c) => c.startsWith('yl_guest='));
  assert.ok(marker?.startsWith('yl_guest=1;') && !marker.includes('HttpOnly'));
  const access = res.headers.getSetCookie().find((c) => c.startsWith('__Host-yl_access='));
  assert.ok(access?.includes('HttpOnly') && access.includes('Secure'));
  assert.deepEqual(s.upserts, [{ id: GUEST_ID, email: null }]);
  console.log('PASS: no session -> a guest is created, cookies are HttpOnly, profile row has no email');
}
{
  const a = fakeAnon({
    getUser: () => ({ data: { user: { id: OTHER_ID, is_anonymous: false } }, error: null }),
  });
  const s = fakeService();
  const res = await createGuestRequest(
    post('/api/auth/guest', {}, '__Host-yl_access=tok'),
    env(),
    () => a.client,
    s.db,
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { existing: true, guest: false });
  assert.equal(a.calls.signInAnonymously, undefined);
  console.log('PASS: someone already signed in is never turned into a guest');
}
{
  const a = fakeAnon();
  const s = fakeService();
  const res = await createGuestRequest(
    post('/api/auth/guest', {}, '__Host-yl_refresh=old'),
    env(),
    () => a.client,
    s.db,
  );
  assert.equal(res.status, 401);
  assert.equal(a.calls.signInAnonymously, undefined);
  console.log('PASS: an expired real sign-in is not silently replaced by a guest');
}
{
  let hits = 0;
  const limiter = { limit: async () => ({ success: ++hits <= 1 }) };
  const s = fakeService();
  const first = await createGuestRequest(
    post('/api/auth/guest', {}),
    env(true, limiter),
    () => fakeAnon().client,
    s.db,
  );
  const a = fakeAnon();
  const second = await createGuestRequest(
    post('/api/auth/guest', {}),
    env(true, limiter),
    () => a.client,
    s.db,
  );
  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.equal(a.calls.signInAnonymously, undefined);
  console.log('PASS: per-visitor rate limit stops repeated guest creation before reaching Supabase');
}
{
  const a = fakeAnon({
    signInAnonymously: () => ({ data: { session: null, user: null }, error: { status: 422 } }),
  });
  const res = await createGuestRequest(post('/api/auth/guest', {}), env(), () => a.client, fakeService().db);
  assert.equal(res.status, 503);
  console.log('PASS: if Supabase refuses anonymous sign-in, checkout falls back to the sign-in page (503)');
}

// ---------- 綁信箱 ----------
const guestCookie = '__Host-yl_access=a; __Host-yl_refresh=r';
{
  const none = await sendGuestBindCode(
    post('/api/auth/guest-email', { email: 'x@example.invalid' }),
    () => fakeAnon().client,
  );
  assert.equal(none.status, 401);
  const notGuest = fakeAnon({
    setSession: () => ({ data: { user: { id: OTHER_ID, is_anonymous: false } }, error: null }),
  });
  const r2 = await sendGuestBindCode(
    post('/api/auth/guest-email', { email: 'x@example.invalid' }, guestCookie),
    () => notGuest.client,
  );
  assert.equal(r2.status, 401);
  assert.equal(notGuest.calls.updateUser, undefined);
  console.log('PASS: only a guest session can start binding an email');
}
{
  const a = fakeAnon();
  const res = await sendGuestBindCode(
    post('/api/auth/guest-email', { email: '  Me@Example.invalid ' }, guestCookie),
    () => a.client,
  );
  assert.equal(res.status, 200);
  assert.deepEqual(a.calls.updateUser?.[0]?.[0], { email: 'me@example.invalid' });
  assert.equal(a.calls.signInWithOtp, undefined, 'binding never creates a second account');
  const taken = fakeAnon({
    updateUser: () => ({
      data: {},
      error: { status: 422, code: 'email_exists', message: 'already registered' },
    }),
  });
  const res2 = await sendGuestBindCode(
    post('/api/auth/guest-email', { email: 'taken@example.invalid' }, guestCookie),
    () => taken.client,
  );
  assert.equal(res2.status, 409);
  assert.equal(((await res2.json()) as { error: { code: string } }).error.code, 'email_in_use');
  console.log(
    'PASS: binding changes the guest email (lower-cased); an email that already has an account gets 409',
  );
}
{
  const bad = await verifyGuestBindCode(
    post('/api/auth/guest-verify', { email: 'me@example.invalid', code: '12345' }, guestCookie),
    () => fakeAnon().client,
  );
  assert.equal(bad.status, 400);
  const swapped = fakeAnon({
    verifyOtp: () => {
      const s = session(OTHER_ID, false);
      return { data: { session: s, user: s.user }, error: null };
    },
  });
  const mismatch = await verifyGuestBindCode(
    post('/api/auth/guest-verify', { email: 'me@example.invalid', code: '123456' }, guestCookie),
    () => swapped.client,
  );
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.headers.getSetCookie().length, 0, 'no cookies for a different account');
  const a = fakeAnon();
  const ok = await verifyGuestBindCode(
    post('/api/auth/guest-verify', { email: 'me@example.invalid', code: '123456' }, guestCookie),
    () => a.client,
  );
  assert.equal(ok.status, 200);
  assert.equal(
    a.calls.verifyOtp?.[0]?.[0] && (a.calls.verifyOtp[0][0] as { type: string }).type,
    'email_change',
  );
  const marker = ok.headers.getSetCookie().find((c) => c.startsWith('yl_guest='));
  assert.ok(marker?.includes('Max-Age=0'), 'guest marker cleared after binding');
  console.log('PASS: the code must verify to the same account id; then the guest marker is cleared');
}

// ---------- 誰算登入 ----------
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ id: GUEST_ID, is_anonymous: true, aud: 'authenticated' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    const r = new Request(`${ORIGIN}/api/account/status`, { headers: { cookie: '__Host-yl_access=tok' } });
    assert.deepEqual(await getAccountUser(r, env()), { id: GUEST_ID, email: null, guest: true });
    assert.equal(await getUserFromRequest(r, env()), null);
  } finally {
    globalThis.fetch = realFetch;
  }
  console.log(
    'PASS: a guest counts for buying/reading (getAccountUser) but not for wishes, admin, check-in (getUserFromRequest)',
  );
}

// ---------- 訪客結帳 ----------
{
  const profileWrites: unknown[] = [];
  const customers: unknown[] = [];
  const db = {
    from(table: string) {
      const ops: string[] = [];
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'insert', 'upsert', 'update', 'eq', 'gte', 'is', 'single', 'maybeSingle'])
        chain[m] = (...args: unknown[]) => {
          ops.push(m);
          if (table === 'profiles' && (m === 'upsert' || m === 'update')) profileWrites.push(args[0]);
          return chain;
        };
      // biome-ignore lint/suspicious/noThenProperty: the fake must be awaitable like a Supabase query builder.
      chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
        let v: unknown = { data: null, error: null };
        if (table === 'orders' && ops.includes('insert')) v = { data: { id: 'order-g' }, error: null };
        else if (table === 'orders' && ops.includes('select') && !ops.includes('update'))
          v = { data: null, error: null, count: 0 };
        else if (table === 'profiles' && ops.includes('update'))
          v = { data: { stripe_customer_id: 'cus_guest' }, error: null };
        else if (table === 'profiles' && ops.includes('select'))
          v = { data: { stripe_customer_id: null }, error: null };
        return Promise.resolve(v).then(ok, bad);
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  const provider = {
    createCustomer: async (u: unknown) => {
      customers.push(u);
      return 'cus_guest';
    },
    createCheckout: async () => ({ url: 'https://checkout.stripe.com/c/pay/g', checkoutRef: 'cs_live_g' }),
  } as unknown as PaymentProvider;
  const res = await createTestCheckout({
    request: new Request(`${ORIGIN}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: 'unlock_1',
        currency: 'HKD',
        locale: 'zh-Hant',
        from: 'market',
        stickId: 7,
        category: 'him',
      }),
    }),
    site,
    provider,
    database: db,
    user: { id: GUEST_ID, email: null, guest: true },
    baseUrl: ORIGIN,
  });
  assert.equal(res.status, 201, await res.clone().text());
  assert.equal(
    (customers[0] as { email: unknown }).email,
    null,
    'Stripe customer has no email; Checkout asks for one',
  );
  assert.equal((profileWrites[0] as { email: unknown }).email, null);
  console.log('PASS: a guest can check out; no email is invented for the Stripe customer or profile');
}

console.log('ALL GUEST ACCOUNT TESTS PASSED (offline fakes only)');
