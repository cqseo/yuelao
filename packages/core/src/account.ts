import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountUser } from './auth';
import { errorResponse, json } from './http';

/** Server-only account data. Service role must always be scoped to a verified
 * user ID; no caller-supplied IDs, SQL filters or arbitrary table access. */
export async function accountSnapshot(
  db: SupabaseClient | null,
  user: AccountUser | null,
  billingTestEnabled: boolean,
  aiTestEnabled: boolean,
): Promise<Response> {
  if (!user) return errorResponse(401, 'login_required');
  if (!db) return errorResponse(503, 'account_unavailable');
  const [orders, packs, unlocks, items, spreads] = await Promise.all([
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
    db.from('owned_items').select('item_id').eq('user_id', user.id).eq('revoked', false).limit(200),
    // 塔羅館、算命攤買過的完整解讀（2026-11-19）：只列自己的、未退款的
    db
      .from('spread_unlocks')
      .select('id,spread,locale,created_at')
      .eq('user_id', user.id)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (orders.error || packs.error || unlocks.error) return errorResponse(503, 'account_query_failed');
  const spreadRows = (spreads.error ? [] : (spreads.data ?? [])) as {
    id: string;
    spread: string;
    locale: string;
    created_at: string;
  }[];
  const bodies = new Map<string, string>();
  if (spreadRows.length) {
    const { data: readings } = await db
      .from('spread_ai_readings')
      .select('unlock_id,body')
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .in(
        'unlock_id',
        spreadRows.map((r) => r.id),
      );
    for (const r of (readings ?? []) as { unlock_id: string; body: string }[])
      bodies.set(r.unlock_id, r.body);
  }
  return json({
    email: user.email,
    // 訪客：還沒綁信箱。前端據此顯示「綁定信箱」而不是登出。
    guest: user.guest === true,
    orders: orders.data,
    packs: packs.data?.map((pack) => ({
      ...pack,
      remaining_uses: Math.max(0, pack.total_uses - pack.used_uses),
    })),
    unlocks: unlocks.data,
    // 沒有正文的是「已付款、還沒生成」：前端可以直接在帳戶頁請伺服器動筆（不針對問題）
    spreads: spreadRows.map((r) => ({
      spread: r.spread,
      locale: r.locale,
      createdAt: r.created_at,
      body: bodies.get(r.id) ?? null,
    })),
    // Owned items (outfits etc.). If the table is not migrated yet this is simply empty.
    items: items.error ? [] : (items.data ?? []).map((row) => row.item_id),
    billingTestEnabled,
    aiTestEnabled,
  });
}
