// 算命攤．合緣配對（站長 2026-11-19）：兩個人的生肖（以立春換年）與星座，看合不合。
// 前端用生日算出生肖與星座的編號（生日不送出、不存）；這裡只用編號判斷關係，
// 付款、生成、讀取都用同一份判斷，免費結果和付費解讀說的是同一件事。
// 只給「怎麼相處」的文化象徵說法，不給機率、分數或「該不該在一起」的結論。

/** 地支順序：1 子鼠 … 12 亥豬。 */
export const ZODIAC = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'] as const;
export const BRANCH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
/** 1 牡羊 … 12 雙魚。 */
export const SIGNS = [
  '牡羊座',
  '金牛座',
  '雙子座',
  '巨蟹座',
  '獅子座',
  '處女座',
  '天秤座',
  '天蠍座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '雙魚座',
] as const;
const ELEMENT = ['火', '土', '風', '水'] as const;
export type Element = (typeof ELEMENT)[number];
export const signElement = (sign: number): Element => ELEMENT[(sign - 1) % 4]!;

/** 星座（月、日；國曆）。 */
export function signOf(month: number, day: number): number {
  // 每個月的分界日：這天（含）以後是下一個星座
  const cut = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  // 1 月分界前是摩羯（10），之後是水瓶（11）
  const before = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const b = before[month - 1]!;
  return day >= cut[month - 1]! ? (b % 12) + 1 : b;
}

export type ZodiacRelation = 'liuhe' | 'sanhe' | 'chong' | 'hai' | 'xing' | 'same' | 'plain';
export type SignRelation = 'same' | 'comp' | 'rub';

const pair = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
// 地支編號 0–11
const LIUHE = new Set(['0,1', '2,11', '3,10', '4,9', '5,8', '6,7']);
const SANHE = [
  [8, 0, 4],
  [11, 3, 7],
  [2, 6, 10],
  [5, 9, 1],
];
const HAI = new Set(['0,7', '1,6', '2,5', '3,4', '8,11', '9,10']);
const XING = new Set(['0,3', '2,5', '5,8', '2,8', '1,10', '7,10', '1,7']);

/** a、b 是 1–12 的生肖編號。優先序：六合 > 三合 > 六沖 > 六害 > 刑 > 同肖 > 平。 */
export function zodiacRelation(a: number, b: number): ZodiacRelation {
  const x = a - 1;
  const y = b - 1;
  const k = pair(x, y);
  if (LIUHE.has(k)) return 'liuhe';
  if (x !== y && SANHE.some((g) => g.includes(x) && g.includes(y))) return 'sanhe';
  if (Math.abs(x - y) === 6) return 'chong';
  if (HAI.has(k)) return 'hai';
  if (XING.has(k)) return 'xing';
  if (x === y) return 'same';
  return 'plain';
}

export function signRelation(a: number, b: number): SignRelation {
  const ea = signElement(a);
  const eb = signElement(b);
  if (ea === eb) return 'same';
  const comp = (p: Element, q: Element) =>
    (p === '火' && q === '風') ||
    (p === '風' && q === '火') ||
    (p === '土' && q === '水') ||
    (p === '水' && q === '土');
  return comp(ea, eb) ? 'comp' : 'rub';
}

export const ZODIAC_RELATION_NAME: Record<ZodiacRelation, string> = {
  liuhe: '六合',
  sanhe: '三合',
  chong: '六沖',
  hai: '六害',
  xing: '相刑',
  same: '同肖',
  plain: '平和',
};
export const SIGN_RELATION_NAME: Record<SignRelation, string> = {
  same: '同頻',
  comp: '互補',
  rub: '磨合',
};

export type MatchTitle = '天作之合' | '相輔相成' | '慢火細燉' | '好事多磨';

const Z_SCORE: Record<ZodiacRelation, number> = {
  liuhe: 2,
  sanhe: 2,
  same: 1,
  plain: 1,
  xing: 0,
  hai: 0,
  chong: -1,
};
const S_SCORE: Record<SignRelation, number> = { same: 1, comp: 1, rub: 0 };

export function matchTitle(z: ZodiacRelation, s: SignRelation): MatchTitle {
  const n = Z_SCORE[z] + S_SCORE[s];
  return n >= 3 ? '天作之合' : n === 2 ? '相輔相成' : n === 1 ? '慢火細燉' : '好事多磨';
}

