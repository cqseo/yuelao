export type DailyFocus = 'connection' | 'communication' | 'self' | 'courage';
export type DailyLocale = 'zh-Hant' | 'zh-Hans';
export type DailyRecord = { lastDate: string; streak: number; checkedDates: string[] };

type Bilingual = { 'zh-Hant': string; 'zh-Hans': string };
const make = (hant: string, hans: string): Bilingual => ({ 'zh-Hant': hant, 'zh-Hans': hans });

export const DAILY_FOCI: Record<DailyFocus, { label: Bilingual; description: Bilingual }> = {
  connection: {
    label: make('緣分', '缘分'),
    description: make('把心留給值得的人', '把心留给值得的人'),
  },
  communication: {
    label: make('溝通', '沟通'),
    description: make('好好說出你的心意', '好好说出你的心意'),
  },
  self: {
    label: make('心境', '心境'),
    description: make('向內照顧自己', '向内照顾自己'),
  },
  courage: {
    label: make('行動', '行动'),
    description: make('給自己一個開始', '给自己一个开始'),
  },
};

const messages: Array<{ name: Bilingual; verse: Bilingual; insight: Bilingual; action: Bilingual }> = [
  {
    name: make('靜待花開', '静待花开'),
    verse: make('花有花期，心有自己的步調。', '花有花期，心有自己的步调。'),
    insight: make(
      '今天不必把所有事情想明白。比起猜測別人的答案，先問自己真正需要什麼。',
      '今天不必把所有事情想明白。比起猜测别人的答案，先问自己真正需要什么。',
    ),
    action: make('留十分鐘給自己，寫下一件可以放慢的事。', '留十分钟给自己，写下一件可以放慢的事。'),
  },
  {
    name: make('微光可循', '微光可循'),
    verse: make('最溫柔的方向，常藏在小小一步裡。', '最温柔的方向，常藏在小小一步里。'),
    insight: make(
      '關係不必靠猜心維持。一句清楚而不施壓的表達，可能比無數次揣測更有力量。',
      '关系不必靠猜心维持。一句清楚而不施压的表达，可能比无数次揣测更有力量。',
    ),
    action: make('試著把「你總是」換成「我感覺」。', '试着把“你总是”换成“我感觉”。'),
  },
  {
    name: make('有度有光', '有度有光'),
    verse: make('靠近是心意，留白也是尊重。', '靠近是心意，留白也是尊重。'),
    insight: make(
      '好的連結容得下各自的生活。今天把一些力氣留給自己，也是一種珍惜。',
      '好的连接容得下各自的生活。今天把一些力气留给自己，也是一种珍惜。',
    ),
    action: make('做一件不為任何人、只為自己開心的事。', '做一件不为任何人、只为自己开心的事。'),
  },
  {
    name: make('如實相見', '如实相见'),
    verse: make('真心不必完美，只要不違背自己。', '真心不必完美，只要不违背自己。'),
    insight: make(
      '比起急著下結論，先看看你們實際的互動：是否尊重、是否願意傾聽、是否說到做到。',
      '比起急着下结论，先看看你们实际的互动：是否尊重、是否愿意倾听、是否说到做到。',
    ),
    action: make('記下一件今天真實發生、而不是想像中的事。', '记下一件今天真实发生、而不是想象中的事。'),
  },
  {
    name: make('心安即歸', '心安即归'),
    verse: make('走得再遠，也別忘了回到自己。', '走得再远，也别忘了回到自己。'),
    insight: make(
      '被喜歡是很好的事，但你的價值不由某個人的回覆速度決定。',
      '被喜欢是很好的事，但你的价值不由某个人的回复速度决定。',
    ),
    action: make('暫時放下手機，去感受身邊一件平凡的小事。', '暂时放下手机，去感受身边一件平凡的小事。'),
  },
  {
    name: make('慢慢靠近', '慢慢靠近'),
    verse: make('一線緣起，從相互願意開始。', '一线缘起，从相互愿意开始。'),
    insight: make(
      '想靠近一個人時，也值得留意對方是否同樣願意。互相尊重，比獨自用力更重要。',
      '想靠近一个人时，也值得留意对方是否同样愿意。互相尊重，比独自用力更重要。',
    ),
    action: make('用一個不要求立即回答的問題開啟交流。', '用一个不要求立即回答的问题开启交流。'),
  },
  {
    name: make('不負此刻', '不负此刻'),
    verse: make('明日尚遠，此刻可以先好好過。', '明日尚远，此刻可以先好好过。'),
    insight: make(
      '你不需要今天決定一段關係的全部未來。能看清當下的一件事，就已是進步。',
      '你不需要今天决定一段关系的全部未来。能看清当下的一件事，就已是进步。',
    ),
    action: make('為今天選一件最小、最可行的行動。', '为今天选一件最小、最可行的行动。'),
  },
  {
    name: make('心有分寸', '心有分寸'),
    verse: make('牽掛可以柔軟，界線也可以清楚。', '牵挂可以柔软，界限也可以清楚。'),
    insight: make(
      '不必為了留住一段關係而忽略自己的感受。說出界線，不等於不夠愛。',
      '不必为了留住一段关系而忽略自己的感受。说出界限，不等于不够爱。',
    ),
    action: make(
      '想一想：今天有哪一件事，你可以溫和地說「不」？',
      '想一想：今天有哪一件事，你可以温和地说“不”？',
    ),
  },
];

function safeDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y = 0, m = 0, d = 0] = key.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayNumber(key: string): number {
  const [y = 0, m = 0, d = 0] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export const emptyDailyRecord = (): DailyRecord => ({
  lastDate: '',
  streak: 0,
  checkedDates: [],
});

export function sanitizeDailyRecord(input: unknown): DailyRecord {
  if (!input || typeof input !== 'object') return emptyDailyRecord();
  const data = input as Partial<DailyRecord>;
  if (typeof data.lastDate !== 'string' || !safeDateKey(data.lastDate)) return emptyDailyRecord();
  if (!Number.isInteger(data.streak) || (data.streak ?? 0) < 0) return emptyDailyRecord();
  const checkedDates = Array.isArray(data.checkedDates)
    ? [
        ...new Set(
          data.checkedDates.filter((day): day is string => typeof day === 'string' && safeDateKey(day)),
        ),
      ].slice(-45)
    : [];
  return {
    lastDate: data.lastDate,
    streak: Math.min(data.streak ?? 0, 3650),
    checkedDates,
  };
}

export function checkedInToday(record: DailyRecord, today: string): boolean {
  return record.lastDate === today;
}

export function checkIn(record: DailyRecord, today: string): DailyRecord {
  if (!safeDateKey(today) || (record.lastDate && dayNumber(today) < dayNumber(record.lastDate))) {
    return record;
  }
  if (checkedInToday(record, today)) return record;
  const nextStreak =
    record.lastDate && dayNumber(today) - dayNumber(record.lastDate) === 1 ? record.streak + 1 : 1;
  return {
    lastDate: today,
    streak: Math.min(nextStreak, 3650),
    checkedDates: [...record.checkedDates, today].slice(-45),
  };
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyReading(day: string, focus: DailyFocus, locale: DailyLocale) {
  const card = messages[hash(`${day}:${focus}`) % messages.length]!;
  const pick = (value: Bilingual) => value[locale];
  return {
    name: pick(card.name),
    verse: pick(card.verse),
    insight: pick(card.insight),
    action: pick(card.action),
    focus: pick(DAILY_FOCI[focus].label),
  };
}

/**
 * 登入的人把簽到同步到帳號（DESIGN.md「每日簽到同步到帳號」）：check = true 時簽今天，
 * 並把瀏覽器裡近 30 天的紀錄一起補登。沒登入、伺服器不可用或網路錯誤都回 null，
 * 呼叫端照舊只用瀏覽器紀錄。
 */
export async function syncDailyRecord(
  local: DailyRecord,
  today: string,
  check: boolean,
): Promise<DailyRecord | null> {
  if (!safeDateKey(today)) return null;
  const t = dayNumber(today);
  const backfill = local.checkedDates.filter(
    (d) => safeDateKey(d) && dayNumber(d) <= t && t - dayNumber(d) < 30,
  );
  const post = () =>
    fetch('/api/account/daily', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ today, check, backfill: backfill.slice(-30) }),
    });
  try {
    let res = await post();
    if (res.status === 401) {
      // 登入狀態可能只是過期：換一次再試；真的沒登入就算了
      const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (!refreshed.ok) return null;
      res = await post();
    }
    if (!res.ok) return null;
    const d = (await res.json()) as { streak?: unknown; lastDate?: unknown; checkedDates?: unknown };
    if (typeof d.lastDate !== 'string' || !d.lastDate) return null;
    return sanitizeDailyRecord(d);
  } catch {
    return null;
  }
}
