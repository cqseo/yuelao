import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STICKS } from '../sites/yuelao/src/ritual/sticks';

const read = (p: string) => readFileSync('sites/yuelao/src/' + p, 'utf8');
const market = read('market/Market.tsx');
const engine = read('market/engine/main.js');
const yuelao = read('market/engine/yuelao.js');
const lite = read('market/LiteMarket.tsx');

assert.equal(STICKS.length, 100);
assert.ok(market.includes('if (lite) return <LiteMarket />;'));
assert.ok(market.includes("get('lite') === '1'"));
assert.ok(market.includes("onBootFailure: () => activateLite('boot')"));
assert.ok(market.includes("catch(() => activateLite('module'))"));
assert.ok(engine.includes('opts.onBootFailure?.()'));
assert.ok(!engine.includes('可以改用一般版求籤'));
assert.ok(lite.includes("localizeHref('/sign/' + result.id)"), 'lite results must remain navigable');
assert.ok(!lite.includes("localizeHref('/ritual')"), 'no separate ritual page');
assert.ok(lite.includes("crypto.getRandomValues"), 'random stick is selected on device');
for (const evt of ['ritual_begin', 'reading_done', 'quick_question_click']) {
  assert.ok(yuelao.includes("'" + evt + "'"), 'Missing privacy-preserving event ' + evt);
}
assert.ok(yuelao.includes('QUICK_QUESTIONS'), '3D hall must offer question shortcuts');
assert.ok(!yuelao.includes("ui.emit?.('ritual_begin', { question:"), 'never emit private questions');
console.log('PASS: same-route lite fallback, market shortcuts, privacy-safe events, and 3D-only ritual.');
