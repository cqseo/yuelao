import {
  BAZI_TITLE_TEXT,
  baziChart,
  baziLines,
  branchElement,
  ELEMENTS,
  pillarName,
  STEMS,
  stemElement,
} from '@yuelao/core/bazi';
import { LOVE_TITLE_TEXT, loveChart, loveLines, starsLabel, yearGanzhi } from '@yuelao/core/love';
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
import { keepBirthday, loadBirthday } from '../../ritual/birthday';
import { createNpc } from './npc.js';
import { shareBazi, shareLove, shareMatch } from './share.js';
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

// 七段和伺服器的寫法一一對應（MATCH_INSTRUCTIONS／LOVE_INSTRUCTIONS），改了要一起改
const LOVE_SECTIONS = [
  ['你的姻緣底色', '你在感情裡的樣子'],
  ['你的桃花在哪裡', '什麼場合、什麼人容易帶來緣分'],
  ['紅鸞天喜什麼時候到', '哪幾年姻緣比較會動'],
  ['今年的感情運', '今年和你的生肖是什麼關係'],
  ['和誰處得來', '合得來與要磨合的生肖、星座'],
  ['對著你的問題', '這一節只寫你問的那件事'],
  ['留給你的一句話', '師傅最後想對你說的'],
];
// 八字的另外三個主題（2026-11-19）；和伺服器的 BAZI_CAREER／WEALTH／YEAR_INSTRUCTIONS 一一對應
const TOPIC_SECTIONS = {
  career: [
    ['你的工作底色', '落在工作上是什麼樣的人'],
    ['適合的方向', '從十神看適合的工作型態'],
    ['貴人與助力', '上司、同事、合作者怎麼相處'],
    ['容易卡住的地方', '具體情境與調整'],
    ['今年的事業運', '哪些事適合推、哪些先放'],
    ['對著你的問題', '這一節只寫你問的那件事'],
    ['留給你的一句話', '師傅最後想對你說的'],
  ],
  wealth: [
    ['你的財運底色', '你和錢的關係'],
    ['賺錢的路子', '比較順的進帳方式'],
    ['守財與破財', '要留意的地方與守財習慣'],
    ['貴人與合作', '什麼人幫你、什麼合作要小心'],
    ['今年的財運', '開源還是守成'],
    ['對著你的問題', '這一節只寫你問的那件事'],
    ['留給你的一句話', '師傅最後想對你說的'],
  ],
  year: [
    ['這一年的總體', '這一年的主題'],
    ['事業', '機會與壓力'],
    ['財運', '進帳與開銷的節奏'],
    ['感情', '依你現在的情況'],
    ['人際與貴人', '助力與要小心的人'],
    ['上半年與下半年', '各自的重點'],
    ['對著你的問題', '這一節只寫你問的那件事'],
    ['留給你的一句話', '師傅最後想對你說的'],
  ],
};
const TOPICS = [
  ['love', '感情'],
  ['career', '事業'],
  ['wealth', '財運'],
  ['year', '年運'],
];
const BAZI_SECTIONS = [
  ['你的命盤底色', '日主與強弱，落在感情裡是什麼樣的人'],
  ['五行的偏與缺', '多的帶來什麼、缺的怎麼補'],
  ['夫妻宮與另一半', '容易被什麼人吸引、適合什麼伴侶'],
  ['桃花與緣分的時機', '緣分怎麼來、哪幾年比較會動'],
  ['今年的感情運', '今年流年對你的作用'],
  ['對著你的問題', '這一節只寫你問的那件事'],
  ['留給你的一句話', '師傅最後想對你說的'],
];
const THIS_YEAR = new Date().getFullYear();
/** 生日用年、月、日三個下拉：安卓的日期選擇器預設停在今天，往回翻幾十年很累。 */
function dateFields(id, value, label) {
  const [y, m, d] = (value || '--').split('-');
  const opts = (from, to, cur, unit, step = 1) => {
    const out = [];
    for (let v = from; step > 0 ? v <= to : v >= to; v += step)
      out.push(`<option value="${v}"${Number(cur) === v ? ' selected' : ''}>${v}${unit}</option>`);
    return out.join('');
  };
  return `<fieldset class="dsel" id="${id}"><legend>${label}</legend>
    <select data-p="y" aria-label="${label}．年"><option value="">年</option>${opts(THIS_YEAR, 1930, y, '', -1)}</select>
    <select data-p="m" aria-label="${label}．月"><option value="">月</option>${opts(1, 12, m, '月')}</select>
    <select data-p="d" aria-label="${label}．日"><option value="">日</option>${opts(1, 31, d, '日')}</select>
  </fieldset>`;
}
function readDate(id) {
  const box = document.getElementById(id);
  if (!box) return null;
  const get = (p) => box.querySelector(`[data-p="${p}"]`)?.value || '';
  const [y, m, d] = [get('y'), get('m'), get('d')];
  return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
}
const TOPIC_WORD = { love: '感情', career: '事業', wealth: '財運', year: '年運' };
/** 年運看哪一年：10 月起看下一年（和 ritual/match.ts 的 reportYear 一致）。 */
const yearLabel = () => {
  const d = new Date();
  return d.getMonth() + 1 >= 10 ? d.getFullYear() + 1 : d.getFullYear();
};
const HOURS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].map(
  (z, i) => `${z}時 ${String((i * 2 + 23) % 24).padStart(2, '0')}–${String(i * 2 + 1).padStart(2, '0')}`,
);
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
  let keep = false; // 在這台裝置記住我的生日
  let mode = 'match'; // 'match' 合緣配對｜'love' 個人姻緣盤｜'bazi' 八字命盤
  let hour = null; // 時辰 0–11，不知道是 null
  let gender = 'n'; // 'f'｜'m'｜'n'（不說）
  let bazi = null; // baziChart(...)
  let topic = 'love'; // 八字看哪方面：love｜career｜wealth｜year
  let result = null; // matchOf(...)
  let chart = null; // loveChart(...)
  let key = '';
  let deepState = null;
  let deepRun = 0;
  let spin = 0;
  const api = ui.fortune;
  const sitWord = () => (SITS.find((x) => x.key === sit) || SITS[0]).word;
  const deepTitle = () =>
    mode === 'bazi'
      ? topic === 'year'
        ? `${bazi?.flow ?? ''} 年運．完整報告`
        : `八字${topic === 'career' ? '事業' : topic === 'wealth' ? '財運' : '命盤'}．完整解讀`
      : mode === 'love'
        ? '個人姻緣盤．完整解讀'
        : '合緣配對．完整解讀';
  const product = () =>
    mode === 'bazi' ? (topic === 'year' ? 'year_1' : 'bazi_1') : mode === 'love' ? 'love_1' : 'match_1';
  const baziPrice = () => (topic === 'year' ? api?.yearPrice : api?.baziPrice);
  const solo = () => mode !== 'match';
  const person = (p) =>
    `${BRANCH[p.zodiac - 1]}${ZODIAC[p.zodiac - 1]}．${SIGNS[p.sign - 1]}（${signElement(p.sign)}象）`;

  function form(note = '') {
    state = 'form';
    ui.panel(
      `<div class="chips decks">
         <button type="button" data-a="mode:match" class="${mode === 'match' ? 'on' : ''}"><b>合緣配對</b><small>兩個人合不合</small></button>
         <button type="button" data-a="mode:love" class="${mode === 'love' ? 'on' : ''}"><b>我的姻緣盤</b><small>桃花、紅鸞、今年感情運</small></button>
         <button type="button" data-a="mode:bazi" class="${mode === 'bazi' ? 'on' : ''}"><b>八字命盤</b><small>感情、事業、財運、年運</small></button>
       </div>
       ${
         mode === 'bazi'
           ? `<p class="kicker">看哪方面</p><div class="chips sits">${TOPICS.map(
               ([k, w]) =>
                 `<button type="button" data-a="t:${k}" class="${topic === k ? 'on' : ''}">${k === 'year' ? `${yearLabel()}年運` : w}</button>`,
             ).join('')}</div>`
           : ''
       }
       <p class="note small">${solo() ? '填你的國曆生日' : '填兩個人的國曆生日'}${mode === 'bazi' ? '，知道出生時辰更準' : ''}。生肖以立春換年；日期只在你這台手機或電腦裡算，不會送出。</p>
       <div class="fortune-form${mode === 'love' ? ' one' : ''}">
         ${dateFields('f-you', you, '你的生日')}
         ${mode === 'match' ? dateFields('f-them', them, '對方的生日') : ''}
         ${
           mode === 'bazi'
             ? `<label><span>出生時辰</span><select id="f-hour"><option value="">不知道</option>${HOURS.map((h, i) => `<option value="${i}"${hour === i ? ' selected' : ''}>${h}</option>`).join('')}</select></label>`
             : ''
         }
       </div>
       ${
         mode === 'bazi'
           ? `<p class="kicker">性別（看配偶星用）</p><div class="chips sits">${[
               ['f', '女'],
               ['m', '男'],
               ['n', '不說'],
             ]
               .map(
                 ([g, w]) =>
                   `<button type="button" data-a="g:${g}" class="${gender === g ? 'on' : ''}">${w}</button>`,
               )
               .join('')}</div>`
           : ''
       }
       <label class="keep-bd"><input type="checkbox" id="f-keep"${keep ? ' checked' : ''}> 在這台裝置記住我的生日（只存在本機，取消勾選就刪除）</label>
       <p class="kicker">${solo() ? '你現在的情況' : '你們現在的情況'}</p>
       <div class="chips sits">${SITS.map(
         (x) =>
           `<button type="button" data-a="sit:${x.key}" class="${x.key === sit ? 'on' : ''}">${x.word}</button>`,
       ).join('')}</div>
       <label class="ask-q"><textarea id="f-q" maxlength="${Q_MAX}" rows="2" placeholder="想問的事（選填），例：${solo() ? '我什麼時候會遇到對的人' : '我們會不會一直吵下去'}">${esc(question)}</textarea>
         <span class="ask-meta"><span>完整解讀會針對這一句寫</span><span id="f-n">${[...question].length}/${Q_MAX}</span></span></label>
       ${note ? `<p class="note" role="status">${note}</p>` : ''}
       <button class="seal" data-a="go">${solo() ? '排一盤' : '合一合'}</button>
       <p class="note small">${mode === 'bazi' ? '八字命盤為簡化的傳統命理' : `生肖星座${mode === 'love' ? '姻緣' : '合緣'}`}是文化習俗與自我反思，不代表現實預測。</p>`,
      (a) => {
        read();
        if (a.startsWith('sit:')) {
          sit = a.slice(4);
          return form();
        }
        if (a.startsWith('t:')) {
          topic = a.slice(2);
          return form();
        }
        if (a.startsWith('g:')) {
          gender = a.slice(2);
          return form();
        }
        if (a.startsWith('mode:')) {
          const mm = a.slice(5);
          mode = mm === 'love' || mm === 'bazi' ? mm : 'match';
          say(
            mode === 'bazi'
              ? '排八字，給我你的生日，知道時辰更好。'
              : mode === 'love'
                ? '看你自己的姻緣，給我你的生日就好。'
                : '來合一合。把你和對方的生日給我。',
          );
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
    const y = readDate('f-you');
    if (y !== null) you = y;
    const th = readDate('f-them');
    if (th !== null) them = th;
    const k = document.getElementById('f-keep');
    if (k) keep = k.checked;
    const hs = document.getElementById('f-hour');
    if (hs) hour = hs.value === '' ? null : Number(hs.value);
    const ta = document.getElementById('f-q');
    if (ta) question = [...ta.value.replace(/\s+/g, ' ').trim()].slice(0, Q_MAX).join('');
  }

  async function compute() {
    const m = await loadMatch();
    if (mode === 'bazi') {
      const flow = topic === 'year' ? m.reportYear() : m.flowYear();
      const input = m.baziOf(you, hour, gender, flow, topic);
      if (!input) return false;
      bazi = baziChart(input);
      key = (await m.baziKey(you, hour, gender, flow, sit, question, topic)) || '';
      return !!key;
    }
    if (mode === 'love') {
      const me = m.personOf(you);
      if (!me) return false;
      const year = m.flowYear();
      chart = loveChart(me.zodiac, me.sign, year);
      key = (await m.loveKey(you, year, sit, question)) || '';
      return !!key;
    }
    const a = m.personOf(you);
    const b = m.personOf(them);
    if (!a || !b) return false;
    result = matchOf(a, b);
    key = (await m.matchKey(you, them, sit, question)) || '';
    return !!key;
  }

  async function go() {
    if (!you) return form('先填你的生日。');
    if (mode === 'match' && !them) return form('兩個人的生日都要填。');
    state = 'turning';
    ui.panel(`<p class="kicker">算命攤</p><p class="note" role="status">師傅正在撥羅盤……</p>`);
    say('我看看。');
    let ok = false;
    try {
      ok = await compute();
    } catch {}
    if (!ok) return form('這個日期算不了，請確認日期是真的存在（例如沒有 2 月 30 日）。');
    keepBirthday(you, keep);
    ui.emit?.('ritual_begin', { kind: mode });
    audio.bell?.(392, 0.12, 2.5);
    spin = 9;
    const [left, right] = tickets2();
    setTicket(0, left);
    await sleep(500);
    setTicket(1, right);
    const target = mode === 'bazi' ? bazi.day.branch + 1 : mode === 'love' ? chart.taohua : result.b.zodiac;
    // 畫面在背景或很慢時動畫會停：最多等 2.5 秒就直接給結果
    await Promise.race([
      tween(
        1.6,
        (k) => {
          needle.rotation.y = k * Math.PI * 6 + (target - 1) * (Math.PI / 6);
        },
        ease.out,
      ),
      sleep(2500),
    ]);
    spin = 0;
    audio.bell?.(523, 0.14, 3);
    show();
  }
  /** 桌上兩張紅帖：合緣是兩人的生肖；姻緣盤是你的生肖和桃花。 */
  const tickets2 = () =>
    mode === 'bazi'
      ? [STEMS[bazi.day.stem], bazi.dayMaster]
      : mode === 'love'
        ? [ZODIAC[chart.zodiac - 1], '桃']
        : [ZODIAC[result.a.zodiac - 1], ZODIAC[result.b.zodiac - 1]];

  function loveUnlockBlock() {
    if (!api?.lovePrice) return '';
    const q = [...question];
    const asked = question
      ? `你問「${q.length > 22 ? `${q.slice(0, 22).join('')}…` : question}」，現在是${sitWord()}。`
      : `你現在是${sitWord()}。`;
    const next = chart.years.find((y) => y.stars.includes('hongluan'));
    const teaser = `${asked}你的桃花在${ZODIAC[chart.taohua - 1]}，${next ? `紅鸞在 ${next.year} 年` : '紅鸞也排出來了'}；${chart.year} ${yearGanzhi(chart.year)}年對你來說是「${chart.title}」。真正會讓你錯過緣分的，其實是……`;
    return `<section class="unlock" id="unlock">
        <h3>解鎖完整姻緣盤</h3>
        <p class="deep-teaser">${esc(teaser)}</p>
        <p class="unlock-note">上面是盤上排出來的位置。完整解讀把桃花、紅鸞、流年連起來，七段都寫你自己${question ? '和你問的那件事' : ''}。</p>
        <button class="offer" id="deep-btn" data-a="deep">解鎖完整姻緣盤　${api.lovePrice}</button>
        <p class="note small unlock-login" id="deep-login" hidden>需先登入（免費），登入完會回到這裡。</p>
        <ol class="deep-list">${LOVE_SECTIONS.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ol>
        <p class="note small">付款即表示同意<a href="/terms" target="_blank" rel="noopener">服務條款</a>與<a href="/privacy" target="_blank" rel="noopener">隱私說明</a>。</p>
      </section>`;
  }

  function showLove() {
    if (state !== 'result' && state !== 'deep') ui.emit?.('reading_done', { kind: 'love' });
    state = 'result';
    const c = chart;
    say(`${c.title}。${LOVE_TITLE_TEXT[c.title].split('。')[0]}。`);
    const stars = c.years
      .slice(0, 6)
      .map(
        (y) => `<li><b>${y.year}</b><span>${yearGanzhi(y.year)}</span><em>${starsLabel(y.stars)}</em></li>`,
      )
      .join('');
    ui.panel(
      `<div class="reading match">
        <p class="asked">${question ? `問．${esc(question)}` : '我的姻緣盤'}<span>${sitWord()}</span></p>
        ${api?.lovePrice ? `<button type="button" class="jump-unlock" data-a="jump">想看桃花、紅鸞、流年連起來怎麼走？完整解讀 ${api.lovePrice} ↓</button>` : ''}
        <div class="match-pair">
          <div><small>你</small><b>${ZODIAC[c.zodiac - 1]}</b><span>${esc(person(c))}</span></div>
          <i aria-hidden="true">✿</i>
          <div><small>桃花</small><b>${ZODIAC[c.taohua - 1]}</b><span>紅鸞 ${ZODIAC[c.hongluan - 1]}．天喜 ${ZODIAC[c.tianxi - 1]}</span></div>
        </div>
        <h3 class="match-title">${c.title}</h3>
        <p>${c.year} ${yearGanzhi(c.year)}年：${LOVE_TITLE_TEXT[c.title]}</p>
        ${loveLines(c)
          .map((l) => `<article><p class="kicker">${l.label}</p><p>${l.text}</p></article>`)
          .join('')}
        <p class="kicker">接下來的星年</p>
        <ul class="star-years">${stars}</ul>
        <p class="note small">生肖以立春換年，桃花、紅鸞、天喜以生肖（年支）起，是簡化的民間算法。屬文化習俗與自我反思，不代表現實預測。</p>
        ${loveUnlockBlock()}
       </div>
       <button type="button" class="share-btn" data-a="share">存成姻緣卡</button>
       ${crossSell()}
       <div class="card-actions"><button class="seal" data-a="again">換人再排</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      onResult,
      true,
    );
    ui.emit?.('offer_view', { product: 'love_1', source: 'bazi' });
    refreshDeep();
  }

  function baziUnlockBlock() {
    const price = baziPrice();
    if (!price) return '';
    const sections = topic === 'love' ? BAZI_SECTIONS : TOPIC_SECTIONS[topic];
    const q = [...question];
    const asked = question
      ? `你問「${q.length > 22 ? `${q.slice(0, 22).join('')}…` : question}」，現在是${sitWord()}。`
      : `你現在是${sitWord()}。`;
    const head = `${asked}${STEMS[bazi.day.stem]}${bazi.dayMaster}日主${bazi.strength}`;
    const teaser =
      topic === 'career'
        ? `${head}，官殺 ${bazi.roles.官殺}、印 ${bazi.roles.印}、食傷 ${bazi.roles.食傷}。把這幾股力量放在一起看，你在工作上最該先調整的，其實是……`
        : topic === 'wealth'
          ? `${head}，財星 ${bazi.roles.財}、比劫 ${bazi.roles.比劫}。放在一起看，你的錢最容易漏掉的地方，其實是……`
          : topic === 'year'
            ? `${head}，${bazi.flow} ${yearGanzhi(bazi.flow)}年對你是「${bazi.flowRole}」，生肖${bazi.flowToZodiac}。這一年最該把握的時機，其實是……`
            : `${head}，夫妻宮坐${BRANCH[bazi.spousePalace]}${bazi.missing.length ? `，命裡缺${bazi.missing.join('、')}` : ''}。把這幾樣放在一起看，你在感情裡最常卡住的，其實是……`;
    const what =
      topic === 'year'
        ? `完整${bazi.flow}年運`
        : `完整八字${topic === 'career' ? '事業' : topic === 'wealth' ? '財運' : '命盤'}`;
    return `<section class="unlock" id="unlock">
        <h3>解鎖${what}</h3>
        <p class="deep-teaser">${esc(teaser)}</p>
        <p class="unlock-note">上面是盤上排出來的位置。完整解讀把它們連起來，${sections.length} 段都寫你自己${question ? '和你問的那件事' : ''}。${topic === 'wealth' || topic === 'career' || topic === 'year' ? '不構成投資或職業建議。' : ''}</p>
        <button class="offer" id="deep-btn" data-a="deep">解鎖${what}　${price}</button>
        <p class="note small unlock-login" id="deep-login" hidden>需先登入（免費），登入完會回到這裡。</p>
        <ol class="deep-list">${sections.map(([t, d], i) => `<li><b><i>${String(i + 1).padStart(2, '0')}</i>${t}</b><span>${d}</span></li>`).join('')}</ol>
        <p class="note small">付款即表示同意<a href="/terms" target="_blank" rel="noopener">服務條款</a>與<a href="/privacy" target="_blank" rel="noopener">隱私說明</a>。</p>
      </section>`;
  }

  function showBazi() {
    if (state !== 'result' && state !== 'deep') ui.emit?.('reading_done', { kind: 'bazi', topic });
    state = 'result';
    const c = bazi;
    say(`${STEMS[c.day.stem]}${c.dayMaster}日主，${c.title}。`);
    const cols = [
      ['時', c.hour],
      ['日', c.day],
      ['月', c.month],
      ['年', c.year],
    ]
      .map(
        ([l, p]) =>
          `<div class="${l === '日' ? 'me' : ''}"><small>${l}柱</small>${
            p
              ? `<b>${STEMS[p.stem]}</b><i>${stemElement(p.stem)}</i><b>${BRANCH[p.branch]}</b><i>${branchElement(p.branch)}</i>`
              : '<b>？</b><i></i><b>？</b><i>不詳</i>'
          }</div>`,
      )
      .join('');
    const max = Math.max(...ELEMENTS.map((e) => c.counts[e]), 1);
    const bars = ELEMENTS.map(
      (e) =>
        `<li><span>${e}</span><i style="width:${Math.round((c.counts[e] / max) * 100)}%"></i><b>${c.counts[e]}</b></li>`,
    ).join('');
    ui.panel(
      `<div class="reading match">
        <p class="asked">${question ? `問．${esc(question)}` : topic === 'year' ? `我的 ${c.flow} 年運` : `我的八字．${TOPIC_WORD[topic]}`}<span>${sitWord()}</span></p>
        ${baziPrice() ? `<button type="button" class="jump-unlock" data-a="jump">想看完整${topic === 'year' ? '年運報告' : '解讀'}？${baziPrice()} ↓</button>` : ''}
        <div class="pillars">${cols}</div>
        <h3 class="match-title">${c.title}</h3>
        <p>${BAZI_TITLE_TEXT[c.title]}</p>
        <ul class="elements">${bars}</ul>
        ${baziLines(c)
          .map((l) => `<article><p class="kicker">${l.label}</p><p>${l.text}</p></article>`)
          .join('')}
        <p class="note small">四柱以立春換年、節氣換月；強弱與十神是簡化看法，沒有排大運。屬傳統命理的文化參考與自我反思，不代表現實預測${topic === 'love' ? '' : '，也不構成投資或職業建議'}。</p>
        ${baziUnlockBlock()}
       </div>
       <button type="button" class="share-btn" data-a="share">存成命盤卡</button>
       ${crossSell()}
       <div class="card-actions"><button class="seal" data-a="again">換人再排</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      onResult,
      true,
    );
    ui.emit?.('offer_view', { product: product(), source: 'bazi' });
    refreshDeep();
  }

  /** 結果下面推另外兩種玩法；你的生日已經填好，不用再填。 */
  function crossSell() {
    const items = [
      ['love', '看你自己的姻緣盤', '桃花、紅鸞、今年感情運'],
      ['bazi', '排你的八字命盤', '四柱五行、夫妻宮'],
      ['match', '和他合一合', '填對方生日，看合不合'],
    ].filter(([m]) => m !== mode);
    return `<div class="cross-sell"><p class="kicker">生日已經填好，也可以看看</p>${items
      .map(([m, t, d]) => `<button type="button" data-a="to:${m}"><b>${t}</b><small>${d}</small></button>`)
      .join('')}</div>`;
  }

  function onResult(x) {
    if (x.startsWith('to:')) {
      const next = x.slice(3);
      mode = next === 'love' || next === 'bazi' ? next : 'match';
      ui.emit?.('fortune_cross', { to: mode });
      question = '';
      if (mode === 'match') {
        them = '';
        say('把對方的生日給我。');
        return form();
      }
      return void go();
    }
    if (x === 'share' && mode === 'bazi') {
      const c = bazi;
      void shareBazi({
        pillars: [c.year, c.month, c.day, c.hour].map((p) => (p ? pillarName(p) : '？？')),
        dayMaster: `${STEMS[c.day.stem]}${c.dayMaster}`,
        counts: ELEMENTS.map((e) => `${e}${c.counts[e]}`).join(' '),
        title: c.title,
        line: BAZI_TITLE_TEXT[c.title],
      }).then((res) => {
        ui.emit?.('share_image', { kind: 'bazi', result: res });
        if (res === 'saved') say('命盤卡存好了。');
      });
      return;
    }
    if (x === 'share' && mode === 'love') {
      // 姻緣卡不放生日和問題，只放生肖、桃花、星年與總評
      const c = chart;
      void shareLove({
        zodiac: ZODIAC[c.zodiac - 1],
        sign: SIGNS[c.sign - 1],
        taohua: ZODIAC[c.taohua - 1],
        hongluan: ZODIAC[c.hongluan - 1],
        tianxi: ZODIAC[c.tianxi - 1],
        year: `${c.year} ${yearGanzhi(c.year)}年`,
        title: c.title,
        line: LOVE_TITLE_TEXT[c.title],
      }).then((res) => {
        ui.emit?.('share_image', { kind: 'love', result: res });
        if (res === 'saved') say('姻緣卡存好了。');
      });
      return;
    }
    if (x === 'share') {
      const r = result;
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
      ui.emit?.('unlock_click', { product: product() });
      return void pay();
    }
    if (x === 'leave') return ui.leave();
    question = '';
    them = '';
    form();
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
    if (mode === 'bazi') return showBazi();
    if (mode === 'love') return showLove();
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
       ${crossSell()}
       <div class="card-actions"><button class="seal" data-a="again">換一對再合</button><button class="ghost" data-a="leave">回到廣場</button></div>`,
      onResult,
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
        btn.textContent =
          r.state === 'ready'
            ? `看完整${mode === 'bazi' ? '八字命盤' : mode === 'love' ? '姻緣盤' : '合緣'}（已解鎖）`
            : '請師傅動筆（已解鎖）';
      const login = document.getElementById('deep-login');
      if (login) login.hidden = !r.guest;
    });
  }
  const backToResult = `<button class="ghost" data-a="back">回到結果</button>`;
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
    const keep = (why) =>
      api.save({
        mode,
        you,
        them: mode === 'match' ? them : '',
        hour: mode === 'bazi' ? hour : null,
        topic: mode === 'bazi' ? topic : 'love',
        gender: mode === 'bazi' ? gender : 'n',
        question,
        sit,
        day: today(),
        why,
      });
    if (r.state === 'redirect') {
      keep('pay');
      say('付完了回到這裡，我就動筆。');
      location.assign(r.url);
    } else if (r.state === 'login') {
      keep('login');
      say('先登入，我才記得這是誰的盤。');
      ui.panel(
        `<h2>登入後再請師傅動筆</h2>
         <p class="note">登入完會回到算命攤，生日只存在這台瀏覽器裡。</p>
         <a class="seal linkbtn" href="/login">去登入</a>${backToResult}`,
        onBack,
      );
    } else if (r.state === 'owned') {
      startGenerate();
    } else {
      say(r.state === 'closed' ? '完整解讀還沒開張，過些日子再來。' : '這會兒忙不過來，稍後再試一次。');
      ui.panel(
        `<p class="note">${r.state === 'closed' ? '付費的完整解讀尚未開放。免費結果照常可以看。' : '沒有扣款。可以稍後再試。'}</p>${backToResult}`,
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
    say(
      mode === 'bazi'
        ? '我把你的四柱、五行和流年連起來看，稍候。'
        : mode === 'love'
          ? '我把你的桃花、紅鸞和流年連起來看，稍候。'
          : '我把你們兩個合起來看，稍候。',
    );
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
    ui.emit?.('deep_read', { product: product() });
    say('寫好了，慢慢看。');
    ui.panel(
      `<p class="kicker">${deepTitle()}</p>
       <p class="asked deep-q">${mode === 'bazi' ? `${[bazi.year, bazi.month, bazi.day, bazi.hour].map((p) => (p ? pillarName(p) : '？？')).join(' ')}．${STEMS[bazi.day.stem]}${bazi.dayMaster}日主` : mode === 'love' ? `${esc(person(chart))}．${chart.year} ${yearGanzhi(chart.year)}年` : `${esc(person(result.a))} × ${esc(person(result.b))}`}</p>
       ${question ? `<p class="asked deep-q">問．${esc(question)}</p>` : ''}
       <div class="deep-body" id="deep-body"></div>
       <p class="note small">${mode === 'bazi' ? '八字命盤為簡化的傳統命理參考' : `生肖星座${mode === 'love' ? '姻緣' : '合緣'}`}，供自我反思，不是預言。</p>
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
        mode = back.mode === 'love' || back.mode === 'bazi' ? back.mode : 'match';
        hour = back.hour ?? null;
        topic = back.topic || 'love';
        gender = back.gender || 'n';
        you = back.you;
        them = back.them;
        question = back.question;
        sit = back.sit;
        void compute().then((ok) => {
          if (!ok) return form();
          const [left, right] = tickets2();
          setTicket(0, left);
          setTicket(1, right);
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
      const saved = loadBirthday();
      if (saved && !you) {
        you = saved;
        keep = true;
      }
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
