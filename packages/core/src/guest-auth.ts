import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { verifyEmailCaptcha } from './auth-handlers';
import {
  clearSessionResponse,
  jsonRequest,
  sameOriginPost,
  sessionResponse,
  sessionTokens,
} from './auth-session';
import { errorResponse, json } from './http';

function displayId(id: string): string {
  // For UI only; a display ID is NOT an account recovery credential.
  return id.slice(0, 8).toUpperCase();
}

function isMember(user: User): boolean {
  return user.is_anonymous !== true && Boolean(user.email && user.email_confirmed_at);
}

function identity(user: User) {
  return {
    kind: isMember(user) ? 'member' : 'guest',
    displayId: displayId(user.id),
    email: isMember(user) ? user.email : null,
  };
}

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  if (!jsonRequest(request)) return null;
  const raw = await request.text();
  if (raw.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function emailOf(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function captchaTokenOf(input: unknown): string | null {
  return typeof input === 'string' && input.length >= 20 && input.length <= 2048 && !/\s/.test(input)
    ? input
    : null;
}

async function challenge(
  request: Request,
  token: unknown,
  secret: string | undefined,
  action: 'guest_create' | 'email_link',
  verifier: typeof verifyEmailCaptcha,
): Promise<Response | null> {
  if (!secret) return errorResponse(503, 'captcha_not_configured');
  const validToken = captchaTokenOf(token);
  if (!validToken) return errorResponse(400, 'captcha_required');
  try {
    if (!(await verifier(request, validToken, secret, fetch, action))) {
      return errorResponse(403, 'captcha_failed');
    }
    return null;
  } catch {
    return errorResponse(503, 'captcha_unavailable');
  }
}

async function ensureGuestProfile(client: SupabaseClient, user: User): Promise<boolean> {
  if (user.is_anonymous !== true) return true;
  // Requires guest_profile_email_nullable migration and the user's own RLS.
  // Idempotent, so a recovered session can repair an interrupted first visit.
  const { error } = await client
    .from('profiles')
    .upsert({ id: user.id, locale: 'zh-Hant' }, { onConflict: 'id', ignoreDuplicates: true });
  return !error;
}

async function attached(
  request: Request,
  client: SupabaseClient,
): Promise<{ user: User; session: Session } | null> {
  const { access, refresh } = sessionTokens(request);
  if (!refresh) return null;
  // Access cookies expire before refresh cookies. Recover the existing user
  // instead of treating a refresh-only session as a new anonymous visitor.
  if (!access) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
    if (error || !data.session) return null;
    const verified = await client.auth.getUser(data.session.access_token);
    if (verified.error || !verified.data.user) return null;
    return { user: verified.data.user, session: data.session };
  }
  const { data, error } = await client.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });
  if (error || !data.session) return null;
  const verified = await client.auth.getUser(data.session.access_token);
  if (verified.error || !verified.data.user) return null;
  return { user: verified.data.user, session: data.session };
}

export async function guestStatus(
  request: Request,
  client: SupabaseClient | null,
  enabled: boolean,
): Promise<Response> {
  if (!enabled || !client) return json({ enabled: false, kind: 'disabled' });
  const { access, refresh } = sessionTokens(request);
  if (!access && !refresh) return json({ enabled: true, kind: 'none' });
  // Without a refresh credential the visitor cannot retain the identity.
  if (!refresh) return json({ enabled: true, kind: 'stale' });
  if (access) {
    const { data, error } = await client.auth.getUser(access);
    if (!error && data.user) return json({ enabled: true, ...identity(data.user) });
  }
  // GET may set rotated session cookies, but never creates a new user.
  const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
  if (!error && data.session) {
    const verified = await client.auth.getUser(data.session.access_token);
    if (!verified.error && verified.data.user) {
      return sessionResponse(
        request,
        json({ enabled: true, recovered: true, ...identity(verified.data.user) }),
        data.session,
      );
    }
  }
  return json({ enabled: true, kind: 'stale' });
}

/**
 * Only creates a guest when there are no existing credentials. A refresh
 * token that cannot be recovered must not silently create a new account.
 * No visit to the public home page calls this endpoint.
 */
