// 算命攤．八字命盤（站長 2026-11-19，第三期）：以感情為主的八字簡盤。
// 前端用萬年曆（lunar-javascript）把生日、時辰換成四柱的天干地支編號；生日與時辰不送出、不存。
// 這裡只用編號推：五行多寡、日主強弱（簡化算法）、夫妻宮、配偶星、桃花，付款、生成、讀取都用同一份。
// 屬簡化的民間算法：不排大運、不論格局與神煞細節，文案照實說。

import { yearGanzhi } from './love';
import { BRANCH, ZODIAC } from './match';

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const ELEMENTS = ['木', '火', '土', '金', '水'] as const;
export type Element5 = (typeof ELEMENTS)[number];

/** 天干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。 */
export const stemElement = (s: number): Element5 => ELEMENTS[Math.floor(s / 2)]!;
/** 地支本氣五行：子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水。 */
const BRANCH_EL: Element5[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
export const branchElement = (b: number): Element5 => BRANCH_EL[b]!;
const isYang = (s: number) => s % 2 === 0;

const idx = (e: Element5) => ELEMENTS.indexOf(e);
/** a 生 b？（木生火、火生土、土生金、金生水、水生木） */
const generates = (a: Element5, b: Element5) => (idx(a) + 1) % 5 === idx(b);
/** a 剋 b？（木剋土、土剋水、水剋火、火剋金、金剋木） */
const controls = (a: Element5, b: Element5) => (idx(a) + 2) % 5 === idx(b);

export type Gender = 'm' | 'f' | 'n';
export interface Pillar {
  stem: number; // 0–9
  branch: number; // 0–11
}
export interface BaziInput {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 不知道時辰就是 null（只排三柱）。 */
  hour: Pillar | null;
  gender: Gender;
  /** 現在的流年（國曆年，立春前算前一年）。 */
  flow: number;
}

export type Strength = '偏強' | '中和' | '偏弱';
export type BaziTitle = '如樹向陽' | '熱烈真誠' | '厚重可靠' | '外冷內熱' | '柔中帶韌';

export interface BaziChart extends BaziInput {
  dayMaster: Element5;
  counts: Record<Element5, number>;
  missing: Element5[];
  strength: Strength;
  /** 夫妻宮：日支。 */
  spousePalace: number;
  /** 配偶星的五行：女命看剋我者（官殺），男命看我剋者（財星）；不說性別時兩者都列。 */
  spouseStars: Element5[];
  /** 配偶星在盤上出現幾次（天干＋地支本氣）。 */
  spouseStarCount: number;
  /** 桃花（以日支起）。 */
  taohua: number;
  /** 今年的天干五行對日主是什麼（生我、同我、我生、我剋、剋我）。 */
  flowRole: '印' | '比劫' | '食傷' | '財' | '官殺';
  title: BaziTitle;
}

export function roleOf(dayMaster: Element5, other: Element5): BaziChart['flowRole'] {
  if (other === dayMaster) return '比劫';
  if (generates(other, dayMaster)) return '印';
  if (generates(dayMaster, other)) return '食傷';
  if (controls(dayMaster, other)) return '財';
  return '官殺';
}

const TAOHUA_BY_BRANCH = (b: number) =>
  [8, 0, 4].includes(b) ? 9 : [2, 6, 10].includes(b) ? 3 : [5, 9, 1].includes(b) ? 6 : 0;

export function baziChart(input: BaziInput): BaziChart {
  const pillars = [input.year, input.month, input.day, ...(input.hour ? [input.hour] : [])];
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 } as Record<Element5, number>;
  for (const p of pillars) {
    counts[stemElement(p.stem)] += 1;
    counts[branchElement(p.branch)] += 1;
  }
  const dayMaster = stemElement(input.day.stem);
  // 強弱（簡化）：同我與生我的字數，月支（得令）多算一次；超過一半偏強、少於三成偏弱
  const total = pillars.length * 2 + 1;
  const supportOf = (e: Element5) => (e === dayMaster || generates(e, dayMaster) ? 1 : 0);
  let support = 0;
  for (const p of pillars) support += supportOf(stemElement(p.stem)) + supportOf(branchElement(p.branch));
  support += supportOf(branchElement(input.month.branch));
  const ratio = support / total;
  const strength: Strength = ratio > 0.5 ? '偏強' : ratio < 0.34 ? '偏弱' : '中和';
  const official = ELEMENTS.find((e) => controls(e, dayMaster))!;
  const wealth = ELEMENTS.find((e) => controls(dayMaster, e))!;
  const spouseStars =
    input.gender === 'f' ? [official] : input.gender === 'm' ? [wealth] : [official, wealth];
  const spouseStarCount = spouseStars.reduce((n, e) => n + counts[e], 0);
  const flowStem = (((input.flow - 4) % 10) + 10) % 10;
  const TITLES: Record<Element5, BaziTitle> = {
    木: '如樹向陽',
    火: '熱烈真誠',
    土: '厚重可靠',
    金: '外冷內熱',
    水: '柔中帶韌',
  };
  return {
    ...input,
    dayMaster,
    counts,
    missing: ELEMENTS.filter((e) => counts[e] === 0),
    strength,
    spousePalace: input.day.branch,
    spouseStars,
    spouseStarCount,
    taohua: TAOHUA_BY_BRANCH(input.day.branch),
    flowRole: roleOf(dayMaster, stemElement(flowStem)),
    title: TITLES[dayMaster],
  };
}

