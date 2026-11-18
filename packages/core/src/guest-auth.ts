import { input, validEmail } from './auth-handlers';
import { sameOriginPost, sessionResponse, sessionTokens, withGuestMarker } from './auth-session';
import type { CoreEnv } from './env';
import { errorResponse, json } from './http';
import type { Supabase } from './supabase';

// 訪客帳號（站長 2026-11-18）：沒登入的人按「解鎖」時，先給他一個訪客帳號（Supabase 匿名使用者），
// 直接去付款；買到的東西記在這個帳號上。之後他願意時再綁信箱：綁定是改這個帳號的信箱，
// 帳號 ID 不變，所以已買的解讀、訂單都跟著走。設計與真實 Auth 測試見 PR #16 的
// docs/GUEST_FIRST_ACCOUNT_MODEL_2026-11-09.md。
//
// 什麼時候建訪客：只在要付款、而且這台瀏覽器完全沒有登入憑證時。有過期的正式登入（refresh 失敗）
// 不建，讓他重新登入，免得把買的東西記到一個新訪客身上。

export function guestsEnabled(env: Pick<CoreEnv, 'GUEST_AUTH_ENABLED'>): boolean {
  return env.GUEST_AUTH_ENABLED === 'true';
}

type AnonFactory = () => Supabase | null;

/**
 * POST /api/auth/guest：建一個訪客帳號並發 session cookie。
 * - 已有有效登入（正式或訪客）：不建，回 200 existing。
 * - 有 refresh 憑證但續不了：不建，回 401（請他重新登入）。
 * - 同一 IP 一分鐘內建太多：429。
 */
export async function createGuestRequest(
  request: Request,
  env: CoreEnv,
  anon: AnonFactory,
  service: Supabase | null,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!guestsEnabled(env)) return errorResponse(404, 'guest_disabled');
  const client = anon();
  if (!client || !service) return errorResponse(503, 'auth_not_configured');

  const { access, refresh } = sessionTokens(request);
  if (access) {
    const { data } = await client.auth.getUser(access);
    if (data.user) return json({ existing: true, guest: data.user.is_anonymous === true });
  }
  if (refresh) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
    if (error || !data.session) return errorResponse(401, 'session_expired');
    const guest = data.session.user.is_anonymous === true;
    return withGuestMarker(
      request,
      sessionResponse(request, json({ existing: true, guest }), data.session),
      guest,
    );
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.GUEST_RATE_LIMITER) {
    const { success } = await env.GUEST_RATE_LIMITER.limit({ key: `guest:${ip}` });
    if (!success) return errorResponse(429, 'guest_rate_limited');
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session || !data.user) {
    if (error?.status === 429) return errorResponse(429, 'guest_rate_limited');
    // 多半是 Supabase 還沒開「Allow anonymous sign-ins」
    return errorResponse(503, 'guest_unavailable');
  }
  // 資料庫觸發器也會建；這裡再補一次，觸發器沒生效時結帳也不會卡在找不到 profile
  await service
    .from('profiles')
    .upsert({ id: data.user.id, email: null }, { onConflict: 'id', ignoreDuplicates: true });
  return withGuestMarker(
    request,
    sessionResponse(request, json({ created: true, guest: true }), data.session),
    true,
  );
}

/** 用目前這個訪客的 session 建一個只屬於這次請求的 client（絕不共用，免得 session 串到別人）。 */
async function guestClient(
  request: Request,
  anon: AnonFactory,
): Promise<{ client: Supabase; id: string } | null> {
  const { access, refresh } = sessionTokens(request);
  const client = anon();
  if (!client || !access || !refresh) return null;
  const { data, error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
  if (error || !data.user || data.user.is_anonymous !== true) return null;
  return { client, id: data.user.id };
}

/**
 * POST /api/auth/guest/email { email }：把信箱綁到目前的訪客帳號，Supabase 寄六位數驗證碼。
 * 用的是「改信箱」（updateUser），不是「用信箱登入」，所以不會另外建一個帳號。
 */
export async function sendGuestBindCode(request: Request, anon: AnonFactory): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  const data = await input(request);
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!validEmail(email)) return errorResponse(400, 'invalid_email');
  const guest = await guestClient(request, anon);
  if (!guest) return errorResponse(401, 'guest_required');
  const { error } = await guest.client.auth.updateUser({ email });
  if (error) {
    if (error.status === 429) return errorResponse(429, 'email_rate_limited');
    // 這個信箱已經有自己的帳號了：不能直接併過去（會變成誰都能領走別人的購買）
    if (error.code === 'email_exists' || /already been registered|already registered/i.test(error.message))
      return errorResponse(409, 'email_in_use');
    return errorResponse(503, 'email_delivery_unavailable');
  }
  return json({ sent: true });
}

/**
 * POST /api/auth/guest/verify { email, code }：驗證碼對了，這個訪客就變成正式的信箱帳號。
 * 驗證完的帳號 ID 必須和目前的訪客相同，才發新的 cookie。
 */
export async function verifyGuestBindCode(request: Request, anon: AnonFactory): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  const data = await input(request);
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!data || !validEmail(email) || typeof data.code !== 'string' || !/^\d{6}$/.test(data.code))
    return errorResponse(400, 'invalid_code');
  const guest = await guestClient(request, anon);
  if (!guest) return errorResponse(401, 'guest_required');
  const { data: verified, error } = await guest.client.auth.verifyOtp({
    email,
    token: data.code,
    type: 'email_change',
  });
  if (error || !verified.session || !verified.user) return errorResponse(401, 'verification_failed');
  if (verified.user.id !== guest.id) return errorResponse(409, 'account_mismatch');
  return withGuestMarker(request, sessionResponse(request, json({ bound: true }), verified.session), false);
}
