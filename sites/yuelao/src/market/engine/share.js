// 分享圖（DESIGN.md「分享圖與付費範例」）：在瀏覽器裡用 canvas 畫一張 1080×1350 的直圖，
// 能用系統分享（手機）就直接分享圖片，不能就存成檔案。圖上不放用戶問的那句話（那是他的私事），
// 只放籤或牌、判詞、站名與網址。

const W = 1080;
const H = 1350;
const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
const NIGHT = '#070812';
const GOLD = '#dcbb7c';
const PAPER = '#efe5cf';
const INK = '#2a1d14';
const RED = '#a8291f';

// 簡體用戶：圖上的字跟畫面一樣轉成簡體（Market.tsx 在 zh-Hans 時設定）
let convert = (t) => t;
export function setShareText(fn) {
  convert = typeof fn === 'function' ? fn : (t) => t;
}
function hook(g) {
  const fill = g.fillText.bind(g);
  const measure = g.measureText.bind(g);
  g.fillText = (t, x, y, w) =>
    w === undefined ? fill(convert(String(t)), x, y) : fill(convert(String(t)), x, y, w);
  g.measureText = (t) => measure(convert(String(t)));
  return g;
}

const loadImg = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

/** 中文逐字換行；回傳畫了幾行。 */
function wrap(g, text, x, y, maxW, lh, maxLines = 99) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (g.measureText(line + ch).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = `${shown[maxLines - 1].slice(0, -1)}…`;
  shown.forEach((l, i) => {
    g.fillText(l, x, y + i * lh);
  });
  return shown.length;
}

function night(g) {
  const bg = g.createRadialGradient(W / 2, -120, 40, W / 2, H * 0.3, H);
  bg.addColorStop(0, '#3a2414');
  bg.addColorStop(0.35, '#121327');
  bg.addColorStop(1, NIGHT);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 幾點星
  g.fillStyle = 'rgba(239,229,207,0.5)';
  for (let i = 0; i < 46; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12345.678) % 1;
    g.globalAlpha = 0.25 + ((i * 7) % 10) / 20;
    g.fillRect(Math.abs(x) * W, Math.abs(y) * 260, 2, 2);
  }
  g.globalAlpha = 1;
}

function footer(g, line) {
  g.textAlign = 'center';
  g.fillStyle = GOLD;
  g.font = `600 34px ${SERIF}`;
  g.fillText('月下集市 · 月老', W / 2, H - 92);
  g.fillStyle = 'rgba(239,229,207,0.55)';
  g.font = `400 26px ${SERIF}`;
  g.fillText(line, W / 2, H - 50);
}

async function ready() {
  try {
    await Promise.all([document.fonts?.load(`700 64px ${SERIF}`), document.fonts?.load(`400 32px ${SERIF}`)]);
  } catch {}
}

/** 畫好、交給系統分享或存檔。回傳 'shared' | 'saved' | 'cancel' | 'error'。 */
async function deliver(canvas, filename, title) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return 'error';
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancel';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

const host = () => (typeof location !== 'undefined' ? location.host : '');

/** 月老殿判詞：籤號、等第、籤詩、出處、判詞、「月老已批」印。 */
export async function shareVerdict({ no, grade, poem, source, verdict, cat }) {
  await ready();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = hook(c.getContext('2d'));
  night(g);
  // 米紙
  const px = 96;
  const py = 150;
  const pw = W - px * 2;
  const ph = 1010;
  const paper = await loadImg('/ritual/paper.jpg');
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 40;
  g.shadowOffsetY = 14;
  g.fillStyle = PAPER;
  g.fillRect(px, py, pw, ph);
  g.restore();
  if (paper) g.drawImage(paper, px, py, pw, ph);
  g.strokeStyle = 'rgba(168,41,31,0.55)';
  g.lineWidth = 3;
  g.strokeRect(px + 22, py + 22, pw - 44, ph - 44);

  g.textAlign = 'center';
  g.fillStyle = RED;
  g.font = `600 34px ${SERIF}`;
  g.fillText(cat ? `${no} · 問${cat}` : no, W / 2, py + 108);
  g.fillStyle = '#5e140e';
  g.font = `700 96px ${SERIF}`;
  g.fillText(grade, W / 2, py + 230);
  g.fillStyle = INK;
  g.font = `700 46px ${SERIF}`;
  const poemLines = String(poem).split('\n').slice(0, 4);
  poemLines.forEach((l, i) => {
    g.fillText(l, W / 2, py + 330 + i * 72);
  });
  let y = py + 330 + poemLines.length * 72;
  if (source) {
    g.fillStyle = 'rgba(42,29,20,0.6)';
    g.font = `400 28px ${SERIF}`;
    g.fillText(`籤詩出處：${source}`, W / 2, y + 10);
    y += 40;
  }
  g.strokeStyle = 'rgba(168,41,31,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W / 2 - 120, y + 34);
  g.lineTo(W / 2 + 120, y + 34);
  g.stroke();
  g.fillStyle = INK;
  g.font = `400 38px ${SERIF}`;
  g.textAlign = 'left';
  wrap(g, verdict, px + 90, y + 110, pw - 180, 62, 5);
  // 月老已批
  g.save();
  g.translate(px + pw - 150, py + ph - 140);
  g.rotate(-0.12);
  g.strokeStyle = RED;
  g.lineWidth = 5;
  g.strokeRect(-64, -64, 128, 128);
  g.fillStyle = RED;
  g.textAlign = 'center';
  g.font = `700 44px ${SERIF}`;
  g.fillText('月老', 0, -8);
  g.fillText('已批', 0, 44);
  g.restore();

  footer(g, host());
  return deliver(c, 'yuelao-sign.png', `${no} · ${grade}`);
}

