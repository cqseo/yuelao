import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { Market } from '~/market/Market';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

export const Route = createFileRoute('/market')({
  head: () =>
    pageHead(site, {
      title: m.common_market_meta_title({ name: site.name }),
      description: m.common_market_meta_description(),
      path: localizeHref('/market', { locale: getLocale() }),
    }),
  component: Market,
});
