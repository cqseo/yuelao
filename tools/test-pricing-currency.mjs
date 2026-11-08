import assert from 'node:assert/strict';
import { checkoutProductForCurrency } from '../packages/core/src/site.ts';

// Pricing is a billing decision, not a writing-system decision.
// A zh-Hant Hong Kong buyer must still pay HKD, and vice versa.
const product = {
  id: 'unlock_1',
  kind: 'unlock',
  name: 'Deep Reading',
  prices: {
    'zh-Hant': { amount: 7500, currency: 'TWD' },
    'zh-Hans': { amount: 1800, currency: 'HKD' },
  },
};

const hkd = checkoutProductForCurrency(product, 'HKD');
const twd = checkoutProductForCurrency(product, 'TWD');
assert.deepEqual(hkd?.price, { amount: 1800, currency: 'HKD' });
assert.deepEqual(twd?.price, { amount: 7500, currency: 'TWD' });
assert.equal(checkoutProductForCurrency(product, 'USD'), null);
assert.equal(checkoutProductForCurrency(product, ''), null);
console.log('PASS: checkout price follows explicitly selected currency, never site language');
