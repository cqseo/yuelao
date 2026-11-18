import type { SessionUser } from './auth';
import { sameOriginPost } from './auth-session';
import type { Supabase } from './supabase';

// 第一方行為紀錄：瀏覽器把一小批事件 POST 到 /api/track，這裡驗格式後寫進 site_events。
// 不存 IP；國家取 Cloudflare 給的兩碼代號，裝置由 User-Agent 粗分。任何錯誤都安靜吞掉（204），
// 統計壞了不能影響網站本身。

export interface TrackedEvent {
  name: string;
  path: string;
  props: Record<string, string | number | boolean>;
  at: string;
}

export interface TrackBatch {
  vid: string;
  sid: string;
  referrer: string | null;
  locale: string | null;
  events: TrackedEvent[];
}

const ID = /^[A-Za-z0-9_-]{8,40}$/;
const NAME = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_EVENTS = 25;
const MAX_BODY = 16_000;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|pingdom|monitor/i;
/**
 * 機房網段（站長 2026-11-18：一週 40 位「美國訪客」幾乎都是直接打開、只看一頁就走，像是會跑 JS 的爬蟲／連結預覽）。
 * 只列雲端主機與 Meta 的網段；Cloudflare、Akamai、Fastly 不列，iPhone 的「私密轉送」走這些，那是真人。
 */
const DATACENTER_ASNS = new Set([
  16509, 14618, // Amazon AWS
  15169, 396982, // Google / Google Cloud
  8075, // Microsoft / Azure
  32934, // Meta（連結預覽爬蟲）
  14061, // DigitalOcean
  16276, // OVH
  24940, // Hetzner
  63949, // Linode
  31898, // Oracle Cloud
  20473, // Vultr
  45102, // Alibaba Cloud
  132203, // Tencent Cloud
]);
export function fromDatacenter(asn: unknown): boolean {
  return typeof asn === 'number' && DATACENTER_ASNS.has(asn);
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  const path = value.split(/[?#]/)[0] ?? '';
  return path.slice(0, 200);
}

function cleanProps(value: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value).slice(0, 10)) {
    if (!/^[a-z][a-z0-9_]{0,30}$/i.test(key)) continue;
    if (typeof raw === 'string') out[key] = raw.slice(0, 80);
    else if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw;
    else if (typeof raw === 'boolean') out[key] = raw;
  }
  return out;
}

/** Referrer as a bare host; our own host and empty values become null. */
export function referrerHost(value: unknown, ownHost: string): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || host === ownHost.replace(/^www\./, '').toLowerCase()) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

export function deviceFrom(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (
    /ipad|tablet|kindle|silk|playbook/i.test(userAgent) ||
    (/android/i.test(userAgent) && !/mobile/i.test(userAgent))
  )
    return 'tablet';
  if (/mobi|iphone|ipod|android|micromessenger/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/** Parses and validates a batch; returns null when the payload is unusable. */
export function parseTrackBatch(body: unknown, ownHost: string, now = new Date()): TrackBatch | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.vid !== 'string' || !ID.test(b.vid)) return null;
  if (typeof b.sid !== 'string' || !ID.test(b.sid)) return null;
  if (!Array.isArray(b.events) || b.events.length === 0) return null;
  const events: TrackedEvent[] = [];
  for (const raw of b.events.slice(0, MAX_EVENTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.name !== 'string' || !NAME.test(e.name)) continue;
    const path = cleanPath(e.path);
    if (path === null) continue;
    // 事件時間取瀏覽器送來的（批次會延遲幾秒），但不得在未來、也不能早於 1 小時前。
    let at = now;
    if (typeof e.at === 'number' && Number.isFinite(e.at)) {
      const t = new Date(e.at);
      if (t.getTime() <= now.getTime() && now.getTime() - t.getTime() < 3_600_000) at = t;
    }
    events.push({ name: e.name, path, props: cleanProps(e.props), at: at.toISOString() });
  }
  if (!events.length) return null;
  const locale = typeof b.locale === 'string' && /^[a-zA-Z-]{2,8}$/.test(b.locale) ? b.locale : null;
  return { vid: b.vid, sid: b.sid, referrer: referrerHost(b.referrer, ownHost), locale, events };
}

export function isAdminEmail(email: string | null | undefined, admins: readonly string[]): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return admins.some((a) => a.trim().toLowerCase() === e);
}

export async function trackRequest(
  request: Request,
  database: Supabase | null,
  getUser: () => Promise<SessionUser | null>,
  admins: readonly string[],
): Promise<Response> {
  const done = new Response(null, { status: 204 });
  if (!sameOriginPost(request) || !database) return done;
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!userAgent || BOT.test(userAgent)) return done;
  const text = await request.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return done;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done;
  }
  const url = new URL(request.url);
  const batch = parseTrackBatch(body, url.hostname);
  if (!batch) return done;

  // 登入的人才查身分；站長自己的操作不算進統計。
  const hasSession = /(?:^|;\s*)(?:__Host-yl_|yl_dev_)access=/.test(request.headers.get('cookie') ?? '');
  const user = hasSession ? await getUser().catch(() => null) : null;
  if (user && isAdminEmail(user.email, admins)) return done;

  const cf = (request as unknown as { cf?: { country?: string; asn?: number } }).cf;
  if (fromDatacenter(cf?.asn)) return done;
  const country = (cf?.country ?? request.headers.get('cf-ipcountry') ?? '').toUpperCase();
  const rows = batch.events.map((e) => ({
    at: e.at,
    vid: batch.vid,
    sid: batch.sid,
    user_id: user?.id ?? null,
    name: e.name,
    path: e.path,
    props: e.props,
    referrer: batch.referrer,
    device: deviceFrom(userAgent),
    country: /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : null,
    locale: batch.locale,
  }));
  const { error } = await database.from('site_events').insert(rows);
  // 剛註冊、profiles 還沒建好時外鍵會擋：退回不帶 user_id 再寫一次。
  if (error && rows[0]?.user_id) {
    await database.from('site_events').insert(rows.map((r) => ({ ...r, user_id: null })));
  }
  return done;
}
