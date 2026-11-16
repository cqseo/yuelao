import { createClient } from '@supabase/supabase-js';
import { sameOriginPost, sessionResponse } from './auth-session';
import type { CoreEnv } from './env';
import { errorResponse } from './http';

const VERIFIER_TTL = 600; // PKCE code verifier only; never store access/refresh tokens here.

function verifierCookieName(request: Request): string {
  return new URL(request.url).protocol === 'https:' ? '__Host-yl_google_pkce' : 'yl_dev_google_pkce';
}

function verifierCookie(request: Request, value: string, maxAge = VERIFIER_TTL): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${verifierCookieName(request)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

function readVerifier(request: Request): string | null {
  const name = verifierCookieName(request);
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The site uses its own HttpOnly session cookies. Keep the OAuth PKCE verifier
 * in a short-lived HttpOnly cookie and install the session only after a successful
 * server-side code exchange. No OAuth/session tokens are exposed to JavaScript. */
function createOAuthClient(env: CoreEnv, request: Request, state: { verifier: string | null }) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key: string) => (key.endsWith('-code-verifier') ? readVerifier(request) : null),
        setItem: (key: string, value: string) => {
          if (key.endsWith('-code-verifier')) state.verifier = value;
        },
        removeItem: (key: string) => {
          if (key.endsWith('-code-verifier')) state.verifier = null;
        },
      },
    },
    global: { fetch },
  });
}

function isReady(request: Request, env: CoreEnv, baseURL: string): boolean {
  if (env.GOOGLE_AUTH_ENABLED !== 'true' || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  try {
    return new URL(request.url).origin === new URL(baseURL).origin;
  } catch {
    return false;
  }
}

function redirectToLogin(request: Request, baseURL: string): Response {
  const response = Response.redirect(new URL('/login?google=failed', baseURL).toString(), 303);
  response.headers.append('set-cookie', verifierCookie(request, '', 0));
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

/** POST only: the browser receives a trusted Supabase authorization URL and a
 * short-lived verifier cookie, then navigates to the URL itself. */
export async function startGoogleLogin(request: Request, env: CoreEnv, baseURL: string): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!isReady(request, env, baseURL)) return errorResponse(503, 'google_login_not_configured');

  const state = { verifier: null as string | null };
  const supabase = createOAuthClient(env, request, state);
  const redirectTo = new URL('/api/auth/google/callback', baseURL).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url || !state.verifier || state.verifier.length > 2048) {
    return errorResponse(503, 'google_login_unavailable');
  }
  // The first hop must always be the project's own trusted Auth endpoint.
  const authorizeURL = new URL(data.url);
  if (authorizeURL.protocol !== 'https:' || authorizeURL.origin !== new URL(env.SUPABASE_URL).origin) {
    return errorResponse(503, 'unexpected_auth_url');
  }
  return new Response(JSON.stringify({ url: data.url }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'set-cookie': verifierCookie(request, state.verifier),
    },
  });
}

/** Supabase redirects here with an auth code; exchange it server-side, then
 * issue the same __Host-yl_access / __Host-yl_refresh cookies used by email OTP. */
export async function finishGoogleLogin(request: Request, env: CoreEnv, baseURL: string): Promise<Response> {
  if (!isReady(request, env, baseURL)) return errorResponse(503, 'google_login_not_configured');
  const code = new URL(request.url).searchParams.get('code');
  const verifier = readVerifier(request);
  if (!code || code.length > 2048 || !verifier) return redirectToLogin(request, baseURL);

  const state = { verifier: null as string | null };
  const supabase = createOAuthClient(env, request, state);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user?.email) return redirectToLogin(request, baseURL);

  const result = sessionResponse(
    request,
    Response.redirect(new URL('/login/complete', baseURL).toString(), 303),
    data.session,
  );
  result.headers.append('set-cookie', verifierCookie(request, '', 0));
  result.headers.set('cache-control', 'private, no-store');
  return result;
}
