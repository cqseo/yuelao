import assert from 'node:assert/strict';
import { computeStats, dayKey, normalizePath } from '../packages/core/src/admin-stats';
import { deviceFrom, isAdminEmail, parseTrackBatch, referrerHost } from '../packages/core/src/site-events';

// 路徑歸類
assert.equal(normalizePath('/'), '/');
assert.equal(normalizePath('/en'), '/');
assert.equal(normalizePath('/ja/sign/12'), '/sign/*');
assert.equal(normalizePath('/market'), '/market');
assert.equal(normalizePath('/english'), '/english');
assert.equal(dayKey(Date.parse('2026-11-14T16:30:00Z')), '2026-11-15');
console.log('PASS: paths fold language prefixes and ids; days are Beijing time');

// 收事件：格式不對的丟掉
const now = new Date('2026-11-15T04:00:00Z');
const ok = parseTrackBatch(
  {
    vid: 'visitor_abcdef12',
    sid: 'session_abcdef12',
    referrer: 'https://www.google.com/search?q=x',
    locale: 'zh-Hans',
    events: [
      { name: 'page_view', path: '/market?x=1#y', at: now.getTime() - 1000 },
      { name: 'BAD NAME', path: '/' },
      { name: 'checkout_start', path: '/market', props: { product: 'unlock_1', nested: { a: 1 } } },
      { name: 'page_view', path: 'no-slash' },
      { name: 'page_view', path: '/', at: now.getTime() + 60_000 },
    ],
  },
  'yuelao.example',
  now,
);
assert.ok(ok);
assert.equal(ok.events.length, 3);
assert.equal(ok.events[0]?.path, '/market');
assert.deepEqual(ok.events[1]?.props, { product: 'unlock_1' });
assert.equal(ok.events[2]?.at, now.toISOString(), 'future timestamps clamp to now');
assert.equal(ok.referrer, 'google.com');
assert.equal(parseTrackBatch({ vid: 'x', sid: 'session_abcdef12', events: [] }, 'h'), null);
assert.equal(referrerHost('https://yuelao.example/a', 'yuelao.example'), null);
assert.equal(deviceFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) MicroMessenger'), 'mobile');
assert.equal(deviceFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'desktop');
assert.equal(isAdminEmail(' Boss@Example.com ', ['boss@example.com']), true);
assert.equal(isAdminEmail(null, ['boss@example.com']), false);
console.log('PASS: track batches are validated and cleaned');

// 彙總：兩位訪客，一位登入、結帳、付款
const t = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const ev = (
  vid: string,
  sid: string,
  min: number,
  name: string,
  path: string,
  user: string | null = null,
  props = {},
) => ({
  at: t(min),
  vid,
  sid,
  user_id: user,
  name,
  path,
  props,
  referrer: null,
  device: 'mobile',
  country: 'CN',
  locale: 'zh-Hans',
});
const stats = computeStats({
  days: 7,
  now,
  events: [
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 60, 'page_view', '/'),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 59, 'page_view', '/market'),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 58, 'market_enter', '/market'),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 57, 'market_room_open', '/market', null, { room: 'tarot' }),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 56, 'reading_done', '/market', null, { kind: 'tarot' }),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 55, 'page_view', '/login'),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 54, 'login', '/login', 'user-a'),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 53, 'page_view', '/market', 'user-a'),
    ev('vA_aaaaaaaa', 'sA1_aaaaaaa', 52, 'checkout_start', '/market', 'user-a'),
    ev('vB_bbbbbbbb', 'sB1_bbbbbbb', 30, 'page_view', '/en'),
    // 上一期
    ev('vC_cccccccc', 'sC1_ccccccc', 60 * 24 * 8, 'page_view', '/'),
  ],
  orders: [
    {
      id: 'o1',
      user_id: 'user-a',
      product_id: 'spread_1',
      amount: 299,
      currency: 'USD',
      status: 'paid',
      checkout_ref: 'cs_live_1',
      created_at: t(52),
      paid_at: t(50),
    },
    {
      id: 'o2',
      user_id: 'user-a',
      product_id: 'spread_1',
      amount: 299,
      currency: 'USD',
      status: 'paid',
      checkout_ref: 'cs_test_1',
      created_at: t(52),
      paid_at: t(50),
    },
  ],
  refunds: new Map(),
  profiles: [{ id: 'user-a', created_at: t(54) }],
  totalUsers: 5,
  eventsTruncated: false,
});
assert.equal(stats.kpis.visitors.value, 2);
assert.equal(stats.kpis.visitors.prev, 1);
assert.equal(stats.kpis.orders.value, 1, 'test-mode orders are excluded');
assert.equal(stats.kpis.revenue.value, 0, 'historical USD cents are not HKD');
assert.equal(stats.kpis.currency, 'HKD');
assert.deepEqual(stats.kpis.otherCurrencies, [{ currency: 'USD', orders: 1, revenue: 299, refunded: 0 }]);
assert.equal(stats.kpis.signups.value, 1);
assert.deepEqual(
  stats.funnel.map((f) => f.count),
  [2, 1, 1, 1, 1, 1],
  'visit, engage, reading, unlock (implied by checkout), checkout, paid',
);
assert.equal(stats.kpis.loggedIn, 1);
assert.deepEqual(stats.checkout, { started: 1, paid: 1, failed: 0, abandoned: 0 });
assert.equal(stats.orderList.length, 2, 'the order list shows live and test orders');
assert.equal(stats.orderList.filter((o) => o.live).length, 1);
assert.equal(stats.ops, null);
assert.deepEqual(stats.paths[0]?.steps ?? [], [
  '/',
  '/market',
  '@market_enter',
  '@room:tarot',
  '@reading',
  '/login',
]);
const journey = stats.recent.find((r) => r.paid);
assert.ok(journey, 'payment is attached to the session');
assert.equal(journey.steps[journey.steps.length - 1], '@paid');
assert.ok(stats.flow.some((f) => f.stage === 0 && f.from === '/' && f.to === '/market'));
assert.ok(
  stats.flow.some((f) => f.from === '/' && f.to === '@exit'),
  'single-page visit exits',
);
assert.equal(stats.daily.length, 8);
// Historical USD and current HKD orders must never be summed as one currency.
const mixed = computeStats({
  days: 7,
  now,
  events: [],
  orders: [
    { id: 'hk', user_id: 'a', product_id: 'unlock_1', amount: 1800, currency: 'HKD',
      status: 'paid', checkout_ref: 'cs_live_hk', created_at: t(60), paid_at: t(50) },
    { id: 'us', user_id: 'b', product_id: 'unlock_1', amount: 299, currency: 'USD',
      status: 'paid', checkout_ref: 'cs_live_us', created_at: t(60), paid_at: t(50) },
  ],
  refunds: new Map([['hk', 200], ['us', 99]]),
  profiles: [],
  totalUsers: 0,
  eventsTruncated: false,
});
assert.equal(mixed.kpis.revenue.value, 1600);
assert.equal(mixed.kpis.refunded, 200);
assert.deepEqual(mixed.kpis.otherCurrencies, [{ currency: 'USD', orders: 1, revenue: 200, refunded: 99 }]);
assert.equal(mixed.daily.reduce((sum, day) => sum + day.revenue, 0), 1600);
assert.equal(mixed.orderList.find(o => o.id === 'us')?.currency, 'USD');
assert.equal(mixed.orderList.find(o => o.id === 'hk')?.currency, 'HKD');

console.log('PASS: stats aggregate visitors, live orders, funnel, paths and journeys');
