// 算命攤．個人姻緣盤（站長 2026-11-19，第二期）：只用自己的生肖（以立春換年）、星座與今年的流年，
// 依民間說法排出桃花、紅鸞、天喜落在哪個生肖、哪幾年，以及今年和你的生肖是什麼關係。
// 前端用生日算出編號（生日不送出、不存）；付款、生成、讀取都用這裡的同一份推算。
// 桃花、紅鸞、天喜一律以「年支」（生肖）起，屬簡化的民間算法，文案上照實說。

import {
  BRANCH,
  SIGNS,
  type SignRelation,
  signElement,
  signRelation,
  ZODIAC,
  ZODIAC_RELATION_NAME,
  type ZodiacRelation,
  zodiacRelation,
} from './match';

const STEM = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 該年（國曆年，以立春後為準）的地支編號 1–12。 */
export const yearZodiac = (year: number) => ((((year - 4) % 12) + 12) % 12) + 1;
export const yearGanzhi = (year: number) =>
  `${STEM[(((year - 4) % 10) + 10) % 10]}${BRANCH[yearZodiac(year) - 1]}`;

/** 桃花：申子辰在酉、寅午戌在卯、巳酉丑在午、亥卯未在子（皆以 1–12 編號）。 */
export function taohuaOf(zodiac: number): number {
  const b = zodiac - 1;
  const group = [8, 0, 4].includes(b) ? 9 : [2, 6, 10].includes(b) ? 3 : [5, 9, 1].includes(b) ? 6 : 0;
  return group + 1;
}
/** 紅鸞：子年在卯，逆行；天喜在紅鸞對沖的位置。 */
export const hongluanOf = (zodiac: number) => ((3 - (zodiac - 1) + 12) % 12) + 1;
export const tianxiOf = (zodiac: number) => ((hongluanOf(zodiac) - 1 + 6) % 12) + 1;

export type LoveStar = 'hongluan' | 'tianxi' | 'taohua';
export const STAR_NAME: Record<LoveStar, string> = { hongluan: '紅鸞', tianxi: '天喜', taohua: '桃花' };

export type LoveTitle =
  | '紅鸞星動'
  | '天喜臨門'
  | '桃花當令'
  | '人緣漸旺'
  | '本命之年'
  | '宜靜不宜急'
  | '先穩自己'
  | '細水長流';

export interface LoveChart {
  zodiac: number;
  sign: number;
  year: number;
  taohua: number;
  hongluan: number;
  tianxi: number;
  /** 今年的地支和你的生肖是什麼關係（沖＝沖太歲、同肖＝本命年）。 */
  yearRelation: ZodiacRelation;
  /** 今年落在哪顆星上（可能沒有）。 */
  yearStar: LoveStar | null;
  /** 未來 12 年（含今年）三顆星各落在哪幾年；同一年可能同時有兩顆（例：屬馬的天喜和桃花都在兔年）。 */
  years: { year: number; stars: LoveStar[] }[];
  /** 六合、三合的生肖（最容易處得來）。 */
  goodMatch: number[];
  /** 六沖的生肖（相處要多磨合）。 */
  hardMatch: number;
  title: LoveTitle;
}

/** 這一年落到的星，依紅鸞、天喜、桃花排。 */
function starsOf(zodiac: number, year: number): LoveStar[] {
  const y = yearZodiac(year);
  const out: LoveStar[] = [];
  if (y === hongluanOf(zodiac)) out.push('hongluan');
  if (y === tianxiOf(zodiac)) out.push('tianxi');
  if (y === taohuaOf(zodiac)) out.push('taohua');
  return out;
}
/** 從 year（含）起，下一個這顆星的年份。 */
export function nextStarYear(c: Pick<LoveChart, 'years'>, star: LoveStar): number | undefined {
  return c.years.find((y) => y.stars.includes(star))?.year;
}
export const starsLabel = (stars: LoveStar[]) => stars.map((s) => STAR_NAME[s]).join('．');

export function loveChart(zodiac: number, sign: number, year: number): LoveChart {
  const yearRelation = zodiacRelation(zodiac, yearZodiac(year));
  const yearStar = starsOf(zodiac, year)[0] ?? null;
  const years: LoveChart['years'] = [];
  for (let y = year; y < year + 12; y++) {
    const stars = starsOf(zodiac, y);
    if (stars.length) years.push({ year: y, stars });
  }
  const goodMatch: number[] = [];
  for (let z = 1; z <= 12; z++) {
    const r = zodiacRelation(zodiac, z);
    if (r === 'liuhe' || r === 'sanhe') goodMatch.push(z);
  }
  const hardMatch = ((zodiac - 1 + 6) % 12) + 1;
  const title: LoveTitle =
    yearStar === 'hongluan'
      ? '紅鸞星動'
      : yearStar === 'tianxi'
        ? '天喜臨門'
        : yearStar === 'taohua'
          ? '桃花當令'
          : yearRelation === 'liuhe' || yearRelation === 'sanhe'
            ? '人緣漸旺'
            : yearRelation === 'same'
              ? '本命之年'
              : yearRelation === 'chong'
                ? '宜靜不宜急'
                : yearRelation === 'hai' || yearRelation === 'xing'
                  ? '先穩自己'
                  : '細水長流';
  return {
    zodiac,
    sign,
    year,
    taohua: taohuaOf(zodiac),
    hongluan: hongluanOf(zodiac),
    tianxi: tianxiOf(zodiac),
    yearRelation,
    yearStar,
    years,
    goodMatch,
    hardMatch,
    title,
  };
}

