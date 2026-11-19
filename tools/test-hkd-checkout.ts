import assert from 'node:assert/strict';
import { checkoutProductForCurrency, formatPerUse, formatPrice, priceForLocale, salePlans } from '../packages/core/src/site';
import site from '../sites/yuelao/site.config';

// Fixed historical HKD tiers, not estimates converted from a US dollar amount.
// 2026-11-19：單次 HK$12；次數包改成 5 次 HK$38、12 次 HK$68（舊的 3／8 次包下架，id 與價格保留給舊訂單）。
const EXPECTED: Record<string, number> = {
  unlock_1: 1200,
  spread_1: 1800,
  followup_1: 800,
  incense_lotus: 1800,
  incense_aurora: 2800,
  pack_5: 3800,
  pack_12: 6800,
  pack_3: 4800,
  pack_8: 10800,
};

assert.equal(site.products.length, Object.keys(EXPECTED).length);
for (const product of site.products) {
  const expectedAmount = EXPECTED[product.id];
  assert.ok(Number.isSafeInteger(expectedAmount), 'Unexpected product: ' + product.id);
  for (const locale of ['zh-Hant', 'zh-Hans'] as const) {
    const price = priceForLocale(product, locale);
    assert.deepEqual(price, { currency: 'HKD', amount: expectedAmount });
    assert.equal(formatPrice(price, locale), 'HK$' + String(expectedAmount / 100));
  }
  const checkout = checkoutProductForCurrency(product, 'HKD');
  assert.equal(checkout?.price.amount, expectedAmount);
  assert.equal(checkout?.price.currency, 'HKD');
  assert.equal(checkoutProductForCurrency(product, 'USD'), null, 'USD cannot be charged');
  assert.equal(checkoutProductForCurrency(product, 'TWD'), null, 'TWD cannot be charged');
}
console.log('PASS: all product display prices and checkout currency are exact HKD; USD/TWD are unavailable.');

// 方案選單：只有上架中的單次與次數包，依次數排；平均每次照算
assert.deepEqual(
  salePlans(site, 'zh-Hant').map((p) => [p.id, p.uses, p.price.amount, p.perUse]),
  [
    ['unlock_1', 1, 1200, 1200],
    ['pack_5', 5, 3800, 760],
    ['pack_12', 12, 6800, 567],
  ],
);
assert.ok(site.products.filter((p) => p.retired).every((p) => p.id === 'pack_3' || p.id === 'pack_8'));
console.log('PASS: sale plans list single + live packs only, with per-use prices; old packs are retired.');
assert.deepEqual([formatPerUse(567, 'HKD'), formatPerUse(760, 'HKD'), formatPerUse(1200, 'HKD')], ['HK$5.7', 'HK$7.6', 'HK$12']);
console.log('PASS: per-use prices show at most one decimal');
