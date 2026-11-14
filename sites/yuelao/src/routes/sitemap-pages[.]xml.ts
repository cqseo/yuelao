import { createFileRoute } from '@tanstack/react-router';
import { sitemapXml } from '@yuelao/core/seo';
import { PREFIXED, withPrefix } from '~/i18n/locale';
// Core pages. 中文（繁簡同路徑）一份，en/ja/th/ko 各一份帶前綴（2026-11-14）。
// Register new indexable pages here. /sign/1…100 live in /sitemap-signs.xml
// （籤詩內容還只有中文，所以籤頁只列中文版）。
import { TESTS } from '~/tests/catalog';
import site from '../../site.config';

export const PAGES = [
  '/',
  '/ritual',
  '/market',
  '/tests',
  '/daily',
  ...TESTS.map((t) => `/tests/${t.slug}`),
  '/privacy',
  '/terms',
  '/refunds',
  '/dmca',
];

const ALL_PAGES = [...PAGES, ...PREFIXED.flatMap((l) => PAGES.map((p) => withPrefix(p, l)))];

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
