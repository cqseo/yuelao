import handler from '@tanstack/react-start/server-entry';
import { legacyRitualDestination } from './market/legacy-ritual';
import { proxyRybbit } from '@yuelao/core/analytics';
import { paraglideMiddleware } from '~/paraglide/server.js';
import './i18n/strategy';
import contentEn from './i18n/content/en.json';
import contentJa from './i18n/content/ja.json';
import { registerContentDict, registerUiDict } from './i18n/ui';
import uiEn from './i18n/ui/en.json';
import uiJa from './i18n/ui/ja.json';
import uiKo from './i18n/ui/ko.json';
import uiTh from './i18n/ui/th.json';

export { HallRoom } from './hall-room';

// 介面字典只在伺服器全部登記；瀏覽器只載目前語言那份（src/client.tsx）。
registerContentDict('en', contentEn);
registerContentDict('ja', contentJa);
registerUiDict('en', uiEn);
registerUiDict('ja', uiJa);
registerUiDict('th', uiTh);
registerUiDict('ko', uiKo);

export { PlazaRoom } from './plaza-room';

// Worker entry: pages and API go to TanStack Start.
//
// Locale：中文繁簡同一路徑、看 PARAGLIDE_LOCALE cookie；en/ja/th/ko 走 /xx/ 前綴。
// 判斷規則在 src/i18n/locale.ts（custom-path 策略），伺服器與瀏覽器同一套，首屏不會對不上。
//
// Security headers are set here on every Worker response (HTML, sitemap,
// llms.txt, API). Static files under /assets/* are served by the platform
// before the Worker runs, so their cache headers live in public/_headers.

// CSP: TanStack Start's streaming/hydration uses an inline <script> and
// React renders inline style attributes, so script/style need
// 'unsafe-inline' — a nonce-based policy is not available here. External
// scripts and tracking connections are explicitly restricted to Google's
// Tag Manager and Analytics origins; all other origins stay blocked.
// DeviceMotion (shake) needs no CSP permission; do NOT add a
// Permissions-Policy that disables accelerometer/gyroscope.
// 最多開幾間殿（每間 60 人）；滿了客戶端會試下一間。
const MAX_HALLS = 50;
const MAX_PLAZAS = 50;

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; font-src 'self'; connect-src 'self' blob: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; frame-src https://www.googletagmanager.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

function withSecurityHeaders(response: Response, staging = false): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (staging) {
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    headers.set('cache-control', 'no-store');
  }
  // HTML stays revalidating (no long cache); sitemap/llms/robots set their
  // own max-age=3600 in core/seo.ts and keep it.
  if (!headers.has('cache-control') && (headers.get('content-type') ?? '').includes('text/html')) {
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const staging = env.SITE_STAGING === 'true';
    if (staging && url.pathname === '/robots.txt') {
      return withSecurityHeaders(
        new Response('User-agent: *\nDisallow: /\n', {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
        true,
      );
    }
    // Brand domain (2026-11-15): the old workers.dev host 301s to yuexia.app.
    // Pages only — /api/* stays put (Stripe webhook POSTs and the hall/plaza
    // WebSocket upgrades must keep reaching the Worker), as does /stats/.
    if (
      url.hostname === 'yuelao.cqseo.workers.dev' &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/stats/')
    ) {
      return withSecurityHeaders(
        Response.redirect(`https://yuexia.app${url.pathname}${url.search}`, 301),
        staging,
      );
    }
    // OAuth originally returned to a child path under /login, which rendered the
    // login parent's form instead of completing navigation. Keep old bookmarks
    // working, while the new callback uses a top-level non-nested route.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const legacyOAuth = url.pathname.match(/^\/(?:(en|ja|th|ko)\/)?login\/complete\/?$/);
      if (legacyOAuth) {
        const path = legacyOAuth[1] ? `/${legacyOAuth[1]}/auth-complete` : '/auth-complete';
        return withSecurityHeaders(
          new Response(null, {
            status: 302,
            headers: { location: new URL(path, url.origin).toString(), 'cache-control': 'private, no-store' },
          }),
          staging,
        );
      }
    }
    // Retired 2D ritual pages: a direct browser URL now opens the real 3D Yuelao hall.
    // Preserve only the language prefix; never carry private `q` text to a new URL.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const target = legacyRitualDestination(url);
      if (target) return withSecurityHeaders(Response.redirect(target, 301), staging);
    }
    // Old /hk/* prefix (P1–P6) is retired: 301 to the same path without it.
    // /hk → /, /hk/ritual → /market#yuelao, /hk/sign/6 → /sign/6.
    if (url.pathname === '/hk' || url.pathname.startsWith('/hk/')) {
      const target = url.pathname === '/hk' ? '/' : url.pathname.slice(3);
      const dest = new URL(target + url.search, url.origin);
      // Legacy /hk/ritual should not strand a visitor at the removed 2D page.
      const hall = legacyRitualDestination(dest);
      if (hall) return withSecurityHeaders(Response.redirect(hall, 301), staging);
      return withSecurityHeaders(Response.redirect(dest, 301), staging);
    }
    // 大殿同拜的 WebSocket：交給對應那間殿的 Durable Object。只收同源的升級請求；
    // 101 回應不能再包一層（會丟掉 webSocket），所以這條路徑不加安全標頭。
    if (url.pathname === '/api/hall/ws') {
      const origin = request.headers.get('origin');
      if (request.headers.get('upgrade') !== 'websocket' || (origin && new URL(origin).host !== url.host)) {
        return withSecurityHeaders(new Response('bad request', { status: 400 }), staging);
      }
      const n = Math.min(MAX_HALLS, Math.max(1, Number(url.searchParams.get('n')) || 1));
      return env.HALL.get(env.HALL.idFromName(`hall-${n}`)).fetch(request);
    }
    // 廣場同遊：同一套規矩，一個廣場分身一個 Durable Object。
    if (url.pathname === '/api/plaza/ws') {
      const origin = request.headers.get('origin');
      if (request.headers.get('upgrade') !== 'websocket' || (origin && new URL(origin).host !== url.host)) {
        return withSecurityHeaders(new Response('bad request', { status: 400 }), staging);
      }
      const n = Math.min(MAX_PLAZAS, Math.max(1, Number(url.searchParams.get('n')) || 1));
      return env.PLAZA.get(env.PLAZA.idFromName(`plaza-${n}`)).fetch(request);
    }
    // Rybbit analytics goes through this site's /stats/ and is proxied upstream here.
    const stats = await proxyRybbit(request, env.RYBBIT_UPSTREAM);
    if (stats) return withSecurityHeaders(stats, staging);
    // Locale：custom-path 策略（網址前綴，否則繁簡 cookie，否則繁體）。
    // Pass the ORIGINAL request to the handler: TanStack Router handles URL
    // localization itself via the rewrite pair in src/router.tsx
    // (deLocalizeUrl on input, localizeUrl on output). Handing it the
    // middleware's already-delocalized request would double-delocalize and
    // redirect-loop — see the paraglideMiddleware JSDoc.
    const response = await paraglideMiddleware(request, () => handler.fetch(request));
    return withSecurityHeaders(response, staging);
  },
} satisfies ExportedHandler<Env>;
