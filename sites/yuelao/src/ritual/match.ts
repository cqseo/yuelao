import { loveIds } from '@yuelao/core/love';
import { type MatchPerson, matchIds, signOf } from '@yuelao/core/match';
import { Solar } from 'lunar-javascript';

// 算命攤．合緣配對：生日 → 生肖（以立春換年，用萬年曆）與星座。只在瀏覽器裡算，生日不送出。
// 萬年曆檔案不小，只在算命攤按「合一合」時才載入（engine/fortune.js 動態 import）。

const ZODIAC_HANS = '鼠牛虎兔龙蛇马羊猴鸡狗猪';

export function zodiacOf(year: number, month: number, day: number): number {
  const z = Solar.fromYmd(year, month, day).getLunar().getYearShengXiaoByLiChun();
  return ZODIAC_HANS.indexOf(z) + 1;
}

/** "YYYY-MM-DD" → 生肖與星座；日期不存在或不在 1901–2099 就回 null。 */
export function personOf(date: string): MatchPerson | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1901 || y > 2099 || mo < 1 || mo > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const zodiac = zodiacOf(y, mo, d);
  return zodiac ? { zodiac, sign: signOf(mo, d) } : null;
}

/** 付費解讀的識別字串：match:<你>,<對方>|<雜湊>。雜湊由兩人生日＋情況＋問題算出，生日本身不送出。 */
export async function matchKey(
  you: string,
  them: string,
  sit: string,
  question: string,
): Promise<string | null> {
  const a = personOf(you);
  const b = personOf(them);
  if (!a || !b) return null;
  const src = `${you}|${them}|${sit}|${question.replace(/\s+/g, '')}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
  const hex = [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  return `match:${matchIds(a, b)}|${hex}`;
}

/** 現在的流年（國曆年，立春前算前一年）。 */
export function flowYear(now = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m < 2 || (m === 2 && now.getDate() < 4) ? y - 1 : y;
}

/** 個人姻緣盤的識別字串：love:<生肖>_<星座>_<流年>|<雜湊>。雜湊由生日＋情況＋問題算出。 */
export async function loveKey(
  you: string,
  year: number,
  sit: string,
  question: string,
): Promise<string | null> {
  const a = personOf(you);
  if (!a) return null;
  const src = `${you}|love|${sit}|${question.replace(/\s+/g, '')}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
  const hex = [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  return `love:${loveIds(a.zodiac, a.sign, year)}|${hex}`;
}
