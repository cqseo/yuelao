import assert from 'node:assert/strict';
import {
  buildHkdPriceQuote,
  estimateLabel,
  parseUsdHkdRate,
} from '../sites/yuelao/src/lib/hkd-prices';
import site from '../sites/yuelao/site.config';

// 2026-11-16: reference-rate display must never alter checkout USD minor units.
const nowMs = Date.parse('2026-11-16T12:00:00.000Z');
const valid = {
  result: 'success',
  base_code: 'USD',
  rates: { HKD: 7.8 },
  time_last_update_utc: 'Mon, 16 Nov 2026 00:00:01 +0000',
};
const parsed = parseUsdHkdRate(valid, nowMs);
assert.equal(parsed?.rate, 7.8);
assert.equal(parsed?.updatedAt, '2026-11-16T00:00:01.000Z');
assert.equal(parseUsdHkdRate({ ...valid, base_code: 'EUR' }, nowMs), null);
assert.equal(parseUsdHkdRate({ ...valid, rates: { HKD: 100 } }, nowMs), null);
assert.equal(parseUsdHkdRate({ ...valid, rates: { HKD: '<img>' } }, nowMs), null);
assert.equal(parseUsdHkdRate({ ...valid, time_last_update_utc: '2026-11-01' }, nowMs), null);
assert.equal(parseUsdHkdRate({ ...valid, time_last_update_utc: 'invalid' }, nowMs), null);

const quote = buildHkdPriceQuote(site, 7.8, parsed!.updatedAt);
assert.equal(quote.prices.unlock_1.approxHkd, 'HK$23.32');
assert.equal(quote.prices.unlock_1.actualUsd, 'US$2.99');
assert.equal(quote.prices.pack_3.approxHkd, 'HK$54.52');
assert.equal(quote.prices.pack_3.actualUsd, 'US$6.99');
assert.equal(quote.prices.pack_8.approxHkd, 'HK$109.12');
assert.equal(quote.prices.pack_8.actualUsd, 'US$13.99');
assert.equal(Object.keys(quote.prices).length, site.products.length);
assert.match(estimateLabel(quote, 'unlock_1', 'US$2.99', 'zh-Hant'), /約HK\$23\.32 · US\$2\.99/);
assert.equal(estimateLabel(null, 'unlock_1', 'US$2.99', 'zh-Hant'), 'US$2.99');
assert.equal(estimateLabel({ ...quote, prices: { unlock_1: { approxHkd: '<script>', actualUsd: 'US$2.99' } } }, 'unlock_1', 'US$2.99', 'zh-Hant'), 'US$2.99');

// Source-of-truth USD values were never changed.
for (const product of site.products) {
  assert.equal(product.prices['zh-Hant'].currency, 'USD');
  assert.equal(product.prices['zh-Hant'].amount, product.prices['zh-Hans'].amount);
}
console.log('PASS: validated daily USD/HKD reference price display; charge remains exact USD.');
