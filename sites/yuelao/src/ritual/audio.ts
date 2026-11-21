// WebAudio 合成竹籤聲（原型直搬）：不帶任何音頻文件，密度/強度隨搖動即時變化。
// AudioContext 只在用戶手勢裡建立（iOS 要求），之後常駐。

let ac: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

/** 與集市共用的聲音開關（localStorage `yuelao:sound`）；關著就不出聲。 */
export function isSoundOn(): boolean {
  try {
    return localStorage.getItem('yuelao:sound') !== 'off';
  } catch {
    return true;
  }
}

/** 記住開關，回傳新的狀態。 */
export function setSound(on: boolean): boolean {
  try {
    localStorage.setItem('yuelao:sound', on ? 'on' : 'off');
  } catch {}
  return on;
}

function audio(): AudioContext | null {
  if (!isSoundOn()) return null;
  if (!ac) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    const len = ac.sampleRate * 0.5;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

/** 喚醒音頻（用戶手勢內呼叫，否則 iOS 不給建）。 */
export function warmAudio(): void {
  audio();
}

/** 竹籤輕碰：bandpass 噪聲，音量隨 intensity。 */
export function clack(intensity: number): void {
  const ctx = audio();
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.75 + Math.random() * 0.6;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400 + Math.random() * 1600 + intensity * 500;
  bp.Q.value = 6;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  const vol = 0.03 + Math.min(0.32, intensity * 0.3);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + intensity * 0.02);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(t, Math.random() * 0.3, 0.08);
}

/** 低頻敲擊（卡籤 / 落地）。 */
export function knock(vol: number): void {
  const ctx = audio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.2);
  g.gain.setValueAtTime(vol || 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.26);
}

/** 掉籤觸地：敲 + 兩下餘響。 */
export function thud(): void {
  knock(0.38);
  clack(1);
  setTimeout(() => clack(0.7), 70);
  setTimeout(() => clack(0.45), 150);
}

export function vibrate(pattern: number | number[]): void {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* 不支持震動的裝置靜默跳過 */
    }
  }
}

let verb: ConvolverNode | null = null;
/** 殿內的殘響：1.6 秒衰減的噪聲脈衝，敲擊聲送一點進去，聽起來像在木造殿裡。 */
function hall(ctx: AudioContext): AudioNode {
  if (verb) return verb;
  const len = Math.floor(ctx.sampleRate * 1.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  verb = ctx.createConvolver();
  verb.buffer = ir;
  const back = ctx.createGain();
  back.gain.value = 0.32;
  verb.connect(back);
  back.connect(ctx.destination);
  return verb;
}

/** 木魚「篤」（功德台）：空心木頭的兩個共鳴＋一點敲擊噪聲，再送進殿內殘響。 */
export function woodblock(): void {
  const ctx = audio();
  if (!ctx || !noiseBuf) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  out.connect(hall(ctx));
  const pitch = 1 + (Math.random() - 0.5) * 0.04;
  for (const [f, vol, dur] of [
    [520, 0.42, 0.22],
    [1180, 0.16, 0.09],
    [190, 0.22, 0.12],
  ] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * pitch * 1.06, t);
    o.frequency.exponentialRampToValueAtTime(f * pitch, t + 0.02);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.22, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  n.connect(bp);
  bp.connect(ng);
  ng.connect(out);
  n.start(t, Math.random() * 0.3, 0.03);
}

let amb: { stop: () => void } | null = null;
/** 殿內的背景聲：很低的持續嗡聲＋偶爾遠處一聲磬。聲音關著就不放。 */
export function templeAmbience(on: boolean): void {
  if (!on) {
    amb?.stop();
    amb = null;
    return;
  }
  if (amb) return;
  const ctx = audio();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 3);
  master.connect(ctx.destination);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.connect(master);
  const oscs = [110, 164.8, 220.6].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = f === 110 ? 0.6 : 0.25;
    o.connect(g);
    g.connect(lp);
    o.start();
    return o;
  });
  const bell = window.setInterval(() => chime(392), 14000);
  amb = {
    stop() {
      clearInterval(bell);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      for (const o of oscs) o.stop(t + 0.7);
    },
  };
}

/** 念珠：珠子相碰的輕響。 */
export function bead(): void {
  clack(0.35);
}

/** 磬（念珠滿一圈、聖筊）：兩個泛音慢慢散開。 */
export function chime(base = 660): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [mul, vol] of [
    [1, 0.18],
    [2.76, 0.06],
  ] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = base * mul;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
    o.connect(g);
    g.connect(ctx.destination);
    g.connect(hall(ctx));
    o.start(t);
    o.stop(t + 2.5);
  }
}
