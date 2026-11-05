import type { SupabaseClient } from '@supabase/supabase-js';
import { errorResponse, json } from '../http';
import type { SiteConfig } from '../site';
import type { PaymentFact, PaymentProvider, WebhookTrigger } from './provider';
import { WebhookSignatureError } from './provider';

// Settles a verified Stripe webhook against Supabase. Webhooks are trigger signals only:
// state is always re-fetched from Stripe, then applied once via the settle_stripe_payment RPC
// (one function = one transaction; idempotency via webhook_events + unique constraints).
// Untested until P4 (no Stripe keys yet): see docs/local-development.md.

export interface SettleDeps {
  site: SiteConfig;
  provider: PaymentProvider;
  supabase: SupabaseClient | null;
  request: Request;
}

export async function settleStripeWebhook({ provider, supabase, request }: SettleDeps): Promise<Response> {
  let trigger: WebhookTrigger;
  try {
    trigger = await provider.parseWebhook(request);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return errorResponse(400, 'invalid_signature');
    throw error;
  }
  if (!trigger.target) return json({ ok: true, ignored: trigger.type });
  if (!supabase) {
    return errorResponse(503, 'supabase_not_configured', 'Supabase is not configured for this worker');
  }
  const fact = await fetchFact(provider, trigger);
  if (!fact) return json({ ok: true, ignored: trigger.type, reason: 'no_payment_fact' });
  const { error } = await supabase.rpc('settle_stripe_payment', {
    p_event_id: trigger.eventId,
    p_type: trigger.type,
    p_provider: fact.provider,
    p_payment_ref: fact.paymentRef,
    p_charge_ref: fact.chargeRef,
    p_user_id: fact.userId,
    p_order_id: fact.orderId,
    p_product_id: fact.productId,
    p_amount: fact.amount,
    p_currency: fact.currency,
    p_paid: fact.paid,
    p_amount_refunded: fact.amountRefunded,
    p_dispute: fact.dispute,
    p_subscription_ref: fact.subscriptionRef,
    p_period_start: fact.periodStart ? new Date(fact.periodStart).toISOString() : null,
    p_period_end: fact.periodEnd ? new Date(fact.periodEnd).toISOString() : null,
    p_paid_at: fact.paidAt ? new Date(fact.paidAt).toISOString() : null,
    p_fetched_at: new Date(fact.fetchedAt).toISOString(),
  });
  if (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'settle_stripe_payment failed',
        event: trigger.eventId,
        error: error.message,
      }),
    );
    return errorResponse(500, 'settle_failed');
  }
  // Refunds / open or lost disputes claw back what was granted; the RPC decides how much.
  if (fact.amountRefunded > 0 || fact.dispute === 'open' || fact.dispute === 'lost') {
    const { error: revokeError } = await supabase.rpc('revoke_for_refund', {
      p_payment_ref: fact.paymentRef,
      p_refund_amount: fact.amountRefunded,
    });
    if (revokeError) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'revoke_for_refund failed',
          event: trigger.eventId,
          error: revokeError.message,
        }),
      );
      return errorResponse(500, 'revoke_failed');
    }
  }
  return json({ ok: true, event: trigger.eventId });
}

async function fetchFact(provider: PaymentProvider, trigger: WebhookTrigger): Promise<PaymentFact | null> {
  const target = trigger.target;
  if (!target) return null;
  switch (target.kind) {
    case 'checkout': {
      const checkout = await provider.fetchCheckout(target.ref);
      return checkout.payment;
    }
    case 'payment':
      return provider.fetchPayment(target.ref);
    case 'charge':
      return provider.fetchPaymentByCharge(target.ref);
    case 'subscription':
      // V1 sells no subscriptions, so subscription events carry no payment to settle.
      // If subscriptions are sold in v2, add a settle_stripe_subscription RPC and handle this kind.
      return null;
  }
}
