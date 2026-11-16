import { findProduct, formatPrice, priceForLocale } from '@yuelao/core/site';
import { contentLocale, uiPrefix } from '~/i18n/locale';
import site from '../../site.config';
import type { OracleCategory } from './lite-pending';

export type LiteAccess =
  | { state: 'ready'; body: string }
  | { state: 'unlocked' | 'none' | 'error' };

export type LiteCheckout =
  | { state: 'redirect'; url: string }
  | { state: 'login' | 'owned' | 'busy' | 'closed' | 'error' };

const product = findProduct(site, 'unlock_1');

export function litePrice(): string {
  return product ? formatPrice(priceForLocale(product, contentLocale()), contentLocale()) : '';
}

export function liteReadingUrl(stickId: number, category: OracleCategory): string {
  return '/account/reading?' + new URLSearchParams({
    stickId: String(stickId), category, locale: contentLocale(),
  }).toString();
}

export async function liteRequest(url: string, init?: RequestInit): Promise<Response> {
  const make = () => fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store' });
  let response = await make();
  if (response.status === 401) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (refresh.ok) response = await make();
  }
  return response;
}

/** Never trust payment redirects for entitlement. Only server-verified grants count. */
export async function liteCheck(stickId: number, category: OracleCategory): Promise<LiteAccess> {
  try {
    const search = new URLSearchParams({ stickId: String(stickId), category, locale: contentLocale() });
    const reading = await liteRequest('/api/account/reading?' + search.toString());
    if (reading.ok) {
      const data = (await reading.json()) as { body?: unknown };
      if (typeof data.body === 'string' && data.body.trim()) return { state: 'ready', body: data.body };
    } else if (reading.status === 401) return { state: 'none' };
    else if (reading.status !== 404) return { state: 'error' };

    const account = await liteRequest('/api/account/status');
    if (account.status === 401) return { state: 'none' };
    if (!account.ok) return { state: 'error' };
    const data = (await account.json()) as {
      unlocks?: { stick_id: number; category: string; locale: string; revoked: boolean }[];
    };
    const owned = data.unlocks?.some(
      (u) => u.stick_id === stickId && u.category === category &&
        u.locale === contentLocale() && !u.revoked,
    );
    return { state: owned ? 'unlocked' : 'none' };
  } catch {
    return { state: 'error' };
  }
}

/** Product amount is always selected on the trusted server. Never send price/amount. */
export async function liteCheckout(stickId: number, category: OracleCategory): Promise<LiteCheckout> {
  if (!product) return { state: 'closed' };
  try {
    const locale = contentLocale();
    const res = await liteRequest('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: 'unlock_1',
        currency: priceForLocale(product, locale).currency,
        locale,
        ui: uiPrefix(),
        from: 'market',
        stickId,
        category,
      }),
    });
    if (res.status === 401) return { state: 'login' };
    if (res.status === 409) return { state: 'owned' };
    if (res.status === 429) return { state: 'busy' };
    if (res.status === 503) return { state: 'closed' };
    if (res.status !== 201) return { state: 'error' };
    const data = (await res.json()) as { checkoutUrl?: unknown };
    if (typeof data.checkoutUrl !== 'string') return { state: 'error' };
    const url = new URL(data.checkoutUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') return { state: 'error' };
    return { state: 'redirect', url: url.href };
  } catch {
    return { state: 'error' };
  }
}

/** Existing server-only AI generation endpoint; requires a verified unlock. */
export async function liteGenerate(
  stickId: number,
  category: OracleCategory,
  question: string,
): Promise<'ready' | 'processing' | 'error'> {
  try {
    const response = await liteRequest('/api/account/reading/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stickId, category, locale: contentLocale(), ui: uiPrefix(),
        question: question.slice(0, 400), consent: true,
      }),
    });
    if (response.status === 202) return 'processing';
    return response.ok ? 'ready' : 'error';
  } catch {
    return 'error';
  }
}
