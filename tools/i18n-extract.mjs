// 抽出介面上寫死的繁體句子，產生翻譯用的鍵清單（多語言，2026-11-14）。
//   node tools/i18n-extract.mjs            → 印出各語言缺幾句
//   node tools/i18n-extract.mjs --missing en → 印出 en 缺的鍵（JSON 陣列）
// 鍵 = 繁體原文；有變數的部分寫成 {0}、{1}。翻譯放在 sites/yuelao/src/i18n/ui/<locale>.json。
//
// React 頁面：tr('…')、trf('…') 與頁面裡「繁、簡二選一」的小幫手（t / text / copy）的第一個參數。
// 3D 集市（market/engine/*.js）：字串與樣板字串拆掉 HTML 標籤後的每一段文字，以及
// placeholder／title／aria-label 屬性；畫在畫布上的字（招牌、分享圖）與內容資料不抽。

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const SITE = new URL('../sites/yuelao/', import.meta.url).pathname;
const ts = createRequire(join(SITE, 'package.json'))('typescript');
const HAN = /[㐀-鿿]/;
const LOCALES = ['en', 'ja', 'th', 'ko'];

export const REACT_FILES = [
  'src/routes/account.tsx',
  'src/routes/daily.tsx',
  'src/routes/login.tsx',
  'src/routes/account/reading.tsx',
  'src/routes/tests/index.tsx',
  'src/routes/tests/$slug.tsx',
  'src/routes/privacy.tsx',
  'src/routes/billing/return.tsx',
  'src/market/Market.tsx',
  'src/ritual/Ritual.tsx',
  'src/tests/components/TestRunner.tsx',
  'src/i18n/LangMenu.tsx',
];
// 內容資料（籤詩、牌義、黃曆、範例）與畫布文字不在這一階段翻。
export const ENGINE_FILES = [
  'main.js',
  'yuelao.js',
  'tarot.js',
  'pool.js',
  'interact.js',
  'sutra.js',
  'charm.js',
  'shrine.js',
  'avatar.js',
  'hall.js',
  'npc.js',
  'koi.js',
  'crowd.js',
  'plaza-net.js',
  'util.js',
].map((f) => `src/market/engine/${f}`);

// 抽不到、但畫面上會出現的介面字（例如 world.js 的地點名、每日心箋的主題名）。
export const EXTRA_KEYS = [
  '山門外',
  '殿前',
  '廣場',
  '緣分',
  '溝通',
  '心境',
  '行動',
  // 塔羅的正逆位・元素、日期、抽牌時的旁白
  '正位・{0}',
  '逆位・{0}',
  '火',
  '水',
  '風',
  '土',
  '大牌',
  '{0} 年 {1} 月 {2} 日',
  '{0}，{1}，正位。',
  '{0}，{1}，逆位。',
  // 付費解讀的小標（AI 照抄中文小標，介面再換）
  '【{0}】',
  // 店鋪招牌下的小字（world.js 的 labels，畫在 DOM 上）
  '求籤問緣',
  '三張牌陣',
  '多人同拜',
  '算命攤',
  '八字命盤',
  '化寶爐',
  '燒疏文',
  '旺鋪招租',
  '虛位以待',
  '茶館',
  '清茶細點',
  '看見此刻',
  '一日一箋',
  '心安即是',
  '繫一條紅線',
];

const HELPERS = new Set(['tr', 'trf', 't', 'text', 'copy']);
const ENT = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&middot;': '·',
};
const decode = (s) => s.replace(/&[a-z#0-9]+;/g, (e) => ENT[e] ?? e);
const MARK = '\u0000';

function parse(file) {
  const src = readFileSync(join(SITE, file), 'utf8');
  const kind = file.endsWith('x')
    ? ts.ScriptKind.TSX
    : file.endsWith('.js')
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
}

function literalText(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n))
    return n.head.text + n.templateSpans.map((s) => MARK + s.literal.text).join('');
  return null;
}

/** 'a' + x + `b${y}` → 'a\0b\0'（只在整串都是 + 時）。 */
function plusChain(n) {
  if (ts.isParenthesizedExpression(n)) return plusChain(n.expression);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return plusChain(n.left) + plusChain(n.right);
  }
  const lit = literalText(n);
  return lit ?? MARK;
}

function segments(raw) {
  const out = [];
  // 屬性
  for (const m of raw.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]*)"/g)) out.push(m[1]);
  // 拆標籤（標籤本身丟掉）
  const text = raw.replace(/<[^>]*>/g, '\u0001');
  for (const seg of text.split('\u0001')) out.push(seg);
  return out
    .map((s) => {
      let i = 0;
      return decode(s.replace(/\u0000/g, () => `{${i++}}`))
        .replace(/\s+/g, ' ')
        .trim();
    })
    .filter((s) => HAN.test(s));
}

export function extract() {
  const keys = new Set(EXTRA_KEYS);
  for (const file of REACT_FILES) {
    let sf;
    try {
      sf = parse(file);
    } catch {
      continue;
    }
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && HELPERS.has(n.expression.text)) {
        const a = n.arguments[0];
        const lit = a && literalText(a);
        if (lit && HAN.test(lit)) keys.add(lit.replace(/\u0000/g, '{?}'));
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  for (const file of ENGINE_FILES) {
    const sf = parse(file);
    const visit = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const p = n.parent;
        const top = !(ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken);
        const chain = top ? plusChain(n) : '';
        if (top && HAN.test(chain)) for (const s of segments(chain)) keys.add(s);
      }
      const lit = literalText(n);
      if (lit !== null && HAN.test(lit)) for (const s of segments(lit)) keys.add(s);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  // 純標點／單字的片段與變數佔滿的鍵沒有意義
  return [...keys]
    .filter((k) => !k.includes('{?}') && !/gl_FragColor|uniform |varying /.test(k))
    .filter((k) => HAN.test(k.replace(/\{\d+\}/g, '')))
    .sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = extract();
  const flag = process.argv[2];
  if (flag === '--missing') {
    const loc = process.argv[3];
    const dict = JSON.parse(readFileSync(join(SITE, `src/i18n/ui/${loc}.json`), 'utf8'));
    console.log(
      JSON.stringify(
        keys.filter((k) => !(k in dict)),
        null,
        1,
      ),
    );
  } else if (flag === '--keys') {
    console.log(JSON.stringify(keys, null, 1));
  } else {
    console.log(`${keys.length} keys`);
    for (const loc of LOCALES) {
      const dict = JSON.parse(readFileSync(join(SITE, `src/i18n/ui/${loc}.json`), 'utf8'));
      const missing = keys.filter((k) => !(k in dict)).length;
      console.log(`${loc}: ${missing} missing`);
    }
  }
}
