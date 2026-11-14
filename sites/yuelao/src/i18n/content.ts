// 內容字典的載入（判詞、白話、建議、牌義…）。字典很大，瀏覽器只在用得到時才載：
// 籤頁、一般版求籤（路由 loader 呼叫）、集市（Market.tsx）。伺服器在 src/server.ts 全部登記。
// 還沒翻內容的語言沒有這份，查不到就顯示中文原文。

import { uiPrefix } from './locale';
import { hasContentDict, registerContentDict } from './ui';

const LOADERS: Partial<Record<string, () => Promise<{ default: Record<string, string> }>>> = {
  en: () => import('./content/en.json'),
  ja: () => import('./content/ja.json'),
};

export async function ensureContent(locale: string | undefined = uiPrefix()) {
  if (typeof window === 'undefined' || !locale || hasContentDict(locale)) return;
  const load = LOADERS[locale];
  if (!load) return;
  try {
    registerContentDict(locale, (await load()).default);
  } catch {
    // 載不到就顯示中文原文
  }
}
