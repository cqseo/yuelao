// 功德台（/merit，2026-11-21）：敲木魚、撥念珠、擲筊問事、今日籤桌布。全部免費、不用 AI、不用登入。
// 功德數只記在這台瀏覽器（localStorage），不上傳；這裡只放純函式，畫面在 routes/merit.tsx。

export const MERIT_KEY = 'yuelao:merit:v1';

export interface MeritRecord {
  /** 累計功德（木魚一下、念珠一顆各算 1）。 */
  total: number;
  /** today 是哪一天（當地日期 YYYY-MM-DD）。 */
  day: string;
  today: number;
  /** 念珠：這一圈撥到第幾顆（0–107）、撥完幾圈。 */
  bead: number;
  rounds: number;
}

export const BEADS_PER_ROUND = 108;

export const emptyMerit = (): MeritRecord => ({ total: 0, day: '', today: 0, bead: 0, rounds: 0 });

const nat = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0;

/** 讀回來的資料一律當不可信：格式不對的欄位歸零。 */
export function sanitizeMerit(v: unknown): MeritRecord {
  if (!v || typeof v !== 'object') return emptyMerit();
  const o = v as Record<string, unknown>;
  return {
    total: nat(o.total, 1e9),
    day: typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : '',
    today: nat(o.today, 1e9),
    bead: nat(o.bead, BEADS_PER_ROUND - 1),
    rounds: nat(o.rounds, 1e9),
  };
}

/** 加 n 點功德；換了一天，今日數從 0 算起。 */
export function addMerit(r: MeritRecord, n: number, day: string): MeritRecord {
  const today = (r.day === day ? r.today : 0) + n;
  return { ...r, total: r.total + n, day, today };
}

/** 撥一顆念珠：也算一點功德。滿 108 顆算一圈，回傳 round=true 讓畫面敲一聲磬。 */
export function nextBead(r: MeritRecord, day: string): { rec: MeritRecord; round: boolean } {
  const next = addMerit(r, 1, day);
  const bead = r.bead + 1;
  if (bead >= BEADS_PER_ROUND) return { rec: { ...next, bead: 0, rounds: r.rounds + 1 }, round: true };
  return { rec: { ...next, bead }, round: false };
}

/** 今日數（日期不是今天就是 0）。 */
export const todayCount = (r: MeritRecord, day: string) => (r.day === day ? r.today : 0);

export const CHANTS = [
  { id: 'amitabha', text: '南無阿彌陀佛', hans: '南无阿弥陀佛' },
  { id: 'guanyin', text: '南無觀世音菩薩', hans: '南无观世音菩萨' },
  { id: 'yuelao', text: '月老保佑', hans: '月老保佑' },
  { id: 'calm', text: '心安', hans: '心安' },
] as const;

// ---------- 擲筊 ----------
/** 一片筊杯落地：flat 平面朝上、round 凸面朝上。 */
export type JiaoFace = 'flat' | 'round';
export type JiaoResult = 'sheng' | 'xiao' | 'yin';

/**
 * 和月老殿的擲筊同一套（ritual/physics.ts、DESIGN.md 儀式鐵律）：
 * 聖筊一平一凸（50%）、笑筊兩凸（30%）、陰筊兩平（20%）；兩片左右順序隨機。
 */
export function tossJiao(rand: () => number = Math.random): {
  faces: [JiaoFace, JiaoFace];
  result: JiaoResult;
} {
  const r = rand();
  const result: JiaoResult = r < 0.5 ? 'sheng' : r < 0.8 ? 'xiao' : 'yin';
  let faces: [JiaoFace, JiaoFace] =
    result === 'sheng' ? ['flat', 'round'] : result === 'xiao' ? ['round', 'round'] : ['flat', 'flat'];
  if (rand() < 0.5) faces = [faces[1], faces[0]];
  return { faces, result };
}

/** 結果的說法（民俗解說，對照 /jiaobei 頁；不說神明真的同意）。 */
export const JIAO_TEXT: Record<JiaoResult, { name: string; hans: string; line: string; lineHans: string }> = {
  sheng: {
    name: '聖筊',
    hans: '圣筊',
    line: '一平一凸。民間說法是「可以」，這件事月老點頭了。想看得更清楚，帶著這個問題去求一支籤。',
    lineHans: '一平一凸。民间说法是「可以」，这件事月老点头了。想看得更清楚，带着这个问题去求一支签。',
  },
  xiao: {
    name: '笑筊',
    hans: '笑筊',
    line: '兩面都是凸的。傳統上說是問題還沒問清楚，或時候未到。換個更具體的問法，再擲一次。',
    lineHans: '两面都是凸的。传统上说是问题还没问清楚，或时候未到。换个更具体的问法，再掷一次。',
  },
  yin: {
    name: '陰筊',
    hans: '阴筊',
    line: '兩面都是平的。一般解作「不行」或「暫時不宜」。先別硬來，想想還有沒有別的路。',
    lineHans: '两面都是平的。一般解作「不行」或「暂时不宜」。先别硬来，想想还有没有别的路。',
  },
};

/** 連續聖筊：聖筊就加一，其他歸零。民間常說連三聖筊最確定。 */
export const shengStreak = (prev: number, r: JiaoResult) => (r === 'sheng' ? prev + 1 : 0);

// ---------- 桌布 ----------
export const WALLPAPERS = [
  {
    id: 'love',
    name: '招桃花',
    hans: '招桃花',
    glyph: '緣',
    glyphHans: '缘',
    color: '#e06a7a',
    wish: '願得一心人',
    wishHans: '愿得一心人',
  },
  {
    id: 'wealth',
    name: '招財',
    hans: '招财',
    glyph: '財',
    glyphHans: '财',
    color: '#e8c25a',
    wish: '財源廣進',
    wishHans: '财源广进',
  },
  {
    id: 'peace',
    name: '保平安',
    hans: '保平安',
    glyph: '安',
    glyphHans: '安',
    color: '#8fc4a8',
    wish: '出入平安',
    wishHans: '出入平安',
  },
] as const;
export type WallpaperId = (typeof WALLPAPERS)[number]['id'];
