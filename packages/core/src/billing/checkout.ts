import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from '../auth';
import { errorResponse, json } from '../http';
import { checkoutProductForCurrency, findProduct, type Locale, type SiteConfig } from '../site';
import type { PaymentProvider } from './provider';

export interface CheckoutSelection {
  productId: string;
  locale: Locale;
  currency: 'HKD' | 'TWD' | 'USD';
  stickId: number | null;
  category: 'him' | 'single' | 'reunion' | null;
  /** Where the purchase started; only picks which fixed page a cancelled checkout returns to. */
  from: 'market' | null;
}

function parseSelection(raw: unknown): CheckoutSelection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const { productId, locale, currency, stickId, category } = value;
  if (value.from !== undefined && value.from !== 'market') return null;
  const from = value.from === 'market' ? 'market' : null;
  // Shape only; whether the product exists is decided against the site config below.
  if (typeof productId !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(productId)) return null;
  if (locale !== 'zh-Hant' && locale !== 'zh-Hans') return null;
  if (currency !== 'HKD' && currency !== 'TWD' && currency !== 'USD') return null;
  // A stick + category means a single deep-reading unlock; every other product must send neither.
  if (stickId !== undefined || category !== undefined) {
    if (typeof stickId !== 'number' || !Number.isInteger(stickId) || stickId < 1 || stickId > 100)
      return null;
    if (category !== 'him' && category !== 'single' && category !== 'reunion') return null;
    return { productId, locale, currency, stickId, category, from };
  }
  return { productId, locale, currency, stickId: null, category: null, from };
}

export interface CheckoutDeps {
  request: Request;
  site: SiteConfig;
  provider: PaymentProvider;
  database: SupabaseClient;
  user: SessionUser;
  baseUrl: string;
}

/**
 * Stripe TEST MODE only until the launch review is signed off.
 * No amount, customer ID, return URL, or order ownership is trusted from the browser.
 * Only a verified Supabase JWT can reach this function.
 */
export async function createTestCheckout({
  request,
  site,
  provider,
  database,
  user,
  baseUrl,
}: CheckoutDeps): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 2048) return errorResponse(413, 'request_too_large');
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  const selection = parseSelection(input);
  if (!selection) return errorResponse(400, 'invalid_product_selection');
  const product = findProduct(site, selection.productId);
  if (!product) return errorResponse(404, 'unknown_product');
  const checkoutProduct = checkoutProductForCurrency(product, selection.currency);
  if (!checkoutProduct) return errorResponse(400, 'unsupported_currency');
  if (checkoutProduct.kind === 'subscription') return errorResponse(400, 'subscription_unavailable');
  // The selection's shape must match the product's kind: unlocks name a stick, nothing else may.
  if ((product.kind === 'unlock') !== (selection.stickId !== null)) {
    return errorResponse(400, 'invalid_product_selection');
  }

  // The Worker config is trusted, unlike any caller-provided Origin/returnUrl.
  const siteUrl = new URL(baseUrl);
  if (siteUrl.protocol !== 'https:' && siteUrl.hostname !== 'localhost' && siteUrl.hostname !== '127.0.0.1') {
    return errorResponse(503, 'invalid_checkout_origin');
  }

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error: countError } = await database
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if (countError) return errorResponse(503, 'order_rate_limit_unavailable');
  if ((count ?? 0) >= 5) return errorResponse(429, 'too_many_checkout_attempts');

  if (selection.stickId !== null && selection.category !== null) {
    const { data: existing, error: unlockError } = await database
      .from('unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('stick_id', selection.stickId)
      .eq('category', selection.category)
      .eq('locale', selection.locale)
      .eq('revoked', false)
      .maybeSingle();
    if (unlockError) return errorResponse(503, 'unlock_lookup_failed');
    if (existing) return errorResponse(409, 'already_unlocked');
  }

  if (product.kind === 'item') {
    // One of each item per user: never take a second payment for something already owned.
    const { data: owned, error: ownedError } = await database
      .from('owned_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', product.id)
      .eq('revoked', false)
      .maybeSingle();
    if (ownedError) return errorResponse(503, 'ownership_lookup_failed');
    if (owned) return errorResponse(409, 'already_owned');
  }

  // Upsert only creates a missing profile. It never overwrites existing customer ownership.
  const { error: profileError } = await database
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email, locale: selection.locale },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (profileError) return errorResponse(503, 'profile_unavailable');

  const { data: profile, error: readProfileError } = await database
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();
  if (readProfileError) return errorResponse(503, 'profile_unavailable');
  let customerRef = profile?.stripe_customer_id as string | null | undefined;
  if (!customerRef) {
    const createdRef = await provider.createCustomer({
      id: user.id,
      email: user.email,
      name: '',
      siteId: site.id,
    });
    const { data: stored, error: storeError } = await database
      .from('profiles')
      .update({ stripe_customer_id: createdRef })
      .eq('id', user.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .maybeSingle();
    if (storeError) return errorResponse(503, 'customer_storage_failed');
    customerRef = stored?.stripe_customer_id ?? null;
    if (!customerRef) {
      const { data: winner, error: winnerError } = await database
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();
      if (winnerError || !winner?.stripe_customer_id) return errorResponse(503, 'customer_storage_failed');
      customerRef = winner.stripe_customer_id;
    }
  }

  if (!customerRef) return errorResponse(503, 'customer_storage_failed');

  const { data: order, error: orderError } = await database
    .from('orders')
    .insert({
      user_id: user.id,
      product_id: product.id,
      product_kind: product.kind,
      provider: provider.name,
      amount: checkoutProduct.price.amount,
      currency: checkoutProduct.price.currency,
      locale: selection.locale,
      stick_id: selection.stickId,
      category: selection.category,
      pack_uses: product.kind === 'pack' ? product.uses : null,
      status: 'pending',
    })
    .select('id')
    .single();
  if (orderError || !order?.id) return errorResponse(503, 'order_creation_failed');

  // No paid content is delivered at this redirect. Only a verified Stripe
  // webhook followed by a single transactional DB grant may unlock it.
  const returnUrl = new URL('/billing/return', siteUrl);
  returnUrl.searchParams.set('order', order.id);
  // Fixed paths only — never a caller-supplied URL.
  const cancelPath =
    selection.from !== 'market' ? '/ritual' : product.kind === 'unlock' ? '/market#yuelao' : '/market';
  const cancelUrl = new URL(cancelPath, siteUrl);
  const checkout = await provider.createCheckout({
    orderId: order.id,
    siteId: site.id,
    product: checkoutProduct,
    userId: user.id,
    customerRef,
    successUrl: returnUrl.toString(),
    cancelUrl: cancelUrl.toString(),
  });
  const { error: updateError } = await database
    .from('orders')
    .update({ checkout_ref: checkout.checkoutRef })
    .eq('id', order.id)
    .eq('user_id', user.id);
  if (updateError) return errorResponse(503, 'checkout_created_but_order_update_failed');
  return json({ checkoutUrl: checkout.url, orderId: order.id }, { status: 201 });
}
