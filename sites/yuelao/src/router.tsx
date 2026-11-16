import { createRouter } from '@tanstack/react-router';
import { deLocalizeUrl, localizeUrl } from '~/paraglide/runtime.js';
import { routeTree } from './routeTree.gen';
import './i18n/strategy';

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // 網址語言前綴：/en/market 會正確對應 /market，產生連結時依目前語言加回前綴
    // （中文不加）。規則在 paraglide 設定的 urlPatterns，語言判斷見 src/i18n/locale.ts。
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
