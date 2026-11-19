import {
  BRANCH,
  matchOf,
  SIGN_RELATION_NAME,
  SIGNS,
  signElement,
  signRelationText,
  TITLE_TEXT,
  ZODIAC,
  ZODIAC_RELATION_NAME,
  ZODIAC_RELATION_TEXT,
} from '@yuelao/core/match';
import * as THREE from 'three';
import { createNpc } from './npc.js';
import { shareMatch } from './share.js';
import { audio, canvasTex, ease, textPlane, tween } from './util.js';
import { SITS } from './yuelao.js';

// 算命攤．合緣配對（站長 2026-11-19，第一期）：填兩個人的生日 → 師傅撥羅盤 → 生肖合沖＋星座元素的免費結果；
// 想看七段完整解讀就付費（match_1），付款、生成、讀取和塔羅館同一套（packages/core/src/spread-reading.ts）。
// 生日只在這台瀏覽器裡算（萬年曆在 ritual/match.ts，按下「合一合」才載入），不送進訂單、不進統計。

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
const loadMatch = () => import('../../ritual/match');

// 七段和伺服器的寫法一一對應（MATCH_INSTRUCTIONS），改了要一起改
const DEEP_SECTIONS = [
  ['你們兩個湊在一起', '一句話說這一對的底色'],
  ['生肖怎麼看', '合沖落在日常相處裡是什麼樣子'],
  ['星座怎麼看', '各自在感情裡的習慣，哪裡順、哪裡卡'],
  ['容易吵的地方', '具體情境，吵起來各退哪一步'],
  ['對著你的問題', '這一節只寫你問的那件事'],
  ['相處上的三件事', '這幾週就能做的事'],
  ['留給你們的一句話', '師傅最後想對你們說的'],
];