/** 塔羅館三張牌：牌面（逆位倒放）、位置、牌名與正逆、關鍵詞。 */
export async function shareSpread({ deckName, cards }) {
  await ready();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = hook(c.getContext('2d'));
  night(g);
  g.textAlign = 'center';
  g.fillStyle = GOLD;
  g.font = `600 38px ${SERIF}`;
  g.fillText(`塔羅館 · ${deckName}`, W / 2, 140);
  g.fillStyle = PAPER;
  g.font = `700 64px ${SERIF}`;
  g.fillText('三張牌', W / 2, 228);

  const imgs = await Promise.all(cards.map((d) => loadImg(d.img)));
  const cw = 280;
  const gap = 40;
  const x0 = (W - (cw * 3 + gap * 2)) / 2;
  const top = 300;
  cards.forEach((d, i) => {
    const im = imgs[i];
    const ch = im ? Math.round((cw * im.height) / im.width) : Math.round(cw * 1.7);
    const x = x0 + i * (cw + gap);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 30;
    g.shadowOffsetY = 10;
    g.fillStyle = '#1b1530';
    g.fillRect(x, top, cw, ch);
    g.restore();
    if (im) {
      g.save();
      if (d.rev) {
        g.translate(x + cw / 2, top + ch / 2);
        g.rotate(Math.PI);
        g.drawImage(im, -cw / 2, -ch / 2, cw, ch);
      } else g.drawImage(im, x, top, cw, ch);
      g.restore();
    }
    g.strokeStyle = 'rgba(220,187,124,0.55)';
    g.lineWidth = 2;
    g.strokeRect(x, top, cw, ch);
    const ty = top + ch + 62;
    g.fillStyle = GOLD;
    g.font = `400 28px ${SERIF}`;
    g.fillText(d.pos, x + cw / 2, ty);
    g.fillStyle = PAPER;
    g.font = `700 40px ${SERIF}`;
    g.fillText(d.name, x + cw / 2, ty + 56);
    if (d.tag) {
      g.fillStyle = 'rgba(239,229,207,0.65)';
      g.font = `400 28px ${SERIF}`;
      g.fillText(d.tag, x + cw / 2, ty + 98);
    }
    if (d.kw?.length) {
      g.fillStyle = 'rgba(239,229,207,0.8)';
      g.font = `400 28px ${SERIF}`;
      g.fillText(d.kw.slice(0, 3).join('・'), x + cw / 2, ty + (d.tag ? 140 : 100));
    }
  });
  footer(g, host());
  return deliver(c, 'yuelao-tarot.png', `塔羅館 · ${deckName}`);
}

/**
 * 今日運勢卡：9:16 直圖（1080×1920），適合 IG 限時動態、LINE 背景。
 * kind 'tarot'：一張牌面；kind 'stick'：一張米紙籤。今日能量色當作光暈。
 */
