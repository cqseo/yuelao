import * as THREE from 'three';
import { CAI_STICKS, caiStickByNo } from '../../ritual/caishen';
import { createNpc } from './npc.js';
import { shareCai } from './share.js';
import { buildCaishen } from './shrine.js';
import { audio, canvasTex, ease, glow, textPlane, tween } from './util.js';

// 財神殿．求財籤（站長 2026-11-19）：選事業或財運 → 上香 → 搖籤筒 → 跳出一支 → 看籤（免費）；
// 想要針對問題的完整解籤就付費（cai_1），付款、生成、讀取和塔羅館、算命攤同一套
// （packages/core/src/spread-reading.ts 的 CAI_INSTRUCTIONS；籤內容 ritual/caishen.ts，本站原創）。
// 問題只在本機與生成那一次請求裡用；識別字串只有籤號、主題與雜湊。

const Q_MAX = 100;
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const GRADE_CLASS = { 上上: 't-good', 上吉: 't-good', 中吉: 't-mid', 中平: 't-mid', 下籤: 't-hard' };
// 和伺服器 CAI_INSTRUCTIONS 的六節一一對應
const DEEP_SECTIONS = [
  ['這支籤在說什麼', '白話把籤詩說清楚'],
  ['落在你的事', '工作或錢現在的處境'],
  ['可以做與先別做', '這幾週能做的事'],
  ['對著你的問題', '這一節只寫你問的那件事'],
  ['時機', '快慢與階段'],
  ['財神爺的一句話', '最後想對你說的'],
];

async function caiKey(no, topic, question, day) {
  const src = `${day}|${topic}|${no}|${question.replace(/\s+/g, '')}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
  const hex = [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cai:${String(no).padStart(3, '0')}_${topic === 'career' ? 'c' : 'w'}|${hex}`;
}
function pickStick() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % CAI_STICKS.length) + 1;
}

