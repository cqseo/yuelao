// Paraglide 自訂語言策略「custom-path」：見 locale.ts 開頭。伺服器與瀏覽器各註冊一次；
// 只要有人 import 這個檔就生效（src/server.ts、src/router.tsx）。

import { defineCustomClientStrategy, defineCustomServerStrategy } from '~/paraglide/runtime.js';
import { resolveLocale } from './locale';

defineCustomServerStrategy('custom-path', {
  getLocale: (request) =>
    request ? resolveLocale(new URL(request.url).pathname, request.headers.get('cookie')) : undefined,
});

defineCustomClientStrategy('custom-path', {
  getLocale: () =>
    typeof window === 'undefined' ? undefined : resolveLocale(window.location.pathname, document.cookie),
  // 換語言一律走 switchLocale（整頁換網址），這裡不做事。
  setLocale: () => {},
});