export async function shareDaily({ kind, dateLabel, title, name, sub, kw = [], line, color, img, poem }) {
  await ready();
  const SW = 1080;
  const SH = 1920;
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const g = hook(c.getContext('2d'));
  const bg = g.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#0d0e22');
  bg.addColorStop(1, NIGHT);
  g.fillStyle = bg;
  g.fillRect(0, 0, SW, SH);
  // 能量色光暈
  const halo = g.createRadialGradient(SW / 2, 760, 40, SW / 2, 760, 720);
  halo.addColorStop(0, `${color}88`);
  halo.addColorStop(0.45, `${color}22`);
  halo.addColorStop(1, `${color}00`);
  g.fillStyle = halo;
  g.fillRect(0, 0, SW, SH);
  g.fillStyle = 'rgba(239,229,207,0.45)';
  for (let i = 0; i < 70; i++) {
    const x = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
    const y = Math.abs((Math.sin(i * 78.233) * 12345.678) % 1);
    g.globalAlpha = 0.2 + ((i * 7) % 10) / 22;
    g.fillRect(x * SW, y * 420, 2, 2);
  }
  g.globalAlpha = 1;

  g.textAlign = 'center';
  g.fillStyle = GOLD;
  g.font = `600 40px ${SERIF}`;
  g.fillText(title, SW / 2, 190);
  g.fillStyle = 'rgba(239,229,207,0.6)';
  g.font = `400 32px ${SERIF}`;
  g.fillText(dateLabel, SW / 2, 244);

  let y = 330;
  if (kind === 'tarot') {
    const im = img ? await loadImg(img) : null;
    const cw = 470;
    const ch = im ? Math.round((cw * im.height) / im.width) : 800;
    const x = (SW - cw) / 2;
    g.save();
    g.shadowColor = color;
    g.shadowBlur = 60;
    g.fillStyle = '#1b1530';
    g.fillRect(x, y, cw, ch);
    g.restore();
    if (im) {
      g.save();
      if (sub === '逆位') {
        g.translate(SW / 2, y + ch / 2);
        g.rotate(Math.PI);
        g.drawImage(im, -cw / 2, -ch / 2, cw, ch);
      } else g.drawImage(im, x, y, cw, ch);
      g.restore();
    }
    g.strokeStyle = 'rgba(220,187,124,0.6)';
    g.lineWidth = 3;
    g.strokeRect(x, y, cw, ch);
    y += ch + 110;
  } else {
    // 一條直式籤紙
    const pw = 440;
    const ph = 760;
    const x = (SW - pw) / 2;
    const paper = await loadImg('/ritual/paper.jpg');
    g.save();
    g.shadowColor = color;
    g.shadowBlur = 60;
    g.fillStyle = PAPER;
    g.fillRect(x, y, pw, ph);
    g.restore();
    if (paper) g.drawImage(paper, x, y, pw, ph);
    g.strokeStyle = 'rgba(168,41,31,0.55)';
    g.lineWidth = 3;
    g.strokeRect(x + 18, y + 18, pw - 36, ph - 36);
    g.fillStyle = RED;
    g.font = `600 34px ${SERIF}`;
    g.fillText(name, SW / 2, y + 96);
    g.fillStyle = '#5e140e';
    g.font = `700 84px ${SERIF}`;
    g.fillText(sub, SW / 2, y + 200);
    // 籤詩直排兩行
    const lines = String(poem || '')
      .split('\n')
      .slice(0, 2);
    g.fillStyle = INK;
    g.font = `700 40px ${SERIF}`;
    lines.forEach((l, i) => {
      const chars = [...l];
      const cx = SW / 2 + (lines.length === 2 ? (i === 0 ? 50 : -50) : 0);
      chars.forEach((ch, k) => {
        g.fillText(ch, cx, y + 290 + k * 44);
      });
    });
    y += ph + 110;
  }

  g.fillStyle = PAPER;
  g.font = `700 64px ${SERIF}`;
  g.fillText(kind === 'tarot' ? name : '今日一籤', SW / 2, y);
  if (kind === 'tarot' && sub) {
    g.fillStyle = 'rgba(239,229,207,0.65)';
    g.font = `400 34px ${SERIF}`;
    g.fillText(sub, SW / 2, y + 56);
    y += 56;
  }
  // 關鍵詞：能量色的小框
  if (kw.length) {
    y += 70;
    g.font = `400 34px ${SERIF}`;
    const ws = kw.map((k) => g.measureText(k).width + 56);
    let x = (SW - ws.reduce((a, b) => a + b + 18, -18)) / 2;
    kw.forEach((k, i) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.strokeRect(x, y - 40, ws[i], 58);
      g.fillStyle = PAPER;
      g.fillText(k, x + ws[i] / 2, y);
      x += ws[i] + 18;
    });
  }
  // 今日一句
  y += 110;
  g.fillStyle = 'rgba(239,229,207,0.9)';
  g.font = `400 40px ${SERIF}`;
  g.textAlign = 'left';
  const n = wrap(g, line, 150, y, SW - 300, 64, 4);
  y += n * 64;
  g.textAlign = 'center';
  g.fillStyle = GOLD;
  g.font = `600 36px ${SERIF}`;
  g.fillText('月下集市 · 月老', SW / 2, SH - 130);
  g.fillStyle = 'rgba(239,229,207,0.55)';
  g.font = `400 28px ${SERIF}`;
  g.fillText(`${host()} ・ 每天來抽一次`, SW / 2, SH - 82);
  return deliver(c, kind === 'tarot' ? 'yuelao-today-card.png' : 'yuelao-today-sign.png', title);
}