/** 星座最合得來的元素：同元素與互補元素。 */
export function signFriends(sign: number): string[] {
  const out: string[] = [];
  for (let s = 1; s <= 12; s++) {
    if (s === sign) continue;
    const r: SignRelation = signRelation(sign, s);
    if (r !== 'rub') out.push(SIGNS[s - 1]!);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 識別字串中間那段：生肖_星座_年（例：11_11_2026）。 */
export const loveIds = (zodiac: number, sign: number, year: number) => `${pad(zodiac)}_${pad(sign)}_${year}`;

export function parseLoveIds(ids: string): { zodiac: number; sign: number; year: number } | null {
  const m = /^(\d\d)_(\d\d)_(20\d\d)$/.exec(ids);
  if (!m) return null;
  const [zodiac, sign, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (zodiac < 1 || zodiac > 12 || sign < 1 || sign > 12 || year < 2025) return null;
  return { zodiac, sign, year };
}

export const LOVE_TITLE_TEXT: Record<LoveTitle, string> = {
  紅鸞星動: '今年走到你的紅鸞年，民間說這是姻緣最容易動的一年。有人就別再只是觀望。',
  天喜臨門: '今年遇上天喜，喜事、好消息容易靠近。感情上適合把話說開、把關係往前推一步。',
  桃花當令: '今年是你的桃花年，認識人的機會變多；多不一定好，要分清楚誰是真心。',
  人緣漸旺: '今年和你的生肖相合，人緣比平常好。主動一點，緣分比較接得住。',
  本命之年: '今年是你的本命年，心情容易起伏。感情上先照顧好自己，再談往前。',
  宜靜不宜急: '今年和你的生肖相沖，步調容易亂。感情上別急著下決定，穩住就是贏。',
  先穩自己: '今年和你的生肖有些不順，小事容易誤會。先把自己的生活過穩，緣分才待得住。',
  細水長流: '今年不沖不合，感情運平穩。不會有大起大落，適合慢慢經營。',
};

/** 免費結果的幾行說明。 */
export function loveLines(c: LoveChart): { label: string; text: string }[] {
  const z = (n: number) => ZODIAC[n - 1];
  const when = (star: LoveStar) => {
    const y = nextStarYear(c, star);
    return y === undefined ? '' : y === c.year ? '就是今年' : `下一次在 ${y} 年（${yearGanzhi(y)}）`;
  };
  return [
    {
      label: `桃花．屬${z(c.taohua)}`,
      text: `你的桃花位在「${BRANCH[c.taohua - 1]}」，屬${z(c.taohua)}的人常是你身邊的好人緣；逢${z(c.taohua)}年桃花較旺，${when('taohua')}。`,
    },
    {
      label: `紅鸞．${z(c.hongluan)}年`,
      text: `紅鸞主姻緣，${when('hongluan')}；天喜主喜事，落在${z(c.tianxi)}年，${when('tianxi')}。`,
    },
    {
      label: '和誰處得來',
      text: `生肖上，${c.goodMatch.map(z).join('、')}和你最合；屬${z(c.hardMatch)}的步調和你相反，要多磨合。星座上，${signElement(c.sign)}象的你和${signFriends(c.sign).slice(0, 4).join('、')}比較有默契。`,
    },
  ];
}

/** 給付費解讀的提示用。 */
export function loveFacts(c: LoveChart) {
  const z = (n: number) => `${BRANCH[n - 1]}${ZODIAC[n - 1]}`;
  return {
    you: { zodiac: z(c.zodiac), sign: SIGNS[c.sign - 1], element: `${signElement(c.sign)}象` },
    thisYear: {
      year: c.year,
      ganzhi: yearGanzhi(c.year),
      relationToYou:
        c.yearRelation === 'chong'
          ? '六沖（沖太歲）'
          : c.yearRelation === 'same'
            ? '同肖（本命年）'
            : ZODIAC_RELATION_NAME[c.yearRelation],
      star: c.yearStar ? STAR_NAME[c.yearStar] : '無',
    },
    taohua: z(c.taohua),
    hongluan: z(c.hongluan),
    tianxi: z(c.tianxi),
    starYears: c.years.map((y) => `${y.year}（${yearGanzhi(y.year)}）${starsLabel(y.stars)}`),
    goodMatch: c.goodMatch.map(z),
    hardMatch: z(c.hardMatch),
    signFriends: signFriends(c.sign),
    overall: c.title,
  };
}
