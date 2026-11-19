/** 輕量財神殿去付款／登入前的記號。問題只放 sessionStorage，不進網址、不進統計。 */
export type LiteCaiPending = {
  liteCai: true;
  no: number;
  topic: 'career' | 'wealth';
  question: string;
  day: string;
  why: 'login' | 'pay';
  at: number;
};
const KEY = 'market-lite-cai-pending';
const MAX_AGE_MS = 45 * 60_000;

function valid(x: unknown, now: number): x is LiteCaiPending {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  return (
    p.liteCai === true &&
    typeof p.no === 'number' &&
    Number.isInteger(p.no) &&
    p.no >= 1 &&
    p.no <= 36 &&
    (p.topic === 'career' || p.topic === 'wealth') &&
    typeof p.question === 'string' &&
    p.question.length <= 100 &&
    typeof p.day === 'string' &&
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(p.day) &&
    (p.why === 'login' || p.why === 'pay') &&
    typeof p.at === 'number' &&
    p.at <= now + 60_000 &&
    now - p.at <= MAX_AGE_MS
  );
}

export function hasLiteCaiPending(now = Date.now()) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    return !!raw && valid(JSON.parse(raw) as unknown, now);
  } catch {
    return false;
  }
}

export function takeLiteCaiPending(now = Date.now()): LiteCaiPending | null {
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

export function saveLiteCaiPending(p: Omit<LiteCaiPending, 'liteCai' | 'at'>): boolean {
  if (typeof window === 'undefined') return false;
  const value: LiteCaiPending = { ...p, liteCai: true, at: Date.now() };
  if (!valid(value, Date.now())) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
