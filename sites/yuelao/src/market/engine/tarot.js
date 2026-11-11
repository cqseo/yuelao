import * as THREE from 'three';
import { createNpc } from './npc.js';
import { audio, canvasTex, ease, FONT, glow, lerp, rand, tween, wait } from './util.js';

// 22 張大阿卡納。牌義是為感情問題寫的短解，樣片用，正式版需懂行的人審。
const CARDS = [
  ['愚者', '放下顧慮，先走出第一步；新的緣分從輕鬆的心開始。', '衝動多過準備，先想清楚自己要什麼，再往前。'],
  [
    '魔術師',
    '你手上的條件已經夠了，主動開口，事情會動起來。',
    '話說得漂亮但心意不足，留意是否有人只在表演。',
  ],
  [
    '女祭司',
    '答案在你心裡，安靜下來聽直覺；先觀察，不急著表態。',
    '你把感受藏得太深，對方猜不到；也別忽略已經看見的訊號。',
  ],
  ['皇后', '被好好照顧、也願意付出的時期，關係有溫度地成長。', '付出過頭或過度依賴，先把自己照顧好。'],
  ['皇帝', '需要穩定與承諾，把話講明、把界線立好。', '控制多過關心，僵持不下時先鬆手一步。'],
  ['教皇', '走向正式、被祝福的關係；聽一聽信得過的人的意見。', '別人的規矩不一定適合你們，照自己的步調。'],
  [
    '戀人',
    '心意相通，是一個要用心做的選擇；選了就全心投入。',
    '在兩個選項間搖擺，或價值觀不合，先對自己誠實。',
  ],
  ['戰車', '目標明確就往前衝，行動會帶來進展。', '方向不一致、用力過猛，先確認兩人是否同路。'],
  ['力量', '用溫柔而不是硬碰，耐心會讓對方靠近。', '信心不足或情緒壓不住，先安撫自己。'],
  ['隱者', '適合獨處整理，想清楚再回到關係裡。', '把自己關太久了，該走出來讓人靠近。'],
  ['命運之輪', '轉機出現，時機站在你這邊，順勢而為。', '時機未到，硬推不動；等這一輪轉過去。'],
  ['正義', '付出多少得到多少，把話說公平、說清楚。', '關係失衡，有人不願面對責任。'],
  ['倒吊人', '換個角度看，暫停不是失去；現在等比追有用。', '為不值得的事犧牲太久，該放下了。'],
  ['死神', '一個階段真正結束，結束之後才有新的開始。', '捨不得放手，拖著只會更累。'],
  ['節制', '慢慢調和，兩個人找到舒服的節奏。', '步調不合、過與不及，需要重新磨合。'],
  ['惡魔', '強烈的吸引，也可能是放不下的執著；看清是愛還是癮。', '開始掙脫束縛，離開不健康的牽絆。'],
  ['高塔', '突來的變動拆掉假象，痛，但讓你看見真實。', '危機在醞釀，早點面對比被動承受好。'],
  ['星星', '希望回來了，慢慢療癒；願望值得繼續相信。', '一時失去信心，別因為累就否定一切。'],
  ['月亮', '看不清、想太多的時候；別急著下結論，讓事情浮現。', '迷霧漸散，誤會有機會解開。'],
  ['太陽', '坦率、溫暖、開心在一起；好消息在路上。', '快樂打了折扣，或期待太高；回到單純的相處。'],
  ['審判', '舊事重提、舊人回來；這次要聽從內心的召喚做決定。', '逃避檢討，同樣的問題會再來一次。'],
  ['世界', '圓滿與完成，一段關係走到成熟；也可能迎向下一個階段。', '只差最後一步，還有一件事沒有收尾。'],
];
const ROMAN = [
  '0',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
  'XXI',
];
const SPREADS = {
  one: { n: 1, labels: ['指引'] },
  three: { n: 3, labels: ['過去', '現在', '未來'] },
};

