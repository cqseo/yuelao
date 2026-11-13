// 牌陣（塔羅館的一次抽牌）的識別字串，付款、生成、讀取都用同一個。
//   tarot:Cups_02,06~,04|<16 位十六進位>   ~ = 逆位
//   lnm:15,19,07|<16 位十六進位>
// 後面的雜湊由前端用「日期＋情況＋問題」算出；問題本身不送進訂單、不存。
// 這裡只驗形狀與牌名合法（三張互不重複），不重新驗證抽牌結果——付錢的是使用者自己的這一組。

export type SpreadDeck = 'tarot' | 'lnm';

const MAJOR = Array.from({ length: 22 }, (_, i) => String(i).padStart(2, '0'));
const MINOR = ['Wands', 'Cups', 'Swords', 'Pentacles'].flatMap((s) =>
  Array.from({ length: 14 }, (_, i) => `${s}_${String(i + 1).padStart(2, '0')}`),
);
export const TAROT_IDS: ReadonlySet<string> = new Set([...MAJOR, ...MINOR]);

export interface ParsedSpread {
  key: string;
  deck: SpreadDeck;
  cards: { id: string; reversed: boolean }[];
}

export function parseSpread(value: unknown): ParsedSpread | null {
  if (typeof value !== 'string' || value.length > 100) return null;
  const m = /^(tarot|lnm):([A-Za-z0-9_~,]{5,80})\|([0-9a-f]{16})$/.exec(value);
  if (!m) return null;
  const deck = m[1] as SpreadDeck;
  const parts = m[2]!.split(',');
  if (parts.length !== 3) return null;
  const cards: ParsedSpread['cards'] = [];
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
