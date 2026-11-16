// 第一方行為紀錄：事件先排隊，攢一小批（或頁面要離開時）送到 /api/track，寫進自己的資料庫，給 /admin 後台看。
// 本模組仍為第一方統計；第三方 Google Tag Manager 由站點根文件載入。訪客 id（vid）存在 localStorage，一次造訪的 id（sid）30 分鐘沒動作就換新。
// 若之後開了 Rybbit，事件也會照舊轉給它。

type Props = Record<string, string | number | boolean>;
type Rybbit = { event(name: string, props?: Props): void; identify?(userId: string): void };
type Pending = { name: string; path: string; props?: Props; at: number };

const VID_KEY = 'yl-vid';
const SID_KEY = 'yl-sid';
const SESSION_IDLE_MS = 30 * 60_000;
const FLUSH_MS = 4000;
const MAX_BATCH = 20;

const queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let memoryVid = '';
let memorySid = { id: '', last: 0 };
let listening = false;

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function visitorId(): string {
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,40}$/.test(id)) {
      id = randomId();
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    memoryVid ||= randomId();
    return memoryVid;
  }
}

function sessionId(now: number): string {
  try {
    const raw = localStorage.getItem(SID_KEY);
    const saved = raw ? (JSON.parse(raw) as { id: string; last: number }) : null;
    const id = saved && now - saved.last < SESSION_IDLE_MS ? saved.id : randomId();
    localStorage.setItem(SID_KEY, JSON.stringify({ id, last: now }));
    return id;
  } catch {
    if (!memorySid.id || now - memorySid.last >= SESSION_IDLE_MS) memorySid = { id: randomId(), last: now };
    memorySid.last = now;
    return memorySid.id;
  }
}

function send(useBeacon: boolean) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({
    vid: visitorId(),
    sid: sessionId(Date.now()),
    referrer: document.referrer || null,
    locale: document.documentElement.lang || null,
    events,
  });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain' }));
    } else {
      void fetch('/api/track', {
        method: 'POST',
        body,
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'content-type': 'text/plain' },
      }).catch(() => {});
    }
  } catch {}
  if (queue.length) send(useBeacon);
}

function listen() {
  if (listening) return;
  listening = true;
  addEventListener('pagehide', () => send(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send(true);
  });
}

// 同一種事件 10 秒內只記一次（例如集市裡點地走路），免得把資料庫灌爆；關鍵事件不限。
const THROTTLE_MS = 10_000;
const UNTHROTTLED = new Set([
  'page_view',
  'login',
  'checkout_start',
  'market_room_open',
  'reading_done',
  'unlock_click',
  'deep_read',
]);
const lastSent = new Map<string, number>();

function enqueue(name: string, props?: Props) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!UNTHROTTLED.has(name)) {
    if (now - (lastSent.get(name) ?? 0) < THROTTLE_MS) return;
    lastSent.set(name, now);
  }
  // 本機開發不記
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  listen();
  queue.push({ name, path: location.pathname, props, at: now });
  if (queue.length >= MAX_BATCH) send(false);
  else timer ??= setTimeout(() => send(false), FLUSH_MS);
}

function rybbit(): Rybbit | undefined {
  return (window as { rybbit?: Rybbit }).rybbit;
}

export function track(name: string, props?: Props) {
  if (typeof window === 'undefined') return;
  enqueue(name, props);
  rybbit()?.event(name, props);
}

let lastPage = '';
/** Called on every client-side navigation (see __root.tsx). Same path twice in a row is ignored. */
export function trackPageView() {
  if (typeof window === 'undefined' || location.pathname === lastPage) return;
  lastPage = location.pathname;
  enqueue('page_view');
}

let identified: string | null = null;

/** After sign-in: the next batches carry the session cookie, so the server links them to the account. */
export function identify(userId: string) {
  if (typeof window === 'undefined' || identified === userId) return;
  identified = userId;
  rybbit()?.identify?.(userId);
}
