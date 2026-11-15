// 頁面 head：在共用的 pageHead 上加各語言版本的 hreflang（中文版沒有前綴，繁簡同一網址）。

import { pageHead as coreHead, type PageMeta } from '@yuelao/core/seo';
import type { SiteConfig } from '@yuelao/core/site';
import { LISTED, prefixOf, stripPrefix, withPrefix } from './locale';

const abs = (site: SiteConfig, path: string) => `${site.url}${path === '/' ? '' : path}`;

export function pageHead(site: SiteConfig, page: PageMeta) {
  const head = coreHead(site, page);
  if (page.noindex) return head;
  const base = stripPrefix(page.path);
  // 沒列出來的語言（泰、韓）不給搜尋引擎收錄，也不掛 hreflang
  const own = prefixOf(page.path);
  if (own && !LISTED.includes(own)) {
    return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, follow' }] };
  }
  const links: Record<string, string>[] = [
    ...head.links,
    { rel: 'alternate', hrefLang: 'zh', href: abs(site, base) },
    ...LISTED.map((l) => ({ rel: 'alternate', hrefLang: l, href: abs(site, withPrefix(base, l)) })),
    { rel: 'alternate', hrefLang: 'x-default', href: abs(site, base) },
  ];
  return { ...head, links };
}
