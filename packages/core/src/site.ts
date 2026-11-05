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
  /** Price per locale; checkout picks by the visitor's locale. */
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
