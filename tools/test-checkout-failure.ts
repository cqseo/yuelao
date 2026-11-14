// 結帳建立失敗時：訂單要作廢（failed），不能永遠卡在 pending；回 503。成功時照舊回結帳網址。
// 不連任何雲端服務：Supabase 與 Stripe 都是假的。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTestCheckout } from '../packages/core/src/billing/checkout';
import type { PaymentProvider } from '../packages/core/src/billing/provider';
import site from '../sites/yuelao/site.config';

type Op = { table: string; ops: [string, unknown[]][] };
function fakeDb() {
  const log: Op[] = [];
  const db = {
    from(table: string) {
      const entry: Op = { table, ops: [] };
      log.push(entry);
      const result = () => {
        const kinds = entry.ops.map((o) => o[0]);
        if (table === 'orders' && kinds.includes('insert')) return { data: { id: 'order-1' }, error: null };
        if (table === 'orders' && kinds.includes('select') && !kinds.includes('update'))
          return { data: null, error: null, count: 0 };
        if (table === 'profiles' && kinds.includes('select'))
          return { data: { stripe_customer_id: 'cus_test' }, error: null };
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'insert', 'upsert', 'update', 'eq', 'gte', 'is', 'single', 'maybeSingle'])
        chain[m] = (...args: unknown[]) => {
          entry.ops.push([m, args]);
          return chain;
        };
      // biome-ignore lint/suspicious/noThenProperty: the fake must be awaitable like a Supabase query builder.
      chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(ok, bad);
      return chain;
    },
  } as unknown as SupabaseClient;
  return { db, log };
}
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' };
const req = () =>
  new Request('https://yuelao.example/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productId: 'unlock_1',
      currency: 'USD',
      locale: 'zh-Hant',
      from: 'market',
      stickId: 7,
      category: 'him',
    }),
  });
const provider = (fail: boolean) =>
  ({
    createCustomer: async () => 'cus_test',
    createCheckout: async (r: { successUrl: string }) => {
      if (fail) throw new Error('stripe says no');
      return {
        url: `https://checkout.stripe.com/c/pay/x?ret=${encodeURIComponent(r.successUrl)}`,
        checkoutRef: 'cs_test_1',
      };
    },
  }) as unknown as PaymentProvider;

{
  const { db, log } = fakeDb();
  const res = await createTestCheckout({
    request: req(),
    site,
    provider: provider(true),
    database: db,
    user,
    baseUrl: 'https://yuelao.example',
  });
  assert.equal(res.status, 503);
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'checkout_unavailable');
  const update = log.find((e) => e.table === 'orders' && e.ops.some((o) => o[0] === 'update'));
  assert.ok(update, 'failed checkout must update the order');
  assert.deepEqual(update.ops.find((o) => o[0] === 'update')?.[1][0], { status: 'failed' });
  assert.ok(update.ops.some((o) => o[0] === 'eq' && o[1][0] === 'status' && o[1][1] === 'pending'));
  assert.ok(update.ops.some((o) => o[0] === 'is' && o[1][0] === 'checkout_ref'));
  console.log('PASS: a checkout Stripe refuses marks the pending order failed and returns 503');
}
{
  const { db, log } = fakeDb();
  const res = await createTestCheckout({
    request: req(),
    site,
    provider: provider(false),
    database: db,
    user,
    baseUrl: 'https://yuelao.example',
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { checkoutUrl: string };
  assert.ok(decodeURIComponent(body.checkoutUrl).includes('https://yuelao.example/market#yuelao'));
  assert.ok(
    !log.some(
      (e) =>
        e.table === 'orders' &&
        e.ops.some((o) => o[0] === 'update' && (o[1][0] as { status?: string })?.status === 'failed'),
    ),
  );
  console.log('PASS: a successful market checkout returns straight to the hall and leaves the order pending');
}

{
  // 換到正式模式後，帳號上存的是測試模式的客戶編號：Stripe 回「沒有這個客戶」。
  // 要在目前模式新建客戶、換掉舊編號、用新的冪等鍵再試一次，不能讓人付不了錢。
  const log: Op[] = [];
  let stored = 'cus_test_old';
  const db = {
    from(table: string) {
      const entry: Op = { table, ops: [] };
      log.push(entry);
      const result = () => {
        const kinds = entry.ops.map((o) => o[0]);
        if (table === 'orders' && kinds.includes('insert')) return { data: { id: 'order-9' }, error: null };
        if (table === 'orders' && kinds.includes('select') && !kinds.includes('update'))
          return { data: null, error: null, count: 0 };
        if (table === 'profiles' && kinds.includes('update')) {
          const patch = entry.ops.find((o) => o[0] === 'update')?.[1][0] as
            | { stripe_customer_id: string }
            | undefined;
          const next = patch?.stripe_customer_id ?? '';
          const guard = entry.ops.find((o) => o[0] === 'eq' && o[1][0] === 'stripe_customer_id')?.[1][1];
          if (guard !== stored) return { data: null, error: null };
          stored = next;
          return { data: { stripe_customer_id: stored }, error: null };
        }
        if (table === 'profiles' && kinds.includes('select'))
          return { data: { stripe_customer_id: stored }, error: null };
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'insert', 'upsert', 'update', 'eq', 'gte', 'is', 'single', 'maybeSingle'])
        chain[m] = (...args: unknown[]) => {
          entry.ops.push([m, args]);
          return chain;
        };
      // biome-ignore lint/suspicious/noThenProperty: the fake must be awaitable like a Supabase query builder.
      chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(ok, bad);
      return chain;
    },
  } as unknown as SupabaseClient;
  const calls: { customerRef: string; retry?: boolean }[] = [];
  const stale = {
    createCustomer: async () => 'cus_live_new',
    createCheckout: async (r: { customerRef: string; retry?: boolean }) => {
      calls.push({ customerRef: r.customerRef, retry: r.retry });
      if (r.customerRef === 'cus_test_old')
        throw Object.assign(new Error('No such customer'), { code: 'resource_missing', param: 'customer' });
      return { url: 'https://checkout.stripe.com/c/pay/y', checkoutRef: 'cs_live_1' };
    },
  } as unknown as PaymentProvider;
  const res = await createTestCheckout({
    request: req(),
    site,
    provider: stale,
    database: db,
    user,
    baseUrl: 'https://yuelao.example',
  });
  assert.equal(res.status, 201, await res.clone().text());
  assert.deepEqual(calls, [
    { customerRef: 'cus_test_old', retry: undefined },
    { customerRef: 'cus_live_new', retry: true },
  ]);
  assert.equal(stored, 'cus_live_new');
  assert.ok(
    !log.some(
      (e) =>
        e.table === 'orders' &&
        e.ops.some((o) => o[0] === 'update' && (o[1][0] as { status?: string })?.status === 'failed'),
    ),
  );
  console.log('PASS: a customer id from the other Stripe mode is replaced and the checkout retried once');
}
