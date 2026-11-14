// 集市的簡體顯示（DESIGN.md「集市簡體」）。集市的文字寫在 3D 引擎的程式裡、只有繁體；
// 簡體用戶進集市時，把畫面上的文字用 OpenCC（台灣字形 → 大陸字形）轉成簡體，再換掉一小批台灣用語。
// 規矩（AGENTS.md §3）：簡體不能機器轉換不經人審就上線——這份轉換規則和逐句結果都要站長審過才合併。
// 籤詩原文（.p-poem、.s-poem）照舊顯示繁體，和一般版求籤頁一致；用戶自己輸入的字不動。

import { Converter } from 'opencc-js/t2cn';

const base = Converter({ from: 'tw', to: 'cn' });

/** 轉完字形後再換的台灣用語（左：轉字形後的樣子；右：大陸常用說法）。審稿時一併看。 */
export const WORDS = [
  ['登入', '登录'],
  ['帐号', '账号'],
  ['帐户', '账户'],
  ['连结', '链接'],
  ['讯息', '消息'],
  ['装置', '设备'],
  ['检举', '举报'],
  ['预设', '默认'],
  ['点选', '点击'],
  ['设定', '设置'],
  ['网路', '网络'],
  ['使用者', '用户'],
  ['介面', '界面'],
  ['资讯', '信息'],
  ['萤幕', '屏幕'],
  ['程式', '程序'],
  ['伺服器', '服务器'],
];

const cache = new Map();
export function toHans(text) {
  if (!text || !/[一-鿿]/.test(text)) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  let s = base(text);
  for (const [a, b] of WORDS) if (s.includes(a)) s = s.split(a).join(b);
  if (cache.size > 4000) cache.clear();
  cache.set(text, s);
  return s;
}

const SKIP = '.p-poem, .s-poem, textarea, input, script, style';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

/** 盯著集市的畫面，出現的文字一律轉簡體。回傳停止函式。 */
export function watchHans(root) {
  const fixText = (n) => {
    if (n.parentElement?.closest(SKIP)) return;
    const v = n.data;
    const h = toHans(v);
    if (h !== v) n.data = h;
  };
  const fixEl = (el) => {
    if (el.closest?.(SKIP)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute?.(a);
      if (v) {
        const h = toHans(v);
        if (h !== v) el.setAttribute(a, h);
      }
    }
  };
  const walk = (node) => {
    if (node.nodeType === 3) return fixText(node);
    if (node.nodeType !== 1) return;
    fixEl(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? fixText(n) : fixEl(n);
  };
  walk(root);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixEl(m.target);
      else for (const n of m.addedNodes) walk(n);
    }
  });
  mo.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
  return () => mo.disconnect();
}
