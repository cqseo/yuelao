import assert from 'node:assert/strict';
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
console.log('PASS: old ritual URLs resolve to the immersive market hall without leaking question text.');
