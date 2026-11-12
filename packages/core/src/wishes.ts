import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from './auth';
import { jsonRequest, sameOriginPost } from './auth-session';
import type { CoreEnv } from './env';
import { errorResponse, json } from './http';

// 許願池：願望是使用者寫的、所有人可見。這裡負責
//   1. 解析與驗證輸入（一句話、固定類別）
//   2. 本地過濾：聯絡方式、連結、明顯辱罵，直接退回讓使用者改寫
//   3. 自動審核（可選）：只有 WISH_AUTO_MODERATION=true 且有 OpenAI 金鑰才把文字送去 moderation；
//      通過就直接公開，否則停在待審，等人工放行。審核服務出錯也一律待審，不會放行。
//   4. 呼叫 Supabase RPC（只給 service_role），列表不回任何使用者身份。

export const WISH_TAGS = ['seek', 'keep', 'reunion', 'self', 'others'] as const;
export type WishTag = (typeof WISH_TAGS)[number];
export type WishLocale = 'zh-Hant' | 'zh-Hans';
export const WISH_MAX_CHARS = 40;
export const REPORT_REASONS = ['personal_info', 'harassment', 'sexual', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const MAX_BODY_BYTES = 800;
const LIST_LIMIT = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WishInput = { body: string; tag: WishTag; locale: WishLocale };
export type PublicWish = {
  id: string;
  body: string;
  tag: WishTag;
  blessings: number;
  createdAt: string;
  status: 'shown' | 'pending';
  mine: boolean;
  blessed: boolean;
};

export function wishesAvailable(env: CoreEnv, database: SupabaseClient | null): boolean {
  return env.WISHES_ENABLED === 'true' && database !== null;
}

function autoModerationOn(env: CoreEnv): boolean {
  return (
    env.WISH_AUTO_MODERATION === 'true' &&
    typeof env.OPENAI_API_KEY === 'string' &&
    env.OPENAI_API_KEY.startsWith('sk-')
  );
}

export function parseWish(value: unknown): WishInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.body !== 'string') return null;
  if (v.locale !== 'zh-Hant' && v.locale !== 'zh-Hans') return null;
  if (typeof v.tag !== 'string' || !(WISH_TAGS as readonly string[]).includes(v.tag)) return null;
  // 把各種空白（含全形、換行）收成一個半形空格；牌子上只有一行。
  const body = v.body.replace(/\s+/gu, ' ').trim();
  if (!body || [...body].length > WISH_MAX_CHARS) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: blocking control characters is the point.
  if (/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/u.test(body)) return null;
  return { body, tag: v.tag as WishTag, locale: v.locale };
}

export type ScreenResult = 'ok' | 'contact' | 'link' | 'abuse' | 'care';

/**
 * 本地過濾。只擋「掛出去一定不行」的：聯絡方式、連結、明顯辱罵與色情招攬。
 * 提到想傷害自己的，不掛出去，改由介面接住（care）。
 */
export function screenWish(body: string): ScreenResult {
  const s = body.normalize('NFKC').toLowerCase();
  const compact = s.replace(/[\s\-_.·・()（）[\]【】]/gu, '');
  if (/(想死|不想活|自殺|自杀|輕生|轻生|了結自己|了结自己|結束生命|结束生命)/u.test(compact)) return 'care';
  if (
    /\d{8,}/u.test(compact) ||
    /[零〇一二三四五六七八九壹贰貳叁參肆伍陆陸柒捌玖]{7,}/u.test(compact) ||
    /[^\s@]+@[^\s@]+/u.test(s) ||
    /(^|[^a-z])@[a-z0-9_]{2,}/u.test(s) ||
    /(微信|威信|薇信|vx|wx|weixin|wechat|line ?id|加line|加我|私訊我|私信我|qq|telegram|tg號|tg号|instagram|ig帳號|ig账号|小紅書號|小红书号|抖音號|抖音号)/u.test(
      compact,
    )
  )
    return 'contact';
  if (/(https?:|www\.|[a-z0-9-]+\.(com|net|org|cn|tw|hk|io|me|cc|xyz|top|app|link|ly)\b)/u.test(s))
    return 'link';
  if (
    /(去死|死全家|賤人|贱人|婊子|操你|幹你娘|干你娘|肏|屌你|雞巴|鸡巴|約炮|约炮|援交|包養|包养|裸聊|殺了他|杀了他|殺了她|杀了她)/u.test(
      compact,
    )
  )
    return 'abuse';
  return 'ok';
}

export type ModerationResult = 'pass' | 'flagged' | 'care' | 'unavailable';

