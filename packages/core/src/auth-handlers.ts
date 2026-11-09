import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clearSessionResponse,
  jsonRequest,
  sameOriginPost,
  sessionResponse,
  sessionTokens,
} from './auth-session';
import { errorResponse, json } from './http';

function validEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.length >= 5 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

async function input(request: Request, max = 1024): Promise<Record<string, unknown> | null> {
  if (!jsonRequest(request)) return null;
  const text = await request.text();
  if (text.length > max) return null;
  try {
    const value = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Verify Turnstile before requesting an email OTP. Never trust a browser-only CAPTCHA flag. */
export async function verifyEmailCaptcha(
  request: Request,
  token: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
  expectedAction = 'auth_send',
): Promise<boolean> {
  const data = new URLSearchParams({ secret, response: token });
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) data.set('remoteip', ip);
  const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: data,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: unknown; hostname?: unknown; action?: unknown };
  return (
    result.success === true &&
    result.hostname === new URL(request.url).hostname &&
    result.action === expectedAction
  );
}

export async function sendEmailCode(
  request: Request,
  client: SupabaseClient | null,
  turnstileSecret?: string,
  captchaVerifier: typeof verifyEmailCaptcha = verifyEmailCaptcha,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!client) return errorResponse(503, 'auth_not_configured');
  // Fail closed. A real Turnstile secret is required before any email can be sent.
  if (!turnstileSecret) return errorResponse(503, 'captcha_not_configured');
  const data = await input(request, 4096);
  if (!data || !validEmail(data.email)) return errorResponse(400, 'invalid_email');
  const token = data.captchaToken;
  if (
    typeof token !== 'string' ||
    token.length < 20 ||
    token.length > 2048 ||
    /\s/.test(token)
  ) return errorResponse(400, 'captcha_required');
  try {
    if (!(await captchaVerifier(request, token, turnstileSecret))) {
      return errorResponse(403, 'captcha_failed');
    }
  } catch {
    return errorResponse(503, 'captcha_unavailable');
  }
  // Cloudflare verifies the single-use Turnstile token here, before Supabase Auth.
  // Keep Supabase's own CAPTCHA integration off to avoid verifying the same token twice.
  const { error } = await client.auth.signInWithOtp({
    email: data.email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429) return errorResponse(429, 'email_rate_limited');
    return errorResponse(503, 'email_delivery_unavailable');
  }
  return json({ sent: true });
}

export async function verifyEmailCode(request: Request, client: SupabaseClient | null): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!client) return errorResponse(503, 'auth_not_configured');
  const data = await input(request);
  if (!data || !validEmail(data.email) || typeof data.code !== 'string' || !/^\d{6}$/.test(data.code)) {
    return errorResponse(400, 'invalid_code');
  }
  const { data: verified, error } = await client.auth.verifyOtp({
    email: data.email.trim().toLowerCase(),
    token: data.code,
    type: 'email',
  });
  if (error || !verified.session || !verified.user?.email) return errorResponse(401, 'verification_failed');
  return sessionResponse(request, json({ authenticated: true }), verified.session);
}

export async function refreshLogin(request: Request, client: SupabaseClient | null): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!client) return errorResponse(503, 'auth_not_configured');
  const refresh = sessionTokens(request).refresh;
  if (!refresh) return errorResponse(401, 'login_required');
  const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) return clearSessionResponse(request, errorResponse(401, 'session_expired'));
  return sessionResponse(request, json({ authenticated: true }), data.session);
}

export async function logoutUser(request: Request, client: SupabaseClient | null): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  // Terminate this device's refresh token if possible. Always clear the cookies.
  const { access } = sessionTokens(request);
  if (client && access) {
    try {
      const { error } = await client.auth.admin.signOut(access, 'local');
      if (error) console.warn('auth sign-out was not acknowledged');
    } catch {
      console.warn('auth sign-out service unavailable');
    }
  }
  return clearSessionResponse(request, json({ authenticated: false }));
}
