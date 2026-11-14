import * as THREE from 'three';

export const FONT = '"Noto Serif TC", "Songti TC", "Noto Serif CJK TC", "PMingLiU", serif';

// ---------- tweens ----------
const tweens = [];
export const ease = {
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  lin: (t) => t,
  back: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
};
export function tween(dur, fn, e = ease.inOut, delay = 0) {
  return new Promise((resolve) => {
    tweens.push({ t: -delay, dur, fn, e, resolve });
  });
}
export function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k), k);
    if (k >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
}
export const wait = (s) => tween(s, () => {}, ease.lin);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function noise(g, w, h, n, alpha, light = 255) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() * light;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export function stoneTex() {
  return canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#2a2622';
      g.fillRect(0, 0, w, h);
      const n = 4;
      const s = w / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const off = y % 2 ? s / 2 : 0;
          const v = 34 + Math.random() * 16;
          g.fillStyle = `rgb(${v + 6},${v + 2},${v - 2})`;
          g.fillRect(x * s + off + 2, y * s + 2, s - 4, s - 4);
          if (off) g.fillRect(x * s + off - w + 2, y * s + 2, s - 4, s - 4);
        }
      noise(g, w, h, 9000, 0.12);
    },
    [7, 30],
  );
}

export function woodTex(base = '#3a2216') {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,210,160'},${0.04 + Math.random() * 0.08})`;
      g.lineWidth = 1 + Math.random() * 2;
      const x = Math.random() * w;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + rand(-6, 6), h * 0.3, x + rand(-6, 6), h * 0.6, x + rand(-4, 4), h);
      g.stroke();
    }
  });
}

export function tileTex() {
  return canvasTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#16191c';
      g.fillRect(0, 0, w, h);
      const cols = 8;
      const cw = w / cols;
      for (let x = 0; x < cols; x++) {
        const gr = g.createLinearGradient(x * cw, 0, (x + 1) * cw, 0);
        gr.addColorStop(0, '#0c0e10');
        gr.addColorStop(0.5, '#39404a');
        gr.addColorStop(1, '#0c0e10');
        g.fillStyle = gr;
        g.fillRect(x * cw, 0, cw, h);
      }
      for (let y = 0; y < h; y += 32) {
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.fillRect(0, y, w, 3);
      }
      noise(g, w, h, 2500, 0.1);
    },
    [3, 2],
  );
}

/** Text on a board. vertical=true stacks characters top to bottom. */
export function textTex(text, o = {}) {
  const {
    vertical = false,
    size = 120,
    fg = '#f0d9a0',
    bg = null,
    border = null,
    weight = 900,
    pad = 0.35,
    glow = null,
  } = o;
  const chars = [...text];
  const w = vertical ? size * (1 + pad * 2) : size * (chars.length * 1.12 + pad * 2);
  const h = vertical ? size * (chars.length * 1.12 + pad * 2) : size * (1 + pad * 2);
  return canvasTex(Math.ceil(w), Math.ceil(h), (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = size * 0.045;
      g.strokeRect(size * 0.12, size * 0.12, w - size * 0.24, h - size * 0.24);
    }
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = fg;
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = size * 0.25;
    }
    chars.forEach((ch, i) => {
      if (vertical) g.fillText(ch, w / 2, size * (pad + 0.56 + i * 1.12));
      else g.fillText(ch, size * (pad + 0.56 + i * 1.12), h / 2 + size * 0.04);
    });
  });
}

export function textPlane(text, height, o = {}) {
  const tex = textTex(text, o);
  const aspect = tex.image.width / tex.image.height;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(height * aspect, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: !o.bg, toneMapped: false, fog: o.fog ?? true }),
  );
  return m;
}

let glowMap;
export function glow(color, size, opacity = 0.9) {
  glowMap ??= canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowMap,
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity,
      fog: false,
    }),
  );
  s.scale.setScalar(size);
  return s;
}