/** OpenAI moderation：只送願望這一句，不送帳號或任何身份資料。出錯就回 unavailable（→ 待審）。 */
export async function moderateWish(
  body: string,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ModerationResult> {
  try {
    const res = await fetchImpl('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'unavailable';
    const data = (await res.json()) as {
      results?: { flagged?: unknown; categories?: Record<string, unknown> }[];
    };
    const first = data.results?.[0];
    if (!first || typeof first.flagged !== 'boolean') return 'unavailable';
    const c = first.categories ?? {};
    if (c['self-harm'] === true || c['self-harm/intent'] === true || c['self-harm/instructions'] === true)
      return 'care';
    return first.flagged ? 'flagged' : 'pass';
  } catch {
    return 'unavailable';
  }
}

type Row = {
  id: string;
  body: string;
  tag: WishTag;
  blessings: number;
  created_at: string;
  status: 'shown' | 'pending';
  mine: boolean;
  blessed: boolean;
};

export async function listWishesResponse(
  database: SupabaseClient | null,
  user: SessionUser | null,
  env: CoreEnv,
): Promise<Response> {
  if (!wishesAvailable(env, database)) {
    return json({ enabled: false, loginRequired: !user, wishes: [], maxChars: WISH_MAX_CHARS });
  }
  const { data, error } = await database!.rpc('list_wishes', {
    p_user_id: user?.id ?? null,
    p_limit: LIST_LIMIT,
  });
  if (error || !Array.isArray(data)) return errorResponse(503, 'wishes_unavailable');
  const wishes: PublicWish[] = (data as Row[]).map((r) => ({
    id: r.id,
    body: r.body,
    tag: r.tag,
    blessings: r.blessings,
    createdAt: r.created_at,
    status: r.status,
    mine: r.mine,
    blessed: r.blessed,
  }));
  const today = new Date().toISOString().slice(0, 10);
  const wroteToday = wishes.some((w) => w.mine && w.createdAt.slice(0, 10) === today);
  return json({
    enabled: true,
    loginRequired: !user,
    canWish: !!user && !wroteToday,
    maxChars: WISH_MAX_CHARS,
    wishes,
  });
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!jsonRequest(request)) return errorResponse(415, 'json_only');
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES)
    return errorResponse(413, 'request_too_large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return errorResponse(413, 'request_too_large');
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return errorResponse(400, 'invalid_json');
    return v as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'invalid_json');
  }
}

/** POST /api/wishes：{ action: 'make' | 'bless' | 'report' | 'withdraw', ... } */
export async function wishActionRequest(
  request: Request,
  database: SupabaseClient | null,
  user: SessionUser | null,
  env: CoreEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (!wishesAvailable(env, database)) return errorResponse(503, 'wishes_disabled');
  if (!user) return errorResponse(401, 'login_required');
  const db = database!;

  if (body.action === 'make') {
    const input = parseWish(body);
    if (!input) return errorResponse(400, 'invalid_wish');
    const screened = screenWish(input.body);
    if (screened === 'care') return errorResponse(422, 'wish_care', undefined, { care: true });
    if (screened !== 'ok') return errorResponse(422, `wish_${screened}`);

    let status: 'shown' | 'pending' = 'pending';
    if (autoModerationOn(env)) {
      const verdict = await moderateWish(input.body, env.OPENAI_API_KEY!, fetchImpl);
      if (verdict === 'care') return errorResponse(422, 'wish_care', undefined, { care: true });
      if (verdict === 'flagged') return errorResponse(422, 'wish_flagged');
      if (verdict === 'pass') status = 'shown';
    }
    const { data, error } = await db.rpc('make_wish', {
      p_user_id: user.id,
      p_body: input.body,
      p_tag: input.tag,
      p_locale: input.locale,
      p_status: status,
    });
    if (error || typeof data !== 'string') return errorResponse(503, 'wishes_unavailable');
    if (data === 'daily_limit') return errorResponse(429, 'daily_limit');
    if (data === 'site_cap') return errorResponse(429, 'site_cap');
    if (!data.startsWith('ok:')) return errorResponse(400, 'invalid_wish');
    return json({ id: data.slice(3), status }, { status: 201 });
  }

  const wishId = typeof body.wishId === 'string' && UUID.test(body.wishId) ? body.wishId : null;
  if (!wishId) return errorResponse(400, 'invalid_wish_id');

  if (body.action === 'bless') {
    const { data, error } = await db.rpc('bless_wish', { p_user_id: user.id, p_wish_id: wishId });
    if (error || typeof data !== 'string') return errorResponse(503, 'wishes_unavailable');
    if (data === 'not_found') return errorResponse(404, 'not_found');
    return json({ result: data });
  }
  if (body.action === 'report') {
    const reason = body.reason;
    if (typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason))
      return errorResponse(400, 'invalid_reason');
    const { data, error } = await db.rpc('report_wish', {
      p_user_id: user.id,
      p_wish_id: wishId,
      p_reason: reason,
    });
    if (error || typeof data !== 'string') return errorResponse(503, 'wishes_unavailable');
    if (data === 'not_found') return errorResponse(404, 'not_found');
    return json({ result: data });
  }
  if (body.action === 'withdraw') {
    const { data, error } = await db.rpc('withdraw_wish', { p_user_id: user.id, p_wish_id: wishId });
    if (error || typeof data !== 'string') return errorResponse(503, 'wishes_unavailable');
    if (data === 'not_found') return errorResponse(404, 'not_found');
    return json({ result: data });
  }
  return errorResponse(400, 'invalid_action');
}
