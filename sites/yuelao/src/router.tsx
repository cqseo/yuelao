import { createRouter } from '@tanstack/react-router';
import { deLocalizeUrl, localizeUrl } from '~/paraglide/runtime.js';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // i18n URL rewriting: P7 removed the /hk/ locale prefix — the locale
    // lives in the PARAGLIDE_LOCALE cookie, so URLs are never localized.
    // localizeUrl/deLocalizeUrl are identity under the identity urlPatterns
    // in the paraglide config; the rewrite pair stays so a future
    // locale-in-URL change only touches the config, not the router.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
