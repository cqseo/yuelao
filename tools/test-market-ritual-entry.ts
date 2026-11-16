import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyRitualDestination } from '../sites/yuelao/src/market/legacy-ritual';

for (const [path, expected] of [
  ['/ritual', '/market#yuelao'],
  ['/ritual/', '/market#yuelao'],
  ['/ritual?cat=single&q=private', '/market#yuelao'],
  ['/en/ritual', '/en/market#yuelao'],
  ['/ja/ritual/', '/ja/market#yuelao'],
  ['/ko/ritual', '/ko/market#yuelao'],
  ['/th/ritual?cat=him', '/th/market#yuelao'],
] as const) {
  const result = legacyRitualDestination(new URL(path, 'https://yuexia.app'));
  assert.equal(result?.pathname + result?.search + result?.hash, expected, path);
}
for (const path of ['/market', '/ritual/example', '/en/market', '/api/billing/checkout', '/sign/1']) {
  assert.equal(legacyRitualDestination(new URL(path, 'https://yuexia.app')), null, path);
}
// Guard against future homepage/sign/detail links reopening the retired 2D ritual.
for (const file of [
  'sites/yuelao/src/market/Home.tsx',
  'sites/yuelao/src/market/Market.tsx',
  'sites/yuelao/src/routes/__root.tsx',
  'sites/yuelao/src/routes/daily.tsx',
  'sites/yuelao/src/routes/tests/index.tsx',
  'sites/yuelao/src/routes/sign/$id.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  assert.ok(!source.includes("localizeHref('/ritual')"), file + ' must not link to 2D ritual');
}
const homepage = readFileSync('sites/yuelao/src/market/Home.tsx', 'utf8');
assert.ok(homepage.includes("href={localizeHref('/market#yuelao')}"), 'homepage must link directly to 3D hall');
const sitemap = readFileSync('sites/yuelao/src/routes/sitemap-pages[.]xml.ts', 'utf8');
assert.ok(!sitemap.includes("  '/ritual',"), 'retired page should be absent from sitemap');
console.log('PASS: 3D hall links exist; no internal 2D ritual links remain.');
console.log('PASS: old ritual URLs resolve to the immersive market hall without leaking question text.');
