// 牌陣（塔羅館的一次抽牌）的識別字串，付款、生成、讀取都用同一個。
//   tarot:Cups_02,06~,04|<16 位十六進位>   ~ = 逆位
//   lnm:15,19,07|<16 位十六進位>
//   match:01_03,05_11|<16 位十六進位>   算命攤．合緣配對：你的生肖_星座,對方的生肖_星座（見 match.ts）
//   love:11_11_2026|<16 位十六進位>      算命攤．個人姻緣盤：生肖_星座_流年（見 love.ts）
//   bazi:6g,9h,2a,xx_2026_f|<16 位十六進位>  算命攤．八字命盤：四柱_流年_性別（見 bazi.ts）
//   cai:007_w|<16 位十六進位>               財神殿．求財籤：籤號（三位數）_主題（c 事業、w 財運）
// 後面的雜湊由前端用「日期＋情況＋問題」算出；問題本身不送進訂單、不存。
// 這裡只驗形狀與牌名合法（三張互不重複），不重新驗證抽牌結果——付錢的是使用者自己的這一組。

import { type BaziInput, parseBaziIds } from './bazi';
import { parseLoveIds } from './love';
import { type MatchPerson, parseMatchIds } from './match';

export type SpreadDeck = 'tarot' | 'lnm';
/** 識別字串的前綴；付費解讀都走同一套表（spread_unlocks／spread_ai_readings）。 */
export type SpreadKind = SpreadDeck | 'match' | 'love' | 'bazi' | 'cai';

const MAJOR = Array.from({ length: 22 }, (_, i) => String(i).padStart(2, '0'));
const MINOR = ['Wands', 'Cups', 'Swords', 'Pentacles'].flatMap((s) =>
  Array.from({ length: 14 }, (_, i) => `${s}_${String(i + 1).padStart(2, '0')}`),
);
export const TAROT_IDS: ReadonlySet<string> = new Set([...MAJOR, ...MINOR]);

export interface CardSpread {
  key: string;
  deck: SpreadDeck;
  cards: { id: string; reversed: boolean }[];
}
export interface MatchSpread {
  key: string;
  deck: 'match';
  a: MatchPerson;
  b: MatchPerson;
}
export interface LoveSpread {
  key: string;
  deck: 'love';
  zodiac: number;
  sign: number;
  year: number;
}
export interface BaziSpread extends BaziInput {
  key: string;
  deck: 'bazi';
}
export interface CaiSpread {
  key: string;
  deck: 'cai';
  /** 籤號 1–36（籤文在站點：sites/yuelao/src/ritual/caishen.ts）。 */
  no: number;
  topic: 'career' | 'wealth';
}
export type ParsedSpread = CardSpread | MatchSpread | LoveSpread | BaziSpread | CaiSpread;
export const CAI_STICK_COUNT = 36;

export function parseSpread(value: unknown): ParsedSpread | null {
  if (typeof value !== 'string' || value.length > 100) return null;
  const m = /^(tarot|lnm|match|love|bazi|cai):([A-Za-z0-9_~,]{5,80})\|([0-9a-f]{16})$/.exec(value);
  if (!m) return null;
  if (m[1] === 'match') {
    const pair = parseMatchIds(m[2]!);
    return pair ? { key: value, deck: 'match', ...pair } : null;
  }
  if (m[1] === 'cai') {
    const c = /^(\d{3})_([cw])$/.exec(m[2]!);
    const no = c ? Number(c[1]) : 0;
    if (!c || no < 1 || no > CAI_STICK_COUNT) return null;
    return { key: value, deck: 'cai', no, topic: c[2] === 'c' ? 'career' : 'wealth' };
  }
  if (m[1] === 'bazi') {
    const b = parseBaziIds(m[2]!);
    return b ? { key: value, deck: 'bazi', ...b } : null;
  }
  if (m[1] === 'love') {
    const me = parseLoveIds(m[2]!);
    return me ? { key: value, deck: 'love', ...me } : null;
  }
  const deck = m[1] as SpreadDeck;
  const parts = m[2]!.split(',');
  if (parts.length !== 3) return null;
  const cards: CardSpread['cards'] = [];
  for (const p of parts) {
    const reversed = p.endsWith('~');
    const id = reversed ? p.slice(0, -1) : p;
    if (deck === 'tarot') {
      if (!TAROT_IDS.has(id)) return null;
    } else {
      if (reversed || !/^(0[1-9]|[12]\d|3[0-6])$/.test(id)) return null;
    }
    cards.push({ id, reversed });
  }
  if (new Set(cards.map((c) => c.id)).size !== 3) return null;
  return { key: value, deck, cards };
}

// 牌名（繁體），給解讀的提示用；和站點的牌義檔（sites/yuelao/src/ritual/tarot.ts、lenormand.ts）同名。
const MAJOR_NAMES = [
  '愚者',
  '魔術師',
  '女祭司',
  '皇后',
  '皇帝',
  '教皇',
  '戀人',
  '戰車',
  '力量',
  '隱者',
  '命運之輪',
  '正義',
  '倒吊人',
  '死神',
  '節制',
  '惡魔',
  '高塔',
  '星星',
  '月亮',
  '太陽',
  '審判',
  '世界',
];
const SUIT_NAMES: Record<string, string> = { Wands: '權杖', Cups: '聖杯', Swords: '寶劍', Pentacles: '錢幣' };
const RANK_NAMES = [
  '王牌',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '侍從',
  '騎士',
  '王后',
  '國王',
];
const LNM_NAMES = [
  '騎士',
  '幸運草',
  '船',
  '房屋',
  '樹',
  '雲',
  '蛇',
  '棺材',
  '花束',
  '鐮刀',
  '鞭子',
  '鳥',
  '孩子',
  '狐狸',
  '熊',
  '星星',
  '鸛鳥',
  '狗',
  '塔',
  '花園',
  '山',
  '岔路',
  '老鼠',
  '心',
  '戒指',
  '書',
  '信',
  '男人',
  '女人',
  '百合',
  '太陽',
  '月亮',
  '鑰匙',
  '魚',
  '錨',
  '十字',
];

export function cardName(deck: SpreadDeck, id: string): string {
  if (deck === 'lnm') return `${Number(id)} ${LNM_NAMES[Number(id) - 1]}`;
  if (/^\d\d$/.test(id)) return MAJOR_NAMES[Number(id)]!;
  const [suit, rank] = id.split('_');
  return `${SUIT_NAMES[suit!]}${RANK_NAMES[Number(rank) - 1]}`;
}

export const SPREAD_POSITIONS: Record<SpreadDeck, readonly [string, string, string]> = {
  tarot: ['過去', '現在', '未來'],
  lnm: ['起因', '過程', '走向'],
};

/** 這把識別字串該用哪一種商品買：塔羅館、算命攤各玩法；八字的年運另外算（bazi-year）。 */
export function spreadProductKind(
  key: string,
): 'tarot' | 'lnm' | 'match' | 'love' | 'bazi' | 'bazi-year' | 'cai' | null {
  const p = parseSpread(key);
  if (!p) return null;
  if (p.deck === 'bazi' && p.topic === 'year') return 'bazi-year';
  return p.deck;
}
