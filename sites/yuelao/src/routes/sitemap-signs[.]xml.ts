import { createFileRoute } from '@tanstack/react-router';
import { sitemapXml } from '@yuelao/core/seo';
import { STICKS } from '~/ritual/sticks';
import site from '../../site.config';

// One URL per stick for Chinese (繁/簡 share the path). Languages whose stick
// content is translated get their own tree too（2026-11-14：English）。
const CONTENT_LOCALES = ['en', 'ja'] as const;
const SIGN_PAGES = [
  ...STICKS.map((stick) => `/sign/${stick.id}`),
  ...CONTENT_LOCALES.flatMap((l) => STICKS.map((stick) => `/${l}/sign/${stick.id}`)),
];

export const Route = createFileRoute('/sitemap-signs.xml')({
  server: {
    handlers: {
      GET: () =>
        sitemapXml(
          site,
          SIGN_PAGES.map((path) => ({ path })),
        ),
    },
  },
});
