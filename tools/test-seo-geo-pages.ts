import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STICKS } from '../sites/yuelao/src/ritual/sticks';

const file = (path: string) => readFileSync('sites/yuelao/src/' + path, 'utf8');
assert.equal(STICKS.length, 100);
assert.deepEqual(STICKS.map((s) => s.id), Array.from({ length: 100 }, (_, i) => i + 1));
const sourced = STICKS.filter((s) => !!s.source).length;
assert.ok(sourced < 100, 'Never assert that every verse has a verified classical citation');
const index = file('routes/signs.tsx');
assert.match(index, /createFileRoute\('\/signs'\)/);
assert.match(index, /STICKS\.map\(/);
assert.ok(index.includes("'/market#yuelao'"), 'A new draw should enter the 3D hall, not 2D');
assert.ok(!index.includes("'/ritual'"), 'Old independent ritual route is retired');

for (const path of ['routes/about.tsx', 'routes/methodology.tsx']) {
  const source = file(path);
  assert.ok(source.includes('localizeHref'), path + ' must support locale-aware URLs');
  assert.ok(!source.includes("to={localizeHref('/ritual')}"), path + ' must not direct to retired page');
}
const sign = file('routes/sign/$id.tsx');
assert.match(sign, /BreadcrumbList/);
assert.match(sign, /localizeHref\('\/signs'/);
assert.match(sign, /replace\(\/\[，,。、；;：:\\s\]\+\$\/u, ''\)/);
const sitemap = file('routes/sitemap-pages[.]xml.ts');
for (const p of ['/signs', '/about', '/methodology']) assert.ok(sitemap.includes("'" + p + "'"));
assert.ok(!sitemap.includes("  '/ritual',"));
const home = file('market/Home.tsx');
assert.ok(home.includes("'/market#yuelao'"));
assert.ok(home.includes("to: '/signs'"));
assert.ok(home.includes("track('home_yuelao_click'"));
const faq = JSON.parse(readFileSync('sites/yuelao/messages/home/zh-Hant.json', 'utf8'));
assert.ok(!faq.home_faq_a6.includes('每首都對過原典'), 'Do not overstate source verification');
console.log('PASS: SEO pages, 100-sign index, source honesty, breadcrumbs and market-only ritual links.');