export async function createGuest(
  request: Request,
  client: SupabaseClient | null,
  enabled: boolean,
  turnstileSecret?: string,
  verifier: typeof verifyEmailCaptcha = verifyEmailCaptcha,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!enabled || !client) return errorResponse(503, 'guest_signup_disabled');
  const { access, refresh } = sessionTokens(request);
  if (access || refresh) {
    // Restore a validated session before attempting profile operations.
    const existing = await attached(request, client);
    if (existing) {
      const valid = await ensureGuestProfile(client, existing.user);
      return sessionResponse(
        request,
        valid
          ? json({ created: false, ...identity(existing.user) })
          : errorResponse(503, 'guest_profile_unavailable'),
        existing.session,
      );
    }
    if (refresh) {
      const refreshed = await client.auth.refreshSession({ refresh_token: refresh });
      if (!refreshed.error && refreshed.data.session && refreshed.data.user) {
        const valid = await ensureGuestProfile(client, refreshed.data.user);
        return sessionResponse(
          request,
          valid
            ? json({ created: false, ...identity(refreshed.data.user) })
            : errorResponse(503, 'guest_profile_unavailable'),
          refreshed.data.session,
        );
      }
    }
    return errorResponse(409, 'existing_session_unrecoverable');
  }
  const payload = await bodyOf(request);
  if (!payload) return errorResponse(400, 'invalid_request');
  const blocked = await challenge(request, payload.captchaToken, turnstileSecret, 'guest_create', verifier);
  if (blocked) return blocked;
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user || !data.session || data.user.is_anonymous !== true) {
    return errorResponse(503, 'guest_signup_unavailable');
  }
  const profileReady = await ensureGuestProfile(client, data.user);
  return sessionResponse(
    request,
    profileReady
      ? json({ created: true, ...identity(data.user) }, { status: 201 })
      : errorResponse(503, 'guest_profile_unavailable'),
    data.session,
  );
}

export async function sendGuestEmailLink(
  request: Request,
  client: SupabaseClient | null,
  enabled: boolean,
  turnstileSecret?: string,
  verifier: typeof verifyEmailCaptcha = verifyEmailCaptcha,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!enabled || !client) return errorResponse(503, 'guest_link_disabled');
  const session = await attached(request, client);
  if (!session) return errorResponse(401, 'guest_session_required');
  if (session.user.is_anonymous !== true) {
    return sessionResponse(request, errorResponse(409, 'already_bound'), session.session);
  }
  if (!(await ensureGuestProfile(client, session.user))) {
    return sessionResponse(request, errorResponse(503, 'guest_profile_unavailable'), session.session);
  }
  const payload = await bodyOf(request);
  const email = emailOf(payload?.email);
  if (!email) return sessionResponse(request, errorResponse(400, 'invalid_email'), session.session);
  const blocked = await challenge(request, payload?.captchaToken, turnstileSecret, 'email_link', verifier);
  if (blocked) return sessionResponse(request, blocked, session.session);
  // This keeps the existing user ID. signInWithOtp would create another account.
  const { error } = await client.auth.updateUser({ email });
  if (error) {
    return sessionResponse(
      request,
      errorResponse(error.status === 429 ? 429 : 503, 'email_link_unavailable'),
      session.session,
    );
  }
  return sessionResponse(request, json({ sent: true, kind: 'guest' }), session.session);
}

export async function verifyGuestEmailLink(
  request: Request,
  client: SupabaseClient | null,
  enabled: boolean,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!enabled || !client) return errorResponse(503, 'guest_link_disabled');
  const previous = await attached(request, client);
  if (!previous) return errorResponse(401, 'guest_session_required');
  if (previous.user.is_anonymous !== true) {
    return sessionResponse(request, errorResponse(409, 'already_bound'), previous.session);
  }
  const payload = await bodyOf(request);
  const email = emailOf(payload?.email);
  const code = payload?.code;
  if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return sessionResponse(request, errorResponse(400, 'invalid_code'), previous.session);
  }
  const { data, error } = await client.auth.verifyOtp({
    email,
    token: code,
    type: 'email_change',
  });
  if (error || !data.user || data.user.id !== previous.user.id || !isMember(data.user)) {
    return sessionResponse(request, errorResponse(401, 'link_verification_failed'), previous.session);
  }
  // An email-change OTP may not return a fresh session. Never reuse the
  // pre-verification anonymous JWT and mistakenly claim membership is ready.
  let updatedSession: Session | null = data.session;
  if (!updatedSession) {
    const refreshed = await client.auth.refreshSession({
      refresh_token: previous.session.refresh_token,
    });
    if (!refreshed.error) updatedSession = refreshed.data.session;
  }
  if (updatedSession) {
    const verified = await client.auth.getUser(updatedSession.access_token);
    if (
      verified.error ||
      !verified.data.user ||
      verified.data.user.id !== previous.user.id ||
      !isMember(verified.data.user)
    ) {
      updatedSession = null;
    }
  }
  // Updating the profile is best-effort: identity linking has already succeeded,
  // and must never be rolled back or presented as a failed OTP after success.
  const { data: updatedProfile, error: profileError } = await client
    .from('profiles')
    .update({ email: data.user.email })
    .eq('id', data.user.id)
    .select('id')
    .maybeSingle();
  const result = json({
    linked: true,
    kind: 'member',
    displayId: displayId(data.user.id),
    email: data.user.email,
    profileSynced: !profileError && updatedProfile?.id === data.user.id,
    signInRequired: !updatedSession,
  });
  return updatedSession
    ? sessionResponse(request, result, updatedSession)
    : clearSessionResponse(request, result);
}
