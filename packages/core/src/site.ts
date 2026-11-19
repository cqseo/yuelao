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
  /** 下架：不再出現在畫面上、也不能再結帳；已經買到的照常可用（舊訂單、舊次數包靠 id 認）。 */
  retired?: boolean;
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

/** Something the buyer owns for good once paid (an outfit, a hair ornament…). One per user. */
export interface ItemProduct extends ProductBase {
  kind: 'item';
}

/** One full reading of one drawn spread (tarot / Lenormand), bought once; key format in spread.ts. */
export interface SpreadProduct extends ProductBase {
  kind: 'spread';
  /** 這個商品收哪一種識別字串（spread.ts 的前綴）；沒寫就是塔羅館的 tarot、lnm。 */
  decks?: readonly ('tarot' | 'lnm' | 'match' | 'love')[];
}

/** 追問月老一次：針對一份已買的解籤再問一句；一份最多 3 次（reading-followup.ts）。 */
export interface FollowupProduct extends ProductBase {
  kind: 'followup';
}

export type Product =
  | UnlockProduct
  | PackProduct
  | SubscriptionProduct
  | ItemProduct
  | SpreadProduct
  | FollowupProduct;

/** A product with the price resolved for one locale — what the payment provider sees. */
export type CheckoutProduct =
  | { id: string; kind: 'unlock' | 'pack' | 'item' | 'spread' | 'followup'; name: string; price: Price }
  | { id: string; kind: 'subscription'; name: string; price: Price; interval: 'month' | 'year' };

export function priceForLocale(product: Product, locale: Locale): Price {
  return product.prices[locale] ?? product.prices['zh-Hant'];
}

/** Display price from the config — never hardcode a price string in a page.
    HKD 1800 -> "HK$18" (zh-Hans), TWD 7500 -> "NT$75" (zh-Hant).
    (Intl currency formatting renders TWD as "$" under zh-Hant, so the
    symbol is mapped explicitly — the price must read NT$75, not $75.) */
const CURRENCY_SYMBOL: Record<string, string> = { TWD: 'NT$', HKD: 'HK$', USD: 'US$' };
export function formatPrice(price: Price, locale: Locale): string {
  const symbol = CURRENCY_SYMBOL[price.currency] ?? `${price.currency} `;
  // Whole amounts print without decimals (NT$75); cent prices keep both (US$2.99).
  const digits = price.amount % 100 === 0 ? 0 : 2;
  return `${symbol}${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(price.amount / 100)}`;
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
  /** 能看 /admin 後台的信箱；不設就只有 supportEmail。部署時還可用 ADMIN_EMAILS（逗號分隔）再加人。 */
  adminEmails?: readonly string[];
  billing: {
    provider: 'stripe';
    /** Enable Stripe Tax automatic tax calculation; configure it in the Stripe dashboard first. */
    automaticTax: boolean;
    /**
     * Stripe 產品稅務分類碼（例如 txcd_10105001）。帳戶開了 Managed Payments（Stripe 預設開）時必填，
     * 沒填 Stripe 會拒絕建立結帳；沒開時只影響 Stripe Tax 的稅率判斷。
     */
    taxCode?: string;
    /**
     * 標價是否已含稅。'inclusive'：買家付的就是標價，稅從站長收入裡扣（不會在結帳時多一行稅）；
     * 'exclusive'：稅另計、加在標價上。沒設時由 Stripe 帳戶預設決定。
     */
    taxBehavior?: 'inclusive' | 'exclusive';
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

/** 解鎖完整解籤可選的方案（單次＋上架中的次數包），附平均每次價格；畫面上的方案選單與「低至每次多少」都從這裡算。 */
export interface SalePlan {
  id: string;
  kind: 'unlock' | 'pack';
  uses: number;
  price: Price;
  /** 平均每次，最小貨幣單位（四捨五入到分）。 */
  perUse: number;
}
export function salePlans(site: SiteConfig, locale: Locale): SalePlan[] {
  const plans: SalePlan[] = [];
  for (const product of site.products) {
    if (product.retired) continue;
    if (product.kind !== 'unlock' && product.kind !== 'pack') continue;
    if (product.kind === 'unlock' && product.id !== 'unlock_1') continue;
    const uses = product.kind === 'pack' ? product.uses : 1;
    const price = priceForLocale(product, locale);
    plans.push({ id: product.id, kind: product.kind, uses, price, perUse: Math.round(price.amount / uses) });
  }
  return plans.sort((a, b) => a.uses - b.uses);
}

/** 平均每次的價格：最多一位小數（HK$5.7、HK$7.6、HK$12），不寫成 HK$5.67。 */
export function formatPerUse(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${(Math.round(amount / 10) / 10).toFixed(1).replace(/\.0$/, '')}`;
}
