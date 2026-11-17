import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawTarot } from '../sites/yuelao/src/ritual/tarot';
import { drawThree } from '../sites/yuelao/src/ritual/lenormand';
import { parseSpread } from '../packages/core/src/spread';
import { hasLiteTarotPending, saveLiteTarotPending, takeLiteTarotPending } from '../sites/yuelao/src/market/lite-tarot-pending';

const tarot = drawTarot('下一步怎么办', 'crush', '2026-11-17');
assert.deepEqual(tarot, drawTarot('下一步怎么办', 'crush', '2026-11-17'), 'draws are deterministic for the same question/day');
assert.equal(new Set(tarot.map((c) => c.card.img)).size, 3);
const tarotKey = 'tarot:' + tarot.map((c) => c.card.img + (c.rev ? '~' : '')).join(',') + '|0123456789abcdef';
assert.equal(parseSpread(tarotKey)?.cards.length, 3, 'same card identifiers as original 3D flow');

const lnm = drawThree('下一步怎么办', 'crush', '2026-11-17');
assert.equal(new Set(lnm.map((c) => c.n)).size, 3);
const lnmKey = 'lnm:' + lnm.map((c) => String(c.n).padStart(2, '0')).join(',') + '|0123456789abcdef';
assert.equal(parseSpread(lnmKey)?.cards.length, 3);

const market = readFileSync('sites/yuelao/src/market/Market.tsx', 'utf8');
const home = readFileSync('sites/yuelao/src/market/Home.tsx', 'utf8');
const lite = readFileSync('sites/yuelao/src/market/LiteTarot.tsx', 'utf8');
assert.ok(home.includes('/market?lite=tarot#tarot'));
assert.ok(market.includes("liteMode === 'tarot'"), 'no WebGL for lite mode');
assert.ok(market.includes('hasLiteTarotPending()'), 'resume after login / Stripe');
assert.ok(lite.includes("'/api/billing/checkout'"), 'reuse existing checkout');
assert.ok(lite.includes("'/api/account/spread/generate'"), 'generation requires verified unlock');
assert.ok(lite.includes("access === 'unlocked'"), 'never charge for owned readings');
assert.ok(lite.includes('checkout_session_created'), 'track successful checkout creation');
assert.ok(lite.includes('scrollIntoView'), 'draw should reveal the result on mobile');
assert.ok(lite.includes('loading="eager"'), 'the three cards are primary content, not deferred thumbnails');
assert.ok(lite.includes('IntersectionObserver'), 'count premium views only after the actual offer is visible');
assert.ok(!lite.includes('amount: 1800'), 'price is server-authoritative');

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  },
});
assert.equal(hasLiteTarotPending(), false);
assert.equal(saveLiteTarotPending({
  deck: 'lnm', question: 'private words', sit: 'crush', day: '2026-11-17', why: 'pay',
}), true);
assert.equal(hasLiteTarotPending(), true);
const restored = takeLiteTarotPending();
assert.equal(restored?.deck, 'lnm');
assert.equal(restored?.question, 'private words');
assert.equal(restored?.why, 'pay');
assert.equal(hasLiteTarotPending(), false, 'consume only once');
assert.equal(saveLiteTarotPending({
  deck: 'lnm', question: '', sit: 'crush', day: '2026-11-17', why: 'pay',
}), false, 'invalid empty question should never be saved');
values.set('market-lite-tarot-pending', JSON.stringify({
  liteTarot: true, deck: 'tarot', question: 'private words', sit: 'crush',
  day: '2026-11-17', why: 'pay', at: Date.now() - 60 * 60_000,
}));
assert.equal(hasLiteTarotPending(), false, 'stale marker expires');

console.log('PASS: fast Tarot/Lenormand, matching paid spread IDs, secure resume marker and no-WebGL entry.');
