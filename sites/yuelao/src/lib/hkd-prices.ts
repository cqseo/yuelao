import { formatPrice, priceForLocale, type SiteConfig } from '@yuelao/core/site';

/** Display-only HKD conversion. Stripe checkout and orders always use configured USD minor units. */
export interface HkdEstimate {
  approxHkd: string;
  actualUsd: string;
}

export interface HkdPriceQuote {
  prices: Record<string, HkdEstimate>;
  updatedAt: string;
}

/** An untrusted upstream rate must be recent, sensible, and explicitly USD-based. */
export function parseUsdHkdRate(
  raw: unknown,
  nowMs: number = Date.now(),
): { rate: number; updatedAt: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.result !== 'success' || data.base_code !== 'USD') return null;
  if (!data.rates || typeof data.rates !== 'object') return null;
  const rate = (data.rates as Record<string, unknown>).HKD;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 7 || rate > 9) return null;
  const timestamp = data.time_last_update_utc;
  if (typeof timestamp !== 'string') return null;
  const updated = Date.parse(timestamp);
  if (!Number.isFinite(updated) || updated > nowMs + 3_600_000 || nowMs - updated > 3 * 86_400_000) {
    return null;
  }
  return { rate, updatedAt: new Date(updated).toISOString() };
}

/** Converts a fixed USD price for display. Never use this number to create a charge or order. */
export function buildHkdPriceQuote(
  site: SiteConfig,
  rate: number,
  updatedAt: string,
): HkdPriceQuote {
  if (!Number.isFinite(rate) || rate < 7 || rate > 9) throw new Error('invalid_hkd_reference_rate');
  const prices: Record<string, HkdEstimate> = {};
  for (const product of site.products) {
    const actualPrice = priceForLocale(product, 'zh-Hant');
    if (actualPrice.currency !== 'USD') continue;
    const hkdCents = Math.round(actualPrice.amount * rate);
    prices[product.id] = {
      approxHkd: 'HK$' + (hkdCents / 100).toFixed(2),
      actualUsd: formatPrice(actualPrice, 'zh-Hant'),
    };
  }
  return { prices, updatedAt };
}

export function estimateLabel(
  quote: HkdPriceQuote | null,
  productId: string,
  fallbackUsd: string,
  locale: string,
): string {
  const estimate = quote?.prices[productId];
  if (!estimate) return fallbackUsd;
  const approx = locale === 'en' || locale === 'ja' ? '≈' : '約';
  // Keep the charged USD amount visible even on narrow 3D buttons.
  return approx + estimate.approxHkd + ' · ' + estimate.actualUsd;
}

/** Checkout disclosure. The linked reference rate provider requires attribution. */
export function currencyDisclosure(locale: string): string {
  const source = '<a href="https://www.exchangerate-api.com/" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a>';
  if (locale === 'en') {
    return 'HKD shown is an estimate using a daily reference rate. Stripe charges in USD; your bank may use a different rate and charge fees. Rate source: ' + source + '.';
  }
  if (locale === 'ja') {
    return '香港ドル表示は日次参考レートによる概算です。Stripeでの実際の決済は米ドルです。カード会社の換算レート・手数料が異なる場合があります。レート出典：' + source + '。';
  }
  if (locale === 'zh-Hans') {
    return '港币金额按每日参考汇率估算，Stripe 实际以美元扣款；银行汇率及手续费可能不同。汇率来源：' + source + '。';
  }
  return '港幣金額按每日參考匯率估算，Stripe 實際以美元扣款；銀行匯率及手續費可能不同。匯率來源：' + source + '。';
}
