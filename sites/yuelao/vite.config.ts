import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds write Paraglide output to their own dir, not src/paraglide: that one belongs to the dev server and typecheck.
const PARAGLIDE_BUILD = fileURLToPath(new URL('./node_modules/.paraglide', import.meta.url));

export default defineConfig(({ command }) => ({
  resolve: {
    alias: [
      ...(command === 'serve' ? [] : [{ find: /^~\/paraglide\//, replacement: `${PARAGLIDE_BUILD}/` }]),
      { find: '~', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  // Pin IPv4: when only ::1 is bound, browsers that go through a proxy or prefer IPv4 get refused on localhost.
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5173, strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
  plugins: [
    // i18n via Paraglide: zh-Hant is the base locale, zh-Hans ships too.
    // Unlike the shipwords template, production uses the full project (not an en-only
    // one) and the server runs the locale middleware in production as well.
    // P7: same-path 繁/簡 toggle (kaucim model) — strategy, urlPatterns
    // and routeStrategies mirror project.inlang/paraglide.config.mjs — keep
    // the two in sync. Strategy is ['cookie', 'baseLocale'] on purpose: the
    // PARAGLIDE_LOCALE cookie is the single source of truth (see the config
    // file's comment); urlPatterns is an identity mapping so localizeUrl()
    // never prefixes a locale into the URL.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: command === 'serve' ? './src/paraglide' : PARAGLIDE_BUILD,
      strategy: ['cookie', 'baseLocale'],
      urlPatterns: [
        {
          // Identity: base and localized shapes are the same path.
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
    }),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));
