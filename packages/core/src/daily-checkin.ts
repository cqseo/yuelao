import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from './auth';
import { jsonRequest, sameOriginPost } from './auth-session';
import { errorResponse, json } from './http';

// 每日心箋簽到存到帳號（DESIGN.md「每日簽到同步到帳號」）。
// 沒登入回 401，前端就照舊只記在瀏覽器；伺服器只存「哪一天簽過」，不存心箋內容。

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string =>
  typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(v));

export type DailyState = { streak: number; lastDate: string; checkedDates: string[] };

function shape(data: unknown): DailyState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if ('error' in d) return null;
  const dates = Array.isArray(d.checkedDates) ? d.checkedDates.filter(isDay) : [];
  return {
    streak: typeof d.streak === 'number' && d.streak >= 0 ? Math.min(d.streak, 3650) : 0,
    lastDate: isDay(d.lastDate) ? d.lastDate : '',
    checkedDates: dates.slice(-30),
  };
}

/**
 * GET  ?today=YYYY-MM-DD → 目前狀態。
 * POST { today, check: boolean, backfill?: string[] } → 簽到並補登瀏覽器裡的舊紀錄，回最新狀態。
 */
export async function dailyCheckinRequest(
  request: Request,
  db: SupabaseClient | null,
  user: SessionUser | null,
): Promise<Response> {
  if (!user) return errorResponse(401, 'login_required');
  if (!db) return errorResponse(503, 'daily_unavailable');
  if (request.method === 'GET') {
    const today = new URL(request.url).searchParams.get('today');
    if (!isDay(today)) return errorResponse(400, 'invalid_day');
    const { data, error } = await db.rpc('daily_checkin_state', { p_user_id: user.id, p_today: today });
    const state = error ? null : shape(data);
    return state
      ? json(state, { headers: { 'cache-control': 'no-store' } })
      : errorResponse(503, 'daily_unavailable');
  }
  if (!sameOriginPost(request) || !jsonRequest(request)) return errorResponse(403, 'forbidden');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!isDay(b.today)) return errorResponse(400, 'invalid_day');
  const backfill = Array.isArray(b.backfill) ? b.backfill.filter(isDay).slice(0, 30) : [];
  const { data, error } = await db.rpc('record_daily_checkin', {
    p_user_id: user.id,
    p_today: b.today,
    p_check: b.check === true,
    p_backfill: backfill,
  });
  if (error) return errorResponse(503, 'daily_unavailable');
  if (data && typeof data === 'object' && 'error' in data) return errorResponse(400, 'invalid_day');
  const state = shape(data);
  return state
    ? json(state, { headers: { 'cache-control': 'no-store' } })
    : errorResponse(503, 'daily_unavailable');
}
