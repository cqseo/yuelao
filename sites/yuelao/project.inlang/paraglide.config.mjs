import { defineConfig } from '@inlang/paraglide-js';

/**
 * Paraglide compiler config. Read by `paraglide-js compile` (see the
 * `typecheck` script) and mirrored in vite.config.ts — keep the two in sync.
 *
 * 多語言（2026-11-14）：中文繁簡同一路徑（PARAGLIDE_LOCALE cookie 分，沿用 P7），
 * en/ja/th/ko 走 /xx/ 前綴。語言由自訂策略 custom-path 判斷（src/i18n/strategy.ts）；
 * urlPatterns 只給 localizeHref()/deLocalizeUrl() 換網址用。
 *
 * /hk/* (the old P1 prefix) is 301-redirected to the unprefixed path in
 * src/server.ts — it is not a locale route anymore.
 *
 * API and locale-neutral text files are excluded from localization: the
 * middleware skips them entirely and they always resolve to the base locale.
 */
export default defineConfig({
  strategy: ['custom-path', 'baseLocale'],
  urlPatterns: [
    {
      pattern: '/:path(.*)?',
      localized: [
        ['en', '/en/:path(.*)?'],
        ['ja', '/ja/:path(.*)?'],
        ['th', '/th/:path(.*)?'],
        ['ko', '/ko/:path(.*)?'],
        ['zh-Hans', '/:path(.*)?'],
        ['zh-Hant', '/:path(.*)?'],
      ],
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
