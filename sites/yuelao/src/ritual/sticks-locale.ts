// 籤文語言解析：繁體是底本原文；簡體只有「已人審」的譯本才能上線。
//
// 倉庫規矩（AGENTS.md §3）：簡體文案不要機器轉換不經人審就上線。
// 機器轉換的簡體種子存在 supabase 遷移裡（標註「待人審」，未應用到
// 線上庫），但在有人逐支審過之前，應用層一律回落繁體原文。
// P1 儀式不從 Supabase 讀籤文（純客戶端，sticks.ts 為唯一數據源），
// 所以這裡的已審表目前是空的——等譯本審完、種子應用後，再把審過的
// 簡體籤文以同樣的結構登記進來即可（key 為 stick.id）。

import type { Locale } from '~/paraglide/runtime.js';
import type { Stick } from './sticks';

/** 已人審的簡體籤文（stick.id → 譯本）。P1 為空：等審完再登記。 */
const REVIEWED_ZH_HANS: ReadonlyMap<number, Stick> = new Map();

export interface ResolvedStick {
  /** 顯示用的籤（簡體已審則為譯本，否則為繁體原文）。 */
  stick: Stick;
  /** true = 正在顯示繁體原文（簡體譯本尚未審過）。 */
  fallback: boolean;
}

export function resolveStick(stick: Stick, locale: Locale): ResolvedStick {
  if (locale === 'zh-Hans') {
    const reviewed = REVIEWED_ZH_HANS.get(stick.id);
    if (reviewed) return { stick: reviewed, fallback: false };
    return { stick, fallback: true };
  }
  return { stick, fallback: false };
}

/** 是否需要在籤卡下方顯示「籤文為繁體原文，簡體譯本審核中」。 */
export function showLocaleNote(locale: Locale): boolean {
  // 非中文介面：籤詩仍是中文原文，一樣提示。
  if (locale !== 'zh-Hant' && locale !== 'zh-Hans') return true;
  return locale === 'zh-Hans' && REVIEWED_ZH_HANS.size === 0;
}
