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
export const SOUND_KEY = 'yuelao:sound';
export function soundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
const LEVEL = 0.5;
export const audio = {
  ctx: null,
  on: typeof window === 'undefined' ? true : soundPref(),
  master: null,
  /** 音量不硬切：從現在的值在 sec 秒內滑到 to。 */
  fade(to, sec) {
    if (!this.master || !this.ctx) return;
    const g = this.master.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + sec);
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
    this.fade(this.on ? LEVEL : 0, 1.5);
    // ambience: low drone + filtered noise (distant crowd / wind)
    const d = this.ctx.createGain();
    d.gain.value = 0.05;
    d.connect(this.master);
    for (const f of [55, 82.4, 110.3]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(d);
      o.start();
    }
    const nb = this.noiseBuf(4);
    const ns = this.ctx.createBufferSource();
    ns.buffer = nb;
    ns.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.4;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.035;
    ns.connect(lp).connect(ng).connect(this.master);
    ns.start();
  },
  /** 離開集市時收聲；下次進來會重新建立。 */
  stop() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  },
  noiseBuf(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
  bell(freq = 520, vol = 0.25, len = 3.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [m, v] of [
      [1, 1],
      [2.01, 0.5],
      [2.76, 0.35],
      [5.4, 0.15],
    ]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = freq * m;
      g.gain.setValueAtTime(vol * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len / m ** 0.5);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + len);
    }
  },
  tick(freq = 1800, vol = 0.12, len = 0.06) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this._nb ??= this.noiseBuf(0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + len + 0.02);
  },
};
