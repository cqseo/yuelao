import { getBrowserSupabase } from './supabase';

// Calls the /api/checkout route (packages/core/src/billing/checkout.ts) and redirects
// the browser to the returned Stripe Checkout url. Requires a signed-in Supabase
// session — src/ritual/components/DeepLock.tsx handles getting one first.

export interface CheckoutParams {
  productId: string;
  locale: string;
  stickId?: number;
  category?: string;
}

export type CheckoutFailure = { kind: 'unauthenticated' } | { kind: 'error'; code: string };

export async function startCheckout(params: CheckoutParams): Promise<CheckoutFailure | null> {
  const supabase = await getBrowserSupabase();
  if (!supabase) return { kind: 'error', code: 'not_configured' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { kind: 'unauthenticated' };

  let res: Response;
  try {
    res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
  } catch {
    return { kind: 'error', code: 'network_error' };
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { error?: string } | null;
    return { kind: 'error', code: problem?.error ?? `http_${res.status}` };
  }
  const body = (await res.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) return { kind: 'error', code: 'no_url' };
  window.location.href = body.url;
  return null;
}
