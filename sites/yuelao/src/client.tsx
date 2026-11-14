import { StartClient } from '@tanstack/react-start/client';
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { ensureContent } from './i18n/content';
import { prefixOf } from './i18n/locale';
import { registerUiDict } from './i18n/ui';

// 瀏覽器入口：和 TanStack Start 預設的一樣，只是非中文介面先載入那一種語言的介面字典再 hydrate
// （伺服器渲染時已用同一份字典，先載好才不會首屏對不上）。中文不載任何字典。
const UI = {
  en: () => import('./i18n/ui/en.json'),
  ja: () => import('./i18n/ui/ja.json'),
  th: () => import('./i18n/ui/th.json'),
  ko: () => import('./i18n/ui/ko.json'),
};
// 伺服器渲染了內容的頁面（籤頁、一般版求籤），內容字典也要先載好才能 hydrate。
const NEEDS_CONTENT = /^\/[a-z]{2}\/(sign|ritual)(\/|$)/;

async function boot() {
  const ui = prefixOf(window.location.pathname);
  if (ui) {
    try {
      const [u] = await Promise.all([
        UI[ui](),
        NEEDS_CONTENT.test(window.location.pathname) ? ensureContent(ui) : undefined,
      ]);
      registerUiDict(ui, u.default);
    } catch {
      // 字典載不到就顯示中文原文，不擋住頁面
    }
  }
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

void boot();
