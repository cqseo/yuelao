import { DurableObject } from 'cloudflare:workers';
import { PLAZA_CAP, type PlazaPeer, plazaMessage, pubPeer as pub } from './plaza-room-logic';

// 廣場同遊：一個 Durable Object = 一個廣場分身（滿了換下一個）。和大殿一樣只同步
// 「誰在、站哪、面向哪、做了什麼動作、坐著還是跪著」——沒有聊天、沒有暱稱、不落任何資料庫。
//
// 訊息（JSON）
//   進：{t:'hi', look}　{t:'m', x, z, f}　{t:'a', a}　{t:'s', s}
//   出：{t:'init', id, room, cap, x, z, peers}　{t:'j', p}　{t:'l', id}
//       {t:'m', id, x, z, f}　{t:'a', id, a}　{t:'s', id, s}
//
// 進來的值一律不信：位置夾在廣場範圍內、外觀只收短的小寫字、動作與姿勢只收白名單、
// 走位與動作分開限速、單條訊息有長度上限。用 WebSocket Hibernation，沒人說話時不計費。

export class PlazaRoom extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= PLAZA_CAP) return new Response('full', { status: 409 });
    const room = Number(new URL(request.url).searchParams.get('n')) || 1;
    const pair = new WebSocketPair();
    const peer: PlazaPeer = {
      id: crypto.randomUUID().slice(0, 8),
      x: 0,
      z: 23,
      f: Math.PI,
      s: '',
      outfit: 'moon',
      hair: 'bun',
      mAt: 0,
      aAt: 0,
    };
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment(peer);
    const peers = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== pair[1])
      .map((ws) => pub(ws.deserializeAttachment() as PlazaPeer));
    pair[1].send(JSON.stringify({ t: 'init', id: peer.id, room, cap: PLAZA_CAP, peers }));
    this.broadcast({ t: 'j', p: pub(peer) }, pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const peer = ws.deserializeAttachment() as PlazaPeer;
    const out = plazaMessage(peer, raw, Date.now());
    if (!out) return;
    ws.serializeAttachment(peer);
    this.broadcast(out, ws);
  }

  override webSocketClose(ws: WebSocket) {
    this.leave(ws);
  }

  override webSocketError(ws: WebSocket) {
    this.leave(ws);
  }

  private leave(ws: WebSocket) {
    const peer = ws.deserializeAttachment() as PlazaPeer | null;
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
