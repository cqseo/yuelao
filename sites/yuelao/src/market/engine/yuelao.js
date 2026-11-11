import * as THREE from 'three';
import { STICKS } from '../../ritual/sticks';
import { createNpc } from './npc.js';
import { audio, canvasTex, ease, glow, lerp, rand, textPlane, tween, wait, woodTex } from './util.js';

const CATS = [
  { key: 'him', word: '他', desc: '心裡有個人，他到底怎麼想' },
  { key: 'single', word: '脫單', desc: '還沒有對象，正緣在哪裡' },
  { key: 'reunion', word: '複合', desc: '已經分開了，他會不會回來' },
];

// 月老殿：供桌、月窗、紅線、籤筒與筊杯。流程：選問法 → 搖籤 → 掉籤 → 擲筊 → 判詞。
export function createYuelao(ui) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120505);
  scene.fog = new THREE.FogExp2(0x160606, 0.045);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  const HOME = new THREE.Vector3(0, 1.85, 1.5);
  const LOOK = new THREE.Vector3(0, 1.42, -2.6);

  scene.add(new THREE.HemisphereLight(0xffc9a0, 0x200808, 0.55));

  // room shell
  const wallTex = canvasTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#5a1014';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(214,170,96,.16)';
      g.lineWidth = 2;
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * 64 + 32;
          const cy = y * 64 + 32;
          g.strokeRect(cx - 20, cy - 20, 40, 40);
          g.strokeRect(cx - 10, cy - 10, 20, 20);
        }
    },
    [5, 3],
  );
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(10, 5.4, 11),
    new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.9 }),
  );
  room.position.set(0, 2.7, -0.5);
  scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 11),
    new THREE.MeshStandardMaterial({ map: woodTex('#22120c'), roughness: 0.5, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, -0.5);
  scene.add(floor);

  // moon window
  const moonTex = canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w * 0.45, w * 0.42, 10, w / 2, w / 2, w / 2);
    gr.addColorStop(0, '#e8cf9a');
    gr.addColorStop(1, '#b98c4a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(120,80,30,${0.04 + Math.random() * 0.07})`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * w, 8 + Math.random() * 30, 0, 6.283);
      g.fill();
    }
  });
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 64),
    new THREE.MeshBasicMaterial({ map: moonTex }),
  );
  moon.position.set(0, 3.15, -5.9);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.06, 10, 80),
    new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 0.8, roughness: 0.35 }),
  );
  ring.position.copy(moon.position);
  const mg = glow(0xffd9a0, 6.5, 0.16);
  mg.position.set(0, 3.15, -5.7);
  scene.add(moon, ring, mg);

  for (const [x, t] of [
    [-2.35, '千里姻緣一線牽'],
    [2.35, '三生石上訂良緣'],
  ]) {
    const c = textPlane(t, 3.1, {
      vertical: true,
      bg: '#1a0707',
      fg: '#b8944e',
      border: '#6e5222',
      size: 96,
      weight: 700,
    });
    c.position.set(x, 2.85, -5.88);
    scene.add(c);
  }

  // red threads with paper tags
  const threads = [];
  const tagMat = new THREE.MeshBasicMaterial({ color: 0xf0e2c4, side: THREE.DoubleSide });
  const threadMat = new THREE.LineBasicMaterial({ color: 0xd8342a });
  for (let i = 0; i < 30; i++) {
    const g = new THREE.Group();
    const len = rand(0.9, 2.3);
    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -len, 0)]),
        threadMat,
      ),
    );
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.22), tagMat);
    tag.position.y = -len - 0.11;
    tag.rotation.y = rand(-0.8, 0.8);
    g.add(tag);
    const x = rand(-4.2, 4.2);
    g.position.set(x, 5.3, Math.abs(x) < 1.8 ? rand(-5.2, -4.2) : rand(-5.2, -1.2));
    g.userData.ph = rand(6.28);
    scene.add(g);
    threads.push(g);
  }

  // altar
  const TOP = 1.06;
  const wood = new THREE.MeshStandardMaterial({ map: woodTex('#2b150d'), roughness: 0.55 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.7), wood);
  table.position.set(0, TOP - 0.06, -2.6);
  scene.add(table);
  for (const x of [-2, 2])
    for (const z of [-1.95, -3.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1, 0.14), wood);
      leg.position.set(x, 0.5, z);
      scene.add(leg);
    }
  const cloth = textPlane('月老', 0.95, { bg: '#8a1a16', fg: '#f0cf85', border: '#c79a48', size: 150 });
  cloth.scale.set(1.35, 1, 1);
  cloth.position.set(0, 0.5, -1.74);
  scene.add(cloth);

  // incense burner + smoke
  const bronze = new THREE.MeshStandardMaterial({ color: 0x6a5230, metalness: 0.85, roughness: 0.4 });
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.3, 24), bronze);
  burner.position.set(0, TOP + 0.15, -3.05);
  scene.add(burner);
  const smokes = [];
  for (const dx of [-0.07, 0, 0.07]) {
    const st = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.55, 5),
      new THREE.MeshBasicMaterial({ color: 0x7a5a3a }),
    );
    st.position.set(dx, TOP + 0.55, -3.05);
    const tip = glow(0xff6a2a, 0.12, 1);
    tip.position.set(dx, TOP + 0.83, -3.05);
    scene.add(st, tip);
  }
  for (let i = 0; i < 14; i++) {
    const s = glow(0xbfb4a8, 0.3, 0.1);
    s.material.blending = THREE.NormalBlending;
    s.userData.k = i / 14;
    scene.add(s);
    smokes.push(s);
  }

  // candles
  const flames = [];
  for (const x of [-1.55, 1.55]) {
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xa3201a, roughness: 0.4 }),
    );
    c.position.set(x, TOP + 0.25, -2.95);
    const f = glow(0xffc070, 0.5, 1);
    f.position.set(x, TOP + 0.6, -2.95);
    const pl = new THREE.PointLight(0xffb060, 9, 9, 1.6);
    pl.position.set(x, TOP + 0.75, -2.7);
    scene.add(c, f, pl);
    flames.push({ f, pl });
  }

  // lot tube
  const tube = new THREE.Group();
  const bamboo = new THREE.MeshStandardMaterial({
    map: woodTex('#8a6a3a'),
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.5, 28, 1, true), bamboo);
  cyl.position.y = 0.25;
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), bamboo);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.005;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.012, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x9a1c16 }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.44;
  tube.add(cyl, base, band);
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xe6c88a, roughness: 0.7, emissive: 0x4a3a1c });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xb0241c, roughness: 0.6 });
  function makeStick() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.62, 0.012), stickMat);
    b.position.y = 0.31;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.014), tipMat);
    t.position.y = 0.59;
    g.add(b, t);
    return g;
  }
  const filler = [];
  for (let i = 0; i < 26; i++) {
    const s = makeStick();
    const a = rand(6.28);
    const r = rand(0.12);
    s.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    s.rotation.set(rand(-0.1, 0.1), rand(3), rand(-0.1, 0.1));
    s.userData.rz = s.rotation.z;
    tube.add(s);
    filler.push(s);
  }
  tube.position.set(0, TOP, -2.15);
  scene.add(tube);
  tube.traverse((o) => {
    o.userData.tube = true;
  });
  const hero = makeStick();
  scene.add(hero);
  const tubeGlow = glow(0xffc070, 1.6, 0);
  tubeGlow.position.set(0, TOP + 0.5, -2.1);
  scene.add(tubeGlow);

  // moon blocks
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.17, -0.35 * Math.PI, 1.35 * Math.PI, false);
  shape.absarc(0, -0.085, 0.125, 1.28 * Math.PI, -0.28 * Math.PI, true);
  const cupGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.02,
    bevelSegments: 3,
    curveSegments: 20,
  });
  cupGeo.center();
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xa8201a, roughness: 0.3, metalness: 0.1 });
  const cups = [-1, 1].map((sgn) => {
    const c = new THREE.Mesh(cupGeo, cupMat);
    c.userData.home = new THREE.Vector3(1.05 + sgn * 0.22, TOP + 0.045, -2.1);
    c.position.copy(c.userData.home);
    c.rotation.set(-Math.PI / 2, 0, sgn > 0 ? Math.PI : 0);
    scene.add(c);
    return c;
  });

  // 掌櫃：月老站在供桌左後方
  const npc = createNpc('yuelao');
  npc.root.position.set(-1.5, 0, -3.75);
  npc.root.rotation.y = 0.38;
  scene.add(npc.root);
  const npcLight = new THREE.PointLight(0xffc890, 5, 5, 1.8);
  npcLight.position.set(-1.1, 2.1, -2.6);
  scene.add(npcLight);
  const say = (text) => {
    npc.talk();
    ui.say(npc.name, text);
  };
  const PICK_LINES = {
    him: '心裡有人了。那就搖吧，籤筒不會騙你。',
    single: '還沒遇到？緣分這條線，我替你找找。',
    reunion: '舊人難忘。搖一支，看這條線斷了沒有。',
  };

  // ---------- flow ----------
  let state = 'idle';
  let cat = 'him';
  let stick = null;
  let energy = 0;
  let pressing = false;
  let lastTick = 0;

  function resetHero() {
    hero.visible = false;
    hero.position.set(0.02, TOP + 0.03, -2.15);
    hero.rotation.set(0, 0, 0);
  }

  function showPick() {
    state = 'pick';
    energy = 0;
    resetHero();
    ui.hint('');
    ui.panel(
      `<h2>你想問月老什麼？</h2>
       <div class="choices">${CATS.map((c) => `<button data-a="${c.key}"><b>${c.word}</b><span>${c.desc}</span></button>`).join('')}</div>`,
      (a) => {
        cat = a;
        say(PICK_LINES[a]);
        showShake();
      },
    );
  }

  function showShake() {
    state = 'shake';
    energy = 0;
    stick = STICKS[Math.floor(Math.random() * STICKS.length)];
    resetHero();
    hero.visible = true;
    ui.hint('心裡默念你的問題');
    ui.panel(
      `<div class="meter"><i id="meter-fill"></i></div>
       <p class="meter-text" id="meter-text">誠心 0%，滿了籤才會出來</p>
       <button class="hold" id="hold">按住搖籤</button>
       <p class="note">也可以直接搖手機，或按住畫面上的籤筒。鬆手會回落。</p>`,
      () => {},
    );
    const hold = document.getElementById('hold');
    const down = (e) => {
      e.preventDefault();
      pressing = true;
      hold.classList.add('on');
    };
    const up = () => {
      pressing = false;
      hold.classList.remove('on');
    };
    hold.addEventListener('pointerdown', down);
    hold.addEventListener('pointerup', up);
    hold.addEventListener('pointerleave', up);
    hold.addEventListener('pointercancel', up);
  }

  async function drop() {
    state = 'drop';
    pressing = false;
    ui.panel('');
    ui.hint('');
    audio.tick(900, 0.3, 0.25);
    const from = hero.position.clone();
    const to = new THREE.Vector3(-0.75, TOP + 0.012, -1.98);
    await tween(
      0.9,
      (k) => {
        hero.position.lerpVectors(from, to, k);
        hero.position.y = lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * 0.75;
        hero.rotation.z = k * (Math.PI / 2 + Math.PI * 2);
        hero.rotation.x = -k * 0.02;
      },
      ease.lin,
    );
    hero.rotation.set(-Math.PI / 2 + 0.0, 0, Math.PI / 2 - 0.35);
    hero.position.copy(to);
    audio.tick(500, 0.35, 0.12);
    tubeGlow.material.opacity = 0;
    await wait(0.35);
    ui.hint('');
    say(`${stick.no}。先別急著看，擲筊問我認不認。`);
    ui.panel(
      `<p class="kicker">掉出來的是</p><h2 class="big">${stick.no}</h2>
       <p class="note">這支籤算不算數，要擲筊請示月老。一平一凸是聖筊，才算數。</p>
       <button class="seal" data-a="toss">擲筊請示</button>`,
      () => toss(),
    );
  }

  async function toss() {
    if (state === 'toss') return;
    state = 'toss';
    ui.panel('');
    const r = Math.random();
    // 機率與 2D 儀式一致（ritual/physics.ts）
    const result = r < 0.5 ? 'sheng' : r < 0.8 ? 'xiao' : 'yin';
    // flat face up = rotation.x -PI/2 ; convex up = +PI/2
    const faces = result === 'sheng' ? [1, -1] : result === 'xiao' ? [1, 1] : [-1, -1];
    if (Math.random() < 0.5) faces.reverse();
    audio.tick(1400, 0.2, 0.08);
    await Promise.all(
      cups.map((c, i) => {
        const from = c.position.clone();
        const to = new THREE.Vector3(
          0.25 + i * 0.5 + rand(-0.08, 0.08),
          TOP + 0.045,
          -1.75 + rand(-0.12, 0.12),
        );
        const spin = (3 + i) * Math.PI * 2;
        const endX = faces[i] > 0 ? Math.PI / 2 : -Math.PI / 2;
        const endZ = rand(-1.2, 1.2);
        return tween(
          1.05,
          (k) => {
            c.position.lerpVectors(from, to, k);
            c.position.y = lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * 1.15;
            c.rotation.x = endX + (1 - k) * spin;
            c.rotation.z = endZ + (1 - k) * 4;
          },
          ease.lin,
          i * 0.06,
        ).then(() => audio.tick(700 + i * 200, 0.35, 0.1));
      }),
    );
    await wait(0.4);
    state = 'tossed';
    if (result === 'sheng') {
      audio.bell(660, 0.22);
      say('聖筊。這支籤，我認了。');
      ui.panel(
        `<p class="kicker">一平一凸</p><h2 class="big">聖筊</h2><p class="note">月老點頭了，這支籤算數。</p>
         <button class="seal" data-a="v">看月老的判詞</button>`,
        () => verdict(),
      );
    } else if (result === 'xiao') {
      say('笑筊。你問得不夠清楚，靜下心再擲一次。');
      ui.panel(
        `<p class="kicker">兩面凸起</p><h2 class="big">笑筊</h2><p class="note">月老在笑：問題還沒問清楚。靜下心，再擲一次。</p>
         <button class="seal" data-a="again">再擲一次</button>`,
        () => toss(), // 鐵律：落定後不動，重擲從落點起步
      );
    } else {
      say('陰筊。這支不算，重新搖。');
      ui.panel(
        `<p class="kicker">兩面平坦</p><h2 class="big">陰筊</h2><p class="note">月老沒有答應，這支籤作廢。重新搖一支。</p>
         <button class="seal" data-a="re">重新搖籤</button>`,
        () => showShake(),
      );
    }
  }

  function homeCups() {
    return Promise.all(
      cups.map((c, i) => {
        const from = c.position.clone();
        const rx = c.rotation.x;
        const rz = c.rotation.z;
        return tween(0.45, (k) => {
          c.position.lerpVectors(from, c.userData.home, k);
          c.rotation.x = lerp(rx, -Math.PI / 2, k);
          c.rotation.z = lerp(rz, i ? Math.PI : 0, k);
        });
      }),
    );
  }

  function verdict() {
    state = 'verdict';
    ui.panel('');
    say('判詞寫好了，拿去看。還有想問的，就開口。');
    const c = CATS.find((x) => x.key === cat);
    ui.card(
      `<div class="paper">
         <p class="p-cat">問．${c.word}</p>
         <p class="p-no">${stick.no}</p>
         <h2 class="p-grade">${stick.grade}</h2>
         <p class="p-poem">${stick.poem.replace(/\n/g, '<br>')}</p>
         ${stick.source ? `<p class="p-src">籤詩出處：${stick.source}</p>` : ''}
         <i class="p-rule"></i>
         <p class="p-verdict">${stick.verdict[cat]}</p>
         <span class="p-seal">月老已批</span>
       </div>
       <div class="card-actions"><button class="seal" data-a="again">再求一支</button><button class="ghost" data-a="leave">回到街上</button></div>
       <button class="ghost full" data-a="ask">問月老：這支籤我該怎麼做</button>
       <a class="ghost full" href="/sign/${stick.id}">看這支籤的完整解讀</a>`,
      (a) => {
        ui.card('');
        if (a === 'ask') showAsk();
        else if (a === 'leave') ui.leave();
        else showPick();
      },
    );
  }

  // 追問月老：免費的引導式回答；AI 即時對話開放且已登入、勾選同意時才走 AI。
  const asked = [];
  function showAsk(chips = ui.askStarters()) {
    state = 'ask';
    const ai = ui.aiStatus();
    ui.panel(
      `<p class="kicker">問月老</p>
       <div class="ask-log" id="ask-log"></div>
       <div class="chips" id="ask-chips"></div>
       ${
         ai.available
           ? `<label class="ask-ai"><input type="checkbox" id="ask-ai" /><span>用 AI 即時回答。我同意將本次訊息與最近 6 條對話送至第三方 AI 模型生成回應；原文不存入月老資料庫。</span></label>`
           : ''
       }
       <form class="ask" id="ask-form"><input id="ask-input" maxlength="200" autocomplete="off" placeholder="把想問的寫下來" aria-label="想問月老的事" /><button class="seal" type="submit">問</button></form>
       <button class="ghost" data-a="card">回到判詞</button>`,
      (a) => a === 'card' && verdict(),
      true,
    );
    const log = document.getElementById('ask-log');
    const chipBox = document.getElementById('ask-chips');
    const input = document.getElementById('ask-input');
    const line = (who, text) => {
      const p = document.createElement('p');
      p.className = who;
      p.textContent = text; // 使用者輸入只當純文字放進畫面
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    };
    for (const m of asked.slice(-6)) line(m.who, m.text);
    if (!asked.length) line('npc', '說吧，我聽著。');
    const setChips = (list) => {
      chipBox.textContent = '';
      for (const text of list.slice(0, 3)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.onclick = () => send(text);
        chipBox.appendChild(b);
      }
    };
    setChips(chips);
    let busy = false;
    async function send(raw) {
      const text = raw.trim().slice(0, 200);
      if (!text || busy) return;
      busy = true;
      input.value = '';
      line('me', text);
      asked.push({ who: 'me', text });
      npc.talk();
      let reply;
      try {
        reply = await ui.ask(text, { ai: !!document.getElementById('ask-ai')?.checked });
      } catch {
        reply = { text: '我這會兒聽不清楚，等一下再問一次。', followups: [] };
      }
      busy = false;
      if (state !== 'ask') return;
      npc.talk();
      line('npc', reply.text);
      asked.push({ who: 'npc', text: reply.text });
      setChips(reply.followups || []);
    }
    document.getElementById('ask-form').onsubmit = (e) => {
      e.preventDefault();
      send(input.value);
    };
  }

  return {
    id: 'yuelao',
    title: '月老殿',
    scene,
    camera,
    enter() {
      camera.position.copy(HOME).add(new THREE.Vector3(0, 0.1, 2.2));
      camera.lookAt(LOOK);
      const from = camera.position.clone();
      tween(
        1.6,
        (k) => {
          camera.position.lerpVectors(from, HOME, k);
          camera.lookAt(LOOK);
        },
        ease.out,
      );
      audio.bell(392, 0.18, 4);
      homeCups(); // 新的一次進門，筊杯回到供桌原位
      showPick();
      say('來了。不急，心裡放著誰，先想清楚。');
    },
    exit() {
      state = 'idle';
      pressing = false;
      ui.panel('');
      ui.card('');
      ui.hint('');
      ui.say('', '');
    },
    resize(aspect) {
      camera.fov = aspect < 0.8 ? 72 : aspect < 1.2 ? 60 : 50;
      // phones stand further back so the couplets and candles stay in frame
      HOME.set(0, aspect < 0.8 ? 2.05 : 1.85, aspect < 0.8 ? 3.0 : aspect < 1.2 ? 2.1 : 1.5);
      camera.position.copy(HOME);
      camera.lookAt(LOOK);
      camera.aspect = aspect;
    },
    pick: () => [cyl],
    onDown(hit) {
      if (state === 'shake' && hit) pressing = true;
    },
    onUp() {
      if (state === 'shake' && !document.querySelector('#hold.on')) pressing = false;
    },
    onShake(mag) {
      if (state === 'shake') energy = Math.min(1, energy + mag * 0.012);
    },
    update(dt, t) {
      npc.update(dt, t);
      for (const g of threads) g.rotation.z = Math.sin(t * 0.8 + g.userData.ph) * 0.04;
      for (const s of smokes) {
        const k = (s.userData.k + t * 0.07) % 1;
        s.position.set(Math.sin(k * 7 + s.userData.k * 20) * 0.12 * k, TOP + 0.85 + k * 1.9, -3.05);
        s.scale.setScalar(0.15 + k * 0.7);
        s.material.opacity = 0.16 * (1 - k);
      }
      for (const { f, pl } of flames) {
        const fl = 0.9 + Math.sin(t * 13 + pl.position.x) * 0.06 + Math.random() * 0.06;
        f.scale.setScalar(0.5 * fl);
        pl.intensity = 9 * fl;
      }
      if (state === 'shake') {
        energy = pressing ? Math.min(1, energy + dt * 0.42) : Math.max(0, energy - dt * 0.13);
        const amp = 0.04 + energy * 0.2;
        const active = pressing || energy > 0.02;
        tube.rotation.z = active ? Math.sin(t * 22) * amp : 0;
        tube.rotation.x = active ? Math.cos(t * 17) * amp * 0.6 : 0;
        tube.position.y = TOP + (active ? Math.abs(Math.sin(t * 22)) * 0.03 * (0.3 + energy) : 0);
        for (const s of filler)
          s.rotation.z = s.userData.rz + (active ? Math.sin(t * 30 + s.position.x * 40) * 0.05 : 0);
        hero.position.set(0.02 + tube.rotation.z * -0.3, TOP + 0.03 + energy * 0.34, -2.15);
        hero.rotation.z = tube.rotation.z;
        tubeGlow.material.opacity = energy * 0.5;
        if (pressing && t - lastTick > 0.09) {
          lastTick = t;
          audio.tick(1500 + Math.random() * 1200, 0.05 + energy * 0.1, 0.04);
        }
        const fill = document.getElementById('meter-fill');
        if (fill) {
          fill.style.width = `${Math.round(energy * 100)}%`;
          document.getElementById('meter-text').textContent =
            energy < 0.34
              ? `誠心 ${Math.round(energy * 100)}%，滿了籤才會出來`
              : energy < 0.7
                ? `誠心 ${Math.round(energy * 100)}%，籤在動了，別停`
                : `誠心 ${Math.round(energy * 100)}%，有支籤站起來了`;
        }
        if (energy >= 1) drop();
      } else {
        tube.rotation.set(0, 0, 0);
        tube.position.y = TOP;
      }
    },
  };
}
