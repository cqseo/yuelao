import type { SessionUser } from './auth';
import { errorResponse, json } from './http';
import { isAdminEmail } from './site-events';
import type { Supabase } from './supabase';

// 站長後台：一次把選定區間的數字算好回給 /admin 頁。資料量還小，直接撈原始列在 Worker 裡彙總；
// 量大了再換成資料庫裡的彙總函式。日期一律按北京時間（UTC+8）切日。

export const RANGE_DAYS = [1, 7, 30, 90] as const;
const TZ_OFFSET_MS = 8 * 3_600_000;
const PAGE = 1000;
const MAX_ROWS = 60_000;
const SESSION_GAP_MS = 2 * 3_600_000;
const PATH_STEPS = 6;

export interface EventRow {
  at: string;
  vid: string;
  sid: string;
  user_id: string | null;
  name: string;
  path: string;
  props: Record<string, unknown> | null;
  referrer: string | null;
  device: string | null;
  country: string | null;
  locale: string | null;
}

export interface OrderRow {
  id: string;
  user_id: string;
  product_id: string;
  amount: number;
  currency: string;
  status: string;
  checkout_ref: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface ProfileRow {
  id: string;
  created_at: string;
}

export interface StatsInput {
  days: number;
  now: Date;
  events: EventRow[];
  /** Orders created or paid since the start of the previous window. */
  orders: OrderRow[];
  /** Refunded amount per order id. */
  refunds: Map<string, number>;
  /** Profiles created since the start of the previous window. */
  profiles: ProfileRow[];
  totalUsers: number;
  eventsTruncated: boolean;
  /** Counts read straight from content tables; null when that table could not be read. */
  ops?: OpsCounts;
}

/** 內容與運營：各功能在區間內被用了幾次，以及現在等著站長處理的事。 */
export interface OpsCounts {
  stickReadings: number | null;
  spreadReadings: number | null;
  failedReadings: number | null;
  wishes: number | null;
  wishesPending: number | null;
  blessings: number | null;
  checkins: number | null;
  offerings: number | null;
}

/** Strips the language prefix and folds ids/slugs so pages group together (/en/sign/12 → /sign/*). */
export function normalizePath(path: string): string {
  const bare = path.replace(/^\/(en|ja|ko|th)(?=\/|$)/, '') || '/';
  const parts = bare.split('/').filter(Boolean);
  if (!parts.length) return '/';
  return parts.length > 1 ? `/${parts[0]}/*` : `/${parts[0]}`;
}

/** Day key in Beijing time, e.g. "2026-11-15". */
export function dayKey(time: number): string {
  return new Date(time + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function isLive(order: OrderRow): boolean {
  return order.checkout_ref?.startsWith('cs_live_') === true;
}

function countBy<T>(items: T[], key: (item: T) => string | null, limit = 10) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function distinctBy<T>(items: T[], group: (item: T) => string | null, id: (item: T) => string, limit = 10) {
  const sets = new Map<string, Set<string>>();
  for (const item of items) {
    const g = group(item);
    if (!g) continue;
    const set = sets.get(g) ?? new Set<string>();
    sets.set(g, set);
    set.add(id(item));
  }
  return [...sets.entries()]
    .map(([label, set]) => ({ label, count: set.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

type Step = { key: string; at: number };

/** A step label for one event: pages by path, a few key actions by name; null = not part of a path. */
function stepOf(e: EventRow): string | null {
  if (e.name === 'page_view') return normalizePath(e.path);
  if (e.name === 'market_enter') return '@market_enter';
  if (e.name === 'home_yuelao_click') return '@home_yuelao';
  if (e.name === 'ritual_begin') return '@ritual_start';
  if (e.name === 'quick_question_click') return '@quick_question';
  if (e.name === 'market_lite_manual') return '@lite_mode';
  if (e.name === 'market_3d_failure') return '@3d_failure';
  if (e.name === 'sign_link_copy') return '@share_link';
  if (e.name === 'market_hall_offer') return '@hall_offer';
  if (e.name === 'market_room_open') {
    const room = typeof e.props?.room === 'string' ? e.props.room : '';
    return room ? `@room:${room}` : null;
  }
  if (e.name === 'reading_done') return '@reading';
  if (e.name === 'unlock_click') return '@unlock';
  if (e.name === 'deep_read') return '@deep';
  if (e.name === 'offer_view') return '@offer';
  if (e.name === 'checkout_login_required') return '@login_gate';
  if (e.name === 'checkout_session_created') return '@stripe_created';
  if (e.name === 'checkout_api_failure') return '@checkout_error';
  if (e.name === 'login') return '@login';
  if (e.name === 'checkout_start') return '@checkout';
  return null;
}

export function computeStats(input: StatsInput) {
  const { days, now } = input;
  const end = now.getTime();
  const start = end - days * 86_400_000;
  const prevStart = start - days * 86_400_000;
  const inRange = (t: number) => t >= start && t <= end;
  const inPrev = (t: number) => t >= prevStart && t < start;

  const events = input.events.map((e) => ({ ...e, t: Date.parse(e.at) }));
  const cur = events.filter((e) => inRange(e.t));
  const prev = events.filter((e) => inPrev(e.t));
  const earliestEventTime = events.reduce((minimum, e) => Math.min(minimum, e.t), Infinity);

  const liveOrders = input.orders.filter(isLive);
  const paid = liveOrders.filter((o) => o.status === 'paid' && o.paid_at);
  const paidCur = paid.filter((o) => inRange(Date.parse(o.paid_at as string)));
  const paidPrev = paid.filter((o) => inPrev(Date.parse(o.paid_at as string)));
  const net = (o: OrderRow) => Math.max(0, o.amount - (input.refunds.get(o.id) ?? 0));
  // Financial totals must never sum HKD cents and historical USD/TWD cents.
  // HKD is the current selling currency; other paid orders stay in a separate breakdown.
  const hkdPaid = (list: OrderRow[]) => list.filter((o) => o.currency.toUpperCase() === 'HKD');
  const sum = (list: OrderRow[]) => hkdPaid(list).reduce((total, o) => total + net(o), 0);
  const nonHkdByCurrency = new Map<string, { revenue: number; refunded: number; orders: number }>();
  for (const o of paidCur) {
    const currency = o.currency.toUpperCase();
    if (currency === 'HKD') continue;
    const item = nonHkdByCurrency.get(currency) ?? { revenue: 0, refunded: 0, orders: 0 };
    item.orders++;
    item.revenue += net(o);
    item.refunded += Math.min(o.amount, input.refunds.get(o.id) ?? 0);
    nonHkdByCurrency.set(currency, item);
  }
  const otherCurrencies = [...nonHkdByCurrency]
    .map(([currency, totals]) => ({ currency, ...totals }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const signCur = input.profiles.filter((p) => inRange(Date.parse(p.created_at)));
  const signPrev = input.profiles.filter((p) => inPrev(Date.parse(p.created_at)));

  const views = (list: typeof events) => list.filter((e) => e.name === 'page_view').length;
  const distinct = (list: typeof events, key: 'vid' | 'sid') => new Set(list.map((e) => e[key])).size;

  const kpis = {
    visitors: { value: distinct(cur, 'vid'), prev: distinct(prev, 'vid') },
    sessions: { value: distinct(cur, 'sid'), prev: distinct(prev, 'sid') },
    pageViews: { value: views(cur), prev: views(prev) },
    signups: { value: signCur.length, prev: signPrev.length },
    orders: { value: paidCur.length, prev: paidPrev.length },
    revenue: { value: sum(paidCur), prev: sum(paidPrev) },
    payers: {
      value: new Set(paidCur.map((o) => o.user_id)).size,
      prev: new Set(paidPrev.map((o) => o.user_id)).size,
    },
    refunded: hkdPaid(paidCur).reduce((s, o) => s + Math.min(o.amount, input.refunds.get(o.id) ?? 0), 0),
    otherCurrencies,
    totalUsers: input.totalUsers,
    currency: 'HKD', // summary revenue is HKD-only; otherCurrencies is shown separately
  };

  // 每天一格（北京時間）；1 天的區間也給當天一格。
  const dayKeys: string[] = [];
  for (let t = start; dayKey(t) <= dayKey(end); t += 86_400_000) {
    const k = dayKey(t);
    if (dayKeys[dayKeys.length - 1] !== k) dayKeys.push(k);
    if (dayKeys.length > 120) break;
  }
  const daily = dayKeys.map((day) => ({ day, visitors: 0, pageViews: 0, signups: 0, orders: 0, revenue: 0 }));
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const dayVisitors = new Map<string, Set<string>>();
  for (const e of cur) {
    const k = dayKey(e.t);
    const set = dayVisitors.get(k) ?? new Set<string>();
    dayVisitors.set(k, set);
    set.add(e.vid);
    const d = byDay.get(k);
    if (d && e.name === 'page_view') d.pageViews++;
  }
  for (const [k, set] of dayVisitors) {
    const d = byDay.get(k);
    if (d) d.visitors = set.size;
  }
  for (const p of signCur) {
    const d = byDay.get(dayKey(Date.parse(p.created_at)));
    if (d) d.signups++;
  }
  for (const o of paidCur) {
    const d = byDay.get(dayKey(Date.parse(o.paid_at as string)));
    if (d) {
      d.orders++;
      if (o.currency.toUpperCase() === 'HKD') d.revenue += net(o);
    }
  }

  // 訪客 ↔ 帳號：同一個瀏覽器（vid）只要登入過一次，就算是那個帳號。
  const vidUser = new Map<string, string>();
  for (const e of events) if (e.user_id) vidUser.set(e.vid, e.user_id);
  const payersCur = new Set(paidCur.map((o) => o.user_id));

  const vids = new Set(cur.map((e) => e.vid));
  const engaged = new Set<string>();
  const loggedIn = new Set<string>();
  const checkout = new Set<string>();
  const readers = new Set<string>();
  const starters = new Set<string>();
  const unlockers = new Set<string>();
  const offerSeen = new Set<string>();
  for (const e of cur) {
    if (e.name !== 'page_view' || normalizePath(e.path) !== '/') engaged.add(e.vid);
    if (e.user_id || e.name === 'login') loggedIn.add(e.vid);
    if (e.name === 'checkout_start') checkout.add(e.vid);
    if (e.name === 'reading_done') readers.add(e.vid);
    if (e.name === 'ritual_begin') starters.add(e.vid);
    if (e.name === 'unlock_click') unlockers.add(e.vid);
    if (e.name === 'offer_seen') offerSeen.add(e.vid);
  }
  // 後面的步驟一定經過前面的步驟：去結帳的人必定按過解鎖、看過結果（舊資料沒記這兩步時也不會倒掛）。
  for (const vid of checkout) unlockers.add(vid);
  // offer_seen 2026-11-18 才開始記：按過解鎖的必定看過價錢（舊資料不倒掛）。
  for (const vid of unlockers) offerSeen.add(vid);
  for (const vid of offerSeen) readers.add(vid);
  for (const vid of unlockers) readers.add(vid);
  // Older visits had completion but no start event; count these as started so
  // a later funnel stage can never exceed the preceding one.
  for (const vid of readers) starters.add(vid);
  let payingVisitors = 0;
  for (const vid of vids) {
    const user = vidUser.get(vid);
    if (user && payersCur.has(user)) payingVisitors++;
  }
  const funnel = [
    { key: 'visit', count: vids.size },
    { key: 'engage', count: engaged.size },
    { key: 'start', count: starters.size },
    { key: 'reading', count: readers.size },
    { key: 'offer', count: offerSeen.size },
    { key: 'unlock', count: unlockers.size },
    { key: 'checkout', count: checkout.size },
    { key: 'paid', count: payingVisitors },
  ];

  // 一次造訪（sid）的路徑：頁面與關鍵動作依時間排，連續重複的合併；付款從訂單補進最後一段。
  const sessions = new Map<
    string,
    {
      sid: string;
      vid: string;
      user: string | null;
      start: number;
      end: number;
      steps: Step[];
      device: string | null;
      country: string | null;
      referrer: string | null;
      locale: string | null;
    }
  >();
  for (const e of cur.slice().sort((a, b) => a.t - b.t)) {
    let s = sessions.get(e.sid);
    if (!s) {
      s = {
        sid: e.sid,
        vid: e.vid,
        user: null,
        start: e.t,
        end: e.t,
        steps: [],
        device: e.device,
        country: e.country,
        referrer: e.referrer,
        locale: e.locale,
      };
      sessions.set(e.sid, s);
    }
    s.end = e.t;
    if (e.user_id) s.user = e.user_id;
    const key = stepOf(e);
    if (key && s.steps[s.steps.length - 1]?.key !== key) s.steps.push({ key, at: e.t });
  }
  for (const s of sessions.values()) if (!s.user) s.user = vidUser.get(s.vid) ?? null;
  const byUser = new Map<string, (typeof sessions extends Map<string, infer V> ? V : never)[]>();
  for (const s of sessions.values()) {
    if (!s.user) continue;
    const list = byUser.get(s.user) ?? [];
    list.push(s);
    byUser.set(s.user, list);
  }
  for (const o of paidCur) {
    const at = Date.parse(o.paid_at as string);
    const candidates = (byUser.get(o.user_id) ?? []).filter(
      (s) => s.start <= at && at <= s.end + SESSION_GAP_MS,
    );
    const s = candidates.sort((a, b) => b.start - a.start)[0];
    if (s) s.steps.push({ key: '@paid', at });
  }

  const sessionList = [...sessions.values()];
  const pathCounts = new Map<string, { steps: string[]; count: number; paid: number }>();
  const transitions = new Map<string, number>();
  const entries = new Map<string, number>();
  const exits = new Map<string, number>();
  for (const s of sessionList) {
    const keys = s.steps.map((x) => x.key);
    if (!keys.length) continue;
    const head = keys.slice(0, PATH_STEPS);
    const id = head.join('>');
    const row = pathCounts.get(id) ?? { steps: head, count: 0, paid: 0 };
    row.count++;
    if (keys.includes('@paid')) row.paid++;
    pathCounts.set(id, row);
    entries.set(keys[0] as string, (entries.get(keys[0] as string) ?? 0) + 1);
    const last = keys[keys.length - 1] as string;
    exits.set(last, (exits.get(last) ?? 0) + 1);
    for (let i = 0; i + 1 < keys.length; i++) {
      const k = `${keys[i]}>${keys[i + 1]}`;
      transitions.set(k, (transitions.get(k) ?? 0) + 1);
    }
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([label, count]) => ({ label, count }));

  // 三欄流向：第一步 → 第二步 → 第三步（沒有下一步的記成「離開」）。
  const flow: { from: string; to: string; stage: number; count: number }[] = [];
  const flowMap = new Map<string, number>();
  for (const s of sessionList) {
    const keys = s.steps.map((x) => x.key);
    if (!keys.length) continue;
    for (let stage = 0; stage < 2; stage++) {
      const from = keys[stage];
      if (!from) break;
      const to = keys[stage + 1] ?? '@exit';
      const k = `${stage}|${from}|${to}`;
      flowMap.set(k, (flowMap.get(k) ?? 0) + 1);
      if (to === '@exit') break;
    }
  }
  for (const [k, count] of flowMap) {
    const [stage, from, to] = k.split('|');
    flow.push({ stage: Number(stage), from: from as string, to: to as string, count });
  }

  const recent = sessionList
    .sort((a, b) => b.start - a.start)
    .slice(0, 40)
    .map((s) => ({
      start: new Date(s.start).toISOString(),
      seconds: Math.round((s.end - s.start) / 1000),
      member: Boolean(s.user),
      device: s.device,
      country: s.country,
      referrer: s.referrer,
      locale: s.locale,
      steps: s.steps.slice(0, 14).map((x) => x.key),
      paid: s.steps.some((x) => x.key === '@paid'),
    }));

  const pageViews = cur.filter((e) => e.name === 'page_view');
  const products = new Map<string, { count: number; revenue: number }>();
  for (const o of paidCur) {
    const p = products.get(o.product_id) ?? { count: 0, revenue: 0 };
    p.count++;
    if (o.currency.toUpperCase() === 'HKD') p.revenue += net(o);
    products.set(o.product_id, p);
  }

  // 結帳：區間內建立的正式訂單，付了幾張、放棄幾張。
  const liveCur = liveOrders.filter((o) => inRange(Date.parse(o.created_at)));
  const checkoutStats = {
    started: liveCur.length,
    uniqueAccounts: new Set(liveCur.map((o) => o.user_id)).size,
    paid: liveCur.filter((o) => o.status === 'paid').length,
    failed: liveCur.filter((o) => o.status === 'failed').length,
    // 超過半小時還沒付的算放棄；半小時內的可能還在付款頁
    abandoned: liveCur.filter(
      (o) => o.status !== 'paid' && o.status !== 'failed' && end - Date.parse(o.created_at) > 30 * 60_000,
    ).length,
  };
  const orderList = input.orders
    .filter((o) => inRange(Date.parse(o.created_at)) || (o.paid_at && inRange(Date.parse(o.paid_at))))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 60)
    .map((o) => ({
      no: o.id.slice(0, 8).toUpperCase(),
      created: o.created_at,
      paid: o.paid_at,
      product: o.product_id,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
      live: isLive(o),
      refunded: Math.min(o.amount, input.refunds.get(o.id) ?? 0),
    }));

  return {
    range: { days, start: new Date(start).toISOString(), end: new Date(end).toISOString() },
    kpis: { ...kpis, loggedIn: loggedIn.size },
    checkout: checkoutStats,
    orderList,
    ops: input.ops ?? null,
    daily,
    funnel,
    pages: distinctBy(
      pageViews,
      (e) => normalizePath(e.path),
      (e) => e.vid,
      12,
    ).map((p) => ({
      ...p,
      views: pageViews.filter((e) => normalizePath(e.path) === p.label).length,
    })),
    referrers: distinctBy(
      cur,
      (e) => e.referrer ?? '(direct)',
      (e) => e.vid,
      8,
    ),
    devices: distinctBy(
      cur,
      (e) => e.device,
      (e) => e.vid,
      3,
    ),
    countries: distinctBy(
      cur,
      (e) => e.country,
      (e) => e.vid,
      8,
    ),
    locales: distinctBy(
      cur,
      (e) => e.locale,
      (e) => e.vid,
      8,
    ),
    events: countBy(
      cur.filter((e) => e.name !== 'page_view'),
      (e) => e.name,
      20,
    ),
    products: [...products.entries()].map(([id, p]) => ({ id, ...p })).sort((a, b) => b.revenue - a.revenue),
    paths: [...pathCounts.values()].sort((a, b) => b.count - a.count).slice(0, 15),
    transitions: top(transitions, 15),
    entries: top(entries, 8),
    exits: top(exits, 8),
    flow,
    recent,
    meta: {
      eventsTruncated: input.eventsTruncated,
      trackedSince: Number.isFinite(earliestEventTime) ? new Date(earliestEventTime).toISOString() : null,
      // If event collection began after this window started, session/visitor
      // attribution is incomplete. Never display a confident payment conversion.
      completeWindowTracking: Number.isFinite(earliestEventTime) && earliestEventTime <= start,
    },
  };
}

export type AdminStats = ReturnType<typeof computeStats>;

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export async function adminStatsRequest(
  request: Request,
  database: Supabase | null,
  user: SessionUser | null,
  admins: readonly string[],
): Promise<Response> {
  if (!user) return errorResponse(401, 'login_required');
  if (!isAdminEmail(user.email, admins)) return errorResponse(403, 'forbidden');
  if (!database) return errorResponse(503, 'supabase_not_configured');
  const asked = Number(new URL(request.url).searchParams.get('days') ?? 7);
  const days = (RANGE_DAYS as readonly number[]).includes(asked) ? asked : 7;
  const now = new Date();
  const since = new Date(now.getTime() - days * 2 * 86_400_000).toISOString();

  const [eventsResult, ordersResult, profilesResult, totalResult] = await Promise.all([
    pageAll<EventRow>((from, to) =>
      database
        .from('site_events')
        .select('at,vid,sid,user_id,name,path,props,referrer,device,country,locale')
        .gte('at', since)
        .order('at', { ascending: true })
        .range(from, to),
    ).catch(() => null),
    pageAll<OrderRow>((from, to) =>
      database
        .from('orders')
        .select('id,user_id,product_id,amount,currency,status,checkout_ref,created_at,paid_at')
        .or(`created_at.gte.${since},paid_at.gte.${since}`)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    pageAll<ProfileRow>((from, to) =>
      database
        .from('profiles')
        .select('id,created_at')
        // 「新註冊」只算有信箱的帳號；訪客（按解鎖時自動建、還沒綁信箱）不算
        .not('email', 'is', null)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    database.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'is', null),
  ]).catch(() => [null, null, null, null] as const);
  if (!ordersResult || !profilesResult) return errorResponse(503, 'stats_unavailable');

  const paidIds = ordersResult.rows.filter((o) => o.status === 'paid').map((o) => o.id);
  const refunds = new Map<string, number>();
  for (let i = 0; i < paidIds.length; i += 200) {
    const { data } = await database
      .from('payments')
      .select('order_id,amount_refunded')
      .in('order_id', paidIds.slice(i, i + 200));
    for (const p of (data ?? []) as { order_id: string | null; amount_refunded: number }[]) {
      if (p.order_id) refunds.set(p.order_id, Math.max(refunds.get(p.order_id) ?? 0, p.amount_refunded ?? 0));
    }
  }

  // 內容表各數一次；哪張表讀不到（還沒建）就回 null，不拖垮整頁。
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  type Counter = PromiseLike<{ count: number | null; error: unknown }>;
  const count = async (query: Counter): Promise<number | null> => {
    try {
      const { count: n, error } = await query;
      return error ? null : (n ?? 0);
    } catch {
      return null;
    }
  };
  const head = (table: string) => database.from(table).select('*', { count: 'exact', head: true });
  const [
    stickReadings,
    spreadReadings,
    failedStick,
    failedSpread,
    wishes,
    wishesPending,
    blessings,
    checkins,
    offerings,
  ] = await Promise.all([
    count(head('paid_ai_readings').eq('status', 'ready').gte('created_at', from)),
    count(head('spread_ai_readings').eq('status', 'ready').gte('created_at', from)),
    count(head('paid_ai_readings').eq('status', 'failed').gte('created_at', from)),
    count(head('spread_ai_readings').eq('status', 'failed').gte('created_at', from)),
    count(head('wishes').gte('created_at', from)),
    count(head('wishes').eq('status', 'pending')),
    count(head('wish_blessings').gte('created_at', from)),
    count(head('daily_checkins').gte('created_at', from)),
    count(head('hall_offerings').gte('created_at', from)),
  ]);
  const ops: OpsCounts = {
    stickReadings,
    spreadReadings,
    failedReadings:
      failedStick === null && failedSpread === null ? null : (failedStick ?? 0) + (failedSpread ?? 0),
    wishes,
    wishesPending,
    blessings,
    checkins,
    offerings,
  };

  const stats = computeStats({
    days,
    now,
    ops,
    events: eventsResult?.rows ?? [],
    orders: ordersResult.rows,
    refunds,
    profiles: profilesResult.rows,
    totalUsers: (totalResult as { count: number | null } | null)?.count ?? 0,
    eventsTruncated: eventsResult?.truncated ?? false,
  });
  return json({ ...stats, tracking: eventsResult !== null });
}
