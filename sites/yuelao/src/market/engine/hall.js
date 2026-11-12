import * as THREE from 'three';
import { OUTFITS } from './avatar.js';
import { createNpc } from './npc.js';
import { audio, canvasTex, ease, glow, rand, tween } from './util.js';

// 大殿同拜：和此刻在線的人同處一殿。看得到彼此的身影、位置與動作（跪拜、上香），
// 不能交談、沒有暱稱。連線走 /api/hall/ws（一間殿一個 Durable Object，滿了換下一間）；
// 連不上就自己拜，其他照常。
const BOUND = { x: 9, zMin: -6, zMax: 8.5 };
const MAX_SHOWN = 48; // 手機同屏畫得動的上限；超過的人仍在殿裡，只是不畫出來

export function createHall(ui) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0605);
  scene.fog = new THREE.FogExp2(0x0a0605, 0.028);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 80);

  // ---------- 殿內 ----------
  scene.add(new THREE.HemisphereLight(0xffc9a0, 0x180806, 0.5));
  const wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a120b';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${rand(60, 110) | 0},${rand(24, 44) | 0},${rand(12, 22) | 0},.35)`;
      g.beginPath();
      const y = rand(h);
      g.moveTo(0, y);
      g.lineTo(w, y + rand(-4, 4));
      g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += w / 4) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(6, 6);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 22),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.42, metalness: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.5;
  scene.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: 0x4a120c, roughness: 0.85 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8c1d14, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x9a7630, roughness: 0.42, metalness: 0.88 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(24, 11), wallM);
  back.position.set(0, 5.5, -10.5);
  scene.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), wallM);
    side.rotation.y = -sx * (Math.PI / 2);
    side.position.set(sx * 12, 5.5, 0.5);
    scene.add(side);
    for (const z of [-7, -1.5, 4, 9.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 11, 18), red);
      col.position.set(sx * 10.4, 5.5, z);
      scene.add(col);
    }
  }
  // 神像後面的滿月與紅線
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(3.3, 48),
    new THREE.MeshBasicMaterial({ color: 0xf2dca8 }),
  );
  moon.position.set(0, 5.6, -10.4);
  scene.add(moon);
  const halo = glow(0xffc070, 13, 0.5);
  halo.position.set(0, 5.6, -10.2);
  scene.add(halo);
  const threadM = new THREE.LineBasicMaterial({ color: 0xc8261c });
  for (let i = 0; i < 26; i++) {
    const x = rand(-11, 11);
    const pts = [
      new THREE.Vector3(x, 10.5, rand(-9, 9)),
      new THREE.Vector3(x + rand(-0.3, 0.3), rand(6.6, 8.6), rand(-9, 9)),
    ];
    pts[1].z = pts[0].z;
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), threadM));
  }
  // 神台、鎏金月老像、香爐、兩排燭
  const dais = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x24100a, roughness: 0.6 }),
  );
  dais.position.set(0, 0.5, -8.6);
  scene.add(dais);
  const statue = createNpc('yuelao');
  statue.root.traverse((o) => {
    if (o.isMesh) o.material = gold;
  });
  statue.root.scale.setScalar(2.7);
  statue.root.position.set(0, 1, -8.9);
  scene.add(statue.root);
  const beam = new THREE.SpotLight(0xffe2a0, 520, 30, 0.42, 0.8, 1.5);
  beam.position.set(5, 11, -1);
  beam.target.position.set(0, 3.6, -8.9);
  scene.add(beam, beam.target);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.05, 1.3), red);
  altar.position.set(0, 0.52, -6.2);
  scene.add(altar);
  const censer = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.36, 0.5, 20), gold);
  censer.position.set(0, 1.3, -6.2);
  scene.add(censer);
  const flames = [];
  for (const x of [-2.6, -1.5, 1.5, 2.6]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 10), red);
    c.position.set(x, 1.35, -6.2);
    const f = glow(0xffc070, 0.55, 1);
    f.position.set(x, 1.82, -6.2);
    scene.add(c, f);
    flames.push(f);
  }
  const candle = new THREE.PointLight(0xffa860, 40, 16, 1.6);
  candle.position.set(0, 2.6, -5.2);
  scene.add(candle);
  for (const [x, z] of [
    [-7, 2],
    [7, 2],
    [-7, 8],
    [7, 8],
  ]) {
    const l = new THREE.PointLight(0xff9a50, 16, 14, 1.7);
    l.position.set(x, 4.2, z);
    const g = glow(0xff8a40, 1.5, 0.8);
    g.position.copy(l.position);
    scene.add(l, g);
  }
  // 香煙
  const smokes = [];
  for (let i = 0; i < 7; i++) {
    const s = glow(0xbfb6a8, 0.9, 0.12);
    s.userData.k = i / 7;
    scene.add(s);
    smokes.push(s);
  }
  // 蒲團：七列六排
  const SEATS = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) SEATS.push([-7.5 + c * 2.5, -3 + r * 2]);
  const cushions = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.14, 18),
    new THREE.MeshStandardMaterial({ color: 0x9c6a1e, roughness: 0.9 }),
    SEATS.length,
  );
  const m4 = new THREE.Matrix4();
  SEATS.forEach(([x, z], i) => {
    cushions.setMatrixAt(i, m4.makeTranslation(x, 0.07, z + 0.55));
  });
  scene.add(cushions);

  // 知客：站在門邊招呼
  const npc = createNpc('keeper');
  npc.root.position.set(-8.6, 0, 7.4);
  npc.root.rotation.y = 2.2;
  scene.add(npc.root);
  const say = (text) => {
    npc.talk();
    ui.say(npc.name, text);
  };

  // ---------- 殿裡的人：輕量小人，同屏幾十個也畫得動 ----------
  const robeGeo = (() => {
    const prof = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      prof.push(new THREE.Vector2(0.15 + 0.27 * k ** 1.5, 1.34 - k * 1.32));
    }
    return new THREE.LatheGeometry(prof, 14);
  })();
  const headGeo = new THREE.SphereGeometry(0.13, 14, 10);
  const hairGeo = new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const sashGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.09, 14);
  const stickGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5);
  const skinM = new THREE.MeshStandardMaterial({ color: 0xf1d3bd, roughness: 0.7 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.5 });
  const stickM = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  const robeMats = new Map();
  const robeMat = (outfit) => {
    const o = OUTFITS.find((x) => x.id === outfit) || OUTFITS[0];
    if (!robeMats.has(o.id))
      robeMats.set(o.id, [
        new THREE.MeshStandardMaterial({ color: o.robe, roughness: 0.75, side: THREE.DoubleSide }),
        new THREE.MeshStandardMaterial({ color: o.sash, roughness: 0.5, metalness: 0.2 }),
      ]);
    return robeMats.get(o.id);
  };
  function figure(p, mine) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    const [rm, sm] = robeMat(p.outfit);
    const robe = new THREE.Mesh(robeGeo, rm);
    const sash = new THREE.Mesh(sashGeo, sm);
    sash.position.y = 0.98;
    const head = new THREE.Mesh(headGeo, skinM);
    head.position.y = 1.5;
    const hair = new THREE.Mesh(hairGeo, hairM);
    hair.position.set(0, 1.51, -0.012);
    hair.rotation.x = -0.25;
    const stick = new THREE.Mesh(stickGeo, stickM);
    stick.position.set(0, 1.25, 0.3);
    stick.visible = false;
    body.add(robe, sash, head, hair, stick);
    g.add(body);
    if (mine) {
      // 腳下一圈光，讓自己在人群裡找得到
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.5, 40),
        new THREE.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: 0.9, toneMapped: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);
    }
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.PI; // 面向神像
    scene.add(g);
    return {
      g,
      body,
      robe,
      sash,
      stick,
      x: p.x,
      z: p.z,
      tx: p.x,
      tz: p.z,
      act: null,
      ph: rand(6.28),
      outfit: p.outfit,
    };
  }
  function drop(f) {
    scene.remove(f.g);
  }
  function setLook(f, outfit) {
    const [rm, sm] = robeMat(outfit);
    f.robe.material = rm;
    f.sash.material = sm;
    f.outfit = outfit;
  }
  function act(f, name) {
    f.act = { name, t: 0, dur: name === 'bow' ? 2.4 : 2.8 };
    f.stick.visible = name === 'incense';
  }
  function stepFigure(f, dt, t) {
    const dx = f.tx - f.x;
    const dz = f.tz - f.z;
    const d = Math.hypot(dx, dz);
    let walking = false;
    if (d > 0.05) {
      const s = Math.min(d, 2.6 * dt);
      f.x += (dx / d) * s;
      f.z += (dz / d) * s;
      walking = true;
      let turn = Math.atan2(dx, dz) - f.g.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      f.g.rotation.y += turn * Math.min(1, dt * 9);
      f.act = null;
      f.stick.visible = false;
    } else {
      // 站定就轉回去面向神像
      let turn = Math.PI - f.g.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      f.g.rotation.y += turn * Math.min(1, dt * 5);
    }
    f.g.position.set(f.x, 0, f.z);
    let lean = walking ? 0.08 : 0;
    let sink = walking ? Math.abs(Math.sin(t * 9 + f.ph)) * 0.03 : Math.sin(t * 1.5 + f.ph) * 0.004;
    if (f.act) {
      f.act.t += dt;
      const k = Math.min(1, f.act.t / f.act.dur);
      if (f.act.name === 'bow') {
        // 跪下、俯身、起來
        const down = Math.sin(k * Math.PI);
        lean = down * 1.05;
        sink = -down * 0.5;
      } else {
        // 舉香三拜
        lean = Math.abs(Math.sin(k * Math.PI * 3)) * 0.38;
      }
      if (k >= 1) {
        f.act = null;
        f.stick.visible = false;
      }
    }
    f.body.rotation.x = lean;
    f.body.position.y = sink;
  }

  // ---------- 連線 ----------
  let ws = null;
  let live = false; // 已收到 init
  let hallNo = 0;
  let inside = false;
  const peers = new Map();
  let me = null;
  let extras = []; // 佈景香客：真人不夠時補幾位，讓殿裡不至於空蕩；不計入人數
  const send = (o) => {
    if (live && ws?.readyState === 1) ws.send(JSON.stringify(o));
  };
  function connect(n, tries) {
    if (!inside) return;
    let got = false;
    const sock = new WebSocket(
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/hall/ws?n=${n}`,
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
        hallNo = msg.hall;
        Object.assign(me, { x: msg.x, z: msg.z, tx: msg.x, tz: msg.z });
        for (const p of msg.peers) join(p);
        send({ t: 'hi', look: ui.look() });
        status();
      } else if (msg.t === 'j') join(msg.p);
      else if (msg.t === 'l') {
        const f = peers.get(msg.id);
        if (f) drop(f);
        peers.delete(msg.id);
        status();
      } else if (msg.t === 'm') {
        const f = peers.get(msg.id);
        if (f) Object.assign(f, { tx: msg.x, tz: msg.z });
      } else if (msg.t === 'a') {
        const f = peers.get(msg.id);
        if (f) act(f, msg.a);
      }
    };
    sock.onclose = () => {
      if (sock !== ws || !inside) return;
      live = false;
      for (const f of peers.values()) drop(f);
      peers.clear();
      // 還沒進殿就被關：多半是這間滿了，換下一間；試幾次都不行就自己拜
      if (!got && tries < 5) connect(n + 1, tries + 1);
      else status();
    };
  }
  function join(p) {
    const old = peers.get(p.id);
    if (old) {
      setLook(old, p.outfit);
      return;
    }
    if (peers.size >= MAX_SHOWN) return;
    peers.set(p.id, figure(p, false));
    status();
  }
  function status() {
    // 真人夠多就把佈景香客撤掉
    const want = Math.max(0, 9 - peers.size);
    while (extras.length > want) drop(extras.pop());
    const el = document.getElementById('hall-count');
    if (el)
      el.textContent = live ? `第 ${hallNo} 殿　此刻 ${peers.size + 1} 人同拜` : '現在連不上其他人，先自己拜';
  }

  function showPanel() {
    ui.panel(
      `<p class="kicker" id="hall-count">正在進殿</p>
       <div class="card-actions"><button class="seal" data-a="bow">跪拜</button><button class="seal" data-a="incense">上香</button></div>
       <p class="note" style="margin:.9rem 0 0">點地面走動，拖曳轉視角。這裡只看得到彼此的身影和動作，不能交談。</p>`,
      (a) => {
        if (!me || me.act) return;
        act(me, a);
        send({ t: 'a', a });
        if (a === 'bow') {
          audio.bell(294, 0.16, 3.5);
          say('心誠則靈。');
        } else {
          audio.bell(440, 0.1, 2.5);
          say('香已上。願望放在心裡就好。');
        }
      },
    );
    status();
  }

  // ---------- 鏡頭：跟在自己身後 ----------
  let yaw = 0;
  const camAt = new THREE.Vector3();
  function placeCamera(dt) {
    if (!me) return;
    const narrow = camera.aspect < 0.8;
    const back = narrow ? 7.5 : 6.6;
    const want = new THREE.Vector3(
      me.x + Math.sin(yaw) * back,
      narrow ? 4.8 : 4.1,
      me.z + Math.cos(yaw) * back,
    );
    want.x = THREE.MathUtils.clamp(want.x, -11, 11);
    want.z = Math.min(want.z, 10.8);
    camera.position.lerp(want, dt ? Math.min(1, dt * 4) : 1);
    // 視線落在自己與神台之間，往前看時神像一直在畫面裡
    camAt.set(me.x * 0.55 - Math.sin(yaw) * 3, 2.3, Math.min(me.z - 4, -1) - Math.cos(yaw) * 1.5);
    camera.lookAt(camAt);
  }

  return {
    id: 'hall',
    title: '大殿',
    scene,
    camera,
    enter() {
      inside = true;
      yaw = 0;
      const look = ui.look();
      me = figure({ x: rand(-3, 3), z: 7.2, outfit: look.outfit }, true);
      extras = SEATS.filter((_, i) => i % 5 === 2)
        .slice(0, 9)
        .map(([x, z]) => {
          const f = figure({ x, z: z + 0.2, outfit: OUTFITS[(Math.random() * 3) | 0].id }, false);
          f.next = rand(2, 14);
          return f;
        });
      placeCamera(0);
      const from = camera.position.clone().add(new THREE.Vector3(0, 0.6, 3));
      const to = camera.position.clone();
      tween(1.4, (k) => camera.position.lerpVectors(from, to, k), ease.out);
      audio.bell(196, 0.2, 6);
      showPanel();
      say('進殿請輕聲。找個蒲團，點地面就能走過去。');
      connect(1, 0);
    },
    exit() {
      inside = false;
      live = false;
      try {
        ws?.close();
      } catch {}
      ws = null;
      for (const f of [...peers.values(), ...extras, me]) if (f) drop(f);
      peers.clear();
      extras = [];
      me = null;
      ui.panel('');
      ui.hint('');
      ui.say('', '');
    },
    resize(aspect) {
      camera.aspect = aspect;
      camera.fov = aspect < 0.8 ? 72 : 58;
    },
    pick: () => [floor],
    onDown() {},
    onUp() {},
    onShake() {},
    /** 點地面：走過去，並告訴同殿的人。 */
    onTap(hit) {
      if (!hit || !me) return;
      me.tx = THREE.MathUtils.clamp(hit.point.x, -BOUND.x, BOUND.x);
      me.tz = THREE.MathUtils.clamp(hit.point.z, BOUND.zMin, BOUND.zMax);
      send({ t: 'm', x: +me.tx.toFixed(2), z: +me.tz.toFixed(2) });
    },
    onDrag(dx) {
      yaw = THREE.MathUtils.clamp(yaw - dx * 0.004, -1.1, 1.1);
    },
    update(dt, t) {
      npc.update(dt, t);
      for (const f of flames)
        f.scale.setScalar(0.55 * (0.9 + Math.sin(t * 11 + f.position.x) * 0.07 + Math.random() * 0.05));
      for (const s of smokes) {
        const k = (s.userData.k + t * 0.06) % 1;
        s.position.set(Math.sin(k * 6 + s.userData.k * 20) * 0.25 * k, 1.6 + k * 3.2, -6.2);
        s.material.opacity = 0.14 * (1 - k);
        s.scale.setScalar(0.5 + k * 1.6);
      }
      if (me) stepFigure(me, dt, t);
      for (const f of peers.values()) stepFigure(f, dt, t);
      for (const f of extras) {
        f.next -= dt;
        if (f.next < 0 && !f.act) {
          act(f, Math.random() < 0.75 ? 'bow' : 'incense');
          f.next = rand(9, 26);
        }
        stepFigure(f, dt, t);
      }
      placeCamera(dt);
    },
  };
}
