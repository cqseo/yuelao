import { createAvatar } from './avatar.js';

// 廣場同遊（用戶端）：和此刻也在逛集市的人同處一個廣場。看得到彼此走動、坐下、跪拜，
// 以及揮手、作揖、合十、比心、上香、餵魚；不能交談、沒有暱稱。
// 連線走 /api/plaza/ws（一個廣場分身一個 Durable Object，滿了換下一個）；連不上就照常一個人逛。
const MAX_SHOWN = 24; // 手機同屏畫得動的上限；其他人仍在，只是不畫出來
const SEND_GAP = 0.12; // 秒

/**
 * @param {{ scene: import('three').Scene, coarse: boolean, look: () => {outfit:string, hair:string},
 *   fx: { act: (a: string, x: number, z: number, avatar: any) => void },
 *   onCount: (n: number, room: number) => void,
 *   onStation?: (st: string, state: {use: string[], queue: string[]}) => void,
 *   onGo?: (st: string) => void }} o
 */
export function createPlazaNet({ scene, coarse, look, fx, onCount, onStation, onGo, groundY = () => 0 }) {
  let ws = null;
  let live = false;
  let want = false; // 是否應該連著（進了集市才連）
  let room = 0;
  let myId = '';
  const stations = {}; // st → { use, queue }
  let retry = 0;
  let retryTimer = 0;
  const peers = new Map();
  const last = { x: 1e9, z: 1e9, f: 0, at: 0 };
  let hold = '';

  const send = (o) => {
    if (live && ws?.readyState === 1) ws.send(JSON.stringify(o));
  };
  const count = () => onCount(live ? peers.size + 1 : 0, room);

  function connect(n, tries) {
    if (!want) return;
    let got = false;
    const sock = new WebSocket(
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/plaza/ws?n=${n}`,
    );
    ws = sock;
    sock.onmessage = (e) => {
      if (sock !== ws) return;
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === 'init') {
        got = true;
        live = true;
        retry = 0;
        room = msg.room;
        myId = msg.id;
        for (const p of msg.peers) join(p);
        for (const s of msg.stations || []) {
          stations[s.st] = { use: s.use, queue: s.queue };
          onStation?.(s.st, stations[s.st]);
        }
        send({ t: 'hi', look: look() });
        last.at = 0;
        last.x = 1e9; // 下一幀就把自己的位置送出去
        if (hold) setTimeout(() => send({ t: 's', s: hold }), 450);
        count();
      } else if (msg.t === 'qs') {
        stations[msg.st] = { use: msg.use, queue: msg.queue };
        onStation?.(msg.st, stations[msg.st]);
      } else if (msg.t === 'go') onGo?.(msg.st);
      else if (msg.t === 'j') join(msg.p);
      else if (msg.t === 'l') {
        drop(msg.id);
        count();
      } else if (msg.t === 'm') {
        const p = peers.get(msg.id);
        if (p) {
          p.tx = msg.x;
          p.tz = msg.z;
          p.tf = msg.f;
        }
      } else if (msg.t === 'a') {
        const p = peers.get(msg.id);
        if (p?.a.root.visible) fx.act(msg.a, p.x, p.z, p.a);
      } else if (msg.t === 's') {
        const p = peers.get(msg.id);
        if (p) setHold(p, msg.s);
      }
    };
    sock.onclose = () => {
      if (sock !== ws) return;
      live = false;
      for (const id of [...peers.keys()]) drop(id);
      count();
      if (!want) return;
      // 還沒進來就被關：多半是這個分身滿了，換下一個；連線斷了就過一會兒重連
      if (!got && tries < 5) connect(n + 1, tries + 1);
      else {
        retry = Math.min(retry + 1, 6);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => connect(1, 0), 1500 * 2 ** retry);
      }
    };
  }

  function join(p) {
    const old = peers.get(p.id);
    if (old) {
      old.a.apply({ outfit: p.outfit, hair: p.hair });
      return;
    }
    if (peers.size >= MAX_SHOWN) return;
    const a = createAvatar(coarse);
    a.root.remove(a.light); // 別人的燈籠只發亮、不照明
    a.apply({ outfit: p.outfit, hair: p.hair });
    a.root.position.set(p.x, 0, p.z);
    a.root.rotation.y = p.f;
    scene.add(a.root);
    const peer = {
      id: p.id,
      a,
      x: p.x,
      z: p.z,
      tx: p.x,
      tz: p.z,
      tf: p.f,
      speed: 0,
      s: '',
      ph: Math.random() * 10,
    };
    setHold(peer, p.s || '');
    peers.set(p.id, peer);
    count();
  }
  function drop(id) {
    const p = peers.get(id);
    if (!p) return;
    scene.remove(p.a.root);
    peers.delete(id);
  }
  function setHold(p, s) {
    p.s = s;
    p.a.root.visible = s !== 'away';
    p.a.hold(s === 'sit' || s === 'kneel' ? s : null);
    if (s === 'away') {
      // 從鋪子裡出來時直接出現在新位置，不要從門口一路滑過去
      p.x = p.tx;
      p.z = p.tz;
    }
  }

  return {
    get count() {
      return live ? peers.size + 1 : 0;
    },
    get live() {
      return live;
    },
    get id() {
      return myId;
    },
    station(st) {
      return stations[st] || { use: [], queue: [] };
    },
    /** 排某個設施（'burner'、'cushion'）；傳 '' 表示不排了／用完了。 */
    queue(st) {
      send({ t: 'q', st });
    },
    start() {
      if (want) return;
      want = true;
      connect(1, 0);
    },
    stop() {
      want = false;
      clearTimeout(retryTimer);
      live = false;
      try {
        ws?.close();
      } catch {}
      ws = null;
      for (const id of [...peers.keys()]) drop(id);
    },
    /** 每幀呼叫：位置有變就（限速地）送出去。 */
    move(x, z, f, t, force = false) {
      if (!live || (!force && t - last.at < SEND_GAP)) return;
      if (!force && Math.hypot(x - last.x, z - last.z) < 0.05 && Math.abs(f - last.f) < 0.15) return;
      last.x = x;
      last.z = z;
      last.f = f;
      last.at = t;
      send({
        t: 'm',
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        f: Math.round(f * 100) / 100,
      });
    },
    act(a) {
      send({ t: 'a', a });
    },
    /** 坐著、跪著、進鋪子（away）或站著（''）。 */
    hold(s) {
      if (s === hold) return;
      hold = s;
      send({ t: 's', s });
    },
    look() {
      send({ t: 'hi', look: look() });
    },
    update(dt, t) {
      for (const p of peers.values()) {
        if (!p.a.root.visible) {
          p.a.root.position.set(p.tx, groundY(p.tx, p.tz, p.s === 'kneel'), p.tz);
          p.x = p.tx;
          p.z = p.tz;
          continue;
        }
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        let speed = 0;
        if (d > 10) {
          p.x = p.tx;
          p.z = p.tz;
        } else if (d > 0.03) {
          // 追得上對方：落後越多走越快（跑起來最多 9）
          const sp = Math.min(9, Math.max(3.6, d * 4));
          const step = Math.min(d, sp * dt);
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          speed = step / dt;
          if (d > 0.2) {
            let turn = Math.atan2(dx, dz) - p.a.root.rotation.y;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            p.a.root.rotation.y += turn * Math.min(1, dt * 9);
          }
        }
        if (speed < 0.5) {
          let turn = p.tf - p.a.root.rotation.y;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          p.a.root.rotation.y += turn * Math.min(1, dt * 6);
        }
        p.speed += (speed - p.speed) * Math.min(1, dt * 10);
        p.a.root.position.set(p.x, groundY(p.x, p.z, p.s === 'kneel'), p.z);
        p.a.update(dt, t + p.ph, p.speed);
      }
    },
  };
}
