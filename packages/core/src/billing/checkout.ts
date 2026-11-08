import type { SupabaseClient } from '@supabase/supabase-js';
import { errorResponse, json } from '../http';
import { checkoutProduct, findProduct, type Locale, type SiteConfig } from '../site';
import type { PaymentProvider } from './provider';

// Creates a pending order, then a Checkout session for it. The order row is the single
// source of truth the webhook reads from later (see billing/settle.ts and
// rpc.settle_stripe_payment): nothing here grants anything, it only records *what was asked
// for*, so a webhook arriving afterwards knows what to unlock once Stripe confirms payment.

export type Category = 'him' | 'single' | 'reunion';
const CATEGORIES: readonly Category[] = ['him', 'single', 'reunion'];

export interface CheckoutBody {
  productId: string;
  locale: string;
  /** Required when the product is kind 'unlock': which stick this purchase unlocks. */
  stickId?: number;
  /** Required when the product is kind 'unlock'. */
  category?: string;
}

export interface CreateCheckoutDeps {
  site: SiteConfig;
  provider: PaymentProvider;
  /** Service-role client: writes orders, reads/writes profiles.stripe_customer_id (bypasses RLS). */
  supabase: SupabaseClient;
  user: { id: string; email: string };
  baseURL: string;
  body: CheckoutBody;
}

function resolveLocale(site: SiteConfig, value: string): Locale {
  return (site.locales as readonly string[]).includes(value) ? (value as Locale) : site.defaultLocale;
}

export async function createCheckoutSession({
  site,
  provider,
  supabase,
  user,
  baseURL,
  body,
}: CreateCheckoutDeps): Promise<Response> {
  const product = findProduct(site, body.productId);
  if (!product) return errorResponse(400, 'unknown_product');
  const locale = resolveLocale(site, body.locale);

  let stickId: number | null = null;
  let category: Category | null = null;
  if (product.kind === 'unlock') {
    if (typeof body.stickId !== 'number' || !Number.isInteger(body.stickId)) {
      return errorResponse(400, 'missing_stick_id');
    }
    if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category as Category)) {
      return errorResponse(400, 'missing_category');
    }
    stickId = body.stickId;
    category = body.category as Category;
  }

  const resolved = checkoutProduct(product, locale);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error(
      JSON.stringify({ level: 'error', message: 'profile lookup failed', user: user.id, error: profileError.message }),
    );
    return errorResponse(500, 'profile_lookup_failed');
  }

  let customerRef = (profile?.stripe_customer_id as string | null | undefined) ?? null;
  if (!customerRef) {
    customerRef = await provider.createCustomer({ id: user.id, email: user.email, name: '', siteId: site.id });
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerRef })
      .eq('id', user.id);
    if (updateError) {
      console.error(
        JSON.stringify({ level: 'error', message: 'profile customer_id save failed', user: user.id, error: updateError.message }),
      );
      return errorResponse(500, 'profile_update_failed');
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      product_id: product.id,
      product_kind: product.kind,
      provider: provider.name,
      amount: resolved.price.amount,
      currency: resolved.price.currency,
      status: 'pending',
      stick_id: stickId,
      category,
      locale,
      pack_uses: product.kind === 'pack' ? product.uses : null,
    })
    .select('id')
    .single();
  if (orderError || !order) {
    console.error(
      JSON.stringify({ level: 'error', message: 'order create failed', user: user.id, product: product.id, error: orderError?.message }),
    );
    return errorResponse(500, 'order_create_failed');
  }

  // Hooks for the frontend to react to (toast, refetch unlocks, etc.) — not read by any route yet.
  const successUrl = stickId
    ? `${baseURL}/sign/${stickId}?checkout=success&order=${order.id}`
    : `${baseURL}/?checkout=success&order=${order.id}`;
  const cancelUrl = stickId ? `${baseURL}/sign/${stickId}?checkout=cancelled` : `${baseURL}/?checkout=cancelled`;

  try {
    const { url, checkoutRef } = await provider.createCheckout({
      orderId: order.id,
      siteId: site.id,
      product: resolved,
      userId: user.id,
      customerRef,
      successUrl,
      cancelUrl,
    });
    const { error: refError } = await supabase.from('orders').update({ checkout_ref: checkoutRef }).eq('id', order.id);
    if (refError) {
      // The checkout session already exists at Stripe; losing checkout_ref doesn't block
      // settlement (the webhook looks up by session/payment id, not by this column), so log
      // and continue rather than fail a working checkout over a non-critical write.
      console.error(
        JSON.stringify({ level: 'error', message: 'order checkout_ref save failed', order: order.id, error: refError.message }),
      );
    }
    return json({ url });
  } catch (error) {
    console.error(
      JSON.stringify({ level: 'error', message: 'provider.createCheckout failed', order: order.id, error: String(error) }),
    );
    return errorResponse(502, 'checkout_create_failed');
  }
}
