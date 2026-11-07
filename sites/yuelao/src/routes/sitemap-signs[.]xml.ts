import { createFileRoute } from '@tanstack/react-router';
import { sitemapXml } from '@yuelao/core/seo';
import { STICKS } from '~/ritual/sticks';
import site from '../../site.config';

// One URL per stick (P7: no locale prefixes — the 繁/簡 toggle is a
// same-path cookie switch, so there is a single /sign/:id tree).
const SIGN_PAGES = STICKS.map((stick) => `/sign/${stick.id}`);

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