let lanternMap;
export function lantern(scale = 1, color = 0xff5a22) {
  lanternMap ??= canvasTex(64, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#b82a12');
    gr.addColorStop(0.45, '#ffb04a');
    gr.addColorStop(0.6, '#ff8a30');
    gr.addColorStop(1, '#a8200e');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,10,0,.5)';
    for (let x = 4; x < w; x += 8) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
  const grp = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshBasicMaterial({ map: lanternMap, color, fog: true }),
  );
  body.scale.set(1, 1.12, 1);
  const capM = new THREE.MeshBasicMaterial({ color: 0x1a0d06 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 10), capM);
  top.position.y = 0.29;
  const bot = top.clone();
  bot.position.y = -0.29;
  const tassel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.03, 0.3, 6),
    new THREE.MeshBasicMaterial({ color: 0xc8402a }),
  );
  tassel.position.y = -0.46;
  const g1 = glow(0xff7a30, 1.5, 0.34);
  grp.add(body, top, bot, tassel, g1);
  grp.scale.setScalar(scale);
  grp.userData.phase = Math.random() * 6.28;
  return grp;
}

export function paperTex(draw, w = 512, h = 512) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#efe3c8';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 5000, 0.06, 120);
    draw?.(g, w, h);
  });
}

// ---------- audio (all synthesized) ----------
// 開關記在瀏覽器，集市與求籤頁共用（見 DESIGN.md「聲音：記住開關、淡入淡出」）。
// 每個空間有自己的背景聲（DESIGN.md「聲音：各空間的背景聲」），換場景時交叉淡化。
export const SOUND_KEY = 'yuelao:sound';
export function soundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
const LEVEL = 0.5;
// 背景聲整體再推高一點（約 +5 dB）：拿掉聽不到的低鳴後，聽得到的部分不能比以前小
const BED_LEVEL = 1.8;
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
// 五聲音階（宮商角徵羽），風鈴、鈴聲都從這裡挑，聽起來不會亂
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export const audio = {
  ctx: null,
  on: typeof window === 'undefined' ? true : soundPref(),
  master: null,
  sfx: null,
  bed: null, // { name, gain, nodes, timers }
  /** 音量不硬切：從現在的值在 sec 秒內滑到 to。 */
  fade(to, sec) {
    if (!this.master || !this.ctx) return;
    this.ramp(this.master.gain, to, sec);
  },
  ramp(param, to, sec) {
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + sec);
  },
  init() {
    if (this.ctx) {
      // 沒有點擊就建立的聲音會被瀏覽器暫停；之後任何一次點擊再叫醒
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    if (this.ctx.state === 'suspended') {
      const wake = () => this.ctx?.resume().catch(() => {});
      window.addEventListener('pointerdown', wake, { once: true, capture: true });
      window.addEventListener('keydown', wake, { once: true, capture: true });
    }
    this.master = this.ctx.createGain();
    // 從無聲淡入；關著就保持無聲（離開再進來也照記住的狀態）
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.fade(this.on ? LEVEL : 0, 1.5);
    // 直接從連結進房間時，房間比聲音先準備好：補上當時要的那一段
    this.scene(this.want || 'plaza');
  },
  /** 離開集市時收聲；下次進來會重新建立。 */
  stop() {
    this.dropBed(0);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.sfx = null;
  },
  noiseBuf(sec, pink = false) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    // 粉紅噪聲（Paul Kellet 簡化版）比白噪聲柔，像遠處人聲、風聲，不像電視雪花
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (!pink) {
        d[i] = w;
        continue;
      }
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return b;
  },
  toggle() {
    this.on = !this.on;
    try {
      localStorage.setItem(SOUND_KEY, this.on ? 'on' : 'off');
    } catch {}
    this.fade(this.on ? LEVEL : 0, 0.3);
    return this.on;
  },

  // ---------- 背景聲 ----------
  /** 換到某個空間的背景聲：舊的 1.2 秒淡出、新的 1.5 秒淡入。plaza／shrine／tarot／sutra。 */
  scene(name) {
    this.want = name;
    if (!this.ctx || this.bed?.name === name) return;
    this.dropBed(1.2);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const bed = { name, gain, nodes: [], timers: [] };
    this.bed = bed;
    const build = {
      plaza: this.bedPlaza,
      shrine: this.bedShrine,
      tarot: this.bedTarot,
      sutra: this.bedSutra,
    }[name];
    build?.call(this, bed);
    this.ramp(gain.gain, BED_LEVEL, 1.5);
  },
  dropBed(sec) {
    const bed = this.bed;
    if (!bed) return;
    this.bed = null;
    for (const t of bed.timers) clearTimeout(t);
    bed.timers.length = 0;
    bed.dead = true;
    if (!this.ctx) return;
    this.ramp(bed.gain.gain, 0, sec);
    const end = this.ctx.currentTime + sec + 0.1;
    for (const n of bed.nodes) {
      try {
        n.stop?.(end);
      } catch {}
    }
    setTimeout(() => bed.gain.disconnect(), (sec + 0.2) * 1000);
  },
  /** 不斷重複的噪聲層：pink 噪聲 → 濾波 → 音量，振幅慢慢起伏（LFO）。 */
  noiseLayer(bed, { type = 'bandpass', freq, q = 0.7, vol, wobble = 0, rate = 0.07 }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._pink ??= this.noiseBuf(6, true);
    src.loop = true;
    src.loopStart = rand(0, 3);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(bed.gain);
    src.start(this.ctx.currentTime, rand(0, 5));
    bed.nodes.push(src);
    if (wobble) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = rate;
      const lg = this.ctx.createGain();
      lg.gain.value = vol * wobble;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
      bed.nodes.push(lfo);
    }
  },
  /** 每隔 a～b 秒做一次 fn（場景換掉就停）。 */
  every(bed, a, b, fn) {
    const loop = () => {
      if (bed.dead) return;
      fn();
      bed.timers.push(setTimeout(loop, rand(a, b) * 1000));
    };
    bed.timers.push(setTimeout(loop, rand(a * 0.4, b * 0.6) * 1000));
  },
  /** 風鈴：五聲音階上兩三個音，輕輕錯開。 */
  chime(out, vol = 0.05) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const f = pick(PENTA) * 2;
      this.tone(out, f, vol * rand(0.6, 1), rand(1.6, 2.8), i * rand(0.09, 0.22), [
        [1, 1],
        [2.76, 0.25],
      ]);
    }
  },
  /** 一個帶泛音的鈴聲，接到指定輸出。 */
  tone(out, freq, vol, len, delay = 0, partials = [[1, 1]]) {
    const t = this.ctx.currentTime + delay;
    for (const [m, v] of partials) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = freq * m * rand(0.998, 1.002);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len / m ** 0.5);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    }
  },
  // 廣場：遠處人聲的起伏（兩段頻帶、慢慢起伏）＋偶爾的風鈴＋很久一次的遠鐘
  bedPlaza(bed) {
    this.noiseLayer(bed, { freq: 520, q: 0.9, vol: 0.09, wobble: 0.45, rate: 0.11 });
    this.noiseLayer(bed, { freq: 1250, q: 1.4, vol: 0.035, wobble: 0.6, rate: 0.23 });
    this.noiseLayer(bed, { type: 'lowpass', freq: 220, q: 0.5, vol: 0.03 });
    this.every(bed, 7, 15, () => this.chime(bed.gain, 0.035));
    this.every(bed, 35, 60, () =>
      this.tone(bed.gain, 196, 0.05, 6, 0, [
        [1, 1],
        [2.01, 0.4],
        [2.76, 0.25],
      ]),
    );
  },
  // 殿內（月老殿、大殿）：安靜的室內底噪＋門外的風鈴，偶爾一聲輕磬
  bedShrine(bed) {
    this.noiseLayer(bed, { type: 'lowpass', freq: 300, q: 0.4, vol: 0.06, wobble: 0.25, rate: 0.05 });
    this.noiseLayer(bed, { freq: 900, q: 0.6, vol: 0.012, wobble: 0.5, rate: 0.09 });
    this.every(bed, 6, 13, () => this.chime(bed.gain, 0.03));
    this.every(bed, 25, 45, () =>
      this.tone(bed.gain, 587.33, 0.04, 5, 0, [
        [1, 1],
        [2.71, 0.3],
        [5.1, 0.12],
      ]),
    );
  },
  // 塔羅館：溫暖的低音鋪底（A 小三和弦，低通、慢慢呼吸）＋偶爾一點閃光
  bedTarot(bed) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.6;
    const pad = this.ctx.createGain();
    pad.gain.value = 0.022;
    lp.connect(pad).connect(bed.gain);
    for (const f of [110, 130.81, 164.81, 220]) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start();
        bed.nodes.push(o);
      }
    }
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lg = this.ctx.createGain();
    lg.gain.value = 260;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    bed.nodes.push(lfo);
    this.noiseLayer(bed, { type: 'lowpass', freq: 260, q: 0.4, vol: 0.03 });
    this.every(bed, 9, 18, () => {
      const base = pick([880, 987.77, 1318.51]);
      for (let i = 0; i < 3; i++) this.tone(bed.gain, base * [1, 1.5, 2][i], 0.018, 2.4, i * 0.12);
    });
  },
  // 抄經閣：很靜的室內＋偶爾一聲木魚
  bedSutra(bed) {
    this.noiseLayer(bed, { type: 'lowpass', freq: 260, q: 0.4, vol: 0.045, wobble: 0.2, rate: 0.04 });
    this.every(bed, 14, 26, () => this.woodblock(bed.gain, 0.12));
    this.every(bed, 10, 20, () => this.chime(bed.gain, 0.02));
  },

  // ---------- 動作音效 ----------
  bell(freq = 520, vol = 0.25, len = 3.2) {
    if (!this.ctx) return;
    // 鐘聲：非整數倍的泛音＋敲擊瞬間的一點雜音，比純正弦更像銅器
    this.tone(this.sfx, freq, vol, len, 0, [
      [1, 1],
      [2.01, 0.5],
      [2.76, 0.35],
      [5.4, 0.15],
    ]);
    this.burst({ freq: freq * 4, q: 2, vol: vol * 0.25, len: 0.05 });
  },
  tick(freq = 1800, vol = 0.12, len = 0.06) {
    this.burst({ freq, q: 3, vol, len });
  },
  /** 一小段濾波噪聲。 */
  burst({ freq, q = 3, vol, len, delay = 0, type = 'bandpass', sweep = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this._nb ??= this.noiseBuf(0.5);
    s.playbackRate.value = rand(0.85, 1.15);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + len);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.004, len / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, rand(0, 0.3));
    s.stop(t + len + 0.03);
  },
  /** 洗牌：一長串紙牌互相撥過的細碎聲，中間密、兩頭疏。 */
  riffle(sec = 0.55, vol = 0.09) {
    if (!this.ctx) return;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const at = sec * (k + 0.06 * Math.sin(k * Math.PI) * Math.random());
      this.burst({
        type: 'highpass',
        freq: rand(2200, 3600),
        q: 0.8,
        vol: vol * (0.5 + Math.sin(k * Math.PI) * 0.5),
        len: 0.022,
        delay: at,
      });
    }
    this.burst({ type: 'lowpass', freq: 500, q: 0.7, vol: vol * 1.2, len: 0.07, delay: sec });
  },
  /** 翻牌：紙張劃過空氣的「唰」（頻率往上掃）＋落桌一下。 */
  flip(vol = 0.16) {
    this.burst({ freq: 900, q: 0.9, vol, len: 0.14, sweep: 3.2 });
    this.burst({ type: 'lowpass', freq: 420, q: 0.7, vol: vol * 0.8, len: 0.06, delay: 0.13 });
  },
  /** 牌放到桌上：短短一聲悶響。 */
  place(vol = 0.14) {
    this.burst({ type: 'lowpass', freq: 380, q: 0.7, vol, len: 0.07 });
    this.burst({ freq: 2600, q: 1.2, vol: vol * 0.3, len: 0.03 });
  },
  /** 木魚：短促、帶一點音高的木頭聲。 */
  woodblock(out = this.sfx, vol = 0.15) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
  },
};
