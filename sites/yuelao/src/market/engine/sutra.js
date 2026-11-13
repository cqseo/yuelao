import * as THREE from 'three';
import {
  checkedInToday,
  checkIn,
  DAILY_FOCI,
  dailyReading,
  emptyDailyRecord,
  localDayKey,
  sanitizeDailyRecord,
} from '../../site/daily';
import { createNpc } from './npc.js';
import { audio, canvasTex, ease, FONT, textPlane, tween } from './util.js';

// 抄經閣：每日心箋搬進 3D。挑今天想照顧的一處 → 經師在宣紙上一筆一筆寫出今天的心箋 →
// 「收下・簽到」蓋上一方朱印。簽到紀錄與一般版 /daily 共用同一份本機紀錄（yuelao:daily:v1）。

const STORAGE_KEY = 'yuelao:daily:v1';
const FOCI = ['connection', 'communication', 'self', 'courage'];
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function loadRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeDailyRecord(JSON.parse(raw)) : emptyDailyRecord();
  } catch {
    return emptyDailyRecord();
  }
}

export function createSutra(ui) {
  const locale = document.documentElement.lang === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0906);
  scene.fog = new THREE.FogExp2(0x0d0906, 0.06);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);
  const HOME = new THREE.Vector3(0, 2.05, 2.7);
  const LOOK = new THREE.Vector3(0, 1.05, -1.0);
  const DESK = 0.72;

  scene.add(new THREE.HemisphereLight(0xffd9a8, 0x1a0f08, 0.45));

  // ---------- 房間：木板牆、竹簾窗、掛軸 ----------
  const plank = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#2a1a10';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 64) {
        g.fillStyle = x % 128 ? 'rgba(0,0,0,.18)' : 'rgba(255,220,170,.04)';
        g.fillRect(x, 0, 64, h);
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.fillRect(x, 0, 3, h);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1, 6 + Math.random() * 30);
      }
    },
    [3, 1],
  );
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(9, 5, 9),
    new THREE.MeshStandardMaterial({ map: plank, side: THREE.BackSide, roughness: 0.95 }),
  );
  room.position.y = 2.5;
  scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ color: 0x1b120b, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);
  // 蒲團
  const mat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.45, 0.12, 28),
    new THREE.MeshStandardMaterial({ color: 0x6b1a14, roughness: 0.9 }),
  );
  mat.position.set(0, 0.06, -1.55);
  scene.add(mat);

  // 掛軸：一個「靜」字
  const scroll = new THREE.Group();
  const scrollPaper = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 }),
  );
  const word = textPlane('靜', 0.8, { fg: '#1d140c', weight: 700 });
  word.position.z = 0.01;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a2412 }),
  );
  rod.rotation.z = Math.PI / 2;
  const rodTop = rod.clone();
  rod.position.y = -1.22;
  rodTop.position.y = 1.22;
  scroll.add(scrollPaper, word, rod, rodTop);
  scroll.position.set(0, 2.55, -4.45);
  scene.add(scroll);
  // 兩側竹簾窗，透一點月光
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.8),
      new THREE.MeshBasicMaterial({
        map: canvasTex(128, 256, (g, w, h) => {
          g.fillStyle = '#0f1a2e';
          g.fillRect(0, 0, w, h);
          for (let y = 0; y < h; y += 7) {
            g.fillStyle = 'rgba(200,170,110,.55)';
            g.fillRect(0, y, w, 4);
          }
        }),
        transparent: true,
        opacity: 0.85,
      }),
    );
    win.position.set(s * 2.6, 2.4, -4.44);
    scene.add(win);
  }

  // ---------- 書案：宣紙、硯台、筆、燭 ----------
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.6 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.1), wood);
  desk.position.set(0, DESK - 0.04, -0.35);
  scene.add(desk);
  for (const [x, z] of [
    [-1.08, -0.82],
    [1.08, -0.82],
    [-1.08, 0.12],
    [1.08, 0.12],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, DESK - 0.08, 0.08), wood);
    leg.position.set(x, (DESK - 0.08) / 2, z);
    scene.add(leg);
  }

  // 宣紙：直式，字由右往左一行一行寫上去
  const PW = 512;
  const PH = 720;
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = PW;
  paperCanvas.height = PH;
  const pg = paperCanvas.getContext('2d');
  const paperTex = new THREE.CanvasTexture(paperCanvas);
  paperTex.colorSpace = THREE.SRGBColorSpace;
  paperTex.anisotropy = 4;
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.64, 0.9),
    new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95 }),
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, DESK + 0.002, -0.32);
  scene.add(paper);

  const seal = textPlane('月老', 0.13, {
    bg: '#a8241a',
    fg: '#f3dfc0',
    border: '#f3dfc0',
    size: 110,
    weight: 700,
  });
  seal.rotation.x = -Math.PI / 2;
  seal.position.set(-0.2, DESK + 0.004, 0.02);
  seal.visible = false;
  scene.add(seal);

  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.11, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 }),
  );
  stone.position.set(0.7, DESK + 0.02, -0.55);
  scene.add(stone);
  const brush = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 0.6 }),
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.02, 0.07, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
  );
  tip.rotation.z = Math.PI;
  tip.position.y = -0.245;
  brush.add(shaft, tip);
  const BRUSH_REST = new THREE.Vector3(0.55, DESK + 0.02, -0.12);
  brush.position.copy(BRUSH_REST);
  brush.rotation.set(0, 0.3, Math.PI / 2);
  scene.add(brush);

  const flames = [];
  for (const s of [-1, 1]) {
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0xb3261c, roughness: 0.5 }),
    );
    candle.position.set(s * 1.0, DESK + 0.11, -0.7);
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc070 }),
    );
    f.scale.y = 1.8;
    f.position.set(s * 1.0, DESK + 0.27, -0.7);
    const pl = new THREE.PointLight(0xffb060, 3.2, 4.5, 1.6);
    pl.position.copy(f.position);
    scene.add(candle, f, pl);
    flames.push({ f, pl });
  }

  // 掌櫃：經師坐在書案後
  const npc = createNpc('keeper');
  npc.name = '經師';
  npc.root.position.set(0, 0, -1.55);
  npc.root.scale.setScalar(1.05);
  scene.add(npc.root);
  const say = (text) => {
    npc.talk();
    ui.say(npc.name, text);
  };

  // ---------- 紙上的字 ----------
  function blankPaper() {
    pg.fillStyle = '#efe4c8';
    pg.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 2600; i++) {
      pg.fillStyle = `rgba(120,90,50,${Math.random() * 0.06})`;
      pg.fillRect(Math.random() * PW, Math.random() * PH, 1 + Math.random() * 2, 1);
    }
    pg.strokeStyle = 'rgba(168,36,26,.35)';
    pg.lineWidth = 2;
    pg.strokeRect(22, 22, PW - 44, PH - 44);
  }
  /** 直書：每行最多 rowMax 字，由右往左；回傳每個字的位置，給逐字顯示用。 */
  function layout(title, verse) {
    const glyphs = [];
    const size = 44;
    const rowMax = 13;
    let x = PW - 70;
    const titleSize = 58;
    for (const [i, ch] of [...title].entries())
      glyphs.push({ ch, x, y: 80 + i * titleSize * 1.08, size: titleSize, color: '#1d140c' });
    x -= titleSize + 34;
    const lines = verse.split(/\n+/).flatMap((line) => {
      const chars = [...line.replace(/\s+/g, '')];
      const out = [];
      for (let i = 0; i < chars.length; i += rowMax) out.push(chars.slice(i, i + rowMax));
      return out;
    });
    for (const line of lines) {
      if (x < 60) break;
      for (const [i, ch] of line.entries())
        glyphs.push({ ch, x, y: 90 + i * size * 1.12, size, color: '#2a1d12' });
      x -= size + 22;
    }
    return glyphs;
  }
  function drawGlyphs(glyphs, n) {
    blankPaper();
    pg.textAlign = 'center';
    pg.textBaseline = 'middle';
    for (let i = 0; i < n && i < glyphs.length; i++) {
      const g = glyphs[i];
      pg.font = `700 ${g.size}px ${FONT}`;
      pg.fillStyle = g.color;
      pg.fillText(g.ch, g.x, g.y);
    }
    paperTex.needsUpdate = true;
  }

  // ---------- 流程 ----------
  let record = emptyDailyRecord();
  let focus = null;
  let run = 0;

  const today = () => localDayKey(new Date());
  function streakNow() {
    if (checkedInToday(record, today())) return record.streak;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return record.lastDate === localDayKey(y) ? record.streak : 0;
  }
  function stampsHtml() {
    const s = streakNow();
    return `<div class="stamps" aria-label="七日簽到">${[1, 2, 3, 4, 5, 6, 7]
      .map((d) => `<span class="${d <= Math.min(s, 7) ? 'on' : ''}">${d}</span>`)
      .join('')}<b>連續 ${s} 日</b></div>`;
  }

  function choose() {
    ui.panel(
      `<p class="kicker">抄經閣　每日心箋</p>
       <h2>今天想照顧的是</h2>
       <div class="chips">${FOCI.map(
         (k) => `<button type="button" data-a="focus:${k}">${esc(DAILY_FOCI[k].label[locale])}</button>`,
       ).join('')}</div>
       ${stampsHtml()}
       <p class="note small">一頁心情提示，不是命運預測。簽到只記在這台裝置的瀏覽器裡。</p>
       <button class="ghost" data-a="leave">回到廣場</button>`,
      (a) => {
        if (a === 'leave') return ui.leave();
        if (a.startsWith('focus:')) void write(a.slice(6));
      },
      true,
    );
  }

  async function write(key) {
    const my = ++run;
    focus = key;
    const r = dailyReading(today(), key, locale);
    const glyphs = layout(r.name, r.verse);
    seal.visible = checkedInToday(record, today());
    say('磨好墨了，我替你寫。');
    ui.panel(`<p class="kicker">抄經閣　每日心箋</p><p class="note" role="status">經師正在寫……</p>`);
    audio.tick?.(420, 0.04, 0.03);
    // 筆從硯台提起，沿著紙走
    const from = brush.position.clone();
    await tween(
      0.5,
      (k) => brush.position.lerpVectors(from, new THREE.Vector3(0.1, DESK + 0.18, -0.6), k),
      ease.out,
    );
    const dur = Math.min(3.2, 0.9 + glyphs.length * 0.05);
    await tween(
      dur,
      (k) => {
        if (my !== run) return;
        const n = Math.ceil(k * glyphs.length);
        drawGlyphs(glyphs, n);
        const g = glyphs[Math.max(0, n - 1)];
        if (g) {
          brush.position.x = (g.x / PW - 0.5) * 0.64;
          brush.position.z = -0.32 - (0.5 - g.y / PH) * 0.9;
          brush.position.y = DESK + 0.17 + Math.sin(k * 60) * 0.008;
        }
      },
      ease.lin,
    );
    if (my !== run) return;
    drawGlyphs(glyphs, glyphs.length);
    const lift = brush.position.clone();
    await tween(0.5, (k) => brush.position.lerpVectors(lift, BRUSH_REST, k), ease.out);
    show(r);
  }

  function show(r) {
    const done = checkedInToday(record, today());
    say(done ? '今天已經收過了。字還在，慢慢看。' : '寫好了。收下，就算今天來過。');
    ui.panel(
      `<p class="kicker">今日心箋　${esc(r.focus)}</p>
       <h2>${esc(r.name)}</h2>
       <div class="deep-body"><p><b>${esc(r.verse)}</b></p><p>${esc(r.insight)}</p>
       <p><b>今天可以做的一件小事</b>${esc(r.action)}</p></div>
       ${stampsHtml()}
       ${done ? '<p class="note">今日已簽到。明天再來，紅線又多一寸。</p>' : '<button class="seal" data-a="sign">收下・簽到</button>'}
       <div class="card-links"><button class="ghost" data-a="again">換一處</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      (a) => {
        if (a === 'sign') void sign(r);
        else if (a === 'again') choose();
        else if (a === 'leave') ui.leave();
      },
      true,
    );
  }

  async function sign(r) {
    const next = checkIn(record, today());
    record = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    ui.emit?.('daily_checkin', { streak: next.streak, focus });
    seal.visible = true;
    seal.scale.setScalar(1.8);
    audio.bell?.(523, 0.16, 3);
    await tween(0.35, (k) => seal.scale.setScalar(1.8 - 0.8 * k), ease.back);
    show(r);
    say(next.streak > 1 ? `連著第 ${next.streak} 天了。明天再來。` : '收好了。明天再來，紅線又多一寸。');
  }

  return {
    id: 'sutra',
    title: '抄經閣',
    scene,
    camera,
    enter() {
      record = loadRecord();
      blankPaper();
      paperTex.needsUpdate = true;
      seal.visible = false;
      brush.position.copy(BRUSH_REST);
      const from = HOME.clone().add(new THREE.Vector3(0, 0.2, 1.8));
      camera.position.copy(from);
      camera.lookAt(LOOK);
      tween(
        1.4,
        (k) => {
          camera.position.lerpVectors(from, HOME, k);
          camera.lookAt(LOOK);
        },
        ease.out,
      );
      audio.bell?.(440, 0.12, 3);
      choose();
      say(
        checkedInToday(record, today())
          ? '今天來過了。想再看看，就挑一處。'
          : '來抄一張心箋。今天，想照顧哪一處？',
      );
    },
    exit() {
      run++;
      ui.panel('');
      ui.say('', '');
    },
    resize(aspect) {
      camera.fov = aspect < 0.8 ? 70 : aspect < 1.2 ? 58 : 48;
      // 手機底部有面板：站遠、抬高，讓經師的臉和掛軸不被頂欄蓋住
      if (aspect < 0.8) {
        HOME.set(0, 3.0, 3.3);
        LOOK.set(0, 0.55, -0.7);
      } else if (aspect < 1.2) {
        HOME.set(0, 2.25, 3.0);
        LOOK.set(0, 1.2, -1.0);
      } else {
        HOME.set(0, 2.05, 2.7);
        LOOK.set(0, 1.05, -1.0);
      }
      camera.position.copy(HOME);
      camera.lookAt(LOOK);
      camera.aspect = aspect;
    },
    pick: () => [],
    onDown() {},
    onUp() {},
    onShake() {},
    update(dt, t) {
      npc.update(dt, t);
      for (const { f, pl } of flames) {
        const fl = 0.9 + Math.sin(t * 11 + f.position.x * 3) * 0.06 + Math.random() * 0.05;
        f.scale.set(fl, 1.8 * fl, fl);
        pl.intensity = 3.2 * fl;
      }
    },
  };
}
