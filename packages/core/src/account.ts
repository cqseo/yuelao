import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from './auth';
import { errorResponse, json } from './http';

/** Server-only account data. Service role must always be scoped to a verified
 * user ID; no caller-supplied IDs, SQL filters or arbitrary table access. */
export async function accountSnapshot(
  db: SupabaseClient | null,
  user: SessionUser | null,
  billingTestEnabled: boolean,
  aiTestEnabled: boolean,
): Promise<Response> {
  if (!user) return errorResponse(401, 'login_required');
  if (!db) return errorResponse(503, 'account_unavailable');
  const [orders, packs, unlocks] = await Promise.all([
    db
      .from('orders')
      .select('id,product_id,amount,currency,status,created_at,paid_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('entitlements')
      .select('id,product_id,total_uses,used_uses,expires_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    db
      .from('unlocks')
      .select('id,stick_id,category,locale,revoked,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (orders.error || packs.error || unlocks.error) return errorResponse(503, 'account_query_failed');
  return json({
    email: user.email,
    orders: orders.data,
    packs: packs.data?.map((pack) => ({
      ...pack,
      remaining_uses: Math.max(0, pack.total_uses - pack.used_uses),
    })),
    unlocks: unlocks.data,
    billingTestEnabled,
    aiTestEnabled,
  });
}
