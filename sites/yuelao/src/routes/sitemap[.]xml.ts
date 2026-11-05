import { createFileRoute } from '@tanstack/react-router';
import { sitemapXml } from '@yuelao/core/seo';
import site from '../../site.config';

// Register new indexable pages here. /sign/1…100 and 擲筊長尾頁 land in P5.
export const PAGES = ['/', '/privacy', '/terms', '/refunds', '/dmca'];

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        sitemapXml(
          site,
          PAGES.map((path) => ({ path })),
        ),
    },
  },
});
