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
  [2, 1, 1, 1, 1, 1, 1, 1],
  'visit, engage, start (historical implied), reading, offer seen (implied by unlock), unlock, checkout, paid',
);
assert.equal(stats.kpis.loggedIn, 1);
assert.deepEqual(stats.checkout, { started: 1, uniqueAccounts: 1, paid: 1, failed: 0, abandoned: 0 });
assert.equal(stats.meta.completeWindowTracking, true, 'previous-window event proves coverage');
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
assert.equal(mixed.orderList.find(o => o.no === 'US')?.currency, 'USD');
assert.equal(mixed.orderList.find(o => o.no === 'HK')?.currency, 'HKD');

// New first-party events should make the previously invisible start-to-read stage measurable.
const newFunnel = computeStats({
  days: 7,
  now,
  events: [
    ev('vD_dddddddd', 'sD1_ddddddd', 60, 'page_view', '/'),
    ev('vD_dddddddd', 'sD1_ddddddd', 59, 'home_yuelao_click', '/'),
    ev('vD_dddddddd', 'sD1_ddddddd', 58, 'page_view', '/market'),
    ev('vD_dddddddd', 'sD1_ddddddd', 57, 'ritual_begin', '/market'),
    ev('vD_dddddddd', 'sD1_ddddddd', 56, 'reading_done', '/market'),
  ],
  orders: [], refunds: new Map(), profiles: [], totalUsers: 0, eventsTruncated: false,
});
assert.deepEqual(newFunnel.funnel.map((s) => s.count), [1, 1, 1, 1, 0, 0, 0, 0]);
assert.ok(newFunnel.recent.some((s) => s.steps.includes('@ritual_start')));
assert.ok(newFunnel.recent.some((s) => s.steps.includes('@home_yuelao')));

// A website only instrumented recently must not show order-count / visitor-count as a conversion rate.
const partialWindow = computeStats({
  days: 7,
  now,
  events: [ev('vX_xxxxxxxx', 'sX_xxxxxxxx', 60, 'page_view', '/')],
  orders: [
    { id: 'old-order', user_id: 'user-a', product_id: 'unlock_1', amount: 299, currency: 'USD',
      status: 'paid', checkout_ref: 'cs_live_old', created_at: t(180), paid_at: t(170) },
    { id: 'dup-order', user_id: 'user-a', product_id: 'unlock_1', amount: 299, currency: 'USD',
      status: 'pending', checkout_ref: 'cs_live_2', created_at: t(60), paid_at: null },
    { id: 'dup-order-2', user_id: 'user-a', product_id: 'unlock_1', amount: 299, currency: 'USD',
      status: 'pending', checkout_ref: 'cs_live_3', created_at: t(59), paid_at: null },
  ],
  refunds: new Map(), profiles: [], totalUsers: 0, eventsTruncated: false,
});
assert.equal(partialWindow.meta.completeWindowTracking, false);
assert.equal(partialWindow.checkout.started, 3);
assert.equal(partialWindow.checkout.uniqueAccounts, 1, 'three checkouts from one account are not three customers');
assert.equal(partialWindow.kpis.payers.value, 1);
assert.equal(partialWindow.funnel.at(-1)?.count, 0, 'an unlinked paying account must not count as a known visitor payer');
console.log('PASS: stats aggregate visitors, live orders, funnel, paths and journeys');

// 機房網段的事件不記（雲端主機、Meta 連結預覽）；iPhone 私密轉送（Cloudflare 13335、Akamai 36183）照記
{
  const { fromDatacenter } = await import('../packages/core/src/site-events');
  assert.ok(fromDatacenter(16509) && fromDatacenter(32934) && fromDatacenter(15169));
  assert.ok(!fromDatacenter(13335) && !fromDatacenter(36183) && !fromDatacenter(3462) && !fromDatacenter(undefined));
  console.log('PASS: datacenter networks are left out of analytics, private relay is not');
}

// 各玩法轉化：算命攤三種玩法分開算；同一帳號買兩次算重複購買
{
  const e = (vid: string, min: number, name: string, props: Record<string, string>) => ({
    at: t(min),
    vid,
    sid: `s_${vid}`,
    user_id: null,
    name,
    path: '/market',
    props,
    referrer: null,
    device: 'mobile',
    country: 'HK',
    locale: 'zh-Hant',
  });
  const order = (id: string, user: string, product: string, amount: number) => ({
    id,
    user_id: user,
    product_id: product,
    amount,
    currency: 'HKD',
    status: 'paid',
    checkout_ref: `cs_live_${id}`,
    created_at: t(20),
    paid_at: t(19),
  });
  const s2 = computeStats({
    days: 7,
    now,
    events: [
      e('v1_aaaaaaaa', 40, 'reading_done', { kind: 'match' }),
      e('v1_aaaaaaaa', 39, 'offer_view', { product: 'match_1' }),
      e('v1_aaaaaaaa', 38, 'unlock_click', { product: 'match_1' }),
      e('v1_aaaaaaaa', 37, 'fortune_cross', { to: 'love' }),
      e('v1_aaaaaaaa', 36, 'reading_done', { kind: 'love' }),
      e('v1_aaaaaaaa', 35, 'reading_done', { kind: 'bazi' }),
      e('v2_bbbbbbbb', 30, 'reading_done', { kind: 'match' }),
      e('v2_bbbbbbbb', 29, 'share_image', { kind: 'match' }),
      e('v3_cccccccc', 30, 'reading_done', { kind: 'tarot' }),
    ],
    orders: [
      order('m1', 'u1', 'match_1', 1200),
      order('m2', 'u1', 'match_1', 1200),
      order('b1', 'u2', 'bazi_1', 2800),
    ],
    refunds: new Map(),
    profiles: [],
    totalUsers: 3,
    eventsTruncated: false,
  });
  const play = (k: string) => s2.plays.find((p) => p.key === k)!;
  assert.deepEqual(
    [
      play('match').results,
      play('match').offers,
      play('match').unlocks,
      play('match').paid,
      play('match').buyers,
    ],
    [2, 1, 1, 2, 1],
  );
  assert.equal(play('match').repeatBuyers, 1);
  assert.equal(play('match').revenue, 2400);
  assert.equal(play('match').shares, 1);
  assert.equal(play('love').crossIn, 1);
  assert.equal(play('bazi').paid, 1);
  assert.equal(play('tarot').results, 1);
  assert.deepEqual(s2.fortuneMulti, { visitors: 2, twoOrMore: 1, allThree: 1 });
  console.log('PASS: per-play conversion splits the stall and the tarot parlor, and spots repeat buyers');
}