// ---------- 識別字串：bazi:<年>,<月>,<日>,<時>_<流年>_<性別>|<雜湊> ----------
// 每柱兩個字：天干 0–9、地支 a–l；不知道時辰寫 xx。例：6g,9h,2a,xx_2026_f
const pillarId = (p: Pillar | null) => (p ? `${p.stem}${String.fromCharCode(97 + p.branch)}` : 'xx');
export const baziIds = (i: BaziInput) =>
  `${pillarId(i.year)},${pillarId(i.month)},${pillarId(i.day)},${pillarId(i.hour)}_${i.flow}_${i.gender}`;

export function parseBaziIds(ids: string): BaziInput | null {
  const m = /^(\d[a-l]),(\d[a-l]),(\d[a-l]),(\d[a-l]|xx)_(20\d\d)_([mfn])$/.exec(ids);
  if (!m) return null;
  const p = (s: string): Pillar => ({ stem: Number(s[0]), branch: s.charCodeAt(1) - 97 });
  const pillars = [p(m[1]!), p(m[2]!), p(m[3]!), m[4] === 'xx' ? null : p(m[4]!)];
  // 干支要陰陽相同（甲子、乙丑…，沒有甲丑）
  if (pillars.some((x) => x && x.stem % 2 !== x.branch % 2)) return null;
  const flow = Number(m[5]);
  if (flow < 2025) return null;
  return {
    year: pillars[0]!,
    month: pillars[1]!,
    day: pillars[2]!,
    hour: pillars[3] ?? null,
    flow,
    gender: m[6] as Gender,
  };
}

export const pillarName = (p: Pillar) => `${STEMS[p.stem]}${BRANCH[p.branch]}`;

export const BAZI_TITLE_TEXT: Record<BaziTitle, string> = {
  如樹向陽: '木日主，像一棵往光裡長的樹：重承諾、肯付出，在感情裡要的是一起成長。',
  熱烈真誠: '火日主，喜歡就藏不住：熱情直接、真心待人，也要學會給感情一點慢下來的時間。',
  厚重可靠: '土日主，給人安穩的感覺：不輕易動心，一旦認定就很長情，最怕被辜負。',
  外冷內熱: '金日主，外表理性、有原則，心裡其實很在乎；說出口的愛不多，做的比說的多。',
  柔中帶韌: '水日主，敏感、善解人意，看起來隨和，其實很有自己的主意。',
};

