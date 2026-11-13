// 每支籤的白話與出處說明（2026-11-13，參考占了麼）。判詞卡在「判詞」之前先給：
//   plain  白話：這句籤詩字面上在說什麼
//   origin 出處：原句本來在說什麼（典故背景）；無出處的傳統籤詩就說明意象
//   love   放在姻緣裡怎麼讀：一句話定調
// 本站自寫的解說（非籤文本身），繁體為底本；簡體版待人工審閱後再加（不機器轉換）。
import { PLAIN_1 } from './sticks-plain-1';
import { PLAIN_2 } from './sticks-plain-2';

export interface StickPlain {
  plain: string;
  origin: string;
  love: string;
}

/** key 為 stick.id（1–100）。 */
export const STICK_PLAIN: Readonly<Record<number, StickPlain>> = { ...PLAIN_1, ...PLAIN_2 };
