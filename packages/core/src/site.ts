// Site config types. Each site declares its config with defineSite() in site.config.ts; packages only read it.

export type Locale = 'zh-Hant' | 'zh-Hans';

export interface Price {
  /** Smallest currency unit, e.g. TWD cents / HKD cents. */
  amount: number;
  currency: string;
}

interface ProductBase {
  id: string;
  name: string;
  /** Legacy locale-keyed price storage. Checkout uses the selected currency, not text locale. */
  prices: Record<Locale, Price>;
  /** Product IDs for providers that need pre-created products. Stripe uses inline prices and needs none. */
  refs?: Record<string, string>;
}

export interface UnlockProduct extends ProductBase {
  kind: 'unlock';
}

export interface PackProduct extends ProductBase {
  kind: 'pack';
  /** Number of deep-reading uses the pack grants; never expires. */
  uses: number;
}

export interface SubscriptionProduct extends ProductBase {
  kind: 'subscription';
  interval: 'month' | 'year';
}

export type Product = UnlockProduct | PackProduct | SubscriptionProduct;

/** A product with the price resolved for one locale — what the payment provider sees. */
export type CheckoutProduct =
  | { id: string; kind: 'unlock' | 'pack'; name: string; price: Price }
  | { id: string; kind: 'subscription'; name: string; price: Price; interval: 'month' | 'year' };

export function priceForLocale(product: Product, locale: Locale): Price {
  return product.prices[locale] ?? product.prices['zh-Hant'];
}

/** Display price from the config — never hardcode a price string in a page.
    HKD 1800 -> "HK$18" (zh-Hans), TWD 7500 -> "NT$75" (zh-Hant).
    (Intl currency formatting renders TWD as "$" under zh-Hant, so the
    symbol is mapped explicitly — the price must read NT$75, not $75.) */
const CURRENCY_SYMBOL: Record<string, string> = { TWD: 'NT$', HKD: 'HK$' };
export function formatPrice(price: Price, locale: Locale): string {
  const symbol = CURRENCY_SYMBOL[price.currency] ?? `${price.currency} `;
  return `${symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price.amount / 100)}`;
}

export function checkoutProduct(product: Product, locale: Locale): CheckoutProduct {
  if (product.kind === 'subscription') {
    return {
      id: product.id,
      kind: 'subscription',
      name: product.name,
      price: priceForLocale(product, locale),
      interval: product.interval,
    };
  }
  return { id: product.id, kind: product.kind, name: product.name, price: priceForLocale(product, locale) };
}

/** Explicit checkout currency: script/locale never chooses the payment currency.
 * A Hong Kong customer may prefer Traditional Chinese, and a Taiwan customer
 * may choose Simplified. Prices are still defined once in the existing config. */
export function checkoutProductForCurrency(product: Product, currency: string): CheckoutProduct | null {
  const price = Object.values(product.prices).find((candidate) => candidate.currency === currency);
  if (!price) return null;
  if (product.kind === 'subscription') {
    return { id: product.id, kind: product.kind, name: product.name, price, interval: product.interval };
  }
  return { id: product.id, kind: product.kind, name: product.name, price };
}

export interface SiteConfig {
  /** Short site name used in metadata, logs and idempotency keys. Don't change it after launch. */
  id: string;
  name: string;
  /** Canonical production URL, without a trailing slash. */
  url: string;
  locales: readonly Locale[];
  defaultLocale: Locale;
  products: readonly Product[];
  /** Contact email shown on legal pages. */
  supportEmail: string;
  billing: {
    provider: 'stripe';
    /** Enable Stripe Tax automatic tax calculation; configure it in the Stripe dashboard first. */
    automaticTax: boolean;
  };
  analytics?: {
    ga4?: string;
    clarity?: string;
    /** The collector URL isn't set here (it would end up in the client bundle); see CoreEnv.RYBBIT_UPSTREAM. */
    rybbit?: { siteId: string };
  };
}

export function defineSite<const T extends SiteConfig>(config: T): T {
  const ids = new Set<string>();
  for (const product of config.products) {
    if (ids.has(product.id)) throw new Error(`duplicate product id: ${product.id}`);
    ids.add(product.id);
    for (const locale of config.locales) {
      const price = product.prices[locale];
      if (!price || !Number.isSafeInteger(price.amount) || price.amount <= 0) {
        throw new Error(
          `product ${product.id}: prices.${locale}.amount must be a positive integer in minor units`,
        );
      }
    }
  }
  return config;
}

export function findProduct(site: SiteConfig, productId: string): Product | undefined {
  return site.products.find((product) => product.id === productId);
}
