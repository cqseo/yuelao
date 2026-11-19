/** 輕量算命攤去付款／登入前的記號。生日與問題只放 sessionStorage，不進網址、不進統計。 */
export type LiteFortunePending = {
  liteFortune: true;
  mode: 'match' | 'love' | 'bazi';
  hour: number | null;
  gender: 'f' | 'm' | 'n';
  you: string;
  them: string;
  question: string;
  sit: string;
  day: string;
  why: 'login' | 'pay';
  at: number;
};
const KEY = 'market-lite-fortune-pending';
const MAX_AGE_MS = 45 * 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function valid(x: unknown, now: number): x is LiteFortunePending {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  return (
    p.liteFortune === true &&
    typeof p.you === 'string' &&
    DATE.test(p.you) &&
    (p.mode === 'match' || p.mode === 'love' || p.mode === 'bazi') &&
    typeof p.them === 'string' &&
    (p.mode === 'match' ? DATE.test(p.them) : p.them === '') &&
    (p.hour === null ||
      (typeof p.hour === 'number' && Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 11)) &&
    (p.gender === 'f' || p.gender === 'm' || p.gender === 'n') &&
    typeof p.question === 'string' &&
    p.question.length <= 100 &&
    typeof p.sit === 'string' &&
    ['single', 'crush', 'dating', 'reunion', 'married'].includes(p.sit) &&
    typeof p.day === 'string' &&
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(p.day) &&
    (p.why === 'login' || p.why === 'pay') &&
    typeof p.at === 'number' &&
    p.at <= now + 60_000 &&
    now - p.at <= MAX_AGE_MS
  );
}

export function hasLiteFortunePending(now = Date.now()) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    return !!raw && valid(JSON.parse(raw) as unknown, now);
  } catch {
    return false;
  }
}

export function takeLiteFortunePending(now = Date.now()): LiteFortunePending | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return valid(value, now) ? value : null;
  } catch {
    return null;
  }
}

export function saveLiteFortunePending(p: Omit<LiteFortunePending, 'liteFortune' | 'at'>): boolean {
  if (typeof window === 'undefined') return false;
  const value: LiteFortunePending = { ...p, liteFortune: true, at: Date.now() };
  if (!valid(value, Date.now())) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
