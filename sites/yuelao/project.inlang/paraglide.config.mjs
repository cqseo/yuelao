import { defineConfig } from '@inlang/paraglide-js';

/**
 * Paraglide compiler config. Read by `paraglide-js compile` (see the
 * `typecheck` script) and mirrored in vite.config.ts for the dev server and
 * the build — keep the two in sync.
 *
 * Routing (P7, kaucim model): Traditional/Simplified is a same-path script
 * toggle, NOT a path prefix. Strategy is ['cookie', 'baseLocale']: the
 * PARAGLIDE_LOCALE cookie is the single source of truth — the server
 * middleware reads it for SSR and the client reads the same cookie, so the
 * first render already matches and hydration cannot mismatch (the P1 bug
 * class: two competing locale signals). setLocale() writes the cookie and
 * reloads the same URL; the path never changes.
 *
 * urlPatterns is an identity mapping on purpose: with no urlPatterns the
 * compiler falls back to the default /:locale/ prefix pattern, which would
 * make localizeUrl() prefix zh-Hans URLs. The pattern below maps both
 * locales to the same path, so localizeUrl()/deLocalizeUrl() are no-ops and
 * every localizeHref() call in the code keeps working unchanged.
 *
 * /hk/* (the old P1 prefix) is 301-redirected to the unprefixed path in
 * src/server.ts — it is not a locale route anymore.
 *
 * API and locale-neutral text files are excluded from localization: the
 * middleware skips them entirely and they always resolve to the base locale.
 */
export default defineConfig({
  strategy: ['cookie', 'baseLocale'],
  urlPatterns: [
    {
      // Identity: base and localized shapes are the same path, so the
      // locale never appears in the URL.
      pattern: '/:path(.*)?',
      localized: [['zh-Hans', '/:path(.*)?']],
    },
  ],
  routeStrategies: [
    { match: '/api/*', exclude: true },
    { match: '/llms.txt', exclude: true },
    { match: '/robots.txt', exclude: true },
    { match: '/sitemap.xml', exclude: true },
    { match: '/sitemap-pages.xml', exclude: true },
    { match: '/sitemap-signs.xml', exclude: true },
  ],
});