export interface MatchPerson {
  zodiac: number;
  sign: number;
}
export interface MatchResult {
  a: MatchPerson;
  b: MatchPerson;
  zodiac: ZodiacRelation;
  sign: SignRelation;
  title: MatchTitle;
}

export function matchOf(a: MatchPerson, b: MatchPerson): MatchResult {
  const zodiac = zodiacRelation(a.zodiac, b.zodiac);
  const sign = signRelation(a.sign, b.sign);
  return { a, b, zodiac, sign, title: matchTitle(zodiac, sign) };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 識別字串中間那段：生肖_星座,生肖_星座（例：01_03,05_11）。 */
export const matchIds = (a: MatchPerson, b: MatchPerson) =>
  `${pad(a.zodiac)}_${pad(a.sign)},${pad(b.zodiac)}_${pad(b.sign)}`;

export function parseMatchIds(ids: string): { a: MatchPerson; b: MatchPerson } | null {
  const m = /^(\d\d)_(\d\d),(\d\d)_(\d\d)$/.exec(ids);
  if (!m) return null;
  const n = m.slice(1).map(Number);
  if (n.some((v) => v < 1 || v > 12)) return null;
  return { a: { zodiac: n[0]!, sign: n[1]! }, b: { zodiac: n[2]!, sign: n[3]! } };
}

/** 免費結果的說明（繁體；簡體由前端轉）。 */
export const ZODIAC_RELATION_TEXT: Record<ZodiacRelation, string> = {
  liuhe: '生肖六合，是老人家最愛說的「合」：一個缺的，另一個剛好有，相處起來不用太費力。',
  sanhe: '生肖三合，像同一路上的夥伴：想法容易對上，一起做事比各自做更順。',
  chong: '生肖六沖，兩個人的步調正好相反：吸引力常常很強，吵起來也快。不是不能在一起，是要學會讓一步。',
  hai: '生肖六害，容易在小事上誤會對方的意思。話說清楚一點，比猜來猜去有用得多。',
  xing: '生肖相刑，兩個人都有自己的堅持，碰在一起會互相較勁。各留一點空間，反而走得遠。',
  same: '同一個生肖，脾氣相像：懂對方，也容易在同一個地方卡住。',
  plain: '生肖之間不沖不合，算是平和。合不合，要看兩個人怎麼經營。',
};
export const SIGN_RELATION_TEXT: Record<SignRelation, string> = {
  same: '星座同屬{e}象，頻率相近，很多事不用解釋就懂。',
  comp: '{e1}象配{e2}象，一個推、一個托，彼此補上對方沒有的那一塊。',
  rub: '{e1}象和{e2}象，處事節奏不太一樣，需要多一點耐心磨合。',
};
export const TITLE_TEXT: Record<MatchTitle, string> = {
  天作之合: '底子很好。要小心的，反而是太順而忘了說謝謝。',
  相輔相成: '各有長處，放在一起比單獨更好。把對方的不同當成幫手，不是麻煩。',
  慢火細燉: '不是一見就合，是越處越對味。急不得，時間站在你們這邊。',
  好事多磨: '摩擦會比別人多一點，但磨出來的感情最結實。關鍵在吵完之後怎麼和好。',
};

export function signRelationText(r: MatchResult): string {
  const e1 = signElement(r.a.sign);
  const e2 = signElement(r.b.sign);
  return SIGN_RELATION_TEXT[r.sign].replace('{e}', e1).replace('{e1}', e1).replace('{e2}', e2);
}

/** 給付費解讀的提示用：把判斷攤開成資料。 */
export function matchFacts(r: MatchResult) {
  const who = (p: MatchPerson) => ({
    zodiac: `${BRANCH[p.zodiac - 1]}${ZODIAC[p.zodiac - 1]}`,
    sign: SIGNS[p.sign - 1],
    element: `${signElement(p.sign)}象`,
  });
  return {
    you: who(r.a),
    partner: who(r.b),
    zodiacRelation: ZODIAC_RELATION_NAME[r.zodiac],
    signRelation: SIGN_RELATION_NAME[r.sign],
    overall: r.title,
  };
}