const ROLE_TEXT: Record<BaziChart['flowRole'], string> = {
  印: '今年的天干生扶你，貴人與安全感較多，適合被照顧、也適合好好談一次心。',
  比劫: '今年和你同氣，朋友圈熱鬧、自我意識強；感情上要留意競爭或各忙各的。',
  食傷: '今年是你表達的一年，魅力與話題都多；把想法說出口，但別說得太衝。',
  財: '今年財星出現，對男命是緣分較近的一年；對所有人都是務實經營的一年。',
  官殺: '今年官殺透出，對女命是緣分較近的一年；對所有人都是壓力與規矩較多的一年。',
};

/** 免費結果的幾行說明。 */
export function baziLines(c: BaziChart): { label: string; text: string }[] {
  const spouseWord =
    c.gender === 'f' ? '官殺（代表伴侶）' : c.gender === 'm' ? '財星（代表伴侶）' : '官殺與財星（代表伴侶）';
  const star =
    c.spouseStarCount === 0
      ? `盤上沒有${spouseWord}的${c.spouseStars.join('、')}，民間說是緣分要靠後天、靠流年引動，不必心急。`
      : c.spouseStarCount >= 3
        ? `${spouseWord}的${c.spouseStars.join('、')}出現 ${c.spouseStarCount} 次，桃花與選擇都多，難的是定下來。`
        : `${spouseWord}的${c.spouseStars.join('、')}出現 ${c.spouseStarCount} 次，緣分有，關鍵在時機。`;
  return [
    {
      label: `五行．日主${c.dayMaster}${c.strength}`,
      text: `四柱裡${ELEMENTS.map((e) => `${e}${c.counts[e]}`).join('、')}${c.missing.length ? `，缺${c.missing.join('、')}` : '，五行都有'}。日主${c.dayMaster}${c.strength}。`,
    },
    {
      label: `夫妻宮．${BRANCH[c.spousePalace]}${branchElement(c.spousePalace)}`,
      text: `日支是夫妻宮，你的是「${BRANCH[c.spousePalace]}」（${branchElement(c.spousePalace)}）。${star}`,
    },
    {
      label: `桃花．屬${ZODIAC[c.taohua]}`,
      text: `以日支起桃花在「${BRANCH[c.taohua]}」：屬${ZODIAC[c.taohua]}的人、${ZODIAC[c.taohua]}年或${ZODIAC[c.taohua]}月，人緣比較旺。`,
    },
    {
      label: `${c.flow} ${yearGanzhi(c.flow)}年`,
      text: ROLE_TEXT[c.flowRole],
    },
  ];
}

/** 給付費解讀的提示用。 */
export function baziFacts(c: BaziChart) {
  return {
    pillars: {
      year: pillarName(c.year),
      month: pillarName(c.month),
      day: pillarName(c.day),
      hour: c.hour ? pillarName(c.hour) : '不詳（只排三柱）',
    },
    gender: c.gender === 'f' ? '女' : c.gender === 'm' ? '男' : '未說明',
    dayMaster: `${STEMS[c.day.stem]}${c.dayMaster}（${isYang(c.day.stem) ? '陽' : '陰'}）`,
    strength: c.strength,
    elementCounts: c.counts,
    missing: c.missing,
    spousePalace: `${BRANCH[c.spousePalace]}（${branchElement(c.spousePalace)}）`,
    spouseStars: c.spouseStars,
    spouseStarCount: c.spouseStarCount,
    taohua: `${BRANCH[c.taohua]}${ZODIAC[c.taohua]}`,
    zodiac: ZODIAC[c.year.branch],
    thisYear: { year: c.flow, ganzhi: yearGanzhi(c.flow), roleToDayMaster: c.flowRole },
    overall: c.title,
  };
}
