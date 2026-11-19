import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findProduct, formatPrice, priceForLocale } from '../packages/core/src/site';
import site from '../sites/yuelao/site.config';
import { hasLitePending, saveLitePending, takeLitePending } from '../sites/yuelao/src/market/lite-pending';

const original = findProduct(site, 'unlock_1');
assert.ok(original, 'Use the existing, not a second payment product');
for (const language of ['zh-Hant', 'zh-Hans'] as const) {
  assert.deepEqual(priceForLocale(original, language), { amount: 1200, currency: 'HKD' });
  assert.equal(formatPrice(priceForLocale(original, language), language), 'HK$12');
}
const lite = readFileSync('sites/yuelao/src/market/LiteMarket.tsx', 'utf8');
const billing = readFileSync('sites/yuelao/src/market/lite-billing.ts', 'utf8');
const market = readFileSync('sites/yuelao/src/market/Market.tsx', 'utf8');
assert.ok(lite.includes('liteCheckout(result.id, category, plan)'), 'Buy the drawn stick/category (or a pack)');
assert.ok(lite.includes('scrollIntoView'), 'after drawing, the result must be visible');
assert.ok(lite.includes('IntersectionObserver'), 'premium impression requires viewport exposure');
assert.ok(lite.includes("response.state === 'owned'"), 'Handle already owned without charging');
assert.ok(lite.includes("payment === 'ready'"), 'Show purchased full text');
assert.ok(lite.includes("payment === 'pending'"), 'Pending Stripe webhook must block a duplicate charge');
assert.ok(lite.includes('liteGenerate(result.id, category, asked)'), 'Generate only after entitlement, with the situation');
assert.ok(lite.includes('disabled={!consent || busy}'), 'Require explicit consent before generation');
assert.ok(billing.includes("'/api/account/reading/generate'"));
assert.ok(billing.includes("'/api/billing/checkout'"));
assert.ok(billing.includes("'/api/account/status'"));
assert.ok(billing.includes("from: 'market'"), 'Same Stripe success/cancel route');
assert.ok(!billing.includes("amount: 1800"), 'Client never sends amount');
assert.ok(market.includes("hasLitePending()"), 'Login and Stripe must resume the lite route');
assert.ok(!lite.includes("localizeHref('/ritual')"), 'Retired 2D ritual remains retired');

// Browser-only marker tests use a fake local sessionStorage. No real payment.
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
assert.equal(hasLitePending(), false);
assert.equal(saveLitePending(75, 'reunion', 'a private question', 'pay'), true);
assert.equal(hasLitePending(), true);
const pending = takeLitePending();
assert.equal(pending?.lite, true);
assert.equal(pending?.stickId, 75);
assert.equal(pending?.category, 'reunion');
assert.equal(pending?.question, 'a private question');
assert.equal(pending?.why, 'pay');
assert.equal(hasLitePending(), false, 'Consume pending exactly once');
assert.equal(saveLitePending(101, 'him', '', 'login'), false);
values.set('market-pending', JSON.stringify({
  lite: true, stickId: 4, category: 'him', question: '', why: 'pay',
  at: Date.now() - 60 * 60_000,
}));
assert.equal(hasLitePending(), false, 'Expire stale pending');
assert.equal(takeLitePending(), null);
// 快速版改版：處境一起存，回來接得上
assert.equal(saveLitePending(12, 'him', '', 'pay', 'pack_5', 'crush'), true);
const withSit = takeLitePending();
assert.equal(withSit?.sit, 'crush');
assert.equal(withSit?.plan, 'pack_5');
console.log('PASS: HKD12 full unlock, no duplicate purchase, owned text, consent and lite return restoration.');
