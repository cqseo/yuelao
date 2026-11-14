import * as THREE from 'three';
import { drawThree, flowLine, POSITION_DESC, POSITIONS, TONE_WORD } from '../../ritual/lenormand';
import { drawTarot, TAROT_POSITION_DESC, TAROT_POSITIONS } from '../../ritual/tarot';
import { createNpc } from './npc.js';
import { audio, canvasTex, ease, FONT, glow, lerp, rand, tween, wait } from './util.js';
import { SITS } from './yuelao.js';

// 兩副真牌（公有領域掃描，見 DESIGN.md）：
//   塔羅：偉特 1909 初版（Roses & Lilies 版）78 張 → /market/cards/rws/{img}.webp
//   雷諾曼：Hechtel《Das Spiel der Hofnung》1799 年 36 張 → /market/cards/lnm/{nn}.webp
const INK = '#231a4a';
const DECKS = {
  tarot: {
    name: '塔羅',
    count: 78,
    aspect: 0.569,
    desc: '78 張偉特塔羅（1909 初版牌面），看過去、現在、未來，有正逆位。',
  },
  lnm: {
    name: '雷諾曼',
    count: 36,
    aspect: 0.754,
    desc: '36 張雷諾曼（1799 年原版牌面），牌義固定，意思在三張的組合和順序裡。',
  },
};
const Q_MAX = 100;
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const imgUrl = (deck, d) =>
  deck === 'lnm'
    ? `/market/cards/lnm/${String(d.n).padStart(2, '0')}.webp`
    : `/market/cards/rws/${d.card.img}.webp`;

