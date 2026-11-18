import type { StickContextProvider } from '@yuelao/core/ai-reading';
import { adviceFor } from './stick-advice';
import { stickById } from './sticks';
import { resolveStick } from './sticks-locale';
import { STICK_PLAIN } from './sticks-plain';

// 付費解籤用的籤內容 = 籤頁上顯示的那一份（籤詩、出處、白話、本義、姻緣解、免費判詞與建議）。
// 資料庫 sticks 表是舊版籤文，不能拿來解（站長 2026-11-18 發現兩邊對不上）。
// 不依賴 Worker 環境，tools/test-reading-v2.ts 直接拿來驗。
export const stickContext: StickContextProvider = (stickId, category, locale) => {
  const base = stickById(stickId);
  if (!base) return null;
  const { stick } = resolveStick(base, locale);
  const plain = STICK_PLAIN[stickId];
  const advice = adviceFor(stickId, locale);
  return {
    no: stick.no,
    grade: stick.grade,
    poem: stick.poem,
    verdict: stick.verdict[category],
    source: stick.source ?? null,
    plain: plain?.plain,
    origin: plain?.origin,
    love: plain?.love,
    actions: advice.actions,
    practice: advice.practice,
  };
};
