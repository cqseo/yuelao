import { createFileRoute } from '@tanstack/react-router';
import { buildHkdPriceQuote, parseUsdHkdRate } from '~/lib/hkd-prices';
import site from '../../../site.config';

// Display only: never use this reference rate for Stripe charges, settlements or refunds.
// ExchangeRate-API's open endpoint updates daily, requires attribution and permits caching.
const FX_URL = 'https://open.er-api.com/v6/latest/USD';
type CachedRate = { rate: number; updatedAt: string; expiresAt: number };
let cached: CachedRate | null = null;
let pending: Promise<CachedRate> | null = null;

async function getRate(): Promise<CachedRate> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(FX_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
      cf: { cacheEverything: true, cacheTtl: 21_600 },
    });
    if (!response.ok) throw new Error('rate_provider_unavailable');
    const json: unknown = await response.json();
    const parsed = parseUsdHkdRate(json);
    if (!parsed) throw new Error('invalid_reference_rate');
    const result = { ...parsed, expiresAt: Date.now() + 60 * 60_000 };
    cached = result;
    return result;
  })().finally(() => { pending = null; });
  return pending;
}

export const Route = createFileRoute('/api/prices')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { rate, updatedAt } = await getRate();
          // Only expose *converted product estimates*, not the provider's raw FX feed.
          const quote = buildHkdPriceQuote(site, rate, updatedAt);
          return Response.json(quote, {
            headers: { 'cache-control': 'public, max-age=900, s-maxage=3600' },
          });
        } catch {
          // Fail closed for HKD estimates: client displays the existing exact USD price.
          return Response.json(
            { error: 'hkd_reference_unavailable' },
            { status: 503, headers: { 'cache-control': 'no-store' } },
          );
        }
      },
    },
  },
});
