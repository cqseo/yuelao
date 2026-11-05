import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import { analyticsScripts } from '@yuelao/core/analytics';
import { captureAttribution } from '@yuelao/core/react/attribution';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import { SUPPORT_EMAIL } from '~/site/legal';
import appCss from '~/site/styles.css?url';
import site from '../../site.config';

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    // Analytics scripts are skipped in local dev so dev traffic stays out of reports.
    scripts: import.meta.env.DEV ? [] : analyticsScripts(site),
  }),
  shellComponent: Document,
  component: Layout,
  notFoundComponent: NotFound,
});

// 404: React 19 hoists title and meta into head. Lists the main entry points.
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

  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="brand">
          {site.name}
        </Link>
        <nav>
          <Link to="/privacy">{m.common_footer_privacy()}</Link>
          <Link to="/terms">{m.common_footer_terms()}</Link>
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
          <a href={`mailto:${SUPPORT_EMAIL}`}>{m.common_footer_contact()}</a>
        </nav>
      </footer>
    </div>
  );
}
