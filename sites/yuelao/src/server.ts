import handler from '@tanstack/react-start/server-entry';
import { proxyRybbit } from '@yuelao/core/analytics';
import { paraglideMiddleware } from '~/paraglide/server.js';

// Worker entry: pages and API go to TanStack Start.
export default {
  async fetch(request, env) {
    // Rybbit analytics goes through this site's /stats/ and is proxied upstream here.
    const stats = await proxyRybbit(request, env.RYBBIT_UPSTREAM);
    if (stats) return stats;
    // Locale: cookie first, zh-Hant default. Unlike the shipwords template, production
    // runs the middleware too — the site ships Traditional Chinese, not English.
    // TODO(P1): /hk/ path-prefix routing for Simplified (Hong Kong).
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
} satisfies ExportedHandler<Env>;
