import { createRootRoute, HeadContent, Link, Outlet, Scripts, useLocation } from '@tanstack/react-router';
import { analyticsScripts } from '@yuelao/core/analytics';
import { captureAttribution } from '@yuelao/core/react/attribution';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref, setLocale } from '~/paraglide/runtime.js';
import { SUPPORT_EMAIL } from '~/site/legal';
import sereneCss from '~/site/serene.css?url';
import appCss from '~/site/styles.css?url';
import site from '../../site.config';

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: sereneCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    // Analytics scripts are skipped in local dev so dev traffic stays out of reports.
    scripts: import.meta.env.DEV ? [] : analyticsScripts(site),
  }),
  shellComponent: Document,
  component: Layout,
  notFoundComponent: NotFound,
});

// 404: React 19 hoists title and meta into head. Lists the main entry points,
// including llms.txt (the AI summary entry) as the plan requires.
function NotFound() {
  return (
    <section className="legal">
      <title>{m.common_not_found_title({ name: site.name })}</title>
      <meta name="robots" content="noindex" />
      <h1>{m.common_not_found_heading()}</h1>
      <p>{m.common_not_found_intro()}</p>
      <ul>
        <li>
          <Link to="/">{m.common_not_found_home()}</Link>
        </li>
        <li>
          <Link to={localizeHref('/ritual')}>{m.common_not_found_ritual()}</Link>
        </li>
        <li>
          <Link to={localizeHref('/sign/1')}>{m.common_not_found_signs()}</Link>
        </li>
        <li>
          <a href={localizeHref('/llms.txt')}>{m.common_not_found_llms()}</a>
        </li>
      </ul>
    </section>
  );
}

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        {import.meta.env.VITE_SITE_STAGING === 'true' && (
          <div className="staging-notice" role="status">
            <strong>月老 2.0 · 預覽環境</strong>　僅供介面驗收，登入、AI 與付款均未啟用。
          </div>
        )}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Layout() {
  useEffect(() => {
    captureAttribution();
  }, []);

  const location = useLocation();
  // 儀式頁全幅沉浸、不掛站點頭尾：location.pathname 是去本地化後的
  // 路徑（/ritual）。
  // 首頁（整頁重做）自帶頂欄與頁腳，同樣不掛站點外殼。
  if (location.pathname === '/' || location.pathname === '/ritual' || location.pathname === '/market') {
    return <Outlet />;
  }

  const locale = getLocale();

  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="brand">
          {site.name}
        </Link>
        {/* 主導航（P8）：只留已上線的問事總目。姻緣簿、香燈簿、我的
            未建，不在頂欄佔位，等頁面建好再加回來。 */}
        <nav className="site-nav" aria-label={m.common_nav_label()}>
          <Link to="/" aria-current={location.pathname === '/' ? 'true' : undefined}>
            {m.common_nav_home()}
          </Link>
          <a href="/market#enter">{m.common_nav_market()}</a>
          <Link
            to={localizeHref('/tests')}
            aria-current={location.pathname.startsWith('/tests') ? 'true' : undefined}
          >
            {locale === 'zh-Hans' ? '情感测试' : '情感測驗'}
          </Link>
          {/* 問月老在 3D 月老殿裡；/chat 一般版仍在，供搜尋引擎與跑不動 3D 的裝置 */}
          <a href="/market#ask">{locale === 'zh-Hans' ? '问月老' : '問月老'}</a>
          <Link
            to={localizeHref('/daily')}
            aria-current={location.pathname === '/daily' ? 'true' : undefined}
          >
            {locale === 'zh-Hans' ? '每日心笺' : '每日心箋'}
          </Link>
          {import.meta.env.VITE_AUTH_ENABLED === 'true' && (
            <Link
              to={localizeHref('/account')}
              aria-current={location.pathname === '/account' ? 'true' : undefined}
            >
              {locale === 'zh-Hans' ? '我的' : '我的'}
            </Link>
          )}
        </nav>
        <nav className="site-meta">
          <Link className="nav-legal" to="/privacy">
            {m.common_footer_privacy()}
          </Link>
          <Link className="nav-legal" to="/terms">
            {m.common_footer_terms()}
          </Link>
          {/* 繁/簡切換（P7，kaucim 式）：同一路徑、不跳頁——setLocale 寫
              PARAGLIDE_LOCALE cookie 再整頁重載，伺服器讀 cookie 做 SSR，
              網址不變。 */}
          <span className="locale-switch">
            <button
              type="button"
              onClick={() => setLocale('zh-Hant')}
              aria-current={locale === 'zh-Hant' ? 'true' : undefined}
            >
              繁體
            </button>
            <button
              type="button"
              onClick={() => setLocale('zh-Hans')}
              aria-current={locale === 'zh-Hans' ? 'true' : undefined}
            >
              簡體
            </button>
          </span>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>{m.common_footer_notice({ year: new Date().getFullYear(), name: site.name })}</span>
        <nav>
          <Link to="/privacy">{m.common_footer_privacy()}</Link>
          <Link to="/terms">{m.common_footer_terms()}</Link>
          <Link to="/refunds">{m.common_footer_refunds()}</Link>
          <Link to="/dmca">{m.common_footer_dmca()}</Link>
          <a href={localizeHref('/llms.txt')}>{m.common_footer_llms()}</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{m.common_footer_contact()}</a>
        </nav>
      </footer>
    </div>
  );
}
