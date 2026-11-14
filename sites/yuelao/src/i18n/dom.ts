// 3D 集市的介面翻譯（2026-11-14）：集市的面板、提示、按鈕是引擎直接寫進 DOM 的中文，
// 非中文介面時用這裡的監聽器把文字換成當地語言（字典同 ui/*.json，鍵是繁體原文）。
// 只在瀏覽器跑；籤詩、牌義等內容不在字典裡，會原樣留著中文。
// 同時把引擎寫死的站內連結（/login、/privacy…）加上語言前綴。

const SKIP = '.p-poem, .s-poem, textarea, input, script, style, [data-no-tr]';
// 屬性（placeholder 等）在輸入框上也要翻，只避開內容區。
const SKIP_ATTR = '.p-poem, .s-poem, [data-no-tr]';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const PREFIXES = ['en', 'ja', 'th', 'ko'];

interface Pattern {
  re: RegExp;
  out: string;
  /** 固定字（不算標點、空白）越多越具體，越先比 */
  weight: number;
}

function compile(dict: Record<string, string>) {
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  for (const [k, v] of Object.entries(dict)) {
    if (k === v) continue;
    if (/\{\d+\}/.test(k)) {
      const order: number[] = [];
      const src = k
        .split(/(\{\d+\})/)
        .map((part) => {
          const m = /^\{(\d+)\}$/.exec(part);
          if (m) {
            order.push(Number(m[1]));
            return '(.+?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
        })
        .join('');
      // 把擷取的順序記在 out 裡：{n} → 第幾個擷取
      let out = v;
      order.forEach((n, i) => {
        out = out.split(`{${n}}`).join(`\uE000${i}\uE000`);
      });
      const weight = k.replace(/\{\d+\}/g, '').replace(/[\s\p{P}]/gu, '').length;
      patterns.push({ re: new RegExp(`^${src}$`, 's'), out, weight });
    } else {
      exact.set(k.replace(/\s+/g, ' ').trim(), v);
    }
  }
  // 固定字越多的越先比（較具體）：「今日一籤．{0}」要先於日期「{0} 年 {1} 月 {2} 日」
  patterns.sort((a, b) => b.weight - a.weight);
  return { exact, patterns };
}

export function watchTranslate(root: HTMLElement, dict: Record<string, string>, lang: string) {
  const { exact, patterns } = compile(dict);

  const translate = (text: string, depth = 0): string | null => {
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key || !/[㐀-鿿]/.test(key)) return null;
    const hit = exact.get(key);
    if (hit !== undefined) return hit;
    if (depth > 1) return null;
    for (const p of patterns) {
      const m = p.re.exec(key);
      if (!m) continue;
      return p.out.replace(/\uE000(\d+)\uE000/g, (_, i) => {
        const cap = m[Number(i) + 1] ?? '';
        return translate(cap, depth + 1) ?? cap;
      });
    }
    return null;
  };

  const doText = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const raw = node.nodeValue ?? '';
    const out = translate(raw);
    if (out === null) return;
    const lead = raw.match(/^\s*/)?.[0] ?? '';
    const tail = raw.match(/\s*$/)?.[0] ?? '';
    const next = lead + out + tail;
    if (next !== raw) node.nodeValue = next;
  };

  const doEl = (el: Element) => {
    if (el.closest(SKIP_ATTR)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) {
        const out = translate(v);
        if (out !== null && out !== v) el.setAttribute(a, out);
      }
    }
    if (el instanceof HTMLAnchorElement) {
      const href = el.getAttribute('href') ?? '';
      if (
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !PREFIXES.some((p) => href.startsWith(`/${p}/`))
      ) {
        if (!/^\/(api|market\/|ritual\/|stats)\b/.test(href)) el.setAttribute('href', `/${lang}${href}`);
      }
    }
  };

  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      doText(n as Text);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    doEl(el);
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let cur = tw.nextNode();
    while (cur) {
      if (cur.nodeType === Node.TEXT_NODE) doText(cur as Text);
      else doEl(cur as Element);
      cur = tw.nextNode();
    }
  };

  walk(root);
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target as Text);
      else if (r.type === 'attributes') doEl(r.target as Element);
      else for (const n of r.addedNodes) walk(n);
    }
  });
  mo.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, 'href'],
  });
  return () => mo.disconnect();
}
