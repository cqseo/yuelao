import { DurableObject } from 'cloudflare:workers';

// 大殿同拜：一個 Durable Object = 一間殿。只同步三件事——誰在、站哪、做了什麼動作。
// 沒有聊天、沒有暱稱、不落任何資料庫；人走光了這間殿就自然休眠。
//
// 訊息（JSON）
//   進：{t:'hi', look}　{t:'m', x, z}　{t:'a', a:'bow'|'incense'}
//   出：{t:'init', id, hall, cap, peers}　{t:'j', p}　{t:'l', id}　{t:'m', id, x, z}　{t:'a', id, a}
//
// 所有進來的值都當成不可信：位置夾在殿內、外觀只收白名單形狀的短字串、動作只收兩種、
// 每條連線限速。用 WebSocket Hibernation，沒人說話時不計費。

export const HALL_CAP = 60;
const BOUND = { x: 9, zMin: -6, zMax: 8.5 };
const ACTIONS = new Set(['bow', 'incense']);
const MIN_GAP_MS = 90;
const MAX_BYTES = 256;

interface Peer {
  id: string;
  x: number;
  z: number;
  outfit: string;
  hair: string;
  at: number; // 上一條訊息的時間，用來限速
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const slug = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^[a-z]{1,12}$/.test(v) ? v : fallback;
const pub = ({ id, x, z, outfit, hair }: Peer) => ({ id, x, z, outfit, hair });

export class HallRoom extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= HALL_CAP) return new Response('full', { status: 409 });
    const hall = Number(new URL(request.url).searchParams.get('n')) || 1;
    const pair = new WebSocketPair();
    const peer: Peer = {
      id: crypto.randomUUID().slice(0, 8),
      x: (Math.random() - 0.5) * 10,
      z: 5 + Math.random() * 3,
      outfit: 'moon',
      hair: 'bun',
      at: 0,
    };
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment(peer);
    const peers = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== pair[1])
      .map((ws) => pub(ws.deserializeAttachment() as Peer));
    pair[1].send(
      JSON.stringify({ t: 'init', id: peer.id, hall, cap: HALL_CAP, x: peer.x, z: peer.z, peers }),
    );
    this.broadcast({ t: 'j', p: pub(peer) }, pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) return;
    const peer = ws.deserializeAttachment() as Peer;
    const now = Date.now();
    if (now - peer.at < MIN_GAP_MS) return;
    peer.at = now;
    let msg: {
      t?: unknown;
      x?: unknown;
      z?: unknown;
      a?: unknown;
      look?: { outfit?: unknown; hair?: unknown };
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === 'hi') {
      peer.outfit = slug(msg.look?.outfit, peer.outfit);
      peer.hair = slug(msg.look?.hair, peer.hair);
      this.broadcast({ t: 'j', p: pub(peer) }, ws);
    } else if (msg.t === 'm') {
      peer.x = clamp(msg.x, -BOUND.x, BOUND.x, peer.x);
      peer.z = clamp(msg.z, BOUND.zMin, BOUND.zMax, peer.z);
      this.broadcast({ t: 'm', id: peer.id, x: peer.x, z: peer.z }, ws);
    } else if (msg.t === 'a' && typeof msg.a === 'string' && ACTIONS.has(msg.a)) {
      this.broadcast({ t: 'a', id: peer.id, a: msg.a }, ws);
    }
    ws.serializeAttachment(peer);
  }

  override webSocketClose(ws: WebSocket) {
    this.leave(ws);
  }

  override webSocketError(ws: WebSocket) {
    this.leave(ws);
  }

  private leave(ws: WebSocket) {
    const peer = ws.deserializeAttachment() as Peer | null;
    try {
      ws.close();
    } catch {
      // 已經關了
    }
    if (peer) this.broadcast({ t: 'l', id: peer.id }, ws);
  }

  private broadcast(msg: unknown, except?: WebSocket) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
        // 對方剛斷線，等它的 close 事件清理
      }
    }
  }
}
