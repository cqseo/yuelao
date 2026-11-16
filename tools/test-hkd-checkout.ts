import assert from 'node:assert/strict';
import { checkoutProductForCurrency, formatPrice, priceForLocale } from '../packages/core/src/site';
import site from '../sites/yuelao/site.config';

// Fixed historical HKD tiers, not estimates converted from a US dollar amount.
const EXPECTED: Record<string, number> = {
  unlock_1: 1800,
  spread_1: 1800,
  incense_lotus: 1800,
  incense_aurora: 2800,
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
