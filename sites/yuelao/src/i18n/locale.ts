// 多語言（2026-11-14）：中文（繁／簡）、English、日本語、ไทย、한국어。
//
// 網址：中文不帶前綴（繁簡同一路徑，靠 PARAGLIDE_LOCALE cookie 分，沿用 P7），
// 其他語言各有獨立網址 /en/…、/ja/…、/th/…、/ko/…，方便分享與搜尋引擎收錄。
// 判斷語言只看這裡的 custom-path 策略（src/i18n/strategy.ts），不用 Paraglide 內建的 url 策略：
// 內建的會把沒前綴的路徑一律判成某一種中文，蓋掉繁簡 cookie。
//
// 內容（籤詩、塔羅牌義、心箋、測驗題目）第一階段仍是中文；非中文介面讀的是繁體內容（contentLocale）。

import { getLocale, type Locale } from '~/paraglide/runtime.js';

export const PREFIXED = ['en', 'ja', 'th', 'ko'] as const;
export type Prefixed = (typeof PREFIXED)[number];
export const COOKIE = 'PARAGLIDE_LOCALE';

export function isZh(locale: string): locale is 'zh-Hant' | 'zh-Hans' {
  return locale === 'zh-Hant' || locale === 'zh-Hans';
}

/** 路徑開頭的語言前綴；沒有就 undefined（中文）。 */
export function prefixOf(pathname: string): Prefixed | undefined {
  const seg = pathname.split('/')[1] ?? '';
  return (PREFIXED as readonly string[]).includes(seg) ? (seg as Prefixed) : undefined;
}

/** 去掉語言前綴：/en/ritual → /ritual，/en → /。 */
export function stripPrefix(pathname: string): string {
  const p = prefixOf(pathname);
  if (!p) return pathname;
  const rest = pathname.slice(p.length + 1);
  return rest === '' ? '/' : rest;
}

/** 某語言下的路徑：中文不加前綴，其他加 /xx。 */
export function withPrefix(pathname: string, locale: string): string {
  const base = stripPrefix(pathname);
  if (isZh(locale)) return base;
  return base === '/' ? `/${locale}/` : `/${locale}${base}`;
}

/** 從路徑＋cookie 決定語言（伺服器與瀏覽器共用）。 */
export function resolveLocale(pathname: string, cookieHeader: string | null | undefined): Locale {
  const p = prefixOf(pathname);
  if (p) return p;
  const m = /(?:^|;\s*)PARAGLIDE_LOCALE=([^;]+)/.exec(cookieHeader ?? '');
  return m?.[1] === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant';
}

/** 內容與 API 用的語言：只有繁、簡兩種內容。 */
export function contentLocale(locale: string = getLocale()): 'zh-Hant' | 'zh-Hans' {
  return locale === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant';
}

/** 非中文介面的網址前綴（給付款回跳用）；中文為 undefined。 */
export function uiPrefix(locale: string = getLocale()): Prefixed | undefined {
  return (PREFIXED as readonly string[]).includes(locale) ? (locale as Prefixed) : undefined;
}

/** 換語言：中文寫 cookie（繁簡同路徑），其他換網址前綴；整頁重載。 */
export function switchLocale(target: Locale) {
  if (typeof window === 'undefined') return;
  if (isZh(target)) {
    // biome-ignore lint/suspicious/noDocumentCookie: 繁簡偏好只存在這個 cookie，伺服器 SSR 也讀它
    document.cookie = `${COOKIE}=${target}; path=/; max-age=34560000; samesite=lax`;
  }
  const { pathname, search, hash } = window.location;
  const next = withPrefix(pathname, target) + search + hash;
  if (next === pathname + search + hash) window.location.reload();
  else window.location.assign(next);
}

/** 語言選單（照站長給的樣式：中［繁／簡］、EN、日本語、ไทย、한국어）。 */
export const LANGS: { id: Locale; label: string; native: string }[] = [
  { id: 'en', label: 'EN', native: 'English' },
  { id: 'ja', label: '日本語', native: '日本語' },
  { id: 'th', label: 'ไทย', native: 'ไทย' },
  { id: 'ko', label: '한국어', native: '한국어' },
];

/** 標在 <html lang> 與 hreflang 的語言碼。 */
export const HREFLANG: Record<Locale, string> = {
  'zh-Hant': 'zh-Hant',
  'zh-Hans': 'zh-Hans',
  en: 'en',
  ja: 'ja',
  th: 'th',
  ko: 'ko',
};
