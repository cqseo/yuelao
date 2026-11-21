// 第一人稱念珠（2026-11-21）：三層疊起來
//   1. mala-hand.webp：握珠的手（站長用 GPT 生成的圖，手上方那段珠串已擦掉）
//   2. 這個 canvas：整串珠子，沿著圖上原本那串珠子的中心一顆顆畫，每撥一下整串往下滑一顆
//   3. mala-front.webp：原圖裡蓋在珠子前面的部分（拇指、無名指指尖、掌緣），珠子從它們底下穿過
// 座標都用原圖（1024×1536）的像素；畫的時候再按版面縮放。

/** 珠子中心，由上往下（上面幾顆在畫面外淡出，下面幾顆從掌緣底下垂出去再淡出）。 */
const CENTERS: [number, number][] = [
  [247, -280],
  [269, -188],
  [290, -96],
  [311, -4],
  [332, 88],
  [352, 180],
  [375, 270],
  [400, 360],
  [410, 460],
  [408, 565],
  [370, 650],
  [318, 748],
  [278, 845],
  [236, 945],
  [238, 1022],
  [232, 1105],
  [226, 1188],
];
// 一顆珠子的貼圖（mala-bead.webp）104×94，上緣是繩結
const BW = 104;
const BH = 94;

function alphaAt(y: number) {
  const top = Math.min(1, Math.max(0, (y + 150) / 250));
  const bottom = Math.min(1, Math.max(0, (1170 - y) / 110));
  return Math.min(top, bottom);
}

export function createMala(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  const bead = new Image();
  bead.src = '/merit/mala-bead.webp';
  let phase = 0; // 已經滑了幾顆（可以是小數）
  let target = 0;
  let raf = 0;
  let last = 0;
  let alive = true;

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw() {
    if (!ctx || !bead.complete || !bead.naturalWidth) return;
    size();
    const k = canvas.width / 1024;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const f = phase - Math.floor(phase);
    // 由下往上畫：上面那顆的底部蓋住下面那顆上緣的繩結，看起來是串在一起的
    for (let i = CENTERS.length - 2; i >= 0; i--) {
      const a = CENTERS[i] as [number, number];
      const b = CENTERS[i + 1] as [number, number];
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      const alpha = alphaAt(y);
      if (alpha <= 0) continue;
      // 往上一顆的方向，貼圖的「上」對準它
      const up = CENTERS[i - 1] ?? [a[0] - 21, a[1] - 92];
      const dx = a[0] - up[0] + (b[0] - a[0] - (a[0] - up[0])) * f;
      const dy = a[1] - up[1] + (b[1] - a[1] - (a[1] - up[1])) * f;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(-dx, dy));
      ctx.drawImage(bead, -BW / 2, -BH / 2 - 2, BW, BH);
      ctx.restore();
    }
  }

  function loop(t: number) {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    phase += (target - phase) * Math.min(1, dt * 16);
    if (Math.abs(target - phase) < 0.002) phase = target;
    draw();
    raf = phase === target ? 0 : requestAnimationFrame(loop);
    if (!raf) last = 0;
  }

  bead.onload = draw;
  const ro = new ResizeObserver(draw);
  ro.observe(canvas);
  draw();

  return {
    /** 拇指撥過一顆：整串往下滑一顆。 */
    flick() {
      target += 1;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
