// 廣場同遊的訊息規則（純函式，不依賴 Workers 執行環境，測試可以直接載入）。
// 說明見 plaza-room.ts。

export const PLAZA_CAP = 40;
// 廣場半徑 26.5，加上殿前（z 到 -26）與山門外（z 到 46）
const BOUND = { x: 28, zMin: -26, zMax: 46 };
export const PLAZA_ACTIONS = new Set(['wave', 'bow', 'pray', 'heart', 'incense', 'feed']);
export const PLAZA_HOLDS = new Set(['', 'sit', 'kneel', 'away']);
const MOVE_GAP_MS = 80;
const ACT_GAP_MS = 400;
const Q_GAP_MS = 200; // 排隊另外限速，免得和動作、姿勢搶同一個額度
const MAX_BYTES = 256;

export interface PlazaPeer {
  id: string;
  x: number;
  z: number;
  f: number;
  s: string;
  outfit: string;
  hair: string;
  mAt: number; // 上一次走位的時間
  aAt: number; // 上一次動作／換姿勢的時間
  q?: string; // 正在排哪個設施（'' 或沒有＝沒排）
  qAt?: number; // 開始排的時間：先來先用
  use?: string; // 正在用哪個設施
  useAt?: number;
  qmAt?: number; // 上一條排隊訊息的時間
}

// ---------- 廣場設施排隊（參考心安宮） ----------
// 只有廣場上的實體設施要排：殿前銅爐一次一人上香、爐前兩個蒲團一次兩人跪拜。
// 鋪子（月老殿、塔羅館…）不排隊——裡面連著付費解讀，不讓人在門口等。
// 誰在用、誰在排都記在各自連線的 attachment 上，Durable Object 休眠醒來也不會丟。
export const STATIONS: Record<string, { cap: number; maxMs: number }> = {
  burner: { cap: 1, maxMs: 15_000 }, // 上香一輪約 5 秒；當機或忘了放開，15 秒後自動讓給下一位
  cushion: { cap: 2, maxMs: 120_000 }, // 跪兩分鐘就讓位
};

/**
 * 整理一個設施：過期的使用者放掉、空出來的位置依排隊先後給人。
 * 會就地改 peers；回傳這次輪到的人。純函式。
 */
export function settleStation(peers: PlazaPeer[], st: string, now: number): PlazaPeer[] {
  const def = STATIONS[st];
  if (!def) return [];
  let used = 0;
  for (const p of peers) {
    if (p.use !== st) continue;
    if (now - (p.useAt ?? 0) > def.maxMs) {
      p.use = '';
      p.useAt = 0;
    } else used++;
  }
  const waiting = peers.filter((p) => p.q === st).sort((a, b) => (a.qAt ?? 0) - (b.qAt ?? 0));
  const granted: PlazaPeer[] = [];
  while (used < def.cap && waiting.length) {
    const p = waiting.shift()!;
    p.q = '';
    p.use = st;
    p.useAt = now;
    granted.push(p);
    used++;
  }
  return granted;
}

/** 對外廣播的設施狀態：誰在用、排隊的順序（只有短 id）。 */
export function stationState(peers: PlazaPeer[], st: string) {
  return {
    t: 'qs',
    st,
    use: peers.filter((p) => p.use === st).map((p) => p.id),
    queue: peers
      .filter((p) => p.q === st)
      .sort((a, b) => (a.qAt ?? 0) - (b.qAt ?? 0))
      .map((p) => p.id),
  };
}

/** 下一次要自動放掉某人的時間（給 Durable Object 設鬧鐘），沒有就回 null。 */
export function nextExpiry(peers: PlazaPeer[]): number | null {
  let at: number | null = null;
  for (const p of peers) {
    const def = p.use ? STATIONS[p.use] : undefined;
    if (!def) continue;
    const t = (p.useAt ?? 0) + def.maxMs + 50;
    if (at === null || t < at) at = t;
  }
  return at;
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const slug = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^[a-z]{1,12}$/.test(v) ? v : fallback;
const round = (v: number) => Math.round(v * 100) / 100;
export const pubPeer = ({ id, x, z, f, s, outfit, hair }: PlazaPeer) => ({ id, x, z, f, s, outfit, hair });

/**
 * 處理一條進來的訊息，回傳要廣播的內容（或 null）。純函式，方便測試。
 * peer 會被就地更新。
 */
export function plazaMessage(peer: PlazaPeer, raw: unknown, now: number): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length > MAX_BYTES) return null;
  let msg: {
    t?: unknown;
    x?: unknown;
    z?: unknown;
    f?: unknown;
    a?: unknown;
    s?: unknown;
    st?: unknown;
    look?: { outfit?: unknown; hair?: unknown };
  };
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  if (msg.t === 'm') {
    if (now - peer.mAt < MOVE_GAP_MS) return null;
    peer.mAt = now;
    peer.x = round(clamp(msg.x, -BOUND.x, BOUND.x, peer.x));
    peer.z = round(clamp(msg.z, BOUND.zMin, BOUND.zMax, peer.z));
    peer.f = round(clamp(msg.f, -100, 100, peer.f));
    return { t: 'm', id: peer.id, x: peer.x, z: peer.z, f: peer.f };
  }
  // 排隊：{t:'q', st:'burner'|'cushion'} 排上去；{t:'q', st:''} 不排了／用完了
  if (msg.t === 'q' && typeof msg.st === 'string' && (msg.st === '' || msg.st in STATIONS)) {
    if (now - (peer.qmAt ?? 0) < Q_GAP_MS) return null;
    peer.qmAt = now;
    leaveStations(peer);
    if (msg.st) {
      peer.q = msg.st;
      peer.qAt = now;
    }
    return { t: '_q' }; // 內部記號：請 Durable Object 重新整理各設施
  }
  if (now - peer.aAt < ACT_GAP_MS) return null;
  if (msg.t === 'hi') {
    peer.aAt = now;
    peer.outfit = slug(msg.look?.outfit, peer.outfit);
    peer.hair = slug(msg.look?.hair, peer.hair);
    return { t: 'j', p: pubPeer(peer) };
  }
  if (msg.t === 'a' && typeof msg.a === 'string' && PLAZA_ACTIONS.has(msg.a)) {
    peer.aAt = now;
    return { t: 'a', id: peer.id, a: msg.a };
  }
  if (msg.t === 's' && typeof msg.s === 'string' && PLAZA_HOLDS.has(msg.s)) {
    peer.aAt = now;
    peer.s = msg.s;
    // 走進鋪子就不排了，也把正在用的設施讓出來
    if (peer.s === 'away') leaveStations(peer);
    return { t: 's', id: peer.id, s: peer.s };
  }
  return null;
}

/** 不排、不用任何設施。 */
export function leaveStations(peer: PlazaPeer) {
  peer.q = '';
  peer.qAt = 0;
  peer.use = '';
  peer.useAt = 0;
}