const loader = new THREE.TextureLoader();
const texCache = new Map();
/** 先載好要翻的那三張；載不到就用一張寫著牌名的素牌頂上。 */
function loadFace(url, name) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((done) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        done(t);
      },
      undefined,
      () =>
        done(
          canvasTex(320, 544, (g, w, h) => {
            g.fillStyle = '#efe4c8';
            g.fillRect(0, 0, w, h);
            g.fillStyle = INK;
            g.textAlign = 'center';
            g.font = `900 50px ${FONT}`;
            g.fillText(name, w / 2, h / 2);
          }),
        ),
    );
  });
  texCache.set(url, p);
  return p;
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
  const all = Array.from({ length: 78 }, (_, i) => {
    // +y is the back (deck lies face down), -y is the face
    const m = new THREE.Mesh(cardGeo, [edge, edge, back, blank, edge, edge]);
    m.userData.i = i;
    scene.add(m);
    return m;
  });
  let deck = 'tarot';
  try {
    deck = sessionStorage.getItem('yuelao:deck') === 'lnm' ? 'lnm' : 'tarot';
  } catch {}
  let cards = all;

  let state = 'idle';
  const N = 3;
  let drawn = [];
  let faces = [];
  let question = '';
  let day = today(); // 抽牌那天；付款回來重算同一組牌要用同一天
  function computeDrawn() {
    drawn =
      deck === 'lnm'
        ? drawThree(question, sit, day).map((c) => ({ ...c, card: c }))
        : drawTarot(question, sit, day);
    faces = drawn.map((d) => loadFace(imgUrl(deck, d), d.card.name));
  }
  let sit = 'single';
  try {
    sit = sessionStorage.getItem('yuelao:sit') || 'single';
  } catch {}
  const sitWord = () => (SITS.find((x) => x.key === sit) || SITS[0]).word;
  let chosen = [];
  let flipped = 0;
  let hover = null;

  function stack() {
    const D = DECKS[deck];
    cards = all.slice(0, D.count);
    const sz = CW / D.aspect / CH; // 兩副牌寬一樣，長度照原牌比例
    all.forEach((c, k) => {
      c.visible = k < D.count;
      c.scale.set(1, 1, sz);
    });
    cards.forEach((c, k) => {
      c.position.set(DECK.x, DECK.y + 0.004 + k * 0.0034, DECK.z);
      c.rotation.set(0, 0.25, 0);
      c.userData.sel = false;
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
    const render = (note = '') => {
      ui.panel(
        `<h2>你想問什麼</h2>
         <div class="chips decks">${Object.entries(DECKS)
           .map(
             ([k, d]) =>
               `<button type="button" data-a="deck:${k}" class="${k === deck ? 'on' : ''}"><b>${d.name}</b><small>${d.count} 張</small></button>`,
           )
           .join('')}</div>
         <p class="note small">${DECKS[deck].desc}</p>
         <label class="ask-q"><textarea id="ask-q" maxlength="${Q_MAX}" rows="3" placeholder="例：他最近忽冷忽熱，這段關係會怎麼走">${esc(question)}</textarea>
           <span class="ask-meta"><span>一件具體的事，說清楚一點</span><span id="ask-n">${[...question].length}/${Q_MAX}</span></span></label>
         <p class="kicker">你現在的情況</p>
         <div class="chips sits">${SITS.map(
           (x) =>
             `<button type="button" data-a="sit:${x.key}" class="${x.key === sit ? 'on' : ''}">${x.word}</button>`,
         ).join('')}</div>
         ${note ? `<p class="note" role="status">${note}</p>` : ''}
         <button class="seal" data-a="go">抽牌</button>
         <p class="note small">同一天問同一件事，抽到的永遠是同一組牌。</p>`,
        (a) => {
          if (a.startsWith('deck:')) {
            deck = a.slice(5) === 'lnm' ? 'lnm' : 'tarot';
            try {
              sessionStorage.setItem('yuelao:deck', deck);
            } catch {}
            stack();
            return render();
          }
          if (a.startsWith('sit:')) {
            sit = a.slice(4);
            try {
              sessionStorage.setItem('yuelao:sit', sit);
            } catch {}
            return render();
          }
          if (a === 'go') {
            const q = question.replace(/\s+/g, ' ').trim();
            if ([...q].length < 2) return render('先寫下想問的事，一句話就好。');
            question = q;
            day = today();
            // 洗牌的這幾秒先把三張牌面載好
            computeDrawn();
            shuffle();
          }
        },
        true,
      );
      const ta = document.getElementById('ask-q');
      if (ta)
        ta.oninput = () => {
          question = [...ta.value].slice(0, Q_MAX).join('');
          const n = document.getElementById('ask-n');
          if (n) n.textContent = `${[...question].length}/${Q_MAX}`;
        };
    };
    render();
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
    ui.hint('憑直覺點三張牌');
  }

  function slot(k) {
    const n = N;
    return new THREE.Vector3((k - (n - 1) / 2) * 0.5, TOP + 0.01, 0.2);
  }

  async function choose(c) {
    if (c.userData.sel || chosen.length >= N) return;
    c.userData.sel = true;
    const k = chosen.length;
    c.userData.card = drawn[k];
    chosen.push(c);
    audio.tick(2400, 0.14, 0.06);
    const from = c.position.clone();
    const to = slot(k);
    const ry = c.rotation.y;
    ui.hint(chosen.length < N ? `還要 ${N - chosen.length} 張` : '');
    await tween(
      0.6,
      (t) => {
        c.position.lerpVectors(from, to, t);
        c.position.y = lerp(from.y, to.y, t) + Math.sin(t * Math.PI) * 0.22;
        c.rotation.y = lerp(ry, 0, t);
        const sc = lerp(1, 1.5, t); // 選出來的牌放大，好看清原畫
        c.scale.x = sc;
        c.scale.z = sc * (CW / DECKS[deck].aspect / CH);
      },
      ease.out,
    );
    if (chosen.length === N && state === 'choose') {
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
      ui.panel(`<button class="seal" data-a="flip">翻開第一張</button>`, () => flipNext());
    }
  }

  async function flipNext() {
    if (state !== 'flip' || flipped >= chosen.length) return;
    const k = flipped++;
    const c = chosen[k];
    const d = c.userData.card;
    const tex = await faces[k];
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 });
    c.material = [edge, edge, back, face, edge, edge];
    audio.tick(1900, 0.2, 0.09);
    const pos = deck === 'lnm' ? POSITIONS : TAROT_POSITIONS;
    say(`${pos[k]}，${d.card.name}${deck === 'tarot' ? (d.rev ? '，逆位' : '，正位') : ''}。`);
    const y0 = c.position.y;
    // face texture is drawn upright for a viewer at +z once the card is turned over about its long axis
    const endY = d.rev ? 0 : Math.PI;
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
    say('三張連起來看。牌給的是方向，路還是你自己走。');
    ui.hint('');
    const thumbs = `<div class="spread">${drawn
      .map(
        (d) =>
          `<figure class="${deck}${d.rev ? ' rev' : ''}"><img src="${imgUrl(deck, d)}" alt="${d.card.name}" loading="lazy"></figure>`,
      )
      .join('')}</div>`;
    let body;
    if (deck === 'lnm') {
      const [a, b, c] = drawn;
      body = `${drawn
        .map(
          (d, k) => `<article><p class="kicker">${POSITIONS[k]}．${POSITION_DESC[k]}</p>
            <h3><i>${d.n}</i>${d.name}<small class="t-${d.tone}">${TONE_WORD[d.tone]}</small></h3>
            <p class="kws">${d.kw.map((w) => `<span>${w}</span>`).join('')}</p>
            <p><b>在這裡：</b>${d.pos[k]}</p>
            <p class="dim">感情裡，${d.love}</p></article>`,
        )
        .join('')}
        <article class="flow"><p class="kicker">三張連起來</p><p>${flowLine(a, b, c)}</p>
          <p class="dim">時間感：${c.name}，${c.pace}。</p></article>
        <p class="note small">雷諾曼的牌義是固定的，順序一換意思就變。同一天問同一件事，抽到的永遠是這一組。牌面為 1799 年《希望遊戲》原版。牌義屬文化體驗與自我認知參考，不代表現實預測。</p>`;
    } else {
      body = `${drawn
        .map(
          (d, k) => `<article><p class="kicker">${TAROT_POSITIONS[k]}．${TAROT_POSITION_DESC[k]}</p>
            <h3>${d.card.name}<small class="${d.rev ? 't-hard' : 't-good'}">${d.rev ? '逆位' : '正位'}</small></h3>
            <p class="kws">${d.card.kw.map((w) => `<span>${w}</span>`).join('')}</p>
            <p>${d.rev ? d.card.rev : d.card.up}</p></article>`,
        )
        .join('')}
        <p class="note small">同一天問同一件事，抽到的永遠是這一組。牌面為 1909 年偉特塔羅初版。牌義屬文化體驗與自我認知參考，不代表現實預測。</p>`;
    }
    ui.panel(
      `<div class="reading lnm">
        <p class="asked">問．${esc(question)}<span>${sitWord()}．${DECKS[deck].name}</span></p>
        ${ui.spread?.price ? `<button type="button" class="jump-unlock" data-a="jump">想把三張連起來看？完整解讀 ${ui.spread.price} ↓</button>` : ''}
        ${thumbs}
        ${body}
        ${unlockBlock()}
       </div>
       <div class="card-actions"><button class="seal" data-a="again">換一件事問</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      (x) => {
        if (x === 'jump') {
          // 不用 #unlock 錨點：集市用網址 hash 換房間
          document.getElementById('unlock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (x === 'deep') {
          // 已經解鎖就直接看／動筆；沒有就直接去付款（說明都在牌義下方，不另開一頁）
          if (deepState && deepState.state !== 'none') return openDeep();
          state = 'deep';
          return void pay();
        }
        if (x === 'leave') return ui.leave();
        question = '';
        intro();
      },
      true,
    );
    refreshDeep();
  }

  // ── 完整解讀（付費）。金額、訂單、解鎖全在伺服器；這裡只負責問、等、帶路。 ──
  // 七段和伺服器的寫法一一對應，改了要一起改 packages/core/src/spread-reading.ts
  const DEEP_SECTIONS = [
    ['三張牌湊在一起', '一句話說這三張在講什麼'],
    ['每一張落在這裡', '每張牌在它的位置上對這件事說什麼'],
    ['兩兩之間', '兩張放在一起，意思怎麼變'],
    ['對著你的問題', '這一節只寫你問的那件事'],
    ['眼下該做與不該做', '具體到你這幾天的處境'],
    ['時間上的提示', '大概多快、在哪個階段'],
    ['留給你的一句話', '塔羅師最後想對你說的'],
  ];
  let deepState = null; // { state: 'none'|'unlocked'|'ready', body? }
  let deepRun = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const deepTitle = () => `${DECKS[deck].name}．完整解讀`;
  async function spreadKey() {
    const ids =
      deck === 'lnm'
        ? drawn.map((d) => String(d.n).padStart(2, '0'))
        : drawn.map((d) => `${d.card.img}${d.rev ? '~' : ''}`);
    const src = `${day}|${sit}|${question.replace(/\s+/g, '')}`;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    const hex = [...new Uint8Array(buf)]
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${deck}:${ids.join(',')}|${hex}`;
  }
  function unlockBlock() {
    if (!ui.spread?.price) return '';
    const [a, b, c] = drawn;
    const teaser =
      deck === 'lnm'
        ? `${flowLine(a, b, c)}${c.love}`
        : `${a.card.name}、${b.card.name}、${c.card.name}放在一起看，${(c.rev ? c.card.rev : c.card.up).replace(/。$/, '')}，而這和你問的事有關的地方在於……`;
    return `<section class="unlock" id="unlock">
        <h3>解鎖完整解讀</h3>
        <p class="deep-teaser">${esc(teaser)}</p>
        <p class="unlock-note">上面是每張牌各自的意思。完整解讀把三張連起來，七段都只寫你問的那件事。</p>
        <button class="offer" id="deep-btn" data-a="deep">解鎖完整解讀　${ui.spread.price}</button>
        <p class="note small unlock-login" id="deep-login" hidden>需先登入（免費），登入完會回到這一把牌。</p>
        <ol class="deep-list">${DEEP_SECTIONS.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ol>
        <p class="note small">付款即表示同意<a href="/terms" target="_blank" rel="noopener">服務條款</a>與<a href="/privacy" target="_blank" rel="noopener">隱私說明</a>。</p>
      </section>`;
  }
  function refreshDeep() {
    deepState = null;
    if (!ui.spread) return;
    const run = deepRun;
    void spreadKey().then((key) =>
      ui.spread.check(key).then((r) => {
        if (state !== 'reading' || run !== deepRun) return;
        deepState = r;
        const btn = document.getElementById('deep-btn');
        if (btn && r.state !== 'none')
          btn.textContent = r.state === 'ready' ? '看完整解讀（已解鎖）' : '請塔羅師動筆（已解鎖）';
        const login = document.getElementById('deep-login');
        if (login) login.hidden = !r.guest;
      }),
    );
  }
  const backToReading = `<button class="ghost" data-a="back">回到牌面</button>`;
  const onBack = (a) => a === 'back' && reading();
  function openDeep() {
    state = 'deep';
    if (deepState?.state === 'ready') return showDeep(deepState.body);
    return startGenerate();
  }
  async function pay() {
    say('稍等，我準備一下。');
    ui.panel(`<p class="note" role="status">正在準備付款</p>`);
    const key = await spreadKey();
    const r = await ui.spread.buy(key);
    if (state !== 'deep') return;
    const keep = (why) => ui.spread.save({ deck, question, sit, day, why });
    if (r.state === 'redirect') {
      keep('pay');
      say('付完了回到這裡，牌還在桌上，我就動筆。');
      location.assign(r.url);
    } else if (r.state === 'login') {
      keep('login');
      say('先登入，我才記得這一把牌是誰抽的。');
      ui.panel(
        `<h2>登入後再請塔羅師動筆</h2>
         <p class="note">登入完會回到塔羅館，這一把牌和你寫的話都還在。</p>
         <a class="seal linkbtn" href="/login">去登入</a>${backToReading}`,
        onBack,
      );
    } else if (r.state === 'owned') {
      startGenerate();
    } else {
      say(r.state === 'closed' ? '完整解讀還沒開張，過些日子再來。' : '這會兒忙不過來，稍後再試一次。');
      ui.panel(
        `<p class="note">${r.state === 'closed' ? '付費的完整解讀尚未開放。牌義照常可以看。' : '沒有扣款。可以稍後再試。'}</p>${backToReading}`,
        onBack,
      );
    }
  }
  /** 付款回來：等伺服器確認解鎖（Stripe 通知通常幾秒內到），確認了就直接動筆。 */
  async function waitPaid() {
    const run = ++deepRun;
    state = 'deep';
    say('你回來了。我確認一下。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p><p class="note" role="status">正在確認付款，通常幾秒鐘。</p>`,
    );
    const key = await spreadKey();
    for (let i = 0; i < 45; i++) {
      const r = await ui.spread.check(key);
      if (run !== deepRun || state !== 'deep') return;
      if (r.state === 'ready') return showDeep(r.body);
      if (r.state === 'unlocked') return startGenerate();
      await sleep(2000);
      if (run !== deepRun || state !== 'deep') return;
    }
    say('付款的消息還沒傳到。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p>
       <p class="note">付款確認還沒到。不用重新付款，等一下再查。</p>
       <button class="seal" data-a="again">再查一次</button>${backToReading}`,
      (a) => (a === 'again' ? void waitPaid() : onBack(a)),
    );
  }
  /** 已解鎖：請伺服器動筆，寫好了直接在這裡看。 */
  async function startGenerate() {
    const run = ++deepRun;
    state = 'deep';
    say('我來把三張連起來看，稍候。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p><p class="note" role="status">塔羅師正在解讀，大約半分鐘。</p>`,
    );
    const talking = setInterval(() => npc.talk(), 2600);
    npc.talk();
    try {
      const key = await spreadKey();
      let status = await ui.spread.generate(key, question, sit);
      if (run !== deepRun || state !== 'deep') return;
      for (let i = 0; status === 'processing' && i < 30; i++) {
        await sleep(3000);
        if (run !== deepRun || state !== 'deep') return;
        const r = await ui.spread.check(key);
        if (r.state === 'ready') return showDeep(r.body);
      }
      if (status === 'ready') {
        const r = await ui.spread.check(key);
        if (run !== deepRun || state !== 'deep') return;
        if (r.state === 'ready') return showDeep(r.body);
        status = 'failed';
      }
      say('這次沒看成，再來一次。');
      ui.panel(
        `<p class="kicker">${deepTitle()}</p>
         <p class="note">這次沒寫成。你已經付過款，再試不會重複扣款。</p>
         <button class="seal" data-a="retry">再試一次</button>${backToReading}`,
        (a) => (a === 'retry' ? void startGenerate() : onBack(a)),
      );
    } finally {
      clearInterval(talking);
    }
  }
  function showDeep(body) {
    state = 'deep';
    say('寫好了，慢慢看。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p>
       <p class="asked deep-q">問．${esc(question)}</p>
       <div class="deep-body" id="deep-body"></div>
       <p class="note small">牌義解讀供自我反思，不是預言。</p>${backToReading}`,
      onBack,
      true,
    );
    // 伺服器回來的內文只當純文字；【小標】那一行單獨成段
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
  /** 付款／登入回來：桌上直接擺好那三張（已翻開），不再演洗牌。 */
  async function layOut() {
    stack();
    chosen = cards.slice(0, 3);
    flipped = 3;
    const sz = CW / DECKS[deck].aspect / CH;
    for (let k = 0; k < 3; k++) {
      const c = chosen[k];
      const d = drawn[k];
      c.userData.sel = true;
      c.userData.card = d;
      c.position.copy(slot(k));
      c.scale.set(1.5, 1, 1.5 * sz);
      c.rotation.set(0, d.rev ? 0 : Math.PI, Math.PI);
      faces[k].then((tex) => {
        c.material = [
          edge,
          edge,
          back,
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 }),
          edge,
          edge,
        ];
      });
    }
    for (const o of cards.slice(3)) o.visible = false;
    camera.position.copy(HOME.clone().lerp(new THREE.Vector3(0, TOP + 0.5, 0.75), 0.42));
    camera.lookAt(new THREE.Vector3(0, TOP, 0.12));
  }

  return {
    id: 'tarot',
    title: '塔羅館',
    scene,
    camera,
    enter() {
      const back = ui.spread?.take();
      const from = GREET.clone().add(new THREE.Vector3(0, -0.2, 2.2));
      camera.position.copy(from);
      camera.lookAt(GREET_LOOK);
      if (!back)
        tween(
          1.6,
          (k) => {
            camera.position.lerpVectors(from, GREET, k);
            camera.lookAt(GREET_LOOK);
          },
          ease.out,
        );
      audio.bell(587, 0.14, 3.5);
      // 從付款或登入回來：重算同一把牌、擺回桌上，接著剛才的解讀
      if (back) {
        deck = back.deck;
        question = back.question;
        sit = back.sit;
        day = back.day;
        computeDrawn();
        void layOut();
        if (back.why === 'pay') return void waitPaid();
        reading();
        say('你回來了。牌還在桌上。');
        return;
      }
      intro();
      say('請坐。先把想問的事寫下來，牌才知道要說什麼。');
    },
    exit() {
      deepRun++;
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