export function createCaishen(ui) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120806);
  scene.fog = new THREE.FogExp2(0x120806, 0.05);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);
  const HOME = new THREE.Vector3(0, 2.1, 3.0);
  const LOOK = new THREE.Vector3(0, 1.3, -1.2);
  const DESK = 0.8;
  scene.add(new THREE.HemisphereLight(0xffd8a0, 0x1a0c08, 0.75));
  const spot = new THREE.SpotLight(0xffe0a0, 16, 9, 0.5, 0.6, 1.4);
  spot.position.set(0, 4.6, -0.8);
  spot.target.position.set(0, 1.8, -3.7);
  scene.add(spot, spot.target);

  // ---------- 殿內：紅牆、金字對聯、財神像 ----------
  const wall = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#4a120d';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(224,184,90,.08)';
      for (let y = 0; y < h; y += 64)
        for (let x = (y / 64) % 2 ? 32 : 0; x < w; x += 64) g.fillRect(x + 20, y + 20, 24, 24);
    },
    [3, 1],
  );
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(9, 5.5, 9),
    new THREE.MeshStandardMaterial({ map: wall, side: THREE.BackSide, roughness: 0.95 }),
  );
  room.position.y = 2.75;
  scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ color: 0x1c0f0a, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);
  ['財源廣進', '福祿綿長'].forEach((t, i) => {
    const p = textPlane(t, 1.7, { vertical: true, bg: '#8a1a14', fg: '#f1d79a', size: 96, weight: 700 });
    p.position.set(i ? -2.3 : 2.3, 2.4, -4.44);
    scene.add(p);
  });
  const altar = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.9, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x3b1a10, roughness: 0.6 }),
  );
  altar.position.set(0, 0.45, -3.6);
  scene.add(altar);
  const god = buildCaishen();
  god.scale.setScalar(1.15);
  god.position.set(0, 0.9, -3.7);
  scene.add(god);
  const halo = glow(0xffcc66, 2.6, 0.35);
  halo.position.set(0, 2.9, -3.9);
  scene.add(halo);

  // ---------- 供桌：香爐、籤筒、元寶 ----------
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.6 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.1), wood);
  desk.position.set(0, DESK - 0.04, -0.6);
  scene.add(desk);
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 0.7, 1.14),
    new THREE.MeshStandardMaterial({ color: 0xa3201a, roughness: 0.9 }),
  );
  cloth.position.set(0, DESK - 0.42, -0.6);
  scene.add(cloth);
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe0b85a,
    emissive: 0x5a3a08,
    roughness: 0.35,
    metalness: 0.6,
  });
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.22, 20), gold);
  burner.position.set(-0.6, DESK + 0.11, -0.7);
  scene.add(burner);
  const incense = [];
  for (let k = 0; k < 3; k++) {
    const st = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.36, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a3a1a }),
    );
    st.position.set(-0.64 + k * 0.04, DESK + 0.36, -0.7);
    st.visible = false;
    const tip = glow(0xff7030, 0.08, 0.95);
    tip.position.set(-0.64 + k * 0.04, DESK + 0.54, -0.7);
    tip.visible = false;
    scene.add(st, tip);
    incense.push(st, tip);
  }
  const tube = new THREE.Group();
  const tubeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.11, 0.42, 18),
    new THREE.MeshStandardMaterial({ color: 0x7a1a12, roughness: 0.6 }),
  );
  tube.add(tubeBody);
  const sticks = [];
  for (let k = 0; k < 12; k++) {
    const st = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.5, 0.006),
      new THREE.MeshStandardMaterial({ color: 0xd9b06a, roughness: 0.6 }),
    );
    const a = (k / 12) * Math.PI * 2;
    st.position.set(Math.cos(a) * 0.06, 0.18, Math.sin(a) * 0.06);
    st.rotation.z = Math.cos(a) * 0.08;
    tube.add(st);
    sticks.push(st);
  }
  tube.position.set(0.5, DESK + 0.21, -0.55);
  scene.add(tube);
  const chosen = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.56, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xf1d38c, roughness: 0.5 }),
  );
  chosen.visible = false;
  scene.add(chosen);
  let label = null;
  for (const [x, z] of [
    [-0.15, -0.35],
    [0.05, -0.25],
    [-0.05, -0.45],
  ]) {
    const ing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.07, 16), gold);
    ing.scale.z = 0.6;
    ing.position.set(x, DESK + 0.035, z);
    scene.add(ing);
  }
  const lights = [];
  for (const s of [-1, 1]) {
    const pl = new THREE.PointLight(0xffa050, 4.5, 7, 1.6);
    pl.position.set(s * 1.8, 2.6, -2.2);
    scene.add(pl);
    lights.push(pl);
  }

  // 廟公站在供桌旁
  const npc = createNpc('keeper');
  npc.name = '廟公';
  npc.root.position.set(1.6, 0, -1.5);
  npc.root.rotation.y = -0.5;
  scene.add(npc.root);
  const say = (text) => {
    npc.talk();
    ui.say(npc.name, text);
  };

  // ---------- 流程 ----------
  const api = ui.cai;
  let state = 'idle';
  let topic = 'wealth';
  const sit = ''; // 財神殿不問感情狀態
  let question = '';
  let no = 0;
  let day = '';
  let key = '';
  let deepState = null;
  let deepRun = 0;
  let shaking = 0;
  const stick = () => caiStickByNo(no);
  const topicWord = () => (topic === 'career' ? '事業' : '財運');

  function resetProps() {
    chosen.visible = false;
    for (const o of incense) o.visible = false;
    if (label) {
      scene.remove(label);
      label = null;
    }
  }

  function intro(note = '') {
    state = 'intro';
    resetProps();
    ui.panel(
      `<h2>求一支財神籤</h2>
       <p class="note small">先選要問哪方面，可以寫下想問的事。上香後搖籤筒，財神爺給你一支籤。</p>
       <div class="chips decks">
         <button type="button" data-a="t:wealth" class="${topic === 'wealth' ? 'on' : ''}"><b>財運</b><small>收入、用錢、守財</small></button>
         <button type="button" data-a="t:career" class="${topic === 'career' ? 'on' : ''}"><b>事業</b><small>工作、升遷、合作</small></button>
       </div>
       <label class="ask-q"><textarea id="c-q" maxlength="${Q_MAX}" rows="2" placeholder="想問的事（選填），例：${topic === 'career' ? '明年適合換工作嗎' : '這半年怎麼存得下錢'}">${esc(question)}</textarea>
         <span class="ask-meta"><span>完整解籤會針對這一句寫</span><span id="c-n">${[...question].length}/${Q_MAX}</span></span></label>
       ${note ? `<p class="note" role="status">${note}</p>` : ''}
       <button class="seal" data-a="go">上香求籤</button>
       <p class="note small">求財籤是本站原創籤詩，供文化體驗與自我反思，不構成投資或職業建議。</p>`,
      (a) => {
        const ta = document.getElementById('c-q');
        if (ta) question = [...ta.value.replace(/\s+/g, ' ').trim()].slice(0, Q_MAX).join('');
        if (a.startsWith('t:')) {
          topic = a.slice(2) === 'career' ? 'career' : 'wealth';
          return intro();
        }
        if (a === 'go') void draw();
      },
      true,
    );
    const ta = document.getElementById('c-q');
    if (ta)
      ta.oninput = () => {
        const n = document.getElementById('c-n');
        if (n) n.textContent = `${[...ta.value].length}/${Q_MAX}`;
      };
  }

  async function draw() {
    state = 'drawing';
    ui.panel(`<p class="kicker">財神殿</p><p class="note" role="status">上香，搖籤……</p>`);
    ui.emit?.('ritual_begin', { kind: 'cai', topic });
    say('心裡默念想問的事，我來搖。');
    for (const o of incense) o.visible = true;
    audio.bell?.(392, 0.12, 2.5);
    no = pickStick();
    day = today();
    key = await caiKey(no, topic, question, day);
    shaking = 1;
    await Promise.race([tween(1.6, () => {}, ease.lin), sleep(2200)]);
    shaking = 0;
    tube.rotation.set(0, 0, 0);
    showChosen();
    audio.bell?.(523, 0.14, 3);
    await sleep(600);
    show();
  }
  function showChosen() {
    chosen.position.set(tube.position.x, tube.position.y + 0.3, tube.position.z);
    chosen.visible = true;
    tween(0.6, (k) => chosen.position.setY(tube.position.y + 0.3 + 0.32 * k), ease.out);
    if (label) scene.remove(label);
    label = textPlane(`第${no}籤`, 0.16, { bg: '#a8241a', fg: '#f3dfc0', size: 90, weight: 700 });
    label.position.set(tube.position.x, tube.position.y + 0.95, tube.position.z);
    scene.add(label);
  }

  function unlockBlock() {
    if (!api?.price) return '';
    const s = stick();
    const q = [...question];
    const asked = question
      ? `你問「${q.length > 22 ? `${q.slice(0, 22).join('')}…` : question}」。`
      : `你問的是${topicWord()}。`;
    const teaser = `${asked}第${s.no}籤${s.grade}，「${s.poem[0]}」。落在你這件事上，最要緊的其實是……`;
    return `<section class="unlock" id="unlock">
        <h3>解鎖完整解籤</h3>
        <p class="deep-teaser">${esc(teaser)}</p>
        <p class="unlock-note">上面是籤本身的意思。完整解籤把籤詩對到你的${topicWord()}${question ? '和你問的那件事' : ''}，六段寫給你。不構成投資或職業建議。</p>
        <button class="offer" id="deep-btn" data-a="deep">解鎖完整解籤　${api.price}</button>
        <p class="note small unlock-login" id="deep-login" hidden>需先登入（免費），登入完會回到這支籤。</p>
        <ol class="deep-list">${DEEP_SECTIONS.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ol>
        <p class="note small">付款即表示同意<a href="/terms" target="_blank" rel="noopener">服務條款</a>與<a href="/privacy" target="_blank" rel="noopener">隱私說明</a>。</p>
      </section>`;
  }

  function show() {
    if (state !== 'result' && state !== 'deep') ui.emit?.('reading_done', { kind: 'cai', topic });
    state = 'result';
    const s = stick();
    say(`第${s.no}籤，${s.grade}。${s.plain}`);
    const main = topic === 'career' ? ['事業', s.career] : ['財運', s.wealth];
    const other = topic === 'career' ? ['財運', s.wealth] : ['事業', s.career];
    ui.panel(
      `<div class="reading">
        <p class="asked">${question ? `問．${esc(question)}` : `求${topicWord()}`}<span>財神殿</span></p>
        ${api?.price ? `<button type="button" class="jump-unlock" data-a="jump">想把這支籤對到你的事上？完整解籤 ${api.price} ↓</button>` : ''}
        <article class="cai-stick">
          <p class="kicker">財神殿求財籤</p>
          <h3>第 ${s.no} 籤<small class="${GRADE_CLASS[s.grade]}">${s.grade}</small></h3>
          <p class="cai-poem">${s.poem.map(esc).join('<br>')}</p>
        </article>
        <article><p class="kicker">白話</p><p>${esc(s.plain)}</p></article>
        <article><p class="kicker">${main[0]}</p><p>${esc(main[1])}</p></article>
        <article><p class="kicker">${other[0]}</p><p class="dim">${esc(other[1])}</p></article>
        <article><p class="kicker">提醒</p><p>${esc(s.advice)}</p></article>
        <p class="note small">求財籤是本站原創籤詩，供文化體驗與自我反思，不構成投資或職業建議。</p>
        ${unlockBlock()}
       </div>
       <button type="button" class="share-btn" data-a="share">存成籤圖</button>
       <div class="card-actions"><button class="seal" data-a="again">再問一件事</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      (x) => {
        if (x === 'share') {
          void shareCai({ no: s.no, grade: s.grade, poem: s.poem, topic: topicWord(), line: s.plain }).then(
            (r) => {
              ui.emit?.('share_image', { kind: 'cai', result: r });
              if (r === 'saved') say('籤圖存好了。');
            },
          );
          return;
        }
        if (x === 'jump') {
          document.getElementById('unlock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (x === 'deep') {
          if (deepState && deepState.state !== 'none') return openDeep();
          state = 'deep';
          ui.emit?.('unlock_click', { product: 'cai_1' });
          return void pay();
        }
        if (x === 'leave') return ui.leave();
        question = '';
        intro();
      },
      true,
    );
    ui.emit?.('offer_view', { product: 'cai_1', source: 'caishen' });
    refreshDeep();
  }

  function refreshDeep() {
    deepState = null;
    if (!api || !key) return;
    const run = deepRun;
    void api.check(key).then((r) => {
      if (state !== 'result' || run !== deepRun) return;
      deepState = r;
      const btn = document.getElementById('deep-btn');
      if (btn && r.state !== 'none')
        btn.textContent = r.state === 'ready' ? '看完整解籤（已解鎖）' : '請廟公動筆（已解鎖）';
      const login = document.getElementById('deep-login');
      if (login) login.hidden = !r.guest;
    });
  }
  const backToResult = `<button class="ghost" data-a="back">回到籤文</button>`;
  const onBack = (a) => a === 'back' && show();
  const deepTitle = () => `求財籤．第${no}籤．完整解籤`;
  function openDeep() {
    state = 'deep';
    if (deepState?.state === 'ready') return showDeep(deepState.body);
    return startGenerate();
  }
  async function pay() {
    say('稍等，我準備一下。');
    ui.panel(`<p class="note" role="status">正在準備付款</p>`);
    const r = await api.buy(key);
    if (state !== 'deep') return;
    const keep = (why) => api.save({ no, topic, question, sit, day, why });
    if (r.state === 'redirect') {
      keep('pay');
      say('付完了回到這裡，籤還在桌上。');
      location.assign(r.url);
    } else if (r.state === 'login') {
      keep('login');
      say('先登入，我才記得這支籤是誰求的。');
      ui.panel(
        `<h2>登入後再請廟公動筆</h2>
         <p class="note">登入完會回到財神殿，這支籤還在。</p>
         <a class="seal linkbtn" href="/login">去登入</a>${backToResult}`,
        onBack,
      );
    } else if (r.state === 'owned') {
      startGenerate();
    } else {
      say(r.state === 'closed' ? '完整解籤還沒開張，過些日子再來。' : '這會兒忙不過來，稍後再試一次。');
      ui.panel(
        `<p class="note">${r.state === 'closed' ? '付費的完整解籤尚未開放。籤文照常可以看。' : '沒有扣款。可以稍後再試。'}</p>${backToResult}`,
        onBack,
      );
    }
  }
  async function waitPaid() {
    const run = ++deepRun;
    state = 'deep';
    say('你回來了。我確認一下。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p><p class="note" role="status">正在確認付款，通常幾秒鐘。</p>
       <p class="note small">沒有付款就回來了？直接回到籤文，不會扣款。</p>${backToResult}`,
      onBack,
    );
    for (let i = 0; i < 45; i++) {
      const r = await api.check(key);
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
       <button class="seal" data-a="again">再查一次</button>${backToResult}`,
      (a) => (a === 'again' ? void waitPaid() : onBack(a)),
    );
  }
  async function startGenerate() {
    const run = ++deepRun;
    state = 'deep';
    say('我把這支籤對到你的事上，稍候。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p><p class="note" role="status">廟公正在寫，大約半分鐘。</p>`,
    );
    const talking = setInterval(() => npc.talk(), 2600);
    npc.talk();
    try {
      let status = await api.generate(key, question, sit);
      if (run !== deepRun || state !== 'deep') return;
      for (let i = 0; status === 'processing' && i < 30; i++) {
        await sleep(3000);
        if (run !== deepRun || state !== 'deep') return;
        const r = await api.check(key);
        if (r.state === 'ready') return showDeep(r.body);
      }
      if (status === 'ready') {
        const r = await api.check(key);
        if (run !== deepRun || state !== 'deep') return;
        if (r.state === 'ready') return showDeep(r.body);
        status = 'failed';
      }
      say('這次沒寫成，再來一次。');
      ui.panel(
        `<p class="kicker">${deepTitle()}</p>
         <p class="note">這次沒寫成。你已經付過款，再試不會重複扣款。</p>
         <button class="seal" data-a="retry">再試一次</button>${backToResult}`,
        (a) => (a === 'retry' ? void startGenerate() : onBack(a)),
      );
    } finally {
      clearInterval(talking);
    }
  }
  function showDeep(body) {
    state = 'deep';
    ui.emit?.('deep_read', { product: 'cai_1' });
    say('寫好了，慢慢看。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p>
       ${question ? `<p class="asked deep-q">問．${esc(question)}</p>` : ''}
       <div class="deep-body" id="deep-body"></div>
       <p class="note small">求財籤供文化體驗與自我反思，不構成投資或職業建議。</p>
       ${api?.guest ? `<p class="note small guest-note">你現在是訪客身分。綁定信箱後，換手機或清掉瀏覽器資料也找得回來。</p><a class="seal linkbtn" href="${api.bindHref}">綁定信箱保存</a>` : ''}${backToResult}`,
      onBack,
      true,
    );
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

  return {
    id: 'caishen',
    title: '財神殿',
    scene,
    camera,
    enter() {
      const back = api?.take?.();
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
      if (back) {
        no = back.no;
        topic = back.topic;
        question = back.question;
        day = back.day;
        void caiKey(no, topic, question, day).then((k) => {
          key = k;
          for (const o of incense) o.visible = true;
          showChosen();
          if (back.why === 'pay' && api.cancelled) {
            show();
            say('沒付也不要緊，籤還在。');
            return;
          }
          if (back.why === 'pay') return void waitPaid();
          show();
          say('你回來了。籤還在桌上。');
        });
        return;
      }
      intro();
      say('來求財神爺指點。想問財運還是事業？');
    },
    exit() {
      deepRun++;
      state = 'idle';
      shaking = 0;
      ui.panel('');
      ui.hint('');
      ui.say('', '');
    },
    resize(aspect) {
      camera.fov = aspect < 0.8 ? 70 : aspect < 1.2 ? 58 : 48;
      if (aspect < 0.8) {
        HOME.set(0, 3.0, 3.6);
        LOOK.set(0, 0.9, -1.0);
      } else if (aspect < 1.2) {
        HOME.set(0, 2.3, 3.2);
        LOOK.set(0, 1.3, -1.2);
      } else {
        HOME.set(0, 2.1, 3.0);
        LOOK.set(0, 1.3, -1.2);
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
      if (shaking) {
        tube.rotation.z = Math.sin(t * 28) * 0.18;
        tube.rotation.x = Math.cos(t * 23) * 0.1;
        for (const s of sticks) s.position.y = 0.18 + Math.random() * 0.04;
      }
      halo.material.opacity = 0.3 + Math.sin(t * 1.2) * 0.06;
      for (const [i, pl] of lights.entries()) pl.intensity = 4.5 * (0.92 + Math.sin(t * 6 + i * 2) * 0.05);
    },
  };
}
