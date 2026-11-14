import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonRequest, sameOriginPost } from './auth-session';
import { errorResponse, json } from './http';

// 大殿「今天已有 N 人上過香」（DESIGN.md）。不需要登入：前端送瀏覽器裡的隨機種子，
// 伺服器雜湊後存（不能回推是誰），同一人同一天只算一次。「今天」照台北時間由資料庫決定。

const VISITOR = /^[a-z0-9]{6,32}$/;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** POST { visitor } → { count }：記一次上香，回今天的總人數。 */
export async function hallOfferingRequest(
  request: Request,
  db: SupabaseClient | null,
  salt: string,
): Promise<Response> {
  if (!sameOriginPost(request) || !jsonRequest(request)) return errorResponse(403, 'forbidden');
  if (!db) return errorResponse(503, 'count_unavailable');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  const visitor = (body as { visitor?: unknown } | null)?.visitor;
  if (typeof visitor !== 'string' || !VISITOR.test(visitor)) return errorResponse(400, 'invalid_visitor');
  const hashed = await sha256Hex(`hall|${salt}|${visitor}`);
  const { data, error } = await db.rpc('record_hall_offering', { p_visitor: hashed });
  if (error || typeof data !== 'number') return errorResponse(503, 'count_unavailable');
  return json({ count: data });
}
