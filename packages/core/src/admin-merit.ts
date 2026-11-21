import type { SessionUser } from './auth';
import { jsonRequest, sameOriginPost } from './auth-session';
import { errorResponse, json } from './http';
import { isAdminEmail } from './site-events';
import type { Supabase } from './supabase';

// 站長後台「功德排行榜」：每天多少人上榜、敲了多少下、有多少是回來的人；
// 今日榜單可以把不當法號從榜上收起（hidden）。權限在伺服器端檢查，資料經 service_role 讀。

export const MERIT_ADMIN_DAYS = 30;
const DEVICE = /^[0-9a-f]{64}$/;

export interface MeritScoreRow {
  device_hash: string;
  day: string;
  count: number;
}
export interface MeritPlayerRow {
  device_hash: string;
  nickname: string;
  hidden: boolean;
  created_at: string;
}

/** 台北時間（＝北京時間）的日期字串。 */
export function taipeiDay(time: number): string {
  return new Date(time + 8 * 3600_000).toISOString().slice(0, 10);
}
function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86400_000).toISOString().slice(0, 10);
}

export function computeMeritStats(
  scores: MeritScoreRow[],
  players: MeritPlayerRow[],
  now: number,
  days = MERIT_ADMIN_DAYS,
) {
  const today = taipeiDay(now);
  const from = shiftDay(today, -(days - 1));
  const byPlayer = new Map(players.map((p) => [p.device_hash, p]));
  // 每個人第一次有敲的那天（看這 30 天的紀錄，再往前就用第一次出現的時間）
  // 只算真的敲過的人（只改了法號、一下都沒敲的不算）
  const firstDay = new Map<string, string>();
  for (const s of scores) {
    if (s.count <= 0) continue;
    const f = firstDay.get(s.device_hash);
    if (!f || s.day < f) firstDay.set(s.device_hash, s.day);
  }
  for (const p of players) {
    const f = firstDay.get(p.device_hash);
    const c = taipeiDay(Date.parse(p.created_at));
    if (f && c < f) firstDay.set(p.device_hash, c);
  }

  const active = new Map<string, Map<string, number>>(); // day → device → count
  for (const s of scores) {
    if (s.count <= 0 || s.day < from || s.day > today) continue;
    const m = active.get(s.day) ?? new Map<string, number>();
    m.set(s.device_hash, (m.get(s.device_hash) ?? 0) + s.count);
    active.set(s.day, m);
  }

  const daily: { day: string; players: number; taps: number; fresh: number; returning: number }[] = [];
  for (let d = from; d <= today; d = shiftDay(d, 1)) {
    const m = active.get(d) ?? new Map<string, number>();
    let taps = 0;
    let fresh = 0;
    for (const [dev, n] of m) {
      taps += n;
      if ((firstDay.get(dev) ?? d) >= d) fresh++;
    }
    daily.push({ day: d, players: m.size, taps, fresh, returning: m.size - fresh });
  }

  // 次日回來率：昨天第一次來的人，今天又來敲的比例（前天→昨天也給一個，今天還沒過完）
  const nextDay = (d: string) => {
    const firsts = [...firstDay].filter(([, f]) => f === d).map(([dev]) => dev);
    const next = active.get(shiftDay(d, 1)) ?? new Map();
    return { day: d, base: firsts.length, back: firsts.filter((dev) => next.has(dev)).length };
  };

  const todayMap = active.get(today) ?? new Map<string, number>();
  const daysActive = new Map<string, number>();
  for (const m of active.values())
    for (const dev of m.keys()) daysActive.set(dev, (daysActive.get(dev) ?? 0) + 1);
  const board = [...todayMap]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([dev, n]) => {
      const p = byPlayer.get(dev);
      return {
        id: dev,
        nickname: p?.nickname ?? '?',
        hidden: p?.hidden ?? false,
        today: n,
        days: daysActive.get(dev) ?? 1,
        since: firstDay.get(dev) ?? today,
      };
    });
  const hidden = players
    .filter((p) => p.hidden)
    .map((p) => ({ id: p.device_hash, nickname: p.nickname }))
    .slice(0, 50);

  const last7 = daily.slice(-7);
  return {
    today,
    daily,
    kpi: {
      playersToday: todayMap.size,
      tapsToday: [...todayMap.values()].reduce((a, b) => a + b, 0),
      returningToday: daily.at(-1)?.returning ?? 0,
      avgPlayers7:
        Math.round((last7.reduce((a, b) => a + b.players, 0) / Math.max(1, last7.length)) * 10) / 10,
      allPlayers: firstDay.size,
    },
    retention: [nextDay(shiftDay(today, -2)), nextDay(shiftDay(today, -1))],
    board,
    hidden,
  };
}
export type MeritAdminStats = ReturnType<typeof computeMeritStats>;

function gate(
  user: SessionUser | null,
  admins: readonly string[],
  database: Supabase | null,
): Response | null {
  if (!user) return errorResponse(401, 'login_required');
  if (!isAdminEmail(user.email, admins)) return errorResponse(403, 'forbidden');
  if (!database) return errorResponse(503, 'supabase_not_configured');
  return null;
}

/** GET：統計；POST { id, hidden }：把某個法號從榜上收起或放回。 */
export async function adminMeritRequest(
  request: Request,
  database: Supabase | null,
  user: SessionUser | null,
  admins: readonly string[],
  now = Date.now(),
): Promise<Response> {
  const denied = gate(user, admins, database);
  if (denied) return denied;
  const db = database as Supabase;

  if (request.method === 'POST') {
    if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
    if (!jsonRequest(request)) return errorResponse(415, 'json_only');
    let body: { id?: unknown; hidden?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse(400, 'invalid_json');
    }
    if (typeof body.id !== 'string' || !DEVICE.test(body.id) || typeof body.hidden !== 'boolean')
      return errorResponse(400, 'invalid_request');
    const { error } = await db
      .from('merit_players')
      .update({ hidden: body.hidden })
      .eq('device_hash', body.id);
    if (error) return errorResponse(503, 'merit_unavailable');
    return json({ ok: true });
  }

  const from = shiftDay(taipeiDay(now), -(MERIT_ADMIN_DAYS - 1));
  const scores = await db
    .from('merit_scores')
    .select('device_hash,day,count')
    .gte('day', from)
    .order('day')
    .limit(50000);
  if (scores.error) return errorResponse(503, 'merit_unavailable');
  const devs = [...new Set(((scores.data ?? []) as MeritScoreRow[]).map((s) => s.device_hash))];
  const players: MeritPlayerRow[] = [];
  for (let i = 0; i < devs.length; i += 200) {
    const { data, error } = await db
      .from('merit_players')
      .select('device_hash,nickname,hidden,created_at')
      .in('device_hash', devs.slice(i, i + 200));
    if (error) return errorResponse(503, 'merit_unavailable');
    players.push(...((data ?? []) as MeritPlayerRow[]));
  }
  // 被收起的法號也要列出來（可能不在這 30 天裡）
  const hidden = await db
    .from('merit_players')
    .select('device_hash,nickname,hidden,created_at')
    .eq('hidden', true)
    .limit(50);
  for (const p of (hidden.data ?? []) as MeritPlayerRow[])
    if (!players.some((x) => x.device_hash === p.device_hash)) players.push(p);
  return json(computeMeritStats((scores.data ?? []) as MeritScoreRow[], players, now));
}
