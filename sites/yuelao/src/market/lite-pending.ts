/** Shares the 3D market's existing return marker so login + Stripe return to
 * the lightweight experience on the SAME /market URL, not the retired /ritual.
 * A user's free-text question is stored only in sessionStorage, never in URLs.
 */
export type OracleCategory = 'him' | 'single' | 'reunion';
export type LitePending = {
  lite: true;
  stickId: number;
  category: OracleCategory;
  question: string;
  why: 'login' | 'pay';
  /** 買的方案：次數包付完回來要先用一次解鎖這支籤。舊資料沒有這欄，當作單次。 */
  plan?: string;
  /** 五種處境之一（快速版改版後才有；舊資料只有 category）。 */
  sit?: string;
  at: number;
};

const KEY = 'market-pending';
const MAX_AGE_MS = 45 * 60_000;

function valid(raw: unknown, now: number): raw is LitePending {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const x = raw as Record<string, unknown>;
  return x.lite === true &&
    Number.isInteger(x.stickId) &&
    typeof x.stickId === 'number' && x.stickId >= 1 && x.stickId <= 100 &&
    (x.category === 'him' || x.category === 'single' || x.category === 'reunion') &&
    (x.why === 'pay' || x.why === 'login') &&
    typeof x.question === 'string' && x.question.length <= 400 &&
    (x.plan === undefined || (typeof x.plan === 'string' && /^(unlock_1|pack_\d+)$/.test(x.plan))) &&
    (x.sit === undefined || (typeof x.sit === 'string' && /^(single|crush|dating|reunion|married)$/.test(x.sit))) &&
    typeof x.at === 'number' &&
    x.at <= now + 60_000 && now - x.at <= MAX_AGE_MS;
}

export function hasLitePending(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const data = sessionStorage.getItem(KEY);
    if (!data) return false;
    const value: unknown = JSON.parse(data);
    return valid(value, now);
  } catch {
    return false;
  }
}

export function takeLitePending(now = Date.now()): LitePending | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = sessionStorage.getItem(KEY);
    if (!data) return null;
    sessionStorage.removeItem(KEY);
    const value: unknown = JSON.parse(data);
    return valid(value, now) ? value : null;
  } catch {
    return null;
  }
}

export function saveLitePending(
  stickId: number,
  category: OracleCategory,
  question: string,
  why: LitePending['why'],
  plan = 'unlock_1',
  sit?: string,
): boolean {
  if (typeof window === 'undefined') return false;
  if (!Number.isInteger(stickId) || stickId < 1 || stickId > 100) return false;
  try {
    const item: LitePending = {
      lite: true,
      stickId,
      category,
      question: question.slice(0, 400),
      why,
      plan,
      ...(sit ? { sit } : {}),
      at: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(item));
    return true;
  } catch {
    return false;
  }
}
