// Subset the self-hosted fonts (public/fonts/) to exactly the glyphs this
// site renders. Run after any copy change that adds new characters
// (messages/*.json, sticks.ts, ritual/home components) — otherwise the new
// text falls back to a system serif.
//
// Sources (downloaded fresh each run, cached under tools/.font-cache — the
// full TTFs are NOT committed):
// - Noto Serif TC variable: google/fonts ofl/notoseriftc/NotoSerifTC[wght].ttf
// - Noto Serif SC variable: google/fonts ofl/notoserifsc/NotoSerifSC[wght].ttf
//   (TC alone does NOT cover Simplified-only glyphs — verified 2026-11-06:
//   112 site glyphs, e.g. 专为亲仅们, are missing from TC. SC is subset to
//   exactly those glyphs and declared under the SAME family name in CSS, so
//   the browser falls through TC -> SC per character.)
// - Ma Shan Zheng: google/fonts ofl/mashanzheng/MaShanZheng-Regular.ttf
//   (GB-based: covers the Simplified decorative words, but NOT the
//   Traditional ones — 搖籤脫複結問靈聖筊陰 fall back to Noto Serif TC in
//   the CSS stack, same as the prototype. No Google Fonts calligraphy face
//   covers both sets; checked Yuji Syuku / Zhi Mang Xing / Long Cang.)
// Requires Python fonttools (`pip install fonttools brotli`) for pyftsubset.
// Usage: node tools/subset-fonts.mjs [--check] (--check only verifies the
// committed woff2 files cover the current glyph set; exit 1 if not.)
//
// Glyph set = every non-ASCII character in messages/**, src/**, site.config.ts
// (that covers all rendered copy: ritual strings, stick poems/verdicts, legal
// pages, header) + ASCII printable + CJK punctuation. Over-collection from
// code comments is intentional and cheap; under-collection breaks rendering.

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sites', 'yuelao');
const CACHE = resolve(dirname(fileURLToPath(import.meta.url)), '.font-cache');
const OUT = join(SITE, 'public', 'fonts');

const FONTS = [
  {
    name: 'noto-serif-tc',
    url: 'https://github.com/google/fonts/raw/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf',
    file: 'NotoSerifTC.ttf',
    out: 'noto-serif-tc.woff2',
  },
  {
    name: 'noto-serif-sc',
    url: 'https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
    file: 'NotoSerifSC.ttf',
    out: 'noto-serif-sc.woff2',
    // Only the glyphs TC lacks (Simplified-only). Declared under the same
    // family name in CSS; the browser uses TC first, SC as per-char fallback.
    onlyNotIn: 'NotoSerifTC.ttf',
  },
  {
    name: 'ma-shan-zheng',
    url: 'https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf',
    file: 'MaShanZheng.ttf',
    out: 'ma-shan-zheng.woff2',
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'paraglide' || entry === '.font-cache') continue;
      walk(p, out);
    } else if (/\.(json|ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

function collectGlyphs() {
  const chars = new Set();
  const files = [...walk(join(SITE, 'messages')), ...walk(join(SITE, 'src')), join(SITE, 'site.config.ts')];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp > 127) chars.add(ch);
    }
  }
  // ASCII printable + CJK punctuation that may appear in copy.
  for (let cp = 0x20; cp <= 0x7e; cp++) chars.add(String.fromCodePoint(cp));
  for (const ch of '，。、；：？！「」『』（）《》〈〉—…·•×÷±→←↑↓§') chars.add(ch);
  return [...chars].sort().join('');
}

function download(url, dest) {
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  execSync(`curl -sL -o ${JSON.stringify(dest)} ${JSON.stringify(url)}`, { stdio: 'inherit' });
}

function charsNotInFont(text, ttfFile) {
  // Returns the subset of `text` whose codepoints are NOT in the given TTF's
  // cmap (used to carve the SC-only set out of the TC coverage).
  const script = `
import sys
from fontTools.ttLib import TTFont
text = open(sys.argv[1], encoding='utf-8').read()
cmap = TTFont(sys.argv[2]).getBestCmap()
open(sys.argv[3], 'w', encoding='utf-8').write(''.join(sorted({c for c in text if ord(c) not in cmap})))
`;
  const tmpPy = join(CACHE, 'filter-glyphs.py');
  const tmpIn = join(CACHE, 'glyphs-full.txt');
  const tmpOut = join(CACHE, 'glyphs-filtered.txt');
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(tmpPy, script, 'utf8');
  writeFileSync(tmpIn, text, 'utf8');
  execFileSync('python3', [tmpPy, tmpIn, join(CACHE, ttfFile), tmpOut], { stdio: 'inherit' });
  return readFileSync(tmpOut, 'utf8');
}

function subset(font, text) {
  const src = join(CACHE, font.file);
  download(font.url, src);
  if (font.onlyNotIn) text = charsNotInFont(text, font.onlyNotIn);
  mkdirSync(OUT, { recursive: true });
  const out = join(OUT, font.out);
  const tmp = join(CACHE, `${font.name}.subset.txt`);
  writeFileSync(tmp, text, 'utf8');
  execFileSync(
    'python3',
    [
      '-m',
      'fontTools.subset',
      src,
      `--text-file=${tmp}`,
      `--output-file=${out}`,
      '--flavor=woff2',
      '--layout-features=*',
    ],
    { stdio: 'inherit' },
  );
  const size = statSync(out).size;
  console.log(`${font.out}: ${size} bytes (${[...text].length} chars)`);
  return size;
}

function checkCoverage(text) {
  // The BODY font is TC + SC under one family name: their union must cover
  // every collected glyph. Ma Shan Zheng is decorative-only; its gaps fall
  // back to Noto Serif TC per the CSS stack, so they are reported, not
  // fatal — but a gap in the TC+SC union would be a rendering bug.
  const script = `
import sys
from fontTools.ttLib import TTFont
text = open(sys.argv[1], encoding='utf-8').read()
union = set()
for name in ['noto-serif-tc.woff2', 'noto-serif-sc.woff2']:
    union |= set(TTFont(sys.argv[2] + '/' + name).getBestCmap())
missing = sorted({c for c in text if ord(c) > 127 and ord(c) not in union})
print('missing from TC+SC union:', ''.join(missing) if missing else '(none)')
msz = TTFont(sys.argv[2] + '/ma-shan-zheng.woff2').getBestCmap()
msz_missing = sorted({c for c in text if ord(c) > 127 and ord(c) not in msz})
print(f'ma-shan-zheng gaps (fallback to Noto Serif TC, OK): {len(msz_missing)} chars')
sys.exit(1 if missing else 0)
`;
  const tmpPy = join(CACHE, 'check-coverage.py');
  const tmpTxt = join(CACHE, 'glyphs.txt');
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(tmpPy, script, 'utf8');
  writeFileSync(tmpTxt, text, 'utf8');
  execFileSync('python3', [tmpPy, tmpTxt, OUT], { stdio: 'inherit' });
}

const checkOnly = process.argv.includes('--check');
const glyphs = collectGlyphs();
console.log(`glyph set: ${[...glyphs].length} chars from ${SITE}`);
if (checkOnly) {
  checkCoverage(glyphs);
} else {
  for (const font of FONTS) subset(font, glyphs);
  checkCoverage(glyphs);
  console.log('done. Re-run after any copy change that adds new characters.');
}
