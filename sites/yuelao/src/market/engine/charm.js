// 送朋友一張平安符（DESIGN.md「送平安符」）：在集市裡選一種符、可以署名，產生一個連結傳給朋友。
// 朋友打開連結會直接站在廣場上「拆開」那張符。送的人和收到的人都沾三天的光（角色身上一圈光）。
// 不需要登入、不經伺服器：符的種類和署名都在連結裡，光只記在各自的瀏覽器。每天可以送一張。

import { localDayKey } from '../../site/daily';

export const CHARMS = {
  peace: {
    name: '平安符',
    color: 0xffd27a,
    css: '#ffd27a',
    lines: [
      '出門平安，回家順利。累了就早點睡，明天會比今天好一點。',
      '願你這陣子心裡安穩，身邊的人都好好的。',
      '不管今天遇到什麼，都有人在遠處替你掛念。',
    ],
  },
  love: {
    name: '桃花符',
    color: 0xff8fa8,
    css: '#ff8fa8',
    lines: [
      '願你遇到的人，懂你的好，也願意慢慢等你。',
      '好的緣分不用追得很累。先把自己照顧好，對的人會看見。',
      '願你被溫柔地喜歡，也有勇氣好好喜歡一個人。',
    ],
  },
  luck: {
    name: '轉運錦囊',
    color: 0x9fd8a8,
    css: '#9fd8a8',
    lines: [
      '卡住的事會鬆開的。先做一件小事，運氣就會跟著動起來。',
      '這陣子辛苦了。錦囊裡只有一句話：你比你以為的更有辦法。',
      '願接下來的日子，順的事多一點，煩的事少一點。',
    ],
  },
};

const GLOW_KEY = 'yuelao:glow';
const SENT_KEY = 'yuelao:charm-sent';
const GLOW_DAYS = 3;

/** 署名：最多 8 個字，只留文字（不收網址、不收標籤符號）。 */
export function cleanFrom(v) {
  const s = String(v || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[<>&"'`\\/{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...s].slice(0, 8).join('');
}

export function charmLink(kind, from) {
  const u = new URL('/market', location.origin);
  u.searchParams.set('charm', kind);
  const f = cleanFrom(from);
  if (f) u.searchParams.set('from', f);
  u.hash = 'charm';
  return u.toString();
}

/** 網址裡帶的符（朋友打開連結時）；沒有就回 null。 */
export function incomingCharm() {
  try {
    const q = new URLSearchParams(location.search);
    const kind = q.get('charm');
    if (!kind || !CHARMS[kind]) return null;
    return { kind, from: cleanFrom(q.get('from')) };
  } catch {
    return null;
  }
}

/** 今天的祝福語：同一張符、同一天打開都是同一句。 */
export function charmLine(kind, from) {
  const c = CHARMS[kind];
  let h = 0;
  for (const ch of `${localDayKey(new Date())}|${kind}|${from}`)
    h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return c.lines[h % c.lines.length];
}

export function sentToday() {
  try {
    return localStorage.getItem(SENT_KEY) === localDayKey(new Date());
  } catch {
    return false;
  }
}
export function markSent() {
  try {
    localStorage.setItem(SENT_KEY, localDayKey(new Date()));
  } catch {}
}

/** 沾光：kind 的顏色、到期時間。 */
export function addGlow(kind) {
  try {
    localStorage.setItem(GLOW_KEY, JSON.stringify({ kind, until: Date.now() + GLOW_DAYS * 86400000 }));
  } catch {}
}
export function activeGlow() {
  try {
    const g = JSON.parse(localStorage.getItem(GLOW_KEY) || 'null');
    if (g && CHARMS[g.kind] && typeof g.until === 'number' && g.until > Date.now()) return g;
  } catch {}
  return null;
}
