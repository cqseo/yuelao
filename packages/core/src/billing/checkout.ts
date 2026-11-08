import type { SupabaseClient } from '@supabase/supabase-js';
import { errorResponse, json } from '../http';
import { checkoutProduct, findProduct, type Locale, type SiteConfig } from '../site';
import type { PaymentProvider } from './provider';

export type Category = 'him' | 'single' | 'reunion';
const CATEGORIES: readonly Category[] = ['him', 'single', 'reunion'];

export interface CheckoutBody {
  productId: string;
  locale: string;
  stickId?: number;
  category?: string;
}

export interface CreateCheckoutDeps {
  site: SiteConfig;
  provider: PaymentProvider;
  supabase: SupabaseClient;
  user: { id: string; email: string };
  baseURL: string;
  body: CheckoutBody;
}

// Price and currency are fixed per product in site.config.ts, not split by locale —
// Stripe Checkout localizes the displayed amount for the buyer itself (Adaptive
// Pricing). `locale` below is only recorded on the order for content/receipts,
// it never affects price.
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

  const resolved = checkoutProduct(product);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'profile lookup failed',
        user: user.id,
        error: profileError.message,
      }),
    );
    return errorResponse(500, 'profile_lookup_failed');
  }

  let customerRef = (profile?.stripe_customer_id as string | null | undefined) ?? null;
  if (!customerRef) {
    customerRef = await provider.createCustomer({
      id: user.id,
      email: user.email,
      name: '',
      siteId: site.id,
    });
    // There's no auth.users-insert trigger yet, so a brand-new signer-in may have no
    // profiles row at all — upsert, not update, so the first purchase's customer id
    // isn't silently dropped by a no-op update against a missing row.
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email, stripe_customer_id: customerRef }, { onConflict: 'id' });
    if (upsertError) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'profile customer_id save failed',
          user: user.id,
          error: upsertError.message,
        }),
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
      JSON.stringify({
        level: 'error',
        message: 'order create failed',
        user: user.id,
        product: product.id,
        error: orderError?.message,
      }),
    );
    return errorResponse(500, 'order_create_failed');
  }

  const successUrl = stickId
    ? `${baseURL}/sign/${stickId}?checkout=success&order=${order.id}`
    : `${baseURL}/?checkout=success&order=${order.id}`;
  const cancelUrl = stickId
    ? `${baseURL}/sign/${stickId}?checkout=cancelled`
    : `${baseURL}/?checkout=cancelled`;

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
    const { error: refError } = await supabase
      .from('orders')
      .update({ checkout_ref: checkoutRef })
      .eq('id', order.id);
    if (refError) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'order checkout_ref save failed',
          order: order.id,
          error: refError.message,
        }),
      );
    }
    return json({ url });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'provider.createCheckout failed',
        order: order.id,
        error: String(error),
      }),
    );
    return errorResponse(502, 'checkout_create_failed');
  }
}
