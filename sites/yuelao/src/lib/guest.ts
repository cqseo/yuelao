import { track } from './track';

// 訪客帳號（站長 2026-11-18：沒登入也能付款）。伺服器邏輯在 packages/core/src/guest-auth.ts。
//
// 結帳時伺服器回 401（沒有任何登入），就先請伺服器建一個訪客帳號，再重試一次結帳。
// 伺服器沒開訪客（GUEST_AUTH_ENABLED 不是 "true"）或建不了，就照舊回 401，畫面照舊請他登入。

/** 這台瀏覽器目前是訪客嗎（伺服器設的 yl_guest 記號；不是憑證，只決定要不要顯示「綁定信箱」）。 */
export function isGuest(): boolean {
  if (typeof document === 'undefined') return false;
  return /(?:^|;\s*)yl_guest=1(?:;|$)/.test(document.cookie);
}

let enabledOnce: Promise<boolean> | null = null;
/** 伺服器有沒有開訪客結帳（開了就不必寫「需先登入」）。每頁只問一次。 */
export function guestCheckoutOn(): Promise<boolean> {
  enabledOnce ??= fetch('/api/auth/guest', { credentials: 'same-origin' })
    .then(async (r) => (r.ok ? ((await r.json()) as { enabled?: boolean }).enabled === true : false))
    .catch(() => false);
  return enabledOnce;
}

/** 請伺服器建訪客帳號（已有登入就不建）。成功表示現在有可用的 session。 */
export async function becomeGuest(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { created?: boolean };
    if (data.created) track('guest_created');
    return true;
  } catch {
    return false;
  }
}

/** 結帳用：第一次回 401 就變成訪客、再試一次。其他狀態原樣回傳。 */
export async function withGuest(go: () => Promise<Response>): Promise<Response> {
  const res = await go();
  if (res.status !== 401) return res;
  return (await becomeGuest()) ? go() : res;
}
