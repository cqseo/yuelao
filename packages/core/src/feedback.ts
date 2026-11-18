import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountUser } from './auth';
import { sameOriginPost } from './auth-session';
import type { CoreEnv } from './env';
import { errorResponse, json } from './http';
import { deviceFrom } from './site-events';

// 用戶意見（站長 2026-11-18）：任何人都能留一句（不用登入），只有站長在後台看得到。
// 擋濫用：同一個 IP 每分鐘最多 5 則（與訪客帳號共用 Workers 限流，key 前綴不同）、內容長度上限、欄位白名單。
// 資料庫：supabase/migrations/20261118090001_feedback.sql。

export const FEEDBACK_KINDS = ['idea', 'problem', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
  contact: string | null;
  page: string | null;
  locale: string | null;
};

export function parseFeedback(value: unknown): FeedbackInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== 'string' || !(FEEDBACK_KINDS as readonly string[]).includes(v.kind)) return null;
  if (typeof v.message !== 'string') return null;
  const message = v.message.trim();
  if (message.length < 2 || message.length > 1000) return null;
  let contact: string | null = null;
  if (v.contact !== undefined && v.contact !== null && v.contact !== '') {
    if (typeof v.contact !== 'string') return null;
    contact = v.contact.trim() || null;
    if (contact && (contact.length < 3 || contact.length > 120)) return null;
  }
  const page =
    typeof v.page === 'string' && v.page.startsWith('/') && v.page.length <= 200
      ? v.page.split(/[?#]/)[0]!
      : null;
  const locale = typeof v.locale === 'string' && /^[a-zA-Z-]{2,8}$/.test(v.locale) ? v.locale : null;
  return { kind: v.kind as FeedbackKind, message, contact, page, locale };
}

/** POST /api/feedback */
export async function submitFeedbackRequest(
  request: Request,
  database: SupabaseClient | null,
  user: AccountUser | null,
  env: CoreEnv,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!database) return errorResponse(503, 'feedback_unavailable');
  const text = await request.text();
  if (text.length > 4000) return errorResponse(413, 'request_too_large');
  let input: FeedbackInput | null;
  try {
    input = parseFeedback(JSON.parse(text));
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  if (!input) return errorResponse(400, 'invalid_feedback');
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.GUEST_RATE_LIMITER) {
    const { success } = await env.GUEST_RATE_LIMITER.limit({ key: `feedback:${ip}` });
    if (!success) return errorResponse(429, 'feedback_rate_limited');
  }
  const { error } = await database.from('feedback').insert({
    kind: input.kind,
    message: input.message,
    contact: input.contact,
    page: input.page,
    locale: input.locale,
    device: deviceFrom(request.headers.get('user-agent') ?? ''),
    user_id: user?.id ?? null,
  });
  if (error) return errorResponse(503, 'feedback_unavailable');
  return json({ ok: true }, { status: 201 });
}

/** GET：最近的意見（新的在前）；POST {id, status}：標成已讀／已處理。權限由呼叫端先檢查。 */
export async function adminFeedbackRequest(request: Request, database: SupabaseClient): Promise<Response> {
  if (request.method === 'POST') {
    if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
    let body: { id?: unknown; status?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse(400, 'invalid_json');
    }
    const { id, status } = body;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return errorResponse(400, 'invalid_id');
    if (status !== 'new' && status !== 'read' && status !== 'done')
      return errorResponse(400, 'invalid_status');
    const { error } = await database
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return errorResponse(503, 'feedback_unavailable');
    return json({ ok: true });
  }
  const { data, error } = await database
    .from('feedback')
    .select('id,created_at,kind,message,contact,page,locale,device,user_id,status')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return errorResponse(503, 'feedback_unavailable');
  return json({ feedback: data ?? [] }, { headers: { 'cache-control': 'no-store' } });
}
