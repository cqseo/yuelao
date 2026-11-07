import { createFileRoute } from '@tanstack/react-router';
import { sitemapIndexXml } from '@yuelao/core/seo';
import site from '../../site.config';

// Sitemap index: per-section sitemaps live at /sitemap-pages.xml (core pages)
// and /sitemap-signs.xml (100 sticks x 2 locales). robots.txt points here.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => sitemapIndexXml(site, ['/sitemap-pages.xml', '/sitemap-signs.xml']),
    },
  },
});
