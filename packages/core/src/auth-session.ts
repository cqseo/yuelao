import type { Session } from '@supabase/supabase-js';

const PREFIX_PROD = '__Host-yl_';
const PREFIX_DEV = 'yl_dev_';
const REFRESH_DAYS = 30;

function cookiePrefix(request: Request): string {
  return new URL(request.url).protocol === 'https:' ? PREFIX_PROD : PREFIX_DEV;
}

function cookie(request: Request, suffix: 'access' | 'refresh'): string {
  const name = cookiePrefix(request) + suffix;
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...parts] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(parts.join('='));
      } catch {
        return '';
      }
    }
  }
  return '';
}

export function sessionTokens(request: Request) {
  return { access: cookie(request, 'access'), refresh: cookie(request, 'refresh') };
}

function valueCookie(request: Request, name: string, value: string, maxAge: number): string {
  const isSecure = new URL(request.url).protocol === 'https:';
  const secure = isSecure ? '; Secure' : '';
  // __Host- cookie names require Secure, Path=/ and no Domain attribute.
  return `${cookiePrefix(request)}${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${Math.floor(maxAge)}`;
}

export function sessionResponse(request: Request, response: Response, session: Session): Response {
  const headers = new Headers(response.headers);
  const accessAge = Math.max(60, Math.min(session.expires_in ?? 3600, 3600) - 45);
  headers.append('set-cookie', valueCookie(request, 'access', session.access_token, accessAge));
  headers.append(
    'set-cookie',
    valueCookie(request, 'refresh', session.refresh_token, REFRESH_DAYS * 24 * 3600),
  );
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export function clearSessionResponse(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append('set-cookie', valueCookie(request, 'access', '', 0));
  headers.append('set-cookie', valueCookie(request, 'refresh', '', 0));
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

/** Cookie-backed writes require same-origin browser requests; cross-origin POST
 * forms and malicious sites do not get an exception just because cookies attach. */
export function sameOriginPost(request: Request): boolean {
  if (request.method !== 'POST') return false;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function jsonRequest(request: Request): boolean {
  return request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json';
}
