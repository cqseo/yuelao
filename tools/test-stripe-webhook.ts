import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFact } from '../packages/core/src/billing/provider';
import { settleStripeWebhook } from '../packages/core/src/billing/settle';
import { isStripeTestApiKey, StripeProvider, webhookTarget } from '../packages/core/src/billing/stripe';
import type { SiteConfig } from '../packages/core/src/site';

assert.equal(isStripeTestApiKey('sk_test_fake'), true);
assert.equal(isStripeTestApiKey('rk_test_fake'), true);
assert.equal(isStripeTestApiKey('sk_live_fake'), false);
assert.equal(isStripeTestApiKey('rk_live_fake'), false);
assert.equal(isStripeTestApiKey(''), false);
console.log('PASS: test-only standard/restricted keys accepted, live keys rejected');

const webhookSecret = 'whsec_yuelao_qa_only_not_real';
const provider = new StripeProvider({
  secretKey: 'sk_test_yuelao_qa_only_not_real',
  webhookSecret,
  automaticTax: false,
});
const privateSigner = provider as unknown as {
  stripe: {
    webhooks: {
      generateTestHeaderString: (input: { payload: string; secret: string }) => string;
    };
  };
};

function signedWebhook(
  eventType: string,
  object: { object: string; id: string; payment_intent?: string },
  id = 'evt_test_one',
  live = false,
): Request {
  const payload = JSON.stringify({
    id,
    object: 'event',
    api_version: '2026-09-30.endive',
    type: eventType,
    livemode: live,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = privateSigner.stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  return new Request('https://local.example.invalid/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': header },
    body: payload,
  });
}

const session = { object: 'checkout.session', id: 'cs_test_01' };
assert.deepEqual(
  webhookTarget({
    type: 'checkout.session.async_payment_succeeded',
    data: { object: session },
  } as never),
  { kind: 'checkout', ref: 'cs_test_01' },
);
assert.deepEqual(
  webhookTarget({
    type: 'checkout.session.async_payment_failed',
    data: { object: session },
  } as never),
  { kind: 'checkout', ref: 'cs_test_01' },
);
assert.deepEqual(
  webhookTarget({
    type: 'checkout.session.expired',
    data: { object: session },
  } as never),
  { kind: 'checkout', ref: 'cs_test_01' },
);
console.log('PASS: success, delayed failure and expiration mapped to checkout lookup');

const parsed = await provider.parseWebhook(signedWebhook('checkout.session.completed', session));
assert.equal(parsed.eventId, 'evt_test_one');
assert.deepEqual(parsed.target, { kind: 'checkout', ref: 'cs_test_01' });
console.log('PASS: valid HMAC-signed Stripe test event');

const fact: PaymentFact = {
  provider: 'stripe',
  paymentRef: 'pi_test_01',
  chargeRef: 'pi_test_01',
  paid: true,
  amount: 4800,
  currency: 'hkd',
  amountRefunded: 0,
  dispute: null,
  metadataTrusted: true,
  userId: '00000000-0000-4000-8000-000000000001',
  orderId: '00000000-0000-4000-8000-000000000002',
  productId: 'pack_3',
  subscriptionRef: null,
  periodStart: null,
  periodEnd: null,
  paidAt: Date.now(),
  fetchedAt: Date.now(),
};
const dbCalls: { name: string; args: Record<string, unknown> }[] = [];
let failSettlement = false;
let failRevocation = false;
const db = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    dbCalls.push({ name, args });
    return {
      data: 'granted',
      error:
        name === 'settle_stripe_payment' && failSettlement
          ? { message: 'simulated_settlement_error' }
          : name === 'revoke_for_refund' && failRevocation
            ? { message: 'simulated_revoke_error' }
            : null,
    };
  },
} as unknown as SupabaseClient;

provider.fetchCheckout = async () => ({ orderId: fact.orderId, subscription: null, payment: fact });
provider.fetchPaymentByCharge = async () => fact;
const site = {} as SiteConfig;
const result = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook('checkout.session.completed', session),
});
assert.equal(result.status, 200);
assert.equal(dbCalls.length, 1);
assert.equal(dbCalls[0].name, 'settle_stripe_payment');
assert.equal(dbCalls[0].args.p_payment_ref, fact.paymentRef);
assert.equal(dbCalls[0].args.p_paid, true);
assert.equal(dbCalls[0].args.p_amount, 4800);
console.log('PASS: signed paid checkout settled from provider-refetched payment, not event payload');

provider.fetchCheckout = async () => ({ orderId: fact.orderId, subscription: null, payment: null });
dbCalls.length = 0;
const incomplete = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook('checkout.session.completed', session, 'evt_unpaid'),
});
assert.equal(incomplete.status, 200);
assert.equal(dbCalls.length, 0);
const failed = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook('checkout.session.async_payment_failed', session, 'evt_failed'),
});
assert.equal(failed.status, 200);
assert.equal(dbCalls.length, 0);
console.log('PASS: unpaid/failed delayed checkout events grant no entitlements');

provider.fetchCheckout = async () => ({ orderId: fact.orderId, subscription: null, payment: fact });
dbCalls.length = 0;
const delayed = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook('checkout.session.async_payment_succeeded', session, 'evt_delayed'),
});
assert.equal(delayed.status, 200);
assert.equal(dbCalls.length, 1);
console.log('PASS: delayed payment success reaches settlement only after confirmed payment');

dbCalls.length = 0;
provider.fetchPaymentByCharge = async () => ({
  ...fact,
  amountRefunded: 100,
  dispute: 'open',
});
const refund = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook(
    'charge.refunded',
    { object: 'charge', id: 'ch_test_01', payment_intent: 'pi_test_01' },
    'evt_refund',
  ),
});
assert.equal(refund.status, 200);
assert.deepEqual(
  dbCalls.map((call) => call.name),
  ['settle_stripe_payment', 'revoke_for_refund'],
);
assert.equal(dbCalls[1].args.p_refund_amount, 100);
assert.equal(dbCalls[1].args.p_dispute, 'open');
console.log('PASS: refund and dispute are forwarded for entitlement revocation');

failSettlement = true;
const badDb = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook(
    'charge.refunded',
    { object: 'charge', id: 'ch_test_01', payment_intent: 'pi_test_01' },
    'evt_bad_db',
  ),
});
assert.equal(badDb.status, 500);
failSettlement = false;
failRevocation = true;
const badRefund = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook(
    'charge.refunded',
    { object: 'charge', id: 'ch_test_01', payment_intent: 'pi_test_01' },
    'evt_bad_refund',
  ),
});
assert.equal(badRefund.status, 500);
failRevocation = false;
console.log('PASS: database failures surface as HTTP 500 for Stripe retries');

const invalid = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: new Request('https://local.example.invalid/api/webhooks/stripe', {
    method: 'POST',
    body: '{"event":"forged"}',
  }),
});
assert.equal(invalid.status, 400);
const productionEvent = await settleStripeWebhook({
  site,
  provider,
  supabase: db,
  request: signedWebhook('checkout.session.completed', session, 'evt_live', true),
});
assert.equal(productionEvent.status, 403);
console.log('PASS: unsigned, forged and live-mode signed events are rejected');
