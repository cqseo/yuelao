import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonRequest, sameOriginPost } from './auth-session';
import { errorResponse, json } from './http';
import { screenWish } from './wishes';

// 功德排行榜：不用登入。瀏覽器自己產生一把隨機「裝置鑰匙」（64 位 hex），每次帶上；
// 這裡只把它的 SHA-256 存進資料庫，所以資料庫外洩也拿不到鑰匙、冒充不了別人。
// 客戶端只送「這次多敲了幾下」，上限與速率在 RPC 裡擋（見 20261121130000_merit_board.sql）。

export const MERIT_NICK_MAX = 10;
export const MERIT_RANGES = ['day', 'week', 'all'] as const;
export type MeritRange = (typeof MERIT_RANGES)[number];
const DEVICE = /^[0-9a-f]{64}$/;
const MAX_BODY_BYTES = 400;

export async function hashDevice(device: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`merit:${device}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 法號：一行、1–10 字、不能留聯絡方式或罵人。不合格回 null。 */
export function parseNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.replace(/\s+/gu, ' ').trim();
  if (!s || [...s].length > MERIT_NICK_MAX) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: blocking control characters is the point.
  if (/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/u.test(s)) return null;
  if (screenWish(s) !== 'ok') return null;
  return s;
}

export function parseSubmit(
  value: unknown,
): { device: string; delta: number; nickname: string | null } | 'invalid' | 'bad_nickname' {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  const v = value as Record<string, unknown>;
  if (typeof v.device !== 'string' || !DEVICE.test(v.device)) return 'invalid';
  if (typeof v.delta !== 'number' || !Number.isInteger(v.delta) || v.delta < 0 || v.delta > 5000)
    return 'invalid';
  let nickname: string | null = null;
  if (v.nickname !== undefined && v.nickname !== null && v.nickname !== '') {
    nickname = parseNickname(v.nickname);
    if (!nickname) return 'bad_nickname';
  }
  return { device: v.device, delta: v.delta, nickname };
}

async function readBody(request: Request): Promise<unknown | Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  // sendBeacon 送的是 text/plain，也收（內容一樣是 JSON）。
  const type = request.headers.get('content-type') ?? '';
  if (!jsonRequest(request) && !type.startsWith('text/plain')) return errorResponse(415, 'json_only');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return errorResponse(413, 'request_too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return errorResponse(400, 'invalid_json');
  }
}

/** POST /api/merit：{ device, delta, nickname? } → { today, accepted } */
export async function submitMeritRequest(
  request: Request,
  database: SupabaseClient | null,
): Promise<Response> {
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const input = parseSubmit(body);
  if (input === 'invalid') return errorResponse(400, 'invalid_request');
  if (input === 'bad_nickname') return errorResponse(422, 'bad_nickname');
  if (!database) return errorResponse(503, 'merit_unavailable');
  const { data, error } = await database.rpc('submit_merit', {
    p_device_hash: await hashDevice(input.device),
    p_nickname: input.nickname,
    p_delta: input.delta,
  });
  const d = data as { today?: number; accepted?: number; error?: string } | null;
  if (error || !d || d.error) return errorResponse(503, 'merit_unavailable');
  return json({ today: d.today ?? 0, accepted: d.accepted ?? 0 });
}

export type BoardRow = { rank: number; nickname: string; total: number; me: boolean };

/** GET /api/merit?range=day|week|all，裝置鑰匙放 X-Merit-Device（不放網址）。 */
export async function meritBoardRequest(
  request: Request,
  database: SupabaseClient | null,
): Promise<Response> {
  const range = new URL(request.url).searchParams.get('range') ?? 'day';
  if (!(MERIT_RANGES as readonly string[]).includes(range)) return errorResponse(400, 'invalid_range');
  const device = request.headers.get('x-merit-device') ?? '';
  if (!database) return errorResponse(503, 'merit_unavailable');
  const { data, error } = await database.rpc('merit_board', {
    p_range: range,
    p_device_hash: DEVICE.test(device) ? await hashDevice(device) : '',
  });
  const d = data as {
    top?: BoardRow[];
    me?: { rank: number; total: number } | null;
    players?: number;
    day?: string;
    error?: string;
  } | null;
  if (error || !d || d.error) return errorResponse(503, 'merit_unavailable');
  return json(
    {
      range,
      day: d.day ?? null,
      players: d.players ?? 0,
      top: (d.top ?? []).map((r) => ({ rank: r.rank, nickname: r.nickname, total: r.total, me: r.me })),
      me: d.me ? { rank: d.me.rank, total: d.me.total } : null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
