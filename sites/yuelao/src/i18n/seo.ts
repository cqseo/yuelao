// 頁面 head：在共用的 pageHead 上加各語言版本的 hreflang（中文版沒有前綴，繁簡同一網址）。

import { pageHead as coreHead, type PageMeta } from '@yuelao/core/seo';
import type { SiteConfig } from '@yuelao/core/site';
import { LISTED, prefixOf, stripPrefix, withPrefix } from './locale';

const abs = (site: SiteConfig, path: string) => `${site.url}${path === '/' ? '' : path}`;

/** 沒指定圖的頁面也要有分享圖（Threads、LINE、WhatsApp 等貼連結時才有預覽，2026-11-19）。 */
// 分享卡：1200×630，左邊大字說明是做什麼的、右邊鋪子畫面（public/og/*.jpg）
const DEFAULT_IMAGE = '/og/market.jpg';

export function pageHead(site: SiteConfig, page: PageMeta) {
  const image = page.image ?? `${site.url}${DEFAULT_IMAGE}`;
  const base0 = coreHead(site, { ...page, image });
  // 分享卡固定 1200×630：先告訴爬蟲尺寸，第一次貼連結就能出大圖
  const head = image.includes('/og/')
    ? {
        ...base0,
        meta: [
          ...base0.meta,
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { property: 'og:image:alt', content: page.title },
        ],
      }
    : base0;
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
