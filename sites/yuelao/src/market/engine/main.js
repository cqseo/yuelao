import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createAvatar, HAIRS, OUTFITS } from './avatar.js';
import { createCrowd } from './crowd.js';
import { createHall } from './hall.js';
import { createInteract } from './interact.js';
import { createKoi } from './koi.js';
import { createPlazaNet } from './plaza-net.js';
import { createPool } from './pool.js';
import { createSutra } from './sutra.js';
import { createTarot } from './tarot.js';
import { audio, canvasTex, ease, stepTweens, tween, wait } from './util.js';
import { createWorld } from './world.js';
import { createYuelao } from './yuelao.js';

/**
 * 啟動 3D 集市。root 是 Market.tsx 渲染的那層外殼；回傳的函式用來收場
 * （離開頁面時停掉渲染循環、事件與聲音）。
 */
export function startMarket(root, opts = {}) {
  const $ = (s) => root.querySelector(s);
  const ac = new AbortController();
  const on = (type, fn) => window.addEventListener(type, fn, { signal: ac.signal });
  const emit = (name, props) => opts.onEvent?.(name, props);
  let dead = false;
  let raf = 0;
  const boot = $('#boot');
  const bootText = $('#boot-text');
  const bootBar = $('#boot-bar');
  const menu = $('#menu');
  const hud = $('#hud');
  const panel = $('#panel');
  const cardEl = $('#card');
  const hintEl = $('#hint');
  const sayEl = $('#say');
  const fade = $('#fade');
  const spots = $('#spots');
  const promptEl = $('#prompt');
  const stickEl = $('#stick');
  const coarse = matchMedia('(pointer: coarse)').matches;

  function bind(el, handler) {
    el.onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (b) handler(b.dataset.a);
    };
  }
  let sayTimer = 0;
  const ui = {
    panel(html, handler, scroll) {
      panel.innerHTML = html;
      panel.classList.toggle('show', !!html);
      panel.classList.toggle('scroll', !!scroll);
      if (handler) bind(panel, handler);
    },
    card(html, handler) {
      cardEl.innerHTML = html;
      cardEl.classList.toggle('show', !!html);
      if (handler) bind(cardEl, handler);
    },
    hint(text) {
      hintEl.textContent = text;
      hintEl.classList.toggle('show', !!text);
    },
    /** 掌櫃開口：名牌 + 一句話，逐字出現。空字串收起。 */
    say(name, text) {
      clearInterval(sayTimer);
      sayEl.classList.toggle('show', !!text);
      if (!text) return;
      sayEl.firstElementChild.textContent = name;
      const p = sayEl.lastElementChild;
      p.textContent = '';
      let i = 0;
      sayTimer = setInterval(() => {
        p.textContent = text.slice(0, ++i);
        if (i % 3 === 0) audio.tick(520, 0.03, 0.02);
        if (i >= text.length) clearInterval(sayTimer);
      }, 45);
    },
    ask: (text, o) => (opts.ask ? opts.ask(text, o) : Promise.reject(new Error('no ask'))),
    askStarters: () => opts.starters || [],
    aiStatus: () => opts.aiStatus?.() || { available: false },
    look: () => ({ ...avatar.state }),
    deep: opts.deep || null,
    leave: () => leaveRoom(),
    emit: (name, props) => emit(name, props),
  };

  const step = async (text, pct) => {
    if (dead) throw new Error('stopped');
    bootText.textContent = text;
    bootBar.style.width = `${pct}%`;
    await new Promise((r) => setTimeout(r, 30));
  };

  let renderer;
  let composer;
  let bloom;
  let world;
  const rooms = {};
  let active = null; // room object, or null while walking the market
  let mode = 'boot';
  const me = { x: 0, z: 43, yaw: 0, pitch: 0.1, y: 1.9, bob: 0, speed: 0, face: Math.PI };
  let avatar;
  let crowd;
  let koi;
  let net; // 廣場同遊
  let crowdBase = 0;
  let inter = null; // 左下互動、右下動作
  let seenOthers = false;
  let third = true; // third-person view (you see your own character); V or the 視角 button switches
  let tp = 0; // 0 = first person, 1 = third person; eased so the switch glides
  let wardrobe = false;
  let pool = null; // 許願池面板
  const input = { f: 0, s: 0, run: false };
  // 點地面自動走：一串路點，摇桿或按鍵一動就取消
  let autoPath = null;
  let autoStuck = 0;
  // 第一次來的人：操作提示留到真的走過一次才收起
  let walkedOnce = false;
  try {
    walkedOnce = localStorage.getItem('market-walked') === '1';
  } catch {}
  function markWalked() {
    if (walkedOnce) return;
    walkedOnce = true;
    try {
      localStorage.setItem('market-walked', '1');
    } catch {}
    setTimeout(() => mode === 'walk' && ui.hint(''), 1500);
  }
  const keys = new Set();

  // film pass: vignette, a little grain, slightly lifted contrast
  const FilmShader = {
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 } },
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uT; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uT) * 43758.5453); }
    void main(){
      vec4 c = clamp(texture2D(tDiffuse, vUv), 0.0, 1.0);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - dot(q, q) * 0.45;
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.1);
      c.rgb += (h(vUv * 900.0) - 0.5) * 0.004; // 幾乎不要顆粒：手機上顆粒只會讓畫面髒
      gl_FragColor = c;
    }`,
  };
  let film;

  async function start() {
    await step('正在備墨', 6);
    try {
      await Promise.all([
        document.fonts.load(`900 64px "Noto Serif TC"`, '月下集市'),
        document.fonts.load(`400 20px "Noto Serif TC"`, '月'),
      ]);
    } catch {}
    await step('正在鋪石板路', 18);
    renderer = new THREE.WebGLRenderer({
      canvas: $('#gl'),
      antialias: !coarse,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    await step('正在蓋房子、掛燈籠', 34);
    world = createWorld(renderer, coarse);
    world.setHour(skyHour);
    renderer.toneMappingExposure = world.sky.exposure;
    skyLabel();
    avatar = createAvatar(coarse);
    world.scene.add(avatar.root);
    crowdBase = coarse ? 6 : 12;
    crowd = createCrowd(world, crowdBase);
    koi = createKoi(world.scene);
    const onlineEl = document.createElement('span');
    onlineEl.id = 'online';
    $('#hud-title').after(onlineEl);
    net = createPlazaNet({
      scene: world.scene,
      coarse,
      look: () => ({ outfit: avatar.state.outfit, hair: avatar.state.hair }),
      fx: { act: remoteAct },
      onStation: (st) => onStation(st),
      onGo: (st) => onGo(st),
      onCount(n) {
        // 真人來了就撤掉幾個佈景路人，人一多廣場只剩真人
        crowd.limit(Math.max(coarse ? 1 : 2, crowdBase - Math.max(0, n - 1) * 2));
        onlineEl.textContent = n > 1 ? `此刻 ${n} 人` : '';
        if (n > 1 && !seenOthers) {
          seenOthers = true;
          if (mode === 'walk') {
            ui.hint('廣場上還有別人在逛。揮個手打招呼吧（右下「動作」）');
            setTimeout(() => mode === 'walk' && ui.hint(''), 5000);
          }
        }
      },
    });
    restoreLook();
    // 擁有的付費外觀要問過帳戶才知道；回來後再套一次上次的選擇
    shop?.owned().then((ids) => {
      if (dead) return;
      for (const id of ids) owned.add(id);
      if (!wardrobe) restoreLook();
    });
    await step('正在擺供桌', 62);
    rooms.yuelao = createYuelao(ui);
    await step('正在洗牌', 78);
    rooms.tarot = createTarot(ui);
    rooms.hall = createHall(ui);
    rooms.sutra = createSutra(ui);
    pool = createPool({ ui, world, api: opts.wishes || null, emit });
    void pool.refresh();

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(world.scene, world.camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.7, 0.82);
    bloom.strength = world.sky.bloom;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // after OutputPass, so the film curve works on display-range colour
    film = new ShaderPass(FilmShader);
    composer.addPass(film);

    buildLabels();
    resize();
    on('resize', resize);
    applyCam();
    await step('正在點燈', 90);
    for (const s of Object.values(rooms)) renderer.compile(s.scene, s.camera);
    render(0);
    await step('開市了', 100);
    boot.classList.add('gone');
    menu.classList.add('show');
    mode = 'menu';
    raf = requestAnimationFrame(loop);

    // #enter：從首頁按「入市」進來，不再顯示第二個入市選單，直接走進山門。
    // 換頁後瀏覽器還不准播聲音；audio 會在第一次點擊或按鍵時自己叫醒。
    if (location.hash === '#enter') {
      history.replaceState(null, '', location.pathname + location.search);
      void enterMarket();
      return;
    }
    // #street, #plaza, #yuelao, #ask, #tarot, #hall, #sutra, #wish jump straight in (首頁的鋪子卡片也用這些)
    const h = location.hash.slice(1);
    if (h) {
      menu.classList.remove('show');
      hud.classList.add('show');
      Object.assign(me, {
        x: h === 'plaza' ? 9 : 0,
        z: h === 'plaza' ? -12 : h === 'wish' ? world.pondR + 1.3 : world.spawn[1],
        pitch: h === 'wish' ? -0.12 : 0,
        y: 1.65,
      });
      // 許願池：站在池邊、面向許願樹，直接打開面板
      if (h === 'wish') me.yaw = yawTo(-me.x, -me.z);
      mode = 'walk';
      applyCam();
      if (h === 'wish') openPool();
      // #ask：進月老殿直接打開「問月老」
      const roomId = h === 'ask' ? 'yuelao' : h;
      if (h === 'ask') rooms.yuelao.intent = 'ask';
      net.start();
      const deep = world.rooms.find((x) => x.id === roomId);
      if (deep?.walkOnly) {
        // 大殿走得進去：直接站在供桌前、面向神像
        Object.assign(me, { x: deep.stand.x, z: deep.stand.z });
        me.yaw = yawTo(deep.door.x - me.x, deep.door.z - me.z);
        me.face = me.yaw + Math.PI;
        applyCam();
      } else if (rooms[roomId])
        enterRoom(
          world.rooms.find((x) => x.id === roomId),
          true,
        );
    }
  }

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    world.camera.aspect = w / h;
    world.camera.fov = w / h < 0.8 ? 80 : 62;
    world.camera.updateProjectionMatrix();
    // keep the table clear of the panel: shift the picture up on phones (bottom sheet), left on wide screens (side panel)
    const wide = w >= 900;
    for (const r of Object.values(rooms)) {
      r.resize(w / h);
      if (wide) r.camera.setViewOffset(w, h, w * 0.11, 0, w, h);
      else r.camera.setViewOffset(w, h, 0, h * 0.17, w, h);
      r.camera.updateProjectionMatrix();
    }
  }

  function applyCam() {
    const c = world.camera;
    c.rotation.set(me.pitch - tp * 0.16, me.yaw, 0);
    const eyeY = me.y + Math.sin(me.bob) * 0.035 * (1 - tp);
    if (tp < 0.01) {
      c.position.set(me.x, eyeY, me.z);
    } else {
      // orbit behind the walker; pull in if the camera would end up inside a building
      const p = c.rotation.x;
      const fx = -Math.sin(me.yaw) * Math.cos(p);
      const fy = Math.sin(p);
      const fz = -Math.cos(me.yaw) * Math.cos(p);
      let d = 4.6 * tp;
      while (d > 1.2 && !world.walkable(me.x - fx * d, me.z - fz * d)) d -= 0.35;
      c.position.set(me.x - fx * d, Math.max(0.5, eyeY + 0.05 * tp - fy * d), me.z - fz * d);
    }
    avatar.root.position.set(me.x, 0, me.z);
    avatar.root.rotation.y = me.face;
    avatar.root.children[0].visible = tp > 0.3;
  }

  // ---------- labels over doors, the room rail, the door prompt ----------
  const labelEls = [];
  function buildLabels() {
    spots.textContent = '';
    for (const l of world.labels) {
      const b = document.createElement('button');
      b.className = `spot${l.open ? '' : ' closed'}`;
      b.innerHTML = l.plain
        ? `<b>${l.name}</b><span>${l.sub}</span>`
        : l.open
          ? `<b>${l.name}</b><span>${l.sub}</span>`
          : `<b>${l.name}</b><span>${l.note || '籌備中'}</span>`;
      b.disabled = !l.open;
      if (l.wish) b.onclick = () => mode === 'walk' && goToPool();
      else if (l.open) b.onclick = () => mode === 'walk' && goTo(l.room);
      spots.appendChild(b);
      labelEls.push({ l, b });
    }
    inter ??= createInteract({ root, halls: world.rooms, run: runAction, emote: doEmote });
    promptEl.onclick = () => {
      if (mode !== 'walk') return;
      if (queued) leaveQueue('不排了。');
      else if (avatar.holding) standUp();
      else if (nearCushion) kneelHere(nearCushion);
      else if (near) enterRoom(near);
      else if (nearPool) openPool();
      else if (nearBurner) offerIncense();
    };
  }
  const v = new THREE.Vector3();
  let near = null;
  let nearPool = false;
  let nearBurner = false;
  let nearCushion = null;
  let lastIncense = -99;
  /** 銅香爐前上香：人物鞠躬、爐裡插上三炷香冒煙。純儀式，不存任何東西。 */
  /** 爐前的「上香」按鈕：有人在用或在排就去排隊，否則直接上。 */
  function offerIncense() {
    if (shared()) runAction('incense');
    else incenseNow();
  }
  function incenseNow() {
    const t = clock.elapsedTime;
    if (t - lastIncense < 3) return;
    lastIncense = t;
    autoPath = null;
    // 面向香爐
    me.face = Math.atan2(world.burner.x - me.x, world.burner.z - me.z);
    avatar.bow();
    world.offerIncense(t);
    net.act('incense');
    audio.bell(330, 0.12, 3);
    emit('market_incense');
    ui.hint('三炷清香，心意已到');
    setTimeout(() => mode === 'walk' && ui.hint(''), 3500);
  }
  // ---------- 互動選單：點一項，走過去、到了就做 ----------
  /** 從目前位置走到 (x, z)；會先從山門外進廣場、繞開許願池。 */
  async function walkTo(x, z, speed = 6) {
    const pts = [];
    if (me.z > world.spawn[1] + 1) {
      pts.push(world.spawn);
    }
    const from = pts.length ? world.spawn : [me.x, me.z];
    const dx = x - from[0];
    const dz = z - from[1];
    const u = Math.max(0, Math.min(1, -(from[0] * dx + from[1] * dz) / (dx * dx + dz * dz || 1)));
    let nx = from[0] + dx * u;
    let nz = from[1] + dz * u;
    const d = Math.hypot(nx, nz);
    const clear = world.pondR + 1.5;
    if (d < clear && Math.hypot(x, z) > world.pondR) {
      if (d < 0.5) {
        nx = -dz;
        nz = dx;
      }
      const n = Math.hypot(nx, nz) || 1;
      pts.push([(nx / n) * (clear + 1), (nz / n) * (clear + 1)]);
    }
    pts.push([x, z]);
    await walkPath(pts, speed);
  }
  async function faceTo(x, z) {
    const want = Math.atan2(x - me.x, z - me.z);
    const f0 = me.face;
    const f1 = turn(f0, want);
    const y0 = me.yaw;
    const y1 = turn(y0, yawTo(x - me.x, z - me.z));
    await tween(0.4, (k) => {
      me.face = f0 + (f1 - f0) * k;
      me.yaw = y0 + (y1 - y0) * k;
      applyCam();
    });
  }
  function standUp() {
    if (!avatar.holding) return;
    avatar.hold(null);
    net.hold('');
    release('cushion');
    // 從池沿上站起來，往外跨一步，免得卡在池子裡
    const r = Math.hypot(me.x, me.z);
    if (r < world.pondR + 0.3) {
      me.x = (me.x / (r || 1)) * (world.pondR + 0.4);
      me.z = (me.z / (r || 1)) * (world.pondR + 0.4);
    }
    applyCam();
  }
  /** 依序走到某處再做事；走的途中 mode 是 moving，到了回到 walk。 */
  async function go(fn) {
    if (mode !== 'walk') return;
    standUp();
    autoPath = null;
    if (wardrobe) closeWardrobe();
    pool?.close();
    mode = 'moving';
    ui.hint('');
    try {
      await fn();
    } finally {
      if (mode === 'moving') mode = 'walk';
    }
  }
  const poolEdge = (gap) => {
    const d = Math.hypot(me.x, me.z) || 1;
    const sx = me.z > world.spawn[1] + 1 ? world.spawn[0] : me.x;
    const sz = me.z > world.spawn[1] + 1 ? world.spawn[1] : me.z;
    const n = Math.hypot(sx, sz) || d;
    return [(sx / n) * (world.pondR + gap), (sz / n) * (world.pondR + gap)];
  };
  // ---------- 排隊（參考心安宮）：殿前銅爐一次一人、兩個蒲團一次兩人 ----------
  // 廣場上有別人時才排；輪到了伺服器會通知（go），用完就放開。鋪子不排隊。
  const ST_NAME = { burner: '上香', cushion: '跪拜' };
  const ST_CAP = { burner: 1, cushion: 2 };
  let queued = null; // { st, pos }
  let using = '';
  /** 隊伍站位：爐前右側排一列（上香），左側排一列（跪拜）。 */
  function queueSpot(st, k) {
    const side = st === 'burner' ? 3.6 : -3.6;
    return [world.burner.x + side, world.burner.z + 4.2 + k * 1.3];
  }
  const shared = () => net.live && net.count > 1;
  function needQueue(st) {
    if (!shared()) return false;
    const s = net.station(st);
    return s.use.length >= ST_CAP[st] || s.queue.length > 0;
  }
  function joinQueue(st) {
    queued = { st, pos: -1 };
    net.queue(st);
    emit('market_queue', { st });
    showQueue();
  }
  function leaveQueue(why) {
    if (!queued) return;
    queued = null;
    net.queue('');
    if (why && mode === 'walk') {
      ui.hint(why);
      setTimeout(() => mode === 'walk' && ui.hint(''), 3000);
    }
  }
  function release(st) {
    if (using !== st) return;
    using = '';
    net.queue('');
  }
  function showQueue() {
    if (!queued) return;
    const s = net.station(queued.st);
    const k = s.queue.indexOf(net.id);
    const name = ST_NAME[queued.st];
    ui.hint(
      k <= 0
        ? `排隊${name}：下一位就是你。想走開就按「不排了」。`
        : `排隊${name}：前面還有 ${k} 位。想走開就按「不排了」。`,
    );
    // 往前挪到自己在隊伍裡的位置
    if (k >= 0 && k !== queued.pos && mode === 'walk' && !autoPath) {
      queued.pos = k;
      const [x, z] = queueSpot(queued.st, k);
      if (Math.hypot(x - me.x, z - me.z) > 0.3) autoPath = [[x, z]];
    }
  }
  /** 等目前的走位或動畫做完再執行（輪到時角色可能還在往隊伍走）。 */
  function whenWalking(fn, tries = 30) {
    if (mode === 'walk') fn();
    else if (mode === 'moving' && tries > 0) setTimeout(() => whenWalking(fn, tries - 1), 200);
  }
  function onStation(st) {
    if (queued?.st === st) showQueue();
  }
  function onGo(st) {
    if (queued?.st !== st) {
      // 已經不排了才輪到：直接讓出去
      net.queue('');
      return;
    }
    queued = null;
    using = st;
    ui.hint(`輪到你${ST_NAME[st]}了`);
    audio.tick(660, 0.05, 0.05);
    whenWalking(() => go(st === 'burner' ? doIncense : doKneel));
  }
  async function doIncense() {
    await walkTo(world.burner.x, world.burner.z + 3.1);
    await faceTo(world.burner.x, world.burner.z);
    mode = 'walk';
    incenseNow();
    // 拜完讓給下一位
    setTimeout(() => release('burner'), 4500);
  }
  async function doKneel() {
    // 兩個蒲團：照使用順序分左右；一個人時挑近的那個
    const s = net.station('cushion');
    const idx = s.use.indexOf(net.id);
    const left = idx >= 0 && s.use.length > 1 ? idx === 0 : me.x < world.burner.x;
    const cx = world.burner.x + (left ? -1.6 : 1.6);
    await walkTo(cx, world.burner.z + 3.4);
    await faceTo(cx, world.burner.z - 6);
    avatar.hold('kneel');
    net.hold('kneel');
    audio.bell(262, 0.1, 4);
    ui.hint('跪下來，靜一靜。想起身就按「起身」，或直接走開。');
    setTimeout(() => ui.hint(''), 4000);
  }
  /** 大殿供桌前上香：鞠躬、香爐冒煙，在場的人也看得到。 */
  let lastOffer = -99;
  function hallOffer() {
    const t = clock.elapsedTime;
    if (mode !== 'walk' || t - lastOffer < 3) return;
    lastOffer = t;
    standUp();
    const hs = world.hallShrine;
    me.face = Math.atan2(hs.door.x - me.x, hs.door.z - me.z);
    avatar.bow();
    hs.offer();
    net.act('offer');
    audio.bell(294, 0.14, 4);
    emit('market_hall_offer');
    ui.hint('香已上。願望放在心裡就好。');
    setTimeout(() => mode === 'walk' && ui.hint(''), 3500);
  }
  /** 殿裡的蒲團：站正、面向神像、跪下。 */
  function kneelHere(c) {
    go(async () => {
      await walkPath([[c.x, c.z]], 3);
      const f = (c.shrine || world.shrine).faceTo;
      await faceTo(f.x, f.z);
      avatar.hold('kneel');
      net.hold('kneel');
      audio.bell(262, 0.1, 4);
      emit('market_shrine_kneel');
      ui.hint('跪在月老面前，心裡想著那個人。想起身就按「起身」。');
      setTimeout(() => ui.hint(''), 4000);
    });
  }
  function runAction(id) {
    if (mode !== 'walk') return;
    emit('market_action', { id });
    if (id.startsWith('room:')) {
      const r = world.rooms.find((x) => x.id === id.slice(5));
      if (r?.open) {
        standUp();
        goTo(r);
      }
      return;
    }
    if (id === 'wish') {
      standUp();
      goToPool();
      return;
    }
    if (id === 'look') {
      standUp();
      openWardrobe();
      return;
    }
    if (id === 'incense' || id === 'kneel') {
      const st = id === 'incense' ? 'burner' : 'cushion';
      // 有別人在場就照規矩排：空著的話伺服器馬上讓你用（go），不然走到隊伍裡等
      if (shared()) {
        if (queued?.st === st || using === st) return;
        if (queued) leaveQueue();
        // 先走到殿前再排：人還在大老遠，不該先占著爐子讓別人等
        const [qx, qz] = queueSpot(st, 0);
        if (Math.hypot(qx - me.x, qz - me.z) > 6)
          return go(async () => {
            await walkTo(qx, qz + 2.5);
            mode = 'walk';
            joinQueue(st);
          });
        standUp();
        joinQueue(st);
        return;
      }
      return go(st === 'burner' ? doIncense : doKneel);
    }
    if (id === 'sit')
      return go(async () => {
        const [x, z] = poolEdge(0.4);
        await walkTo(x, z);
        // 坐上池沿，背對池子
        const r = world.pondR - 0.35;
        const n = Math.hypot(x, z) || 1;
        await tween(0.5, (k) => {
          me.x = x + ((x / n) * r - x) * k;
          me.z = z + ((z / n) * r - z) * k;
          applyCam();
        });
        me.face = Math.atan2(me.x, me.z);
        avatar.hold('sit');
        net.hold('sit');
        ui.hint('在池邊歇一會兒。想起身就按「起身」，或直接走開。');
        setTimeout(() => ui.hint(''), 4000);
      });
    if (id === 'feed')
      return go(async () => {
        const [x, z] = poolEdge(0.4);
        await walkTo(x, z);
        await faceTo(0, 0);
        avatar.emote('wave');
        await wait(0.5);
        koi.feed(me.x, me.z, clock.elapsedTime);
        net.act('feed');
        audio.tick(880, 0.04, 0.05);
        ui.hint('撒了一把飼料，錦鯉都游過來了。');
        setTimeout(() => ui.hint(''), 3500);
      });
  }

  // ---------- 動作：揮手、作揖、合十、比心 ----------
  const hearts = [];
  let heartMap = null;
  function doEmote(kind) {
    if (mode !== 'walk') return;
    standUp();
    autoPath = null;
    const len = avatar.emote(kind);
    if (!len) return;
    emit('market_emote', { kind });
    if (kind === 'bow' || kind === 'pray') audio.bell(392, 0.08, 2.5);
    net.act(kind);
    if (kind === 'heart') spawnHearts(me.x, me.z);
    // 第一人稱看不到自己，動作時暫時切到第三人稱的效果交給鏡頭：只提示一下
    if (!third) ui.hint('切到第三人稱（右上角）就看得到自己的動作');
    const n = crowd.react(me.x, me.z, kind);
    if (n && third) setTimeout(() => mode === 'walk' && ui.hint('附近的人也回了你一個'), 1400);
    if (n || !third) setTimeout(() => mode === 'walk' && ui.hint(''), 3800);
  }
  /** 別人做的動作：在他的角色身上播出來。 */
  function remoteAct(a, x, z, av) {
    const t = clock.elapsedTime;
    if (a === 'incense') {
      av.emote('bow');
      world.offerIncense(t);
    } else if (a === 'offer') {
      av.emote('bow');
      world.hallShrine?.offer();
    } else if (a === 'feed') {
      av.emote('wave');
      koi.feed(x, z, t);
    } else {
      av.emote(a);
      if (a === 'heart') spawnHearts(x, z);
    }
  }
  function spawnHearts(x, z) {
    heartMap ??= canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#ff4f6d';
      g.beginPath();
      g.moveTo(w / 2, w * 0.86);
      g.bezierCurveTo(w * 0.05, w * 0.55, w * 0.1, w * 0.12, w / 2, w * 0.3);
      g.bezierCurveTo(w * 0.9, w * 0.12, w * 0.95, w * 0.55, w / 2, w * 0.86);
      g.fill();
    });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: heartMap,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      s.scale.setScalar(0.45);
      s.position.set(x + (i - 1) * 0.25, 2.2, z);
      world.scene.add(s);
      hearts.push({ s, t: -i * 0.25 });
    }
  }
  function updateHearts(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.t += dt;
      if (h.t < 0) {
        h.s.visible = false;
        continue;
      }
      h.s.visible = true;
      h.s.position.y += dt * 0.7;
      h.s.material.opacity = Math.max(0, 1 - h.t / 2.6);
      if (h.t > 2.6) {
        world.scene.remove(h.s);
        h.s.material.dispose();
        hearts.splice(i, 1);
      }
    }
  }

  function placeLabels() {
    const show = mode === 'walk';
    // 開著池邊或衣櫥面板時收起兩顆圓鈕，免得壓住面板底部的按鈕
    inter?.visible(show && !wardrobe && !pool?.isOpen);
    const cp = world.camera.position;
    for (const { l, b } of labelEls) {
      v.copy(l.pos).project(world.camera);
      const dist = l.pos.distanceTo(cp);
      const ok = show && v.z < 1 && dist < 34 && dist > 2.5 && Math.abs(v.x) < 1.2;
      b.style.display = ok ? '' : 'none';
      if (ok) {
        b.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * innerWidth}px,${((1 - v.y) / 2) * innerHeight}px)`;
        b.style.opacity = String(Math.min(1, (34 - dist) / 8));
      }
    }
    near = null;
    if (show)
      for (const r of world.rooms)
        if (r.open && Math.hypot(r.stand.x - me.x, r.stand.z - me.z) < 3.6) near = r;
    const fromCentre = Math.hypot(me.x, me.z);
    nearPool = show && !near && fromCentre < world.pondR + 2.6;
    // 走離池邊就把許願面板收起來
    if (pool?.isOpen && show && fromCentre > world.pondR + 9) pool.close();
    // 月老殿裡的蒲團：站上去就能跪拜
    nearCushion = null;
    if (show)
      for (const sh of [world.shrine, world.hallShrine])
        for (const c of sh?.cushions || [])
          if (Math.hypot(c.x - me.x, c.z - me.z) < 0.75) nearCushion = Object.assign(c, { shrine: sh });
    nearBurner =
      show && !near && !nearPool && Math.hypot(world.burner.x - me.x, world.burner.z - me.z) < world.burner.r;
    const panel = !!pool?.isOpen || !!wardrobe;
    const sitting = show && !!avatar.holding;
    const inLine = show && !!queued;
    const wantPrompt = !panel && (inLine || sitting || !!nearCushion || !!near || nearPool || nearBurner);
    promptEl.classList.toggle('show', wantPrompt);
    if (inLine) promptEl.textContent = '不排了';
    else if (sitting) promptEl.textContent = '起身';
    else if (nearCushion) promptEl.textContent = '跪拜';
    else if (near)
      promptEl.textContent = near.walkOnly
        ? clock.elapsedTime - lastOffer < 3
          ? '心意已到'
          : '上香'
        : near.inside
          ? '求籤'
          : `進入${near.name}`;
    else if (nearPool) promptEl.textContent = '到池邊許願';
    else if (nearBurner)
      promptEl.textContent =
        clock.elapsedTime - lastIncense < 3 ? '心意已到' : needQueue('burner') ? '排隊上香' : '上香';
    // 觸控：走動時搖桿一直在左下；開了面板就收起
    stickEl.classList.toggle('fixed', coarse && show && !panel);
  }

  // ---------- getting around ----------
  const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
  function turn(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  }
  async function walkPath(points, speed = 7.5) {
    for (const [x, z] of points) {
      const x0 = me.x;
      const z0 = me.z;
      const dist = Math.hypot(x - x0, z - z0);
      if (dist < 0.2) continue;
      const y0 = me.yaw;
      const y1 = turn(y0, yawTo(x - x0, z - z0));
      const p0 = me.pitch;
      await tween(
        Math.max(0.5, dist / speed),
        (k, lin) => {
          me.x = x0 + (x - x0) * k;
          me.z = z0 + (z - z0) * k;
          me.yaw = y0 + (y1 - y0) * Math.min(1, lin * 3);
          me.pitch = p0 * (1 - Math.min(1, lin * 3));
          me.bob += 0.22;
          me.speed = 4.2;
          me.face = turn(me.face, me.yaw + Math.PI);
          applyCam();
        },
        ease.inOut,
      );
    }
  }

  async function enterMarket() {
    audio.init();
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission)
      DeviceMotionEvent.requestPermission().catch(() => {});
    menu.classList.remove('show');
    mode = 'moving';
    emit('market_enter');
    net.start();
    audio.bell(330, 0.2, 5);
    const y0 = me.y;
    tween(2.5, (k) => (me.y = y0 + (1.65 - y0) * k));
    // 每個人進門的落腳點錯開一點，同時進來的人才不會疊在一起
    const jx = world.spawn[0] + (Math.random() - 0.5) * 6;
    const jz = world.spawn[1] + (Math.random() - 0.5) * 2;
    await walkPath([[jx, jz]], 4.6);
    hud.classList.add('show');
    $('#back').hidden = true;
    mode = 'walk';
    ui.hint(
      coarse
        ? '推下方的搖桿走動（推到圈外會跑），點地面就走過去；左下「互動」選要做的事，右下「動作」打招呼'
        : 'WASD 走動（Shift 跑），點地面就走過去，拖曳轉視角；左下「互動」選要做的事，右下「動作」打招呼',
    );
    // 老客人 8 秒後收起；第一次來的人等真的走動過再收
    if (walkedOnce) setTimeout(() => mode === 'walk' && ui.hint(''), 8000);
  }

  /** 走到某間房門口再進去：從山門外先進廣場；直線會穿過許願池就繞半圈。 */
  async function goTo(r) {
    if (mode !== 'walk') return;
    mode = 'moving';
    ui.hint('');
    const pts = [];
    let x = me.x;
    let z = me.z;
    if (z > world.spawn[1] + 1) {
      pts.push(world.spawn);
      [x, z] = world.spawn;
    }
    const dx = r.stand.x - x;
    const dz = r.stand.z - z;
    const u = Math.max(0, Math.min(1, -(x * dx + z * dz) / (dx * dx + dz * dz || 1)));
    let nx = x + dx * u;
    let nz = z + dz * u;
    const near = Math.hypot(nx, nz);
    const clear = world.pondR + 2.5;
    if (near < clear) {
      if (near < 0.5) {
        nx = -dz;
        nz = dx;
      }
      const n = Math.hypot(nx, nz);
      pts.push([(nx / n) * (clear + 1.5), (nz / n) * (clear + 1.5)]);
    }
    if (r.inside) pts.push([r.entry.x, r.entry.z]); // 走得進去的殿：先到殿門口再進去
    pts.push([r.stand.x, r.stand.z]);
    await walkPath(pts);
    if (r.walkOnly) {
      // 大殿：走進來就到了，不轉場。面向神像，告訴人可以做什麼
      await faceTo(r.door.x, r.door.z);
      mode = 'walk';
      ui.hint('到大殿了。在供桌前可以上香，站上蒲團可以跪拜；在場的人都看得到。');
      setTimeout(() => mode === 'walk' && ui.hint(''), 5000);
      return;
    }
    enterRoom(r, false, true);
  }

  /** 走到池邊離自己最近的那一點，面向許願樹，打開許願面板。 */
  async function goToPool(focusId) {
    if (mode !== 'walk') return;
    mode = 'moving';
    ui.hint('');
    const pts = [];
    let x = me.x;
    let z = me.z;
    if (z > world.spawn[1] + 1) {
      pts.push(world.spawn);
      [x, z] = world.spawn;
    }
    const d = Math.hypot(x, z) || 1;
    const rim = world.pondR + 1.3;
    if (d > rim + 0.4) pts.push([(x / d) * rim, (z / d) * rim]);
    await walkPath(pts, 6);
    const y0 = me.yaw;
    const y1 = turn(y0, yawTo(-me.x, -me.z));
    await tween(0.45, (k) => {
      me.yaw = y0 + (y1 - y0) * k;
      me.pitch = me.pitch * (1 - k) + -0.12 * k;
      applyCam();
    });
    mode = 'walk';
    openPool(focusId);
  }
  function openPool(focusId) {
    if (!pool) return;
    if (wardrobe) closeWardrobe();
    pool.show(focusId || null);
  }

  async function enterRoom(r, instant, arrived) {
    if (r.walkOnly) {
      // 走得進去、不用轉場的殿：「進入」就是在供桌前上香
      hallOffer();
      return;
    }
    mode = 'moving';
    if (wardrobe) closeWardrobe();
    pool?.close();
    ui.hint('');
    promptEl.classList.remove('show');
    if (!instant) {
      if (!arrived) await walkPath([[r.stand.x, r.stand.z]], 5);
      const y0 = me.yaw;
      const y1 = turn(y0, yawTo(r.door.x - me.x, r.door.z - me.z));
      await tween(0.5, (k) => {
        me.yaw = y0 + (y1 - y0) * k;
        me.pitch *= 1 - k;
        applyCam();
      });
      if (r.inside) {
        // 已經站在神前了：鞠個躬就開始求籤，不再往門裡走
        avatar.bow();
        await wait(0.9);
        fade.classList.add('on');
        await wait(0.35);
      } else {
        fade.classList.add('on');
        const x0 = me.x;
        const z0 = me.z;
        await tween(
          0.55,
          (k) => {
            me.x = x0 + (r.door.x - x0) * k * 0.8;
            me.z = z0 + (r.door.z - z0) * k * 0.8;
            applyCam();
          },
          ease.lin,
        );
      }
    } else fade.classList.add('on');
    leaveQueue();
    release('burner');
    release('cushion');
    net.hold('away');
    active = rooms[r.id];
    active.from = r;
    emit('market_room_open', { room: r.id });
    composer.passes[0].scene = active.scene;
    composer.passes[0].camera = active.camera;
    bloom.strength = 0.28;
    bloom.threshold = 0.9;
    renderer.toneMappingExposure = 1.05; // 室內不受天色影響
    $('#hud-title').textContent = active.title;
    $('#back').hidden = false;
    active.enter();
    mode = 'room';
    await wait(0.15);
    fade.classList.remove('on');
  }

  async function leaveRoom() {
    if (mode !== 'room') return;
    mode = 'moving';
    fade.classList.add('on');
    await wait(0.5);
    const r = active.from;
    active.exit();
    active = null;
    composer.passes[0].scene = world.scene;
    composer.passes[0].camera = world.camera;
    bloom.strength = world.sky.bloom;
    bloom.threshold = 0.82;
    renderer.toneMappingExposure = world.sky.exposure;
    // 回到廣場：站在門外，沿著圓環朝大殿那一側看，鏡頭才不會卡進屋子裡。
    // 走得進去的殿：就站在神前，面向神像
    const px = r.inside ? r.stand.x : r.stand.x + r.fx * 0.6;
    const pz = r.inside ? r.stand.z : r.stand.z + r.fz * 0.6;
    let tx = -pz;
    let tz = px;
    if (tz > 0) {
      tx = -tx;
      tz = -tz;
    }
    if (r.inside) {
      tx = r.door.x - px;
      tz = r.door.z - pz;
    }
    const yaw = yawTo(tx, tz);
    Object.assign(me, { x: px, z: pz, yaw, pitch: 0, y: 1.65, face: yaw + Math.PI });
    applyCam();
    net.start();
    net.move(me.x, me.z, me.face, clock.elapsedTime, true);
    setTimeout(() => net.hold(''), 200);
    $('#back').hidden = true;
    mode = 'walk';
    fade.classList.remove('on');
  }

  // ---------- input ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hitTest(e, objects, camera) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objects, true)[0] || null;
  }
  /** 點到樹上的願望牌就回傳那則願望的 id。太遠（32m 以上）不算。 */
  function plateHit(e) {
    if (!world.wishPick?.count) return null;
    const h = hitTest(e, [world.wishPick], world.camera);
    return h && h.distance < 32 && h.instanceId !== undefined ? world.wishAt(h.instanceId) : null;
  }
  /** 搖桿：圈內走、推出底座（約 60px）就跑。 */
  function moveStick(e) {
    const dx = e.clientX - stick.x;
    const dy = e.clientY - stick.y;
    const len = Math.hypot(dx, dy);
    const k = Math.min(1, len / 46);
    input.s = len ? (dx / len) * k : 0;
    input.f = len ? (-dy / len) * k : 0;
    input.run = len > 62;
    stickEl.classList.toggle('run', input.run);
    stickEl.firstElementChild.style.transform = `translate(${(len ? dx / len : 0) * Math.min(len, 62)}px,${(len ? dy / len : 0) * Math.min(len, 62)}px)`;
  }
  // ---------- 點地面自動走 ----------
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundHit = new THREE.Vector3();
  let marker = null;
  /** 從目前位置走到 (x, z)：直線會穿過許願池就先繞到池邊。 */
  function planTo(x, z) {
    const pts = [];
    const dx = x - me.x;
    const dz = z - me.z;
    const u = Math.max(0, Math.min(1, -(me.x * dx + me.z * dz) / (dx * dx + dz * dz || 1)));
    const nx = me.x + dx * u;
    const nz = me.z + dz * u;
    const near = Math.hypot(nx, nz);
    const clear = world.pondR + 1.2;
    if (near < clear) {
      // 往路線偏的那一側繞；剛好穿過圓心就往右繞
      let ox = nx;
      let oz = nz;
      if (near < 0.3) {
        ox = -dz;
        oz = dx;
      }
      const n = Math.hypot(ox, oz) || 1;
      pts.push([(ox / n) * (clear + 0.8), (oz / n) * (clear + 0.8)]);
    }
    pts.push([x, z]);
    return pts;
  }
  function tapGround(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, world.camera);
    if (!ray.ray.intersectPlane(groundPlane, groundHit)) return false;
    let d = Math.hypot(groundHit.x - me.x, groundHit.z - me.z);
    // 點得太遠（接近地平線）就先往那個方向走一段
    if (d > 30) {
      groundHit.x = me.x + ((groundHit.x - me.x) / d) * 30;
      groundHit.z = me.z + ((groundHit.z - me.z) / d) * 30;
      d = 30;
    }
    if (d < 0.6 || !world.walkable(groundHit.x, groundHit.z)) return false;
    standUp();
    if (queued) {
      const [qx, qz] = queueSpot(queued.st, Math.max(0, queued.pos));
      if (Math.hypot(qx - groundHit.x, qz - groundHit.z) > 3) leaveQueue('走出隊伍，不排了。');
    }
    autoPath = planTo(groundHit.x, groundHit.z);
    autoStuck = 0;
    if (!marker) {
      marker = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.4, 32),
        new THREE.MeshBasicMaterial({ color: 0xdcbb7c, transparent: true, opacity: 0.9, toneMapped: false }),
      );
      marker.rotation.x = -Math.PI / 2;
      world.scene.add(marker);
    }
    marker.position.set(groundHit.x, 0.04, groundHit.z);
    marker.visible = true;
    marker.userData.t = 0;
    emit('market_tap_walk');
    markWalked();
    return true;
  }
  const gl = $('#gl');
  let look = null; // pointer that turns the view
  let stick = null; // pointer that drives the joystick (touch only)
  gl.addEventListener('pointerdown', (e) => {
    gl.setPointerCapture(e.pointerId);
    if (mode === 'room') {
      active.onDown(hitTest(e, active.pick(), active.camera));
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      return;
    }
    if (mode !== 'walk') return;
    // 觸控：左下那塊按下就是搖桿。搖桿底座固定在左下角、一直看得到；
    // 中心取底座中心（不是手指落點），推出底座外圈就跑。
    const sr = stickEl.getBoundingClientRect();
    const fixed = stickEl.classList.contains('fixed') && sr.width > 0;
    const scx = sr.left + sr.width / 2;
    const scy = sr.top + sr.height / 2;
    const onBase = fixed
      ? Math.hypot(e.clientX - scx, e.clientY - scy) < 96
      : e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.4;
    if (e.pointerType === 'touch' && !stick && onBase) {
      const cx = fixed ? scx : e.clientX;
      const cy = fixed ? scy : e.clientY;
      stick = { id: e.pointerId, x: cx, y: cy };
      if (!fixed) {
        stickEl.style.left = `${e.clientX}px`;
        stickEl.style.top = `${e.clientY}px`;
      }
      stickEl.classList.add('show');
      autoPath = null;
      moveStick(e);
      return;
    }
    if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  });
  gl.addEventListener('pointermove', (e) => {
    if (mode === 'room' && active.onHover && e.pointerType !== 'touch') {
      const hit = hitTest(e, active.pick(), active.camera);
      active.onHover(hit);
      gl.style.cursor = hit ? 'pointer' : '';
    }
    if (stick && e.pointerId === stick.id) {
      moveStick(e);
      return;
    }
    if (!look || e.pointerId !== look.id) {
      if (mode === 'walk' && e.pointerType !== 'touch')
        gl.style.cursor = hitTest(e, world.doors, world.camera) || plateHit(e) !== null ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - look.x;
    const dy = e.clientY - look.y;
    look.x = e.clientX;
    look.y = e.clientY;
    look.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'room' && active.onDrag) active.onDrag(dx, dy);
    if (mode === 'walk') {
      const k = e.pointerType === 'touch' ? 0.0055 : 0.0035;
      me.yaw += dx * k;
      me.pitch = THREE.MathUtils.clamp(me.pitch + dy * k, -0.6, 0.75);
    }
  });
  const end = (e) => {
    if (stick && e.pointerId === stick.id) {
      stick = null;
      input.f = input.s = 0;
      input.run = false;
      stickEl.classList.remove('show', 'run');
      stickEl.firstElementChild.style.transform = '';
      return;
    }
    if (!look || e.pointerId !== look.id) return;
    if (mode === 'walk' && look.moved < 8) {
      const hit = hitTest(e, world.doors, world.camera);
      const plate = hit ? null : plateHit(e);
      if (hit && hit.distance < 30) goTo(world.rooms.find((r) => r.id === hit.object.userData.room));
      else if (plate) {
        emit('wish_plate_tap');
        if (Math.hypot(me.x, me.z) < world.pondR + 3) openPool(plate);
        else goToPool(plate);
      } else if (!wardrobe && !pool?.isOpen) tapGround(e);
    }
    if (mode === 'room') {
      if (look.moved < 8 && active.onTap) active.onTap(hitTest(e, active.pick(), active.camera));
      active.onUp();
    }
    look = null;
  };
  gl.addEventListener('pointerup', end);
  gl.addEventListener('pointercancel', end);
  const KEYMAP = {
    w: 'f',
    arrowup: 'f',
    s: 'b',
    arrowdown: 'b',
    a: 'l',
    d: 'r',
    arrowleft: 'tl',
    arrowright: 'tr',
    q: 'tl',
    e: 'tr',
  };
  on('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (mode === 'room' && k === 'escape') leaveRoom();
    if (mode === 'walk' && pool?.isOpen && k === 'escape') pool.close();
    // 在面板的輸入框裡打字時，不要把按鍵當成走路或開門
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (KEYMAP[k]) keys.add(KEYMAP[k]);
    if (k === 'shift') keys.add('run');
    if (mode === 'walk' && k === 'escape') inter?.close();
    if (mode === 'walk' && (k === 'enter' || k === 'f') && avatar.holding) standUp();
    else if (mode === 'walk' && (k === 'enter' || k === 'f') && nearCushion) kneelHere(nearCushion);
    else if (mode === 'walk' && (k === 'enter' || k === 'f') && near) enterRoom(near);
    else if (mode === 'walk' && (k === 'enter' || k === 'f') && nearPool && !pool?.isOpen) openPool();
    else if (mode === 'walk' && (k === 'enter' || k === 'f') && nearBurner && !wardrobe) offerIncense();
    if (mode === 'walk' && k === 'v') toggleView();
  });
  on('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (KEYMAP[k]) keys.delete(KEYMAP[k]);
    if (k === 'shift') keys.delete('run');
  });
  on('blur', () => keys.clear());
  on('devicemotion', (e) => {
    const a = e.acceleration;
    if (!a || mode !== 'room') return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (mag > 6) active.onShake(mag);
  });
  function toggleView() {
    third = !third;
    emit('market_view', { third });
    $('#view').textContent = third ? '第一人稱' : '第三人稱';
  }
  // ---------- 外觀：免費款隨便換；付費款可試穿，買了才留得住 ----------
  const saved = {};
  const owned = new Set();
  const shop = opts.shop || null;
  const itemId = (key, id) => `${key}_${id}`;
  const usable = (key, o) => o.free || owned.has(itemId(key, o.id));
  const listOf = (key) => (key === 'outfit' ? OUTFITS : HAIRS);
  /** 讀回上次的選擇，只套用現在用得了的（免費的，或這個帳號擁有的）。 */
  function restoreLook() {
    let want = {};
    try {
      want = JSON.parse(localStorage.getItem('market-look') || '{}') || {};
    } catch {}
    for (const key of ['outfit', 'hair']) {
      const o = listOf(key).find((x) => x.id === want[key]);
      if (o && usable(key, o)) saved[key] = o.id;
    }
    avatar.apply({ outfit: saved.outfit || 'moon', hair: saved.hair || 'bun' });
  }
  function keep(key, id) {
    saved[key] = id;
    try {
      localStorage.setItem('market-look', JSON.stringify(saved));
    } catch {}
  }
  let trying = null; // 正在試穿、還沒擁有的那一件：{ key, o }
  let shopNote = '';
  function openWardrobe() {
    if (mode !== 'walk') return;
    if (pool?.isOpen) pool.close();
    if (!wardrobe) {
      emit('market_wardrobe_open');
      trying = null;
      shopNote = '';
    }
    wardrobe = true;
    third = true;
    $('#view').textContent = '第一人稱';
    const tag = (key, o) => {
      if (usable(key, o)) return o.free ? '' : '<span>已擁有</span>';
      return `<span>${shop?.prices[itemId(key, o.id)] || '之後開放'}</span>`;
    };
    const sw = (key) =>
      listOf(key)
        .map(
          (o) =>
            `<button data-a="${key}:${o.id}" class="${avatar.state[key] === o.id ? 'on' : ''}${usable(key, o) ? '' : ' lock'}">${o.robe !== undefined ? `<i style="background:#${o.robe.toString(16).padStart(6, '0')};border-color:#${o.trim.toString(16).padStart(6, '0')}"></i>` : ''}<b>${o.name}</b>${tag(key, o)}</button>`,
        )
        .join('');
    const price = trying && shop?.prices[itemId(trying.key, trying.o.id)];
    const offer = !trying
      ? ''
      : price
        ? `<button class="offer" data-a="buy">買下「${trying.o.name}」　${price}</button>`
        : '<p class="note">這一款還沒開賣。</p>';
    ui.panel(
      `<h2>外觀</h2><p class="kicker">衣服</p><div class="swatches">${sw('outfit')}</div>
     <p class="kicker">髮型</p><div class="swatches">${sw('hair')}</div>
     ${offer}
     <p class="note" id="look-note" role="status">${shopNote || (trying ? '現在是試穿。沒買的話，離開這個面板會換回原本的。' : '標了價錢的款式可以先試穿。')}</p>
     <button class="seal" data-a="done">好了</button>`,
      (a) => {
        if (a === 'done') return closeWardrobe();
        if (a === 'buy') return void buyTrying();
        const [key, id] = a.split(':');
        const o = listOf(key).find((x) => x.id === id);
        if (!o) return;
        avatar.apply({ [key]: id });
        shopNote = '';
        if (usable(key, o)) {
          keep(key, id);
          if (trying?.key === key) trying = null;
        } else {
          trying = { key, o };
          emit('market_locked_look_try', { item: id });
        }
        openWardrobe();
      },
      true,
    );
  }
  async function buyTrying() {
    if (!trying || !shop) return;
    const { key, o } = trying;
    shopNote = '正在準備';
    openWardrobe();
    const r = await shop.buy(itemId(key, o.id));
    if (!wardrobe || trying?.o !== o) return;
    if (r.state === 'redirect') {
      shop.leaving();
      location.assign(r.url);
      return;
    }
    if (r.state === 'owned') {
      owned.add(itemId(key, o.id));
      keep(key, o.id);
      trying = null;
      shopNote = '這一款已經是你的了。';
    } else if (r.state === 'login') {
      shop.leaving();
      shopNote = '要先登入才能買，這樣換了裝置也還在。<a href="/login">去登入</a>';
    } else if (r.state === 'closed') {
      shopNote = '付費外觀還沒開賣。沒有扣款。';
    } else {
      shopNote = '這會兒忙不過來，稍後再試。沒有扣款。';
    }
    openWardrobe();
  }
  function closeWardrobe() {
    wardrobe = false;
    trying = null;
    ui.panel('');
    avatar.apply({ outfit: saved.outfit || 'moon', hair: saved.hair || 'bun' });
    net.look();
  }
  $('#view').onclick = toggleView;
  $('#look').onclick = () => (wardrobe ? closeWardrobe() : openWardrobe());
  $('#enter').onclick = enterMarket;
  $('#back').onclick = leaveRoom;
  $('#sound').onclick = (e) => {
    audio.init();
    e.currentTarget.textContent = audio.toggle() ? '聲音　開' : '聲音　關';
  };

  function walk(dt) {
    let f = input.f + (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0);
    let s = input.s + (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
    me.yaw += ((keys.has('tl') ? 1 : 0) - (keys.has('tr') ? 1 : 0)) * dt * 1.9;
    const len = Math.hypot(f, s);
    if (len > 0.02) {
      if (avatar.holding) standUp(); // 坐著、跪著時一動就起身
      if (queued) {
        const [qx, qz] = queueSpot(queued.st, Math.max(0, queued.pos));
        if (Math.hypot(qx - me.x, qz - me.z) > 3) leaveQueue('走出隊伍，不排了。');
      }
      if (autoPath) autoPath = null; // 自己動手就取消自動走
      markWalked();
    } else if (autoPath) {
      // 沿著路點走；被擋住超過半秒就停下
      const [tx, tz] = autoPath[0];
      const ddx = tx - me.x;
      const ddz = tz - me.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist < 0.35) {
        autoPath.shift();
        if (!autoPath.length) autoPath = null;
      } else {
        const sp = Math.min(dist, 4.6 * dt);
        const mx = (ddx / dist) * sp;
        const mz = (ddz / dist) * sp;
        const ox = me.x;
        const oz = me.z;
        if (world.walkable(me.x + mx, me.z)) me.x += mx;
        if (world.walkable(me.x, me.z + mz)) me.z += mz;
        const moved = Math.hypot(me.x - ox, me.z - oz);
        autoStuck = moved < sp * 0.2 ? autoStuck + dt : 0;
        if (autoStuck > 0.5) autoPath = null;
        me.bob += dt * 10;
        me.speed = 4.2;
        me.face += (turn(me.face, Math.atan2(mx, mz)) - me.face) * Math.min(1, dt * 10);
        // 第一人稱時鏡頭也慢慢轉向走的方向
        if (!third) me.yaw += (turn(me.yaw, yawTo(mx, mz)) - me.yaw) * Math.min(1, dt * 4);
      }
      if (!autoPath && marker) marker.visible = false;
      applyCam();
      return;
    }
    if (len > 1) {
      f /= len;
      s /= len;
    }
    if (len > 0.02) {
      const sp = (input.run || keys.has('run') ? 7.5 : 4.2) * dt;
      const sin = Math.sin(me.yaw);
      const cos = Math.cos(me.yaw);
      const dx = (-sin * f + cos * s) * sp;
      const dz = (-cos * f - sin * s) * sp;
      // slide along walls: try each axis on its own
      if (world.walkable(me.x + dx, me.z)) me.x += dx;
      if (world.walkable(me.x, me.z + dz)) me.z += dz;
      me.bob += dt * (input.run || keys.has('run') ? 15 : 10) * Math.min(1, len);
      me.speed = (sp / dt) * Math.min(1, len);
      // the character turns to face where it is walking
      const want = wardrobe ? me.yaw : Math.atan2(dx, dz);
      me.face += (turn(me.face, want) - me.face) * Math.min(1, dt * 10);
    } else {
      me.speed = 0;
      if (wardrobe) me.face += (turn(me.face, me.yaw) - me.face) * Math.min(1, dt * 6);
    }
    applyCam();
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let slow = 0;
  let frames = 0;
  let lastArea = '';
  // 天色：預設跟訪客當地的時間；點頂欄的時段可以先看別的時候（再點一輪回到「此刻」）
  const clockHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };
  const SKY_PICKS = [null, 6.4, 12, 18.3, 22];
  const SKY_NAMES = ['此刻', '清晨', '正午', '黃昏', '深夜'];
  let skyPick = null;
  let skyHour = clockHour();
  let skyAt = performance.now();
  const skyBtn = $('#sky');
  const nameOf = (h) =>
    h < 5
      ? '深夜'
      : h < 8
        ? '清晨'
        : h < 11
          ? '上午'
          : h < 14
            ? '正午'
            : h < 17
              ? '午後'
              : h < 19.5
                ? '黃昏'
                : '夜';
  function skyLabel() {
    const i = SKY_PICKS.indexOf(skyPick);
    skyBtn.textContent = i === 0 ? nameOf(clockHour()) : `${SKY_NAMES[i]}（預覽）`;
  }
  skyBtn.onclick = () => {
    skyPick = SKY_PICKS[(SKY_PICKS.indexOf(skyPick) + 1) % SKY_PICKS.length];
    emit('market_sky', { pick: skyPick === null ? 'now' : skyPick });
    skyLabel();
  };
  function render(dt) {
    if (bloom.enabled) composer.render(dt);
    else renderer.render(active ? active.scene : world.scene, active ? active.camera : world.camera);
  }
  function loop() {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    stepTweens(dt);
    if (active) active.update(dt, t);
    else {
      if (mode === 'walk') walk(dt);
      else if (mode === 'menu') {
        me.yaw = Math.sin(t * 0.15) * 0.05;
        applyCam();
      }
      const want =
        third && (mode === 'walk' || (mode === 'moving' && hud.classList.contains('show'))) ? 1 : 0;
      tp += (want - tp) * Math.min(1, dt * 5);
      if (mode !== 'walk') applyCam();
      avatar.update(dt, t, mode === 'walk' || mode === 'moving' ? me.speed : 0);
      // 天色慢慢追上目標時辰（跟著訪客的時鐘，或手動預覽的時段）
      const goal = skyPick === null ? clockHour() : skyPick;
      const gap = ((((goal - skyHour) % 24) + 36) % 24) - 12;
      if (Math.abs(gap) <= 0.002) skyAt = performance.now();
      else {
        // 用真實經過的時間推進，慢的裝置也在幾秒內轉完
        const nowMs = performance.now();
        skyHour += gap * Math.min(1, Math.min(0.3, (nowMs - skyAt) / 1000) * 1.6);
        skyAt = nowMs;
        world.setHour(skyHour);
        renderer.toneMappingExposure = world.sky.exposure;
        bloom.strength = world.sky.bloom;
      }
      crowd.update(dt, t);
      net.update(dt, t);
      if (hud.classList.contains('show') && (mode === 'walk' || mode === 'moving'))
        net.move(me.x, me.z, me.face, t);
      koi.update(dt, t);
      updateHearts(dt);
      world.update(dt, t, world.camera.position);
      if (marker?.visible) {
        marker.userData.t += dt;
        const s = 1 + Math.sin(marker.userData.t * 6) * 0.12;
        marker.scale.set(s, s, s);
        if (mode !== 'walk') marker.visible = false;
      }
      world.reflect(world.camera);
      const a = world.area(me.x, me.z);
      if (a !== lastArea && mode !== 'room') $('#hud-title').textContent = lastArea = a;
    }
    if (active) lastArea = '';
    film.uniforms.uT.value = t % 10;
    placeLabels();
    render(dt);
    // drop bloom and resolution if the device can't keep up
    if (bloom.enabled && ++frames > 40) {
      if (dt > 1 / 26) slow++;
      if (slow > 45) {
        bloom.enabled = false;
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
        resize();
      }
    }
  }

  start().catch((e) => {
    if (dead) return;
    bootText.textContent = '這台裝置開不了 3D 集市。可以改用一般版求籤。';
    root.classList.add('failed');
    console.error(e);
  });
  return () => {
    dead = true;
    net?.stop();
    ac.abort();
    clearInterval(sayTimer);
    cancelAnimationFrame(raf);
    audio.stop();
    renderer?.dispose();
  };
}
