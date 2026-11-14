// 介面短句翻譯（2026-11-14）：程式裡寫死的繁體句子，非中文時查表換成當地語言。
// 鍵就是繁體原文；查不到就顯示原文（中文），所以漏翻不會壞，只會露出中文。
// 字典由 tools/i18n-extract.mjs 從原始碼抽出、翻好放在 ui/*.json。
// 這是機器翻譯初稿（站長同意先上線），頁面上有「翻譯審核中」的標示。
//
// 字典不打包進共用程式（四種語言加起來快 100 KB）：伺服器在 src/server.ts 全部登記，
// 瀏覽器在 src/client.tsx 只載入目前語言那一份、載好才開始 hydrate，所以首屏兩邊一致。

import { getLocale } from '~/paraglide/runtime.js';

const DICT: Record<string, Record<string, string>> = {};

export function registerUiDict(locale: string, dict: Record<string, string>) {
  DICT[locale] = dict;
}

/** 繁體原文 → 目前語言。中文（繁／簡）原樣回傳；簡體另由呼叫端的繁簡二選一處理。 */
export function tr(hant: string, locale: string = getLocale()): string {
  const d = DICT[locale];
  return d?.[hant] ?? hant;
}

/** 帶變數的句子：原文用 {0}、{1} 佔位，例如 trf('剩 {0} 次', n)。 */
export function trf(hant: string, ...args: (string | number)[]): string {
  return tr(hant).replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}

export function uiDict(locale: string = getLocale()): Record<string, string> | undefined {
  return DICT[locale];
}
