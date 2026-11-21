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

/** 木魚「篤」（功德台）：短促的木頭聲＝高頻正弦快速衰減＋一點噪聲。 */
export function woodblock(): void {
  const ctx = audio();
  if (!ctx || !noiseBuf) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(820, t);
  o.frequency.exponentialRampToValueAtTime(560, t + 0.09);
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.18);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 3;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.12, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  n.connect(bp);
  bp.connect(ng);
  ng.connect(ctx.destination);
  n.start(t, 0, 0.04);
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
    o.start(t);
    o.stop(t + 2.5);
  }
}
