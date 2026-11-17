/** Persistent return marker for fast, non-WebGL tarot checkout.
 * Keep the personal question in sessionStorage; never include it in URLs or analytics.
 */
export type LiteTarotDeck = 'tarot' | 'lnm';
export type LiteTarotPending = {
  liteTarot: true;
  deck: LiteTarotDeck;
  question: string;
  sit: string;
  day: string;
  why: 'login' | 'pay';
  at: number;
};
const KEY = 'market-lite-tarot-pending';
const MAX_AGE_MS = 45 * 60_000;

function valid(x: unknown, now: number): x is LiteTarotPending {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  return p.liteTarot === true &&
    (p.deck === 'tarot' || p.deck === 'lnm') &&
    typeof p.question === 'string' && p.question.length > 0 && p.question.length <= 100 &&
    typeof p.sit === 'string' && ['single', 'crush', 'dating', 'reunion', 'married'].includes(p.sit) &&
    typeof p.day === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(p.day) &&
    (p.why === 'login' || p.why === 'pay') &&
    typeof p.at === 'number' && p.at <= now + 60_000 && now - p.at <= MAX_AGE_MS;
}

export function hasLiteTarotPending(now = Date.now()) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    return !!raw && valid(JSON.parse(raw) as unknown, now);
  } catch {
    return false;
  }
}

export function takeLiteTarotPending(now = Date.now()): LiteTarotPending | null {
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

export function saveLiteTarotPending(p: Omit<LiteTarotPending, 'liteTarot' | 'at'>): boolean {
  if (typeof window === 'undefined') return false;
  const value: LiteTarotPending = { ...p, liteTarot: true, at: Date.now() };
  if (!valid(value, Date.now())) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
