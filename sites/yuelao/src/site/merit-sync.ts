// 功德排行榜的瀏覽器端：裝置鑰匙、法號、還沒送出的下數。
// 敲一下只是 pending +1（存在 localStorage，關掉頁面也不丟），每幾秒送一次；
// 頁面被切走時用 sendBeacon 送最後一批。伺服器只收「多了幾下」，上限在資料庫擋。

const DEVICE_KEY = 'yuelao:merit:device';
const NICK_KEY = 'yuelao:merit:nick';
const PENDING_KEY = 'yuelao:merit:pending';
const NICK_SENT_KEY = 'yuelao:merit:nick-sent';

function get(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

let memDevice = '';
export function deviceKey(): string {
  const saved = get(DEVICE_KEY);
  if (saved && /^[0-9a-f]{64}$/.test(saved)) return saved;
  if (!memDevice) {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    memDevice = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    set(DEVICE_KEY, memDevice);
  }
  return memDevice;
}

/** 預設法號：「無名善信」＋四位數，第一次就固定下來。 */
export function nickname(hans: boolean): string {
  const saved = get(NICK_KEY);
  if (saved) return saved;
  const n = `${hans ? '无名善信' : '無名善信'}${String(Math.floor(1000 + Math.random() * 9000))}`;
  set(NICK_KEY, n);
  return n;
}
export function setNickname(n: string) {
  set(NICK_KEY, n);
  set(NICK_SENT_KEY, '');
}

let memPending = 0;
function pending(): number {
  const v = Number(get(PENDING_KEY) ?? memPending);
  return Number.isInteger(v) && v > 0 ? v : 0;
}
function setPending(n: number) {
  memPending = Math.max(0, n);
  set(PENDING_KEY, String(memPending));
}
export function addPending(n = 1) {
  setPending(pending() + n);
}

function payload(hans: boolean, delta: number) {
  const nick = nickname(hans);
  // 法號改過才帶上（第一次也帶）；平常只送下數，省得每次重寫
  const sendNick = get(NICK_SENT_KEY) !== nick;
  return { body: { device: deviceKey(), delta, nickname: sendNick ? nick : undefined }, nick, sendNick };
}

let inflight: Promise<FlushResult> | null = null;
export type FlushResult = { ok: true; today: number } | { ok: false; error: string };

/** 送出還沒送的下數。沒有可送的也會送 0 下（用來改法號）。 */
export function flush(hans: boolean, force = false): Promise<FlushResult> {
  if (inflight) return inflight;
  const delta = pending();
  const { body, nick, sendNick } = payload(hans, delta);
  if (!delta && !sendNick && !force) return Promise.resolve({ ok: true, today: -1 });
  inflight = (async (): Promise<FlushResult> => {
    try {
      const res = await fetch('/api/merit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        today?: number;
        error?: { code?: string };
      } | null;
      if (!res.ok) {
        const code = data?.error?.code ?? 'error';
        // 法號被退回：換回預設，下數留著下次再送
        if (code === 'bad_nickname') return { ok: false, error: code };
        // 請求本身不合格就丟掉這批，免得一直重送
        if (res.status === 400) setPending(pending() - delta);
        return { ok: false, error: code };
      }
      setPending(pending() - delta);
      if (sendNick) set(NICK_SENT_KEY, nick);
      return { ok: true, today: data?.today ?? 0 };
    } catch {
      return { ok: false, error: 'network' };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 頁面被切走、關掉時：用 sendBeacon 把剩下的送出去（送出去就算了，不等回應）。 */
export function beacon(hans: boolean) {
  const delta = pending();
  if (!delta || inflight || !navigator.sendBeacon) return;
  const { body, nick, sendNick } = payload(hans, delta);
  const ok = navigator.sendBeacon('/api/merit', new Blob([JSON.stringify(body)], { type: 'text/plain' }));
  if (ok) {
    setPending(0);
    if (sendNick) set(NICK_SENT_KEY, nick);
  }
}

export type BoardRange = 'day' | 'week' | 'all';
export type Board = {
  range: BoardRange;
  players: number;
  top: { rank: number; nickname: string; total: number; me: boolean }[];
  me: { rank: number; total: number } | null;
};

export async function fetchBoard(range: BoardRange): Promise<Board | null> {
  try {
    const res = await fetch(`/api/merit?range=${range}`, { headers: { 'x-merit-device': deviceKey() } });
    if (!res.ok) return null;
    return (await res.json()) as Board;
  } catch {
    return null;
  }
}
