import assert from 'node:assert/strict';
import { billingMode, buyerAllowed, checkoutGate, keyMatchesMode } from '../packages/core/src/billing/mode';

// 收款模式：測試／正式絕不混用；正式模式對所有登入的人開放；預設是測試模式。
const T = 'sk_test_x';
const RT = 'rk_test_x';
const L = 'sk_live_x';
const RL = 'rk_live_x';
const W = 'whsec_x';

assert.equal(billingMode({}), 'test');
assert.equal(billingMode({ BILLING_MODE: 'LIVE' }), 'test', 'only the exact value "live" switches');
assert.equal(billingMode({ BILLING_MODE: 'live' }), 'live');
console.log('PASS: default is test mode; only BILLING_MODE="live" switches');

// 測試模式（和以前一樣）
assert.equal(
  checkoutGate({ BILLING_ENABLE_TEST_CHECKOUT: 'true', STRIPE_SECRET_KEY: T, STRIPE_WEBHOOK_SECRET: W }),
  null,
);
assert.equal(
  checkoutGate({ BILLING_ENABLE_TEST_CHECKOUT: 'true', STRIPE_SECRET_KEY: RT, STRIPE_WEBHOOK_SECRET: W }),
  null,
);
assert.equal(checkoutGate({ STRIPE_SECRET_KEY: T, STRIPE_WEBHOOK_SECRET: W }), 'checkout_disabled');
assert.equal(
  checkoutGate({ BILLING_ENABLE_TEST_CHECKOUT: 'true', STRIPE_SECRET_KEY: L, STRIPE_WEBHOOK_SECRET: W }),
  'test_key_required',
);
assert.equal(
  checkoutGate({ BILLING_ENABLE_TEST_CHECKOUT: 'true', STRIPE_SECRET_KEY: T }),
  'webhook_not_configured',
);
assert.equal(buyerAllowed({ BILLING_TEST_ALLOWED_EMAILS: 'a@x.com' }, 'A@x.com'), true);
assert.equal(buyerAllowed({ BILLING_TEST_ALLOWED_EMAILS: 'a@x.com' }, 'b@x.com'), false);
assert.equal(buyerAllowed({}, 'a@x.com'), false, 'empty allowlist fails closed');
console.log('PASS: test mode keeps the old rules (flag, test key, webhook secret, allowlist)');

// 正式模式
const live = { BILLING_MODE: 'live' };
assert.equal(checkoutGate({ ...live, STRIPE_SECRET_KEY: L, STRIPE_WEBHOOK_SECRET: W }), null);
assert.equal(checkoutGate({ ...live, STRIPE_SECRET_KEY: RL, STRIPE_WEBHOOK_SECRET: W }), null);
assert.equal(checkoutGate({ ...live, STRIPE_SECRET_KEY: T, STRIPE_WEBHOOK_SECRET: W }), 'live_key_required');
assert.equal(checkoutGate({ ...live, STRIPE_SECRET_KEY: L }), 'webhook_not_configured');
assert.equal(
  checkoutGate({
    ...live,
    STRIPE_SECRET_KEY: L,
    STRIPE_WEBHOOK_SECRET: W,
    BILLING_ENABLE_TEST_CHECKOUT: 'false',
  }),
  null,
  'the test-checkout flag does not matter in live mode',
);
assert.equal(buyerAllowed(live, 'anyone@x.com'), true);
console.log('PASS: live mode needs a live key and webhook secret, and is open to every signed-in buyer');

// webhook：金鑰要和模式一致
assert.equal(keyMatchesMode({ STRIPE_SECRET_KEY: T }), true);
assert.equal(keyMatchesMode({ STRIPE_SECRET_KEY: L }), false);
assert.equal(keyMatchesMode({ ...live, STRIPE_SECRET_KEY: L }), true);
assert.equal(keyMatchesMode({ ...live, STRIPE_SECRET_KEY: T }), false);
assert.equal(keyMatchesMode({ ...live }), false);
console.log('PASS: webhooks only run when the key matches the mode');
