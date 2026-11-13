// 廣場同遊的訊息規則（純函式，不依賴 Workers 執行環境，測試可以直接載入）。
// 說明見 plaza-room.ts。

export const PLAZA_CAP = 40;
// 廣場半徑 26.5，加上殿前（z 到 -26）與山門外（z 到 46）
const BOUND = { x: 28, zMin: -26, zMax: 46 };
export const PLAZA_ACTIONS = new Set(['wave', 'bow', 'pray', 'heart', 'incense', 'feed']);
export const PLAZA_HOLDS = new Set(['', 'sit', 'kneel', 'away']);
const MOVE_GAP_MS = 80;
const ACT_GAP_MS = 400;
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
    return { t: 's', id: peer.id, s: peer.s };
  }
  return null;
}
