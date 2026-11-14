import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { FAQS, Home } from '~/market/Home';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

// 首頁（整頁重做，2026-11-12）：月下集市的門面，內容在 ~/market/Home。
// 舊的問事總目版式已整個換掉；求籤、心箋、問月老、測驗各自的頁面不變，首頁只留入口。
export const Route = createFileRoute('/')({
  head: () => {
    const head = pageHead(site, {
      title: m.home_meta_title({ name: tr(site.name) }),
      description: m.home_meta_description(),
      // Canonical 是單棵樹（P7：繁/簡同路徑切換，網址不帶語言）。
      path: localizeHref('/', { locale: getLocale() }),
      image: `${site.url}/market/plaza.jpg`,
      jsonLd: [
        {
          '@type': 'WebApplication',
          name: tr(site.name),
          url: site.url,
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Web',
        },
        {
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({
            '@type': 'Question',
            name: f.q(),
            acceptedAnswer: { '@type': 'Answer', text: f.a() },
          })),
        },
      ],
    });
    return { ...head, links: [...head.links, { rel: 'preload', as: 'image', href: '/market/plaza.jpg' }] };
  },
  component: Home,
});