export function createFortune(ui) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0806);
  scene.fog = new THREE.FogExp2(0x0e0806, 0.055);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);
  const HOME = new THREE.Vector3(0, 2.0, 2.6);
  const LOOK = new THREE.Vector3(0, 1.05, -1.0);
  const DESK = 0.74;
  scene.add(new THREE.HemisphereLight(0xffd0a0, 0x1a0c08, 0.45));

  // ---------- 攤子：深紅布幔、兩盞燈籠、八卦牌 ----------
  const drape = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#3a0f0b';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        g.fillStyle = x % 64 ? 'rgba(0,0,0,.22)' : 'rgba(255,190,140,.05)';
        g.fillRect(x, 0, 32, h);
      }
    },
    [3, 1],
  );
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(9, 5, 9),
    new THREE.MeshStandardMaterial({ map: drape, side: THREE.BackSide, roughness: 0.95 }),
  );
  room.position.y = 2.5;
  scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ color: 0x1a100a, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);

  const banner = new THREE.Group();
  ['生肖合沖', '星辰相處'].forEach((t, i) => {
    const p = textPlane(t, 1.5, { vertical: true, bg: '#8a1a14', fg: '#f1d79a', size: 96, weight: 700 });
    p.position.set(i ? -2.0 : 2.0, 2.05, -4.44);
    banner.add(p);
  });
  scene.add(banner);

  const lanterns = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xd2321f, emissive: 0x7a160c, roughness: 0.6 }),
    );
    l.scale.y = 1.25;
    l.position.set(s * 1.7, 3.1, -2.4);
    const pl = new THREE.PointLight(0xff8a50, 4, 6, 1.6);
    pl.position.copy(l.position);
    scene.add(l, pl);
    lanterns.push({ l, pl, ph: s });
  }

  // ---------- 卦桌：紅布、羅盤、兩張生辰帖 ----------
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.6 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.1), wood);
  desk.position.set(0, DESK - 0.04, -0.35);
  scene.add(desk);
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 0.6, 1.14),
    new THREE.MeshStandardMaterial({ color: 0x8a1a14, roughness: 0.9 }),
  );
  cloth.position.set(0, DESK - 0.36, -0.35);
  scene.add(cloth);

  const dial = canvasTex(512, 512, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.fillStyle = '#c9a25a';
    g.beginPath();
    g.arc(0, 0, 250, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a1a10';
    g.lineWidth = 3;
    for (const r of [240, 175, 110, 60]) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#2a1a10';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 40px serif';
    for (let i = 0; i < 12; i++) {
      g.save();
      g.rotate((i * Math.PI) / 6);
      g.fillText(BRANCH[i], 0, -208);
      g.font = '600 34px serif';
      g.fillText(ZODIAC[i], 0, -142);
      g.font = '700 40px serif';
      g.restore();
    }
    g.fillStyle = '#7a1a12';
    g.beginPath();
    g.arc(0, 0, 54, 0, Math.PI * 2);
    g.fill();
  });
  const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.05, 40), [
    new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ map: dial, roughness: 0.45, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0x3b2414 }),
  ]);
  compass.position.set(0, DESK + 0.025, -0.4);
  scene.add(compass);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.01, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xa8241a, roughness: 0.4 }),
  );
  needle.position.set(0, DESK + 0.06, -0.4);
  scene.add(needle);

  // 生辰帖：紅紙，翻開寫上生肖
  const cardTex = (word) =>
    canvasTex(256, 360, (g, w, h) => {
      g.fillStyle = '#a8241a';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f1d79a';
      g.lineWidth = 6;
      g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = '#f1d79a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 150px serif';
      g.fillText(word, w / 2, h / 2);
    });
  const tickets = [-1, 1].map((s) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.42),
      new THREE.MeshStandardMaterial({ map: cardTex('帖'), roughness: 0.85 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(s * 0.72, DESK + 0.003, -0.25);
    scene.add(m);
    return m;
  });
  const setTicket = (k, word) => {
    tickets[k].material.map?.dispose();
    tickets[k].material.map = cardTex(word);
    tickets[k].material.needsUpdate = true;
  };

  // 師傅坐在卦桌後
  const npc = createNpc('keeper');
  npc.name = '算命師傅';
  npc.root.position.set(0, 0, -1.55);
  npc.root.scale.setScalar(1.05);
  scene.add(npc.root);
  const say = (text) => {
    npc.talk();
    ui.say(npc.name, text);
  };

  // ---------- 流程 ----------
  let state = 'idle';
  let you = '';
  let them = '';
  let sit = 'dating';
  let question = '';
  let result = null; // matchOf(...)
  let key = '';
  let deepState = null;
  let deepRun = 0;
  let spin = 0;
  const api = ui.fortune;
  const sitWord = () => (SITS.find((x) => x.key === sit) || SITS[0]).word;
  const deepTitle = () => '合緣配對．完整解讀';
  const person = (p) =>
    `${BRANCH[p.zodiac - 1]}${ZODIAC[p.zodiac - 1]}．${SIGNS[p.sign - 1]}（${signElement(p.sign)}象）`;

  function form(note = '') {
    state = 'form';
    ui.panel(
      `<h2>合一合</h2>
       <p class="note small">填兩個人的國曆生日。生肖以立春換年；日期只在你這台手機或電腦裡算，不會送出。</p>
       <div class="fortune-form">
         <label><span>你的生日</span><input type="date" id="f-you" min="1901-01-01" max="2099-12-31" value="${esc(you)}"></label>
         <label><span>對方的生日</span><input type="date" id="f-them" min="1901-01-01" max="2099-12-31" value="${esc(them)}"></label>
       </div>
       <p class="kicker">你們現在的情況</p>
       <div class="chips sits">${SITS.map(
         (x) =>
           `<button type="button" data-a="sit:${x.key}" class="${x.key === sit ? 'on' : ''}">${x.word}</button>`,
       ).join('')}</div>
       <label class="ask-q"><textarea id="f-q" maxlength="${Q_MAX}" rows="2" placeholder="想問的事（選填），例：我們會不會一直吵下去">${esc(question)}</textarea>
         <span class="ask-meta"><span>完整解讀會針對這一句寫</span><span id="f-n">${[...question].length}/${Q_MAX}</span></span></label>
       ${note ? `<p class="note" role="status">${note}</p>` : ''}
       <button class="seal" data-a="go">合一合</button>
       <p class="note small">生肖星座合緣是文化習俗與自我反思，不代表現實預測。</p>`,
      (a) => {
        read();
        if (a.startsWith('sit:')) {
          sit = a.slice(4);
          return form();
        }
        if (a === 'go') void go();
      },
      true,
    );
    const ta = document.getElementById('f-q');
    if (ta)
      ta.oninput = () => {
        question = [...ta.value].slice(0, Q_MAX).join('');
        const n = document.getElementById('f-n');
        if (n) n.textContent = `${[...question].length}/${Q_MAX}`;
      };
  }
  function read() {
    you = document.getElementById('f-you')?.value || you;
    them = document.getElementById('f-them')?.value || them;
    const ta = document.getElementById('f-q');
    if (ta) question = [...ta.value.replace(/\s+/g, ' ').trim()].slice(0, Q_MAX).join('');
  }

  async function compute() {
    const m = await loadMatch();
    const a = m.personOf(you);
    const b = m.personOf(them);
    if (!a || !b) return false;
    result = matchOf(a, b);
    key = (await m.matchKey(you, them, sit, question)) || '';
    return !!key;
  }

  async function go() {
    if (!you || !them) return form('兩個人的生日都要填。');
    state = 'turning';
    ui.panel(`<p class="kicker">算命攤</p><p class="note" role="status">師傅正在撥羅盤……</p>`);
    say('我看看。');
    let ok = false;
    try {
      ok = await compute();
    } catch {}
    if (!ok) return form('這個日期算不了，請確認是 1901 到 2099 年間的真實日期。');
    ui.emit?.('ritual_begin', { kind: 'match' });
    audio.bell?.(392, 0.12, 2.5);
    spin = 9;
    setTicket(0, ZODIAC[result.a.zodiac - 1]);
    await sleep(500);
    setTicket(1, ZODIAC[result.b.zodiac - 1]);
    // 畫面在背景或很慢時動畫會停：最多等 2.5 秒就直接給結果
    await Promise.race([
      tween(
        1.6,
        (k) => {
          needle.rotation.y = k * Math.PI * 6 + (result.b.zodiac - 1) * (Math.PI / 6);
        },
        ease.out,
      ),
      sleep(2500),
    ]);
    spin = 0;
    audio.bell?.(523, 0.14, 3);
    show();
  }

  function unlockBlock() {
    if (!api?.price) return '';
    const q = [...question];
    const asked = question
      ? `你問「${q.length > 22 ? `${q.slice(0, 22).join('')}…` : question}」，現在是${sitWord()}。`
      : `你們現在是${sitWord()}。`;
    const teaser = `${asked}${ZODIAC[result.a.zodiac - 1]}配${ZODIAC[result.b.zodiac - 1]}是${ZODIAC_RELATION_NAME[result.zodiac]}，${SIGNS[result.a.sign - 1]}配${SIGNS[result.b.sign - 1]}是${SIGN_RELATION_NAME[result.sign]}。放在一起看，你們最容易卡住的地方，其實是……`;
    return `<section class="unlock" id="unlock">
        <h3>解鎖完整合緣</h3>
        <p class="deep-teaser">${esc(teaser)}</p>
        <p class="unlock-note">上面是生肖和星座各自的說法。完整解讀把兩邊合起來，七段都寫你們這一對${question ? '和你問的那件事' : ''}。</p>
        <button class="offer" id="deep-btn" data-a="deep">解鎖完整合緣　${api.price}</button>
        <p class="note small unlock-login" id="deep-login" hidden>需先登入（免費），登入完會回到這裡。</p>
        <ol class="deep-list">${DEEP_SECTIONS.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ol>
        <p class="note small">付款即表示同意<a href="/terms" target="_blank" rel="noopener">服務條款</a>與<a href="/privacy" target="_blank" rel="noopener">隱私說明</a>。</p>
      </section>`;
  }

  function show() {
    if (state !== 'result' && state !== 'deep') ui.emit?.('reading_done', { kind: 'match' });
    state = 'result';
    const r = result;
    say(`${r.title}。${TITLE_TEXT[r.title].split('。')[0]}。`);
    ui.panel(
      `<div class="reading match">
        <p class="asked">${question ? `問．${esc(question)}` : '合緣'}<span>${sitWord()}</span></p>
        ${api?.price ? `<button type="button" class="jump-unlock" data-a="jump">想看你們合起來怎麼走？完整合緣 ${api.price} ↓</button>` : ''}
        <div class="match-pair">
          <div><small>你</small><b>${ZODIAC[r.a.zodiac - 1]}</b><span>${esc(person(r.a))}</span></div>
          <i aria-hidden="true">×</i>
          <div><small>對方</small><b>${ZODIAC[r.b.zodiac - 1]}</b><span>${esc(person(r.b))}</span></div>
        </div>
        <h3 class="match-title">${r.title}</h3>
        <p>${TITLE_TEXT[r.title]}</p>
        <article><p class="kicker">生肖．${ZODIAC_RELATION_NAME[r.zodiac]}</p><p>${ZODIAC_RELATION_TEXT[r.zodiac]}</p></article>
        <article><p class="kicker">星座．${SIGN_RELATION_NAME[r.sign]}</p><p>${signRelationText(r)}</p></article>
        <p class="note small">生肖以立春換年，星座依國曆生日。合緣屬文化習俗與自我反思，不代表現實預測，也不能決定一段關係。</p>
        ${unlockBlock()}
       </div>
       <button type="button" class="share-btn" data-a="share">存成合緣卡</button>
       <div class="card-actions"><button class="seal" data-a="again">換一對再合</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      (x) => {
        if (x === 'share') {
          // 分享卡不放生日和問題，只放生肖、星座與總評
          void shareMatch({
            a: { zodiac: ZODIAC[r.a.zodiac - 1], sign: SIGNS[r.a.sign - 1] },
            b: { zodiac: ZODIAC[r.b.zodiac - 1], sign: SIGNS[r.b.sign - 1] },
            zodiacRel: ZODIAC_RELATION_NAME[r.zodiac],
            signRel: SIGN_RELATION_NAME[r.sign],
            title: r.title,
            line: TITLE_TEXT[r.title],
          }).then((res) => {
            ui.emit?.('share_image', { kind: 'match', result: res });
            if (res === 'saved') say('合緣卡存好了。');
          });
          return;
        }
        if (x === 'jump') {
          document.getElementById('unlock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (x === 'deep') {
          if (deepState && deepState.state !== 'none') return openDeep();
          state = 'deep';
          ui.emit?.('unlock_click', { product: 'match_1' });
          return void pay();
        }
        if (x === 'leave') return ui.leave();
        question = '';
        them = '';
        form();
      },
      true,
    );
    ui.emit?.('offer_view', { product: 'match_1', source: 'bazi' });
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
        btn.textContent = r.state === 'ready' ? '看完整合緣（已解鎖）' : '請師傅動筆（已解鎖）';
      const login = document.getElementById('deep-login');
      if (login) login.hidden = !r.guest;
    });
  }
  const backToResult = `<button class="ghost" data-a="back">回到合緣結果</button>`;
  const onBack = (a) => a === 'back' && show();
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
    const keep = (why) => api.save({ you, them, question, sit, day: today(), why });
    if (r.state === 'redirect') {
      keep('pay');
      say('付完了回到這裡，我就動筆。');
      location.assign(r.url);
    } else if (r.state === 'login') {
      keep('login');
      say('先登入，我才記得這是誰的合緣。');
      ui.panel(
        `<h2>登入後再請師傅動筆</h2>
         <p class="note">登入完會回到算命攤，兩個人的生日只存在這台瀏覽器裡。</p>
         <a class="seal linkbtn" href="/login">去登入</a>${backToResult}`,
        onBack,
      );
    } else if (r.state === 'owned') {
      startGenerate();
    } else {
      say(r.state === 'closed' ? '完整合緣還沒開張，過些日子再來。' : '這會兒忙不過來，稍後再試一次。');
      ui.panel(
        `<p class="note">${r.state === 'closed' ? '付費的完整合緣尚未開放。免費結果照常可以看。' : '沒有扣款。可以稍後再試。'}</p>${backToResult}`,
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
       <p class="note small">沒有付款就回來了？直接回到結果，不會扣款。</p>${backToResult}`,
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
    say('我把你們兩個合起來看，稍候。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p><p class="note" role="status">師傅正在寫，大約半分鐘。</p>`,
    );
    const talking = setInterval(() => npc.talk(), 2600);
    npc.talk();
    spin = 2;
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
      spin = 0;
    }
  }
  function showDeep(body) {
    state = 'deep';
    ui.emit?.('deep_read', { product: 'match_1' });
    say('寫好了，慢慢看。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p>
       <p class="asked deep-q">${esc(person(result.a))} × ${esc(person(result.b))}</p>
       ${question ? `<p class="asked deep-q">問．${esc(question)}</p>` : ''}
       <div class="deep-body" id="deep-body"></div>
       <p class="note small">生肖星座合緣供自我反思，不是預言。</p>
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
    id: 'bazi',
    title: '算命攤',
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
        // 付款／登入回來：用本機記下的生日重算同一份結果
        you = back.you;
        them = back.them;
        question = back.question;
        sit = back.sit;
        void compute().then((ok) => {
          if (!ok) return form();
          setTicket(0, ZODIAC[result.a.zodiac - 1]);
          setTicket(1, ZODIAC[result.b.zodiac - 1]);
          if (back.why === 'pay' && api.cancelled) {
            show();
            say('沒付也不要緊，結果還在。');
            return;
          }
          if (back.why === 'pay') return void waitPaid();
          show();
          say('你回來了。剛才的結果還在。');
        });
        return;
      }
      setTicket(0, '帖');
      setTicket(1, '帖');
      form();
      say('來合一合。把你和對方的生日給我。');
    },
    exit() {
      deepRun++;
      state = 'idle';
      ui.panel('');
      ui.hint('');
      ui.say('', '');
    },
    resize(aspect) {
      camera.fov = aspect < 0.8 ? 70 : aspect < 1.2 ? 58 : 48;
      if (aspect < 0.8) {
        HOME.set(0, 3.0, 3.3);
        LOOK.set(0, 0.55, -0.7);
      } else if (aspect < 1.2) {
        HOME.set(0, 2.25, 3.0);
        LOOK.set(0, 1.2, -1.0);
      } else {
        HOME.set(0, 2.0, 2.6);
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
      if (spin) needle.rotation.y += dt * spin;
      compass.rotation.y = Math.sin(t * 0.2) * 0.05;
      for (const { l, pl, ph } of lanterns) {
        l.position.x = ph * 1.7 + Math.sin(t * 0.9 + ph) * 0.03;
        pl.intensity = 4 * (0.9 + Math.sin(t * 7 + ph * 3) * 0.05 + Math.random() * 0.04);
      }
    },
  };
}
