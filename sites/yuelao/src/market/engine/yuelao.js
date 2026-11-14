import * as THREE from 'three';
import { STICKS } from '../../ritual/sticks';
import { STICK_PLAIN } from '../../ritual/sticks-plain';
import { dailyStick, todayLabel } from './daily-draw.js';
import { createNpc } from './npc.js';
import { yuelaoSampleHtml } from './samples.js';
import { shareDaily, shareVerdict } from './share.js';
import { audio, canvasTex, ease, glow, lerp, rand, textPlane, tween, wait, woodTex } from './util.js';

const CATS = [
  { key: 'him', word: '他', desc: '心裡有個人，他到底怎麼想' },
  { key: 'single', word: '脫單', desc: '還沒有對象，正緣在哪裡' },
  { key: 'reunion', word: '複合', desc: '已經分開了，他會不會回來' },
];
// 2026-11-13：不再先選「他／脫單／複合」三個方向。改成先寫下想問的事、再選現在的情況
// （參考占了麼的求籤頁）。籤詩判詞仍分三類，由「情況」對應過去；問的事一路帶到深度解讀，不用再寫一次。
export const SITS = [
  { key: 'single', word: '單身', cat: 'single' },
  { key: 'crush', word: '曖昧中', cat: 'him' },
  { key: 'dating', word: '交往中', cat: 'him' },
  { key: 'reunion', word: '想復合', cat: 'reunion' },
  { key: 'married', word: '已婚／談婚論嫁', cat: 'him' },
];
const Q_MAX = 100;

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
  // 燭台放在供桌兩端（原本 ±1.55 正好擋在月老身前）
  for (const x of [-2.15, 2.15]) {
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
  // 月老坐在籤筒左後方、靠近畫面中間：寬螢幕右側有面板，不能太靠右；也不能被燭台擋住
  npc.root.position.set(-1.0, 0, -3.7);
  npc.root.rotation.y = 0.26;
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

  let sit = 'single';
  try {
    sit = sessionStorage.getItem('yuelao:sit') || 'single';
  } catch {}
  const sitWord = () => (SITS.find((x) => x.key === sit) || SITS[0]).word;
  function showPick() {
    state = 'pick';
    energy = 0;
    resetHero();
    ui.hint('');
    say('來了。心裡那件事，寫下來給我看看。');
    const render = (note = '') => {
      ui.panel(
        `<button type="button" class="daily-link" data-a="daily">☾ 今日一籤<span>每天一支，不用寫問題</span></button>
         <h2>你想問月老什麼</h2>
         <label class="ask-q"><textarea id="ask-q" maxlength="${Q_MAX}" rows="3" placeholder="例：我和他還有機會嗎">${esc(draftQ)}</textarea>
           <span class="ask-meta"><span>一件具體的事，說清楚一點</span><span id="ask-n">${[...draftQ].length}/${Q_MAX}</span></span></label>
         <p class="kicker">你現在的情況</p>
         <div class="chips sits">${SITS.map(
           (x) =>
             `<button type="button" data-a="sit:${x.key}" class="${x.key === sit ? 'on' : ''}">${x.word}</button>`,
         ).join('')}</div>
         <p class="note small">照你現在的位置選，判詞和解讀會照著寫。</p>
         ${note ? `<p class="note" role="status">${note}</p>` : ''}
         <button class="seal" data-a="go">求籤</button>`,
        (a) => {
          if (a === 'daily') return dailySign();
          if (a.startsWith('sit:')) {
            sit = a.slice(4);
            try {
              sessionStorage.setItem('yuelao:sit', sit);
            } catch {}
            return render();
          }
          if (a === 'go') {
            const q = draftQ.replace(/\s+/g, ' ').trim();
            if ([...q].length < 2) return render('先寫下想問的事，一句話就好。');
            draftQ = q;
            cat = (SITS.find((x) => x.key === sit) || SITS[0]).cat;
            say(PICK_LINES[cat]);
            showShake();
          }
        },
        true,
      );
      // 每次重畫都重新接上輸入框（重畫會換一個新的 textarea）
      const ta = document.getElementById('ask-q');
      if (ta)
        ta.oninput = () => {
          draftQ = [...ta.value].slice(0, Q_MAX).join('');
          const n = document.getElementById('ask-n');
          if (n) n.textContent = `${[...draftQ].length}/${Q_MAX}`;
        };
    };
    render();
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

  // 今日一籤：每天一支、不用寫問題（DESIGN.md「今日一籤／今日一牌」）。
  // 不經過籤筒：搖籤儀式（籤號在掉籤落定才揭示）只屬於正式求籤，這裡是一張摺起來的籤條，點開來看。
  function dailySign() {
    state = 'daily';
    const d = dailyStick();
    say('今天替你留了一支。不用問，打開看看。');
    const show = (open) =>
      ui.panel(
        `<p class="kicker">今日一籤．${todayLabel()}</p>
         <div class="daily-slip${open ? ' open' : ''}" style="--energy:${d.color}">
           ${
             open
               ? `<p class="s-no">${d.stick.no}</p><p class="s-grade">${d.stick.grade}</p>
                  <p class="s-poem">${d.stick.poem.replace(/\n/g, '<br>')}</p>`
               : '<p class="s-fold">月老今日籤</p>'
           }
         </div>
         ${
           open
             ? `${d.plain ? `<p class="daily-line"><b>白話</b>${d.plain}</p>` : ''}
                ${d.love ? `<p class="daily-line"><b>放在姻緣裡</b>${d.love}</p>` : ''}
                <p class="note small">每天一支，今天再來還是這一支。想問具體的事，就正式求一支。</p>
                <button type="button" class="share-btn" data-a="share">存成今日運勢卡</button>
                <button class="seal" data-a="ask">想問一件具體的事</button>
                <button class="ghost" data-a="leave">回到廣場</button>`
             : `<button class="seal" data-a="open">打開今日一籤</button>`
         }`,
        (a) => {
          if (a === 'open') {
            audio.tick(1400, 0.12, 0.08);
            show(true);
            say(`${d.stick.no}，${d.stick.grade}。`);
            return;
          }
          if (a === 'share') {
            void shareDaily({
              kind: 'stick',
              title: '今日一籤',
              dateLabel: todayLabel(),
              name: d.stick.no,
              sub: d.stick.grade,
              poem: d.stick.poem,
              line: d.love || d.plain,
              color: d.color,
            }).then((r) => r === 'saved' && say('存好了，可以放進限時動態。'));
            return;
          }
          if (a === 'leave') return ui.leave();
          showPick();
        },
        true,
      );
    show(false);
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

  /** 判詞卡下方：白話、出處原意、放在姻緣裡怎麼讀（參考占了麼）。 */
  function explainBlock() {
    const x = STICK_PLAIN[stick.id];
    if (!x) return '';
    return `<section class="explain">
        <h3>白話</h3>
        <p>${x.plain}</p>
        ${stick.source ? `<p class="ex-src">出處．${stick.source}</p>` : ''}
        <h4>原句本來在說什麼</h4>
        <p class="ex-dim">${x.origin}</p>
        <h3>放在姻緣裡怎麼讀</h3>
        <blockquote>${x.love}</blockquote>
      </section>`;
  }
  // 依「現在的情況」開頭，讓開頭那一段讀起來就是在說你（參考占了麼）
  const SIT_LEAD = {
    single: '你還在等待對象，這支籤提醒的是：',
    crush: '你們還在曖昧，這支籤想讓你先看清楚：',
    dating: '你們正在交往，這支籤要說的是：',
    reunion: '你們已經分開，這支籤對複合的看法是：',
    married: '你們正談婚論嫁，這支籤提醒的是：',
  };
  /** 判詞下方直接接「解鎖完整解籤」：開頭一段漸淡、付款按鈕、七段目錄。 */
  function unlockBlock() {
    if (!ui.deep?.price) return '';
    const x = STICK_PLAIN[stick.id];
    const teaser = `${SIT_LEAD[sit] || ''}${x ? x.love : ''}${stick.verdict[cat]}`;
    return `<section class="unlock" id="unlock">
        <h3>解鎖完整解籤</h3>
        <p class="deep-teaser">${esc(teaser)}</p>
        <p class="unlock-note">這一段還沒說完。解鎖之後它會完整，另外六段只寫你問的那件事。</p>
        <button class="offer" id="deep-btn" data-a="deep">解鎖完整解籤　${ui.deep.price}</button>
        <ol class="deep-list">${DEEP_SECTIONS.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ol>
        ${yuelaoSampleHtml()}
        <p class="note small">付款即表示同意<a href="/terms" target="_blank" rel="noopener">服務條款</a>與<a href="/privacy" target="_blank" rel="noopener">隱私說明</a>。</p>
      </section>`;
  }
  function verdict() {
    state = 'verdict';
    ui.panel('');
    say('判詞寫好了，拿去看。往下還有白話和完整解籤。');
    const c = CATS.find((x) => x.key === cat);
    ui.card(
      `<div class="paper">
         <p class="p-cat${draftQ ? ' q' : ''}">${draftQ ? `問．${esc(draftQ)}` : `問．${c.word}`}</p>
         ${draftQ ? `<p class="p-sit">${sitWord()}</p>` : ''}
         <p class="p-no">${stick.no}</p>
         <h2 class="p-grade">${stick.grade}</h2>
         <p class="p-poem">${stick.poem.replace(/\n/g, '<br>')}</p>
         ${stick.source ? `<p class="p-src">籤詩出處：${stick.source}</p>` : ''}
         <i class="p-rule"></i>
         <p class="p-verdict">${stick.verdict[cat]}</p>
         <span class="p-seal">月老已批</span>
       </div>
       ${explainBlock()}
       ${unlockBlock()}
       <button type="button" class="share-btn" data-a="share">分享籤圖</button>
       <div class="card-actions"><button class="seal" data-a="again">再求一支</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      (a) => {
        if (a === 'share') {
          // 分享圖不放問的那句話（私事），只放籤、判詞與站名
          void shareVerdict({
            no: stick.no,
            grade: stick.grade,
            poem: stick.poem,
            source: stick.source,
            verdict: stick.verdict[cat],
            cat: c.word,
          }).then((r) => r === 'saved' && say('籤圖存好了，可以傳給朋友。'));
          return;
        }
        ui.card('');
        if (a === 'deep') {
          // 已經解鎖過就直接看／動筆；沒有就直接去付款（說明都在判詞下方，不另開一頁）
          if (deepState && deepState.state !== 'none') openDeep();
          else {
            state = 'deep';
            void pay();
          }
        } else if (a === 'leave') ui.leave();
        else showPick();
      },
    );
    refreshDeep();
  }

  // 深度解讀（付費）。金額、訂單、解鎖全在伺服器；這裡只負責問、等、帶路。
  let deepState = null; // 這支籤的解鎖狀態：{ state: 'ready'|'unlocked'|'none', body? }
  function refreshDeep() {
    deepState = null;
    if (!ui.deep) return;
    const id = stick.id;
    ui.deep.check(id, cat).then((r) => {
      if (state !== 'verdict' || stick.id !== id) return;
      deepState = r;
      const b = document.getElementById('deep-btn');
      if (b && r.state !== 'none')
        b.textContent = r.state === 'ready' ? '看完整解籤（已解鎖）' : '請月老動筆（已解鎖）';
    });
  }
  const backToCard = `<button class="ghost" data-a="card">回到判詞</button>`;
  const esc = (t) =>
    String(t).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  let draftQ = ''; // 想問的事：只放在這頁的記憶體與 sessionStorage，生成後清掉
  let deepRun = 0; // 每次開始等待／生成就換一個號碼，舊的輪詢看到號碼變了就停
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function openDeep() {
    state = 'deep';
    if (deepState?.state === 'ready') return showDeep(deepState.body);
    if (deepState?.state === 'unlocked') return startGenerate(draftQ);
    // 還沒解鎖：回到判詞，捲到下方的「解鎖完整解籤」
    verdict();
    setTimeout(
      () => document.getElementById('unlock')?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      80,
    );
  }

  // 完整解籤的七段（和伺服器要月老寫的段落一一對應，改了要一起改 packages/core/src/ai-reading.ts）
  const DEEP_SECTIONS = [
    ['這支籤對你這件事的定調', '往前、要等、看清楚，還是放下'],
    ['原典給你的提示', '原句裡那個處境和你的對應'],
    ['對著你的問題', '這一節只寫你問的那件事'],
    ['眼下該做與不該做', '具體到你這幾天的處境'],
    ['對方那一邊', '他可能在顧慮什麼（不猜心，只說可能）'],
    ['三天內可以做的一步', '一件小到今天就能開始的事'],
    ['留給你的一句話', '月老最後想對你說的'],
  ];
  async function pay() {
    say('稍等，我看看簿子。');
    ui.panel(`<p class="note" role="status">正在準備付款</p>`);
    const r = await ui.deep.buy(stick.id, cat);
    if (state !== 'deep') return;
    if (r.state === 'redirect') {
      ui.deep.save(stick.id, cat, 'pay', draftQ);
      say('隨我來。付完了回到這裡，我就動筆。');
      location.assign(r.url);
    } else if (r.state === 'login') {
      ui.deep.save(stick.id, cat, 'login', draftQ);
      say('先登入，我才記得這支籤是誰求的。');
      ui.panel(
        `<h2>登入後再請月老動筆</h2>
         <p class="note">登入完會回到月老殿，這支籤和你寫的話都還在。</p>
         <a class="seal linkbtn" href="/login">去登入</a>${backToCard}`,
        (a) => a === 'card' && verdict(),
      );
    } else if (r.state === 'owned') {
      startGenerate(draftQ);
    } else {
      say(r.state === 'closed' ? '完整解籤還沒開張，過些日子再來。' : '這會兒忙不過來，稍後再試一次。');
      ui.panel(
        `<p class="note">${r.state === 'closed' ? '付費的完整解籤尚未開放。免費的判詞照常可以看。' : '沒有扣款。可以稍後再試。'}</p>${backToCard}`,
        (a) => a === 'card' && verdict(),
      );
    }
  }

  /** 付款回來：等伺服器確認解鎖（Stripe 通知通常幾秒內到），確認了就直接動筆。 */
  async function waitPaid(question) {
    const run = ++deepRun;
    state = 'deep';
    say('你回來了。我核對一下簿子。');
    ui.panel(
      `<p class="kicker">${stick.no}　完整解籤</p><p class="note" role="status">正在確認付款，通常幾秒鐘。</p>`,
    );
    for (let i = 0; i < 45; i++) {
      const r = await ui.deep.check(stick.id, cat);
      if (run !== deepRun || state !== 'deep') return;
      if (r.state === 'ready') return showDeep(r.body);
      if (r.state === 'unlocked') return startGenerate(question);
      await sleep(2000);
      if (run !== deepRun || state !== 'deep') return;
    }
    say('付款的消息還沒傳到我這。');
    ui.panel(
      `<p class="kicker">${stick.no}　完整解籤</p>
       <p class="note">付款確認還沒到。不用重新付款，等一下再查；確認後解讀也會出現在「我的」。</p>
       <button class="seal" data-a="again">再查一次</button>${backToCard}`,
      (a) => (a === 'again' ? void waitPaid(question) : a === 'card' && verdict()),
    );
  }

  /** 已解鎖：請伺服器生成，寫好了直接在這裡看。 */
  async function startGenerate(question) {
    const run = ++deepRun;
    state = 'deep';
    say('我提筆了，稍候。');
    ui.panel(
      `<p class="kicker">${stick.no}　完整解籤</p><p class="note" role="status">月老正在批讀，大約半分鐘。</p>`,
    );
    const talking = setInterval(() => npc.talk(), 2600);
    npc.talk();
    try {
      // 把「現在的情況」一起帶給月老，解讀才會照著寫
      const asked = question ? `［${sitWord()}］${question}` : `［${sitWord()}］`;
      let status = await ui.deep.generate(stick.id, cat, asked);
      if (run !== deepRun || state !== 'deep') return;
      // 另一個分頁已經在寫：等它寫完
      for (let i = 0; status === 'processing' && i < 30; i++) {
        await sleep(3000);
        if (run !== deepRun || state !== 'deep') return;
        const r = await ui.deep.check(stick.id, cat);
        if (r.state === 'ready') return showDeep(r.body);
      }
      if (status === 'ready') {
        const r = await ui.deep.check(stick.id, cat);
        if (run !== deepRun || state !== 'deep') return;
        if (r.state === 'ready') {
          draftQ = '';
          return showDeep(r.body);
        }
        status = 'failed';
      }
      say('筆頭不順，再來一次。');
      ui.panel(
        `<p class="kicker">${stick.no}　完整解籤</p>
         <p class="note">這次沒寫成。你已經付過款，再試不會重複扣款。</p>
         <button class="seal" data-a="retry">再試一次</button>${backToCard}`,
        (a) => (a === 'retry' ? void startGenerate(question) : a === 'card' && verdict()),
      );
    } finally {
      clearInterval(talking);
    }
  }
  function showDeep(body) {
    state = 'deep';
    say('寫好了，慢慢看。');
    ui.panel(
      `<p class="kicker">${stick.no}　完整解籤</p><div class="deep-body" id="deep-body"></div>
       <p class="note small">這份解籤也存在「我的」，日後隨時能看。籤詩解讀供自我反思，不是預言。</p>${backToCard}`,
      (a) => a === 'card' && verdict(),
      true,
    );
    // 伺服器回來的內文只當純文字；【小標】那一行單獨成段，讀起來分得出段落
    const box = document.getElementById('deep-body');
    for (const block of String(body).split(/\n{2,}/)) {
      const text = block.trim();
      if (!text) continue;
      const p = document.createElement('p');
      const head = text.match(/^【[^】]{1,12}】/);
      if (head) {
        const b = document.createElement('b');
        b.textContent = head[0];
        p.appendChild(b);
        p.appendChild(document.createTextNode(text.slice(head[0].length).replace(/^\n/, '')));
      } else p.textContent = text;
      box.appendChild(p);
    }
  }

  const hall = {
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
      // 從登入或付款回來：接著剛才那支籤
      const back = ui.deep?.take();
      const kept = back && STICKS.find((x) => x.id === back.stickId);
      if (kept) {
        stick = kept;
        cat = back.category;
        draftQ = back.question || '';
        resetHero();
        if (back.why === 'pay') {
          // 付完款回來：不先秀判詞卡，直接等確認、動筆
          ui.card('');
          void waitPaid(draftQ);
          return;
        }
        verdict();
        if (back.why === 'ritual') {
          // 從一般版求籤頁按「深度解讀」過來：直接打開深度解讀
          ui.card('');
          openDeep();
          return;
        }
        say('你回來了。這支籤還在。');
        return;
      }
      showPick();
      say('來了。不急，心裡放著誰，先想清楚。');
    },
    exit() {
      deepRun++;
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
  return hall;
}
