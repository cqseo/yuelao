import { createRootRoute, HeadContent, Link, Outlet, Scripts, useLocation } from '@tanstack/react-router';
import { analyticsScripts } from '@yuelao/core/analytics';
import { captureAttribution } from '@yuelao/core/react/attribution';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { LangMenu } from '~/i18n/LangMenu';
import { tr } from '~/i18n/ui';
import { trackPageView } from '~/lib/track';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
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
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
      <title>{m.common_not_found_title({ name: tr(site.name) })}</title>
      <meta name="robots" content="noindex" />
      <h1>{m.common_not_found_heading()}</h1>
      <p>{m.common_not_found_intro()}</p>
      <ul>
        <li>
          <Link to="/">{m.common_not_found_home()}</Link>
        </li>
        <li>
          <a href={localizeHref('/market#yuelao')}>{m.common_not_found_ritual()}</a>
        </li>
        <li>
          <Link to={localizeHref('/signs')}>{m.common_not_found_signs()}</Link>
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
  // 第一方統計：每換一頁記一次（站長後台 /admin 看）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在路徑變了才記一次瀏覽
  useEffect(() => {
    trackPageView();
  }, [location.pathname]);
  // 首頁與 3D 集市自帶頂欄與頁腳；沒有獨立的求籤功能頁。
  if (
    location.pathname === '/' ||
    location.pathname === '/market' ||
    location.pathname === '/admin'
  ) {
    return <Outlet />;
  }

  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="brand">
          {tr(site.name)}
        </Link>
        {/* 主導航：和首頁同一組、同一順序（DESIGN.md「頂欄一致」）。左上「月老」回首頁；
            隱私權、服務條款只在頁腳。求籤入口直接到 3D 月老殿。 */}
        <nav className="site-nav" aria-label={m.common_nav_label()}>
          <a href={localizeHref('/market#enter')}>{m.home_market_nav_market()}</a>
          <a href={localizeHref('/market#yuelao')}>{m.home_market_nav_ritual()}</a>
          <a href={localizeHref('/market#sutra')}>{m.home_market_nav_daily()}</a>
          <Link
            to={localizeHref('/tests')}
            aria-current={location.pathname.startsWith('/tests') ? 'true' : undefined}
          >
            {m.home_market_nav_tests()}
          </Link>
          {import.meta.env.VITE_AUTH_ENABLED === 'true' && (
            <Link
              to={localizeHref('/account')}
              aria-current={location.pathname === '/account' ? 'true' : undefined}
            >
              {m.home_market_nav_account()}
            </Link>
          )}
        </nav>
        <nav className="site-meta">
          {/* 語言選單：中文繁簡同一路徑（cookie），其他語言換網址前綴。見 src/i18n/locale.ts。 */}
          <LangMenu />
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>{m.common_footer_notice({ year: new Date().getFullYear(), name: tr(site.name) })}</span>
        <nav>
          <Link to={localizeHref('/about')}>{getLocale() === 'en' ? 'About YUEXIA' : getLocale() === 'ja' ? '月下について' : getLocale() === 'zh-Hans' ? '关于月下' : '關於月下'}</Link>
          <Link to={localizeHref('/methodology')}>{getLocale() === 'en' ? 'Sources & methodology' : getLocale() === 'ja' ? '出典と解説方法' : getLocale() === 'zh-Hans' ? '来源与解读方法' : '來源與解讀方法'}</Link>
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
