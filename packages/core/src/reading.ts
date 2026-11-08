import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from './auth';
import { getDeepReading } from './entitlements';
import { errorResponse, json } from './http';

type ReadingParams = {
  stickId: number;
  category: 'him' | 'single' | 'reunion';
  locale: 'zh-Hant' | 'zh-Hans';
};

export function parseReadingParams(url: URL): ReadingParams | null {
  const id = url.searchParams.get('stickId');
  const category = url.searchParams.get('category');
  const locale = url.searchParams.get('locale');
  if (!id || !/^[1-9]\d{0,2}$/.test(id)) return null;
  const stickId = Number(id);
  if (stickId > 100) return null;
  if (category !== 'him' && category !== 'single' && category !== 'reunion') return null;
  if (locale !== 'zh-Hant' && locale !== 'zh-Hans') return null;
  return { stickId, category, locale };
}

/** This endpoint is never a public document or SSR data source. It validates
 * the JWT first and delegates ownership checking to get_deep_reading RPC. */
export async function paidReadingResponse(
  request: Request,
  db: SupabaseClient | null,
  user: SessionUser | null,
): Promise<Response> {
  if (!user) return errorResponse(401, 'login_required');
  if (!db) return errorResponse(503, 'reading_unavailable');
  const params = parseReadingParams(new URL(request.url));
  if (!params) return errorResponse(400, 'invalid_reading_selection');
  try {
    const body = await getDeepReading(db, user.id, params.stickId, params.category, params.locale);
    if (!body) return errorResponse(404, 'reading_not_available');
    return json({ stickId: params.stickId, category: params.category, locale: params.locale, body });
  } catch {
    return errorResponse(503, 'reading_unavailable');
  }
}
