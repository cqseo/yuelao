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

export async function sendEmailCode(request: Request, client: SupabaseClient | null): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!client) return errorResponse(503, 'auth_not_configured');
  const data = await input(request);
  if (!data || !validEmail(data.email)) return errorResponse(400, 'invalid_email');
  // Supabase handles per-email rate limiting; before public launch add Turnstile
  // and edge/IP rate controls to prevent mass signups and email abuse.
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
