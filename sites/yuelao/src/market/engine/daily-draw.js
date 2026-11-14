// 今日一籤（月老殿）／今日一牌（塔羅館）：每天免費一次，不用寫問題（DESIGN.md「今日一籤／今日一牌」）。
// 同一個人同一天打開都是同一支籤、同一張牌：用這台瀏覽器的一個隨機種子＋當地日期決定，
// 不上傳、不需要登入。換一天才換。

import { STICKS } from '../../ritual/sticks';
import { STICK_PLAIN } from '../../ritual/sticks-plain';
import { TAROT } from '../../ritual/tarot';
import { localDayKey } from '../../site/daily';

const SEED_KEY = 'yuelao:seed';

function deviceSeed() {
  try {
    let s = localStorage.getItem(SEED_KEY);
    if (!s) {
      s = Math.random().toString(36).slice(2, 12);
      localStorage.setItem(SEED_KEY, s);
    }
    return s;
  } catch {
    return 'guest';
  }
}

function rng(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export const todayKey = () => localDayKey(new Date());
export const todayLabel = () => {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};

// 今日的「能量色」：塔羅照花色（火、水、風、土、大牌），籤照等第
const SUIT = {
  Wands: { color: '#e0773a', element: '火' },
  Cups: { color: '#5b8fd6', element: '水' },
  Swords: { color: '#a9bcd6', element: '風' },
  Pentacles: { color: '#9fbf6a', element: '土' },
};
const MAJOR = { color: '#b48ce0', element: '大牌' };

/** 今日一牌：{ card, rev, color, element, line } */
export function dailyTarot() {
  const r = rng(`daily-tarot|${todayKey()}|${deviceSeed()}`);
  const card = TAROT[Math.floor(r() * TAROT.length)];
  const rev = r() < 0.25;
  const suit = SUIT[card.img.split('_')[0]] || MAJOR;
  return { card, rev, color: suit.color, element: suit.element, line: rev ? card.rev : card.up };
}

function gradeColor(grade) {
  if (grade.includes('上上')) return '#e8c25a';
  if (grade.includes('上')) return '#e0705a';
  if (grade.includes('下')) return '#8ea2c4';
  return '#8fc4a8';
}

/** 今日一籤：{ stick, plain, love, color } */
export function dailyStick() {
  const r = rng(`daily-stick|${todayKey()}|${deviceSeed()}`);
  const stick = STICKS[Math.floor(r() * STICKS.length)];
  const x = STICK_PLAIN[stick.id] || {};
  return { stick, plain: x.plain || '', love: x.love || '', color: gradeColor(stick.grade) };
}