const INK = '#231a4a';
const GOLD = '#b8893a';

function emblem(g, i, cx, cy, r) {
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = 3;
  const ring = (rad, w = 3) => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, rad, 0, 6.283);
    g.stroke();
  };
  const star = (n, r1, r2, fill) => {
    g.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const a = (k * Math.PI) / n - Math.PI / 2;
      const rr = k % 2 ? r2 : r1;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    fill ? g.fill() : g.stroke();
  };
  ring(r, 2);
  if (i === 18) {
    g.beginPath();
    g.arc(0, 0, r * 0.62, 0.5, 5.78);
    g.arc(r * 0.26, 0, r * 0.5, 5.4, 0.88, true);
    g.fill();
  } else if (i === 19) {
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(0, 0, r * 0.36, 0, 6.283);
    g.fill();
    g.strokeStyle = GOLD;
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46);
      g.lineTo(Math.cos(a) * r * (k % 2 ? 0.7 : 0.86), Math.sin(a) * r * (k % 2 ? 0.7 : 0.86));
      g.stroke();
    }
  } else if (i === 17) {
    g.fillStyle = GOLD;
    star(8, r * 0.78, r * 0.26, true);
  } else if (i === 6) {
    g.lineWidth = 4;
    for (const dx of [-0.24, 0.24]) {
      g.beginPath();
      g.arc(dx * r, 0, r * 0.44, 0, 6.283);
      g.stroke();
    }
  } else if (i === 10) {
    ring(r * 0.7, 4);
    ring(r * 0.16, 4);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16);
      g.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      g.stroke();
    }
  } else if (i === 16) {
    g.fillRect(-r * 0.2, -r * 0.45, r * 0.4, r * 1.05);
    g.strokeStyle = GOLD;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(r * 0.5, -r * 0.8);
    g.lineTo(r * 0.05, -r * 0.3);
    g.lineTo(r * 0.3, -r * 0.3);
    g.lineTo(-r * 0.1, r * 0.15);
    g.stroke();
  } else if (i === 11) {
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, -r * 0.6);
    g.lineTo(0, r * 0.6);
    g.moveTo(-r * 0.55, -r * 0.4);
    g.lineTo(r * 0.55, -r * 0.4);
    g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * r * 0.55, -r * 0.05, r * 0.2, 0, Math.PI);
      g.stroke();
    }
  } else if (i === 21) {
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(0, 0, r * 0.48, r * 0.74, 0, 0, 6.283);
    g.stroke();
    g.fillStyle = GOLD;
    star(4, r * 0.26, r * 0.1, true);
  } else {
    const n = 3 + (i % 6);
    g.lineWidth = 3;
    star(n, r * 0.76, r * (0.3 + (i % 3) * 0.08), false);
    g.fillStyle = GOLD;
    star(n, r * 0.3, r * 0.12, true);
  }
  g.restore();
}

function faceTex(i) {
  return canvasTex(320, 544, (g, w, h) => {
    g.fillStyle = '#f1e7d0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = GOLD;
    g.lineWidth = 2;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.font = `500 34px Georgia, "Times New Roman", serif`;
    g.fillText(ROMAN[i], w / 2, 78);
    emblem(g, i, w / 2, h / 2 - 12, 104);
    g.font = `900 46px ${FONT}`;
    const name = CARDS[i][0];
    g.fillText(name, w / 2, h - 62);
  });
}

function backTex() {
  return canvasTex(320, 544, (g, w, h) => {
    g.fillStyle = '#1d1547';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a25a';
    g.lineWidth = 4;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 1.5;
    g.strokeRect(26, 26, w - 52, h - 52);
    g.strokeStyle = 'rgba(201,162,90,.55)';
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 4; x++) {
        const cx = 62 + x * 65.5;
        const cy = 62 + y * 70;
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const r = k % 2 ? 7 : 20;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath();
        g.stroke();
      }
    g.fillStyle = '#c9a25a';
    g.beginPath();
    g.arc(w / 2, h / 2, 46, 0.5, 5.78);
    g.arc(w / 2 + 20, h / 2, 38, 5.4, 0.88, true);
    g.fill();
  });
}

