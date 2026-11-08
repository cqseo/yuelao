import { createFileRoute } from '@tanstack/react-router';
import { sitemapXml } from '@yuelao/core/seo';
// Core pages, one URL tree (P7: no locale prefixes — the 繁/簡 toggle is a
// same-path cookie switch). Register new indexable pages here.
// /sign/1…100 live in /sitemap-signs.xml.
import { TESTS } from '~/tests/catalog';
import site from '../../site.config';

export const PAGES = [
  '/',
  '/ritual',
  '/tests',
  ...TESTS.map((t) => `/tests/${t.slug}`),
  '/privacy',
  '/terms',
  '/refunds',
  '/dmca',
];

const ALL_PAGES = PAGES;

export const Route = createFileRoute('/sitemap-pages.xml')({
  server: {
    handlers: {
      GET: () =>
        sitemapXml(
          site,
          ALL_PAGES.map((path) => ({ path })),
        ),
    },
  },
});
