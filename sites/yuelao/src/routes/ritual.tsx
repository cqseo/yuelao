import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import type { RitualCat } from '~/ritual/physics';
import { Ritual } from '~/ritual/Ritual';
import site from '../../site.config';

export const Route = createFileRoute('/ritual')({
  validateSearch: (search: Record<string, unknown>) => {
    const cat = search.cat;
    const q = search.q;
    return {
      cat: cat === 'him' || cat === 'single' || cat === 'reunion' ? (cat as RitualCat) : undefined,
      q: typeof q === 'string' && q.length > 0 && q.length <= 40 ? q : undefined,
    };
  },
  head: () => {
    const head = pageHead(site, {
      title: m.ritual_meta_title({ name: site.name }),
      description: m.ritual_meta_description(),
      // Canonical 是單棵樹（P7：繁/簡同路徑切換，網址不帶語言）。
      path: localizeHref('/ritual', { locale: getLocale() }),
      image: `${site.url}/ritual/temple-fair.jpg`,
    });
    return {
      ...head,
      links: [
        ...head.links,
        // 首屏只預載背景 + 竹筒兩張，其餘懶載（首屏零等待）。
        { rel: 'preload', as: 'image', href: '/ritual/temple-fair.jpg' },
        { rel: 'preload', as: 'image', href: '/ritual/tube.webp' },
      ],
    };
  },
  component: RitualRoute,
});

function RitualRoute() {
  const search = Route.useSearch();
  return <Ritual initialCat={search.cat} initialQ={search.q} />;
}