// 塔羅館：帳內圓桌。流程：選牌陣 → 洗牌攤開 → 點選 → 翻牌 → 解讀。
export function createTarot(ui) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07051a);
  scene.fog = new THREE.FogExp2(0x0a0722, 0.05);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
  const HOME = new THREE.Vector3(0, 2.75, 2.05);
  const LOOK = new THREE.Vector3(0, 0.92, -0.2);
  // 進門先和塔羅師打照面，開始洗牌才低頭看桌面
  const GREET = new THREE.Vector3(0, 1.9, 2.6);
  const GREET_LOOK = new THREE.Vector3(0, 1.15, -1.2);
  const TOP = 0.96;

  scene.add(new THREE.HemisphereLight(0x8f86ff, 0x120a2a, 0.5));

  const tentTex = canvasTex(
    512,
    512,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#120c33');
      gr.addColorStop(1, '#2a1b5c');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 64) {
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(x, 0, 10, h);
      }
      g.fillStyle = '#d9b877';
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 1 + Math.random() * 2.2;
        g.globalAlpha = 0.3 + Math.random() * 0.6;
        g.beginPath();
        g.arc(x, y, r, 0, 6.283);
        g.fill();
      }
      g.globalAlpha = 1;
    },
    [4, 1],
  );
  const tent = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 6.2, 6, 40, 1, true),
    new THREE.MeshBasicMaterial({ map: tentTex, side: THREE.BackSide, fog: true }),
  );
  tent.position.y = 3;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(5.6, 2.6, 40, 1, true),
    new THREE.MeshBasicMaterial({ map: tentTex, side: THREE.BackSide }),
  );
  roof.position.y = 7.3;
  scene.add(tent, roof);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x150e30, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const clothTex = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#2b1a63';
    g.fillRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    g.strokeStyle = 'rgba(217,184,119,.55)';
    for (const [r, lw] of [
      [236, 3],
      [222, 1],
      [150, 1.5],
      [70, 1],
    ]) {
      g.lineWidth = lw;
      g.beginPath();
      g.arc(0, 0, r, 0, 6.283);
      g.stroke();
    }
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      g.beginPath();
      g.moveTo(Math.cos(a) * 150, Math.sin(a) * 150);
      g.lineTo(Math.cos(a) * 222, Math.sin(a) * 222);
      g.stroke();
    }
  });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.08, 64), [
    new THREE.MeshStandardMaterial({ color: 0x1c1145, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x1c1145 }),
  ]);
  table.position.y = TOP - 0.04;
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.95, 0.9, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1c1145, roughness: 0.95 }),
  );
  skirt.position.y = TOP - 0.5;
  scene.add(table, skirt);

  const flames = [];
  for (const [x, z] of [
    [-1.35, -0.75],
    [1.35, -0.75],
    [0, -1.5],
  ]) {
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.5 }),
    );
    c.position.set(x, TOP + 0.14, z);
    const f = glow(0xffc070, 0.42, 1);
    f.position.set(x, TOP + 0.36, z);
    const pl = new THREE.PointLight(0xffb070, 5.5, 6, 1.7);
    pl.position.set(x * 0.8, TOP + 0.7, z * 0.8);
    scene.add(c, f, pl);
    flames.push({ f, pl });
  }
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xb9c6ff,
      emissive: 0x3a2f9a,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.3,
    }),
  );
  ball.position.set(0, TOP + 0.25, -1.05);
  const bg = glow(0x8f7dff, 1.1, 0.5);
  bg.position.copy(ball.position);
  scene.add(ball, bg);
  const stars = [];
  for (let i = 0; i < 16; i++) {
    const s = glow(i % 3 ? 0xffd9a0 : 0xa99cff, rand(0.25, 0.5), 0.8);
    s.position.set(rand(-4, 4), rand(2.6, 5), rand(-4.5, 1));
    s.userData.ph = rand(6.28);
    scene.add(s);
    stars.push(s);
  }

  // deck
  const CW = 0.3;
  const CH = 0.51;
  const cardGeo = new THREE.BoxGeometry(CW, 0.006, CH);
  const edge = new THREE.MeshStandardMaterial({ color: 0xe8dcc0 });
  const back = new THREE.MeshStandardMaterial({ map: backTex(), roughness: 0.6 });
  const blank = new THREE.MeshStandardMaterial({ color: 0xf1e7d0, roughness: 0.7 });
  const DECK = new THREE.Vector3(-1.15, TOP, 0.35);
  const cards = CARDS.map((_, i) => {
    // +y is the back (deck lies face down), -y is the face
    const m = new THREE.Mesh(cardGeo, [edge, edge, back, blank, edge, edge]);
    m.userData.i = i;
    scene.add(m);
    return m;
  });

  let state = 'idle';
  let spread = SPREADS.three;
  let chosen = [];
  let flipped = 0;
  let hover = null;

  function stack() {
    cards.forEach((c, k) => {
      c.position.set(DECK.x, DECK.y + 0.004 + k * 0.0034, DECK.z);
      c.rotation.set(0, 0.25, 0);
      c.userData.sel = false;
      c.userData.rev = false;
      c.material = [edge, edge, back, blank, edge, edge];
    });
  }

  // 掌櫃：塔羅師坐在桌子另一頭
  const npc = createNpc('tarot');
  npc.root.position.set(0, 0, -2.0);
  npc.root.scale.setScalar(1.2);
  scene.add(npc.root);
  const npcLight = new THREE.PointLight(0xffe2c4, 5, 5, 1.6);
  npcLight.position.set(0, 2.3, -1.2);
  scene.add(npcLight);
  const say = (text) => {
    npc.talk();
    ui.say(npc.name, text);
  };

  function intro() {
    state = 'intro';
    camera.position.copy(GREET);
    camera.lookAt(GREET_LOOK);
    chosen = [];
    flipped = 0;
    stack();
    ui.hint('');
    ui.panel(
      `<h2>想清楚一件事，再抽牌</h2>
       <div class="choices">
         <button data-a="three"><b>三張</b><span>過去、現在、未來，看一件事的來龍去脈</span></button>
         <button data-a="one"><b>單張</b><span>只要一個指引</span></button>
       </div>`,
      (a) => {
        spread = SPREADS[a];
        shuffle();
      },
    );
  }

  async function shuffle() {
    state = 'shuffle';
    ui.panel('');
    ui.hint('');
    say('我來洗牌。你只管想著那件事。');
    const look = GREET_LOOK.clone();
    tween(
      1.1,
      (k) => {
        camera.position.lerpVectors(GREET, HOME, k);
        look.lerpVectors(GREET_LOOK, LOOK, k);
        camera.lookAt(look);
      },
      ease.inOut,
    );
    const order = cards.map((_, i) => i).sort(() => Math.random() - 0.5);
    for (let r = 0; r < 3; r++) {
      audio.tick(2600, 0.12, 0.2);
      await Promise.all(
        cards.map((c, k) => {
          const from = c.position.clone();
          const side = (k + r) % 2 ? 1 : -1;
          return tween(0.3, (t) => {
            const s = Math.sin(t * Math.PI);
            c.position.x = from.x + side * 0.26 * s;
            c.position.z = from.z + s * 0.05 * (k % 3);
          });
        }),
      );
    }
    // fan out along an arc
    const n = cards.length;
    await Promise.all(
      order.map((ci, k) => {
        const c = cards[ci];
        const a = lerp(-0.66, 0.66, k / (n - 1));
        const to = new THREE.Vector3(Math.sin(a) * 1.9, TOP + 0.004 + k * 0.0012, 1.42 - Math.cos(a) * 1.9);
        const from = c.position.clone();
        const ry = c.rotation.y;
        c.userData.fan = to;
        c.userData.fanRy = -a;
        return tween(
          0.55,
          (t) => {
            c.position.lerpVectors(from, to, t);
            c.position.y = lerp(from.y, to.y, t) + Math.sin(t * Math.PI) * 0.08;
            c.rotation.y = lerp(ry, -a, t);
          },
          ease.out,
          k * 0.035,
        ).then(() => k % 3 === 0 && audio.tick(3200, 0.05, 0.03));
      }),
    );
    state = 'choose';
    say('憑直覺，不要挑。');
    ui.hint(spread.n === 1 ? '憑直覺點一張牌' : `憑直覺點 ${spread.n} 張牌`);
  }

  function slot(k) {
    const n = spread.n;
    return new THREE.Vector3((k - (n - 1) / 2) * 0.46, TOP + 0.01, 0.2);
  }

  async function choose(c) {
    if (c.userData.sel || chosen.length >= spread.n) return;
    c.userData.sel = true;
    c.userData.rev = Math.random() < 0.35;
    const k = chosen.length;
    chosen.push(c);
    audio.tick(2400, 0.14, 0.06);
    const from = c.position.clone();
    const to = slot(k);
    const ry = c.rotation.y;
    ui.hint(chosen.length < spread.n ? `還要 ${spread.n - chosen.length} 張` : '');
    await tween(
      0.6,
      (t) => {
        c.position.lerpVectors(from, to, t);
        c.position.y = lerp(from.y, to.y, t) + Math.sin(t * Math.PI) * 0.22;
        c.rotation.y = lerp(ry, 0, t);
      },
      ease.out,
    );
    if (chosen.length === spread.n && state === 'choose') {
      state = 'flip';
      // the rest of the fan slides away
      for (const o of cards)
        if (!o.userData.sel) {
          const f = o.position.clone();
          tween(0.7, (t) => {
            o.position.z = f.z - t * 0.62;
            o.position.y = f.y;
          });
        }
      // lean in over the chosen cards
      const from = camera.position.clone();
      const to = HOME.clone().lerp(new THREE.Vector3(0, TOP + 0.5, 0.75), 0.42);
      const look = LOOK.clone();
      tween(1.1, (t) => {
        camera.position.lerpVectors(from, to, t);
        look.lerpVectors(LOOK, new THREE.Vector3(0, TOP, 0.12), t);
        camera.lookAt(look);
      });
      ui.hint('點牌，一張一張翻開');
      ui.panel(`<button class="seal" data-a="flip">翻開${spread.n > 1 ? '第一張' : ''}</button>`, () =>
        flipNext(),
      );
    }
  }

  async function flipNext() {
    if (state !== 'flip' || flipped >= chosen.length) return;
    const k = flipped++;
    const c = chosen[k];
    const face = new THREE.MeshStandardMaterial({ map: faceTex(c.userData.i), roughness: 0.65 });
    c.material = [edge, edge, back, face, edge, edge];
    audio.tick(1900, 0.2, 0.09);
    say(
      `${spread.n > 1 ? `${spread.labels[k]}，` : ''}${CARDS[c.userData.i][0]}${c.userData.rev ? '，逆位' : ''}。`,
    );
    const y0 = c.position.y;
    // face texture is drawn upright for a viewer at +z once the card is turned over about its long axis
    const endY = c.userData.rev ? 0 : Math.PI;
    await tween(
      0.7,
      (t) => {
        c.rotation.z = t * Math.PI;
        c.rotation.y = endY * t;
        c.position.y = y0 + Math.sin(t * Math.PI) * 0.3;
      },
      ease.inOut,
    );
    if (flipped < chosen.length) {
      ui.panel(`<button class="seal" data-a="flip">翻開第${'一二三'[flipped]}張</button>`, () => flipNext());
    } else {
      await wait(0.5);
      audio.bell(880, 0.12, 2.4);
      reading();
    }
  }

  function reading() {
    state = 'reading';
    say('牌說完了。它給的是方向，路還是你自己走。');
    ui.hint('');
    ui.panel(
      `<div class="reading">
        ${chosen
          .map((c, k) => {
            const [name, up, rev] = CARDS[c.userData.i];
            return `<article><p class="kicker">${spread.labels[k]}</p><h3>${name}<small>${c.userData.rev ? '逆位' : '正位'}</small></h3><p>${c.userData.rev ? rev : up}</p></article>`;
          })
          .join('')}
       </div>
       <div class="card-actions"><button class="seal" data-a="again">再抽一次</button><button class="ghost" data-a="leave">回到街上</button></div>`,
      (a) => (a === 'leave' ? ui.leave() : intro()),
      true,
    );
  }

  return {
    id: 'tarot',
    title: '塔羅館',
    scene,
    camera,
    enter() {
      const from = GREET.clone().add(new THREE.Vector3(0, -0.2, 2.2));
      camera.position.copy(from);
      camera.lookAt(GREET_LOOK);
      tween(
        1.6,
        (k) => {
          camera.position.lerpVectors(from, GREET, k);
          camera.lookAt(GREET_LOOK);
        },
        ease.out,
      );
      audio.bell(587, 0.14, 3.5);
      intro();
      say('請坐。想清楚一件事，牌才知道要說什麼。');
    },
    exit() {
      state = 'idle';
      ui.panel('');
      ui.hint('');
      ui.say('', '');
    },
    resize(aspect) {
      camera.fov = aspect < 0.8 ? 70 : aspect < 1.2 ? 58 : 46;
      // phones look from higher and further back so the whole fan fits the narrow screen
      if (aspect < 0.8) HOME.set(0, 4.5, 3.2);
      else if (aspect < 1.2) HOME.set(0, 3.4, 2.6);
      else HOME.set(0, 2.75, 2.05);
      // 手機畫面被底部面板往上推，打照面時鏡頭要抬高一點、站遠一點
      GREET.set(0, 1.9, aspect < 0.8 ? 3.4 : 2.6);
      GREET_LOOK.set(0, aspect < 0.8 ? 1.8 : 1.15, -1.2);
      camera.position.copy(state === 'intro' || state === 'idle' ? GREET : HOME);
      camera.lookAt(state === 'intro' || state === 'idle' ? GREET_LOOK : LOOK);
      camera.aspect = aspect;
    },
    pick: () => (state === 'choose' ? cards.filter((c) => !c.userData.sel) : state === 'flip' ? chosen : []),
    onDown(hit) {
      if (!hit) return;
      if (state === 'choose') choose(hit.object);
      else if (state === 'flip') flipNext();
    },
    onUp() {},
    onHover(hit) {
      hover = state === 'choose' && hit ? hit.object : null;
    },
    onShake() {},
    update(dt, t) {
      npc.update(dt, t);
      for (const { f, pl } of flames) {
        const fl = 0.9 + Math.sin(t * 12 + pl.position.x * 3) * 0.06 + Math.random() * 0.06;
        f.scale.setScalar(0.42 * fl);
        pl.intensity = 5.5 * fl;
      }
      for (const s of stars) s.material.opacity = 0.45 + Math.sin(t * 1.3 + s.userData.ph) * 0.35;
      bg.material.opacity = 0.5 + Math.sin(t * 1.7) * 0.12;
      if (state === 'choose')
        for (const c of cards)
          if (!c.userData.sel && c.userData.fan) {
            const lift = c === hover ? 0.05 : 0;
            c.position.y += (c.userData.fan.y + lift - c.position.y) * Math.min(1, dt * 12);
          }
    },
  };
}
