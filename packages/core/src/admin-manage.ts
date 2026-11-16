import type { SessionUser } from './auth';
import { jsonRequest, sameOriginPost } from './auth-session';
import { errorResponse, json } from './http';
import { isAdminEmail } from './site-events';
import type { Supabase } from './supabase';

// 站長後台的兩個管理頁：用戶列表、許願池審核。只有 site.adminEmails（或 ADMIN_EMAILS）裡的帳號能用，
// 權限在伺服器端檢查；資料一律經 service_role 讀寫，前端碰不到這些表。

const WISH_STATUSES = ['shown', 'hidden', 'removed'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function gate(
  user: SessionUser | null,
  admins: readonly string[],
  database: Supabase | null,
): Response | null {
  if (!user) return errorResponse(401, 'login_required');
  if (!isAdminEmail(user.email, admins)) return errorResponse(403, 'forbidden');
  if (!database) return errorResponse(503, 'supabase_not_configured');
  return null;
}

interface WishRow {
  id: string;
  user_id: string;
  body: string;
  tag: string;
  status: string;
  decided_by: string | null;
  blessings: number;
  reports: number;
  created_at: string;
}

/** GET：等審核的（pending、被檢舉收起的 hidden）全部列出，另外附最近處理過的 40 則。 */
export async function adminWishesRequest(
  database: Supabase | null,
  user: SessionUser | null,
  admins: readonly string[],
): Promise<Response> {
  const denied = gate(user, admins, database);
  if (denied) return denied;
  const db = database as Supabase;
  const columns = 'id,user_id,body,tag,status,decided_by,blessings,reports,created_at';
  const [waiting, recent] = await Promise.all([
    db.from('wishes').select(columns).in('status', ['pending', 'hidden']).order('created_at').limit(200),
    db
      .from('wishes')
      .select(columns)
      .in('status', ['shown', 'removed'])
      .order('updated_at', { ascending: false })
      .limit(40),
  ]);
  if (waiting.error || recent.error) return errorResponse(503, 'wishes_unavailable');
  const rows = [...((waiting.data ?? []) as WishRow[]), ...((recent.data ?? []) as WishRow[])];
  // 作者信箱：審核時要知道是不是同一個人一直在亂寫
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const emails = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from('profiles')
      .select('id,email')
      .in('id', ids.slice(i, i + 200));
    for (const p of (data ?? []) as { id: string; email: string }[]) emails.set(p.id, p.email);
  }
  const shape = (r: WishRow) => ({
    id: r.id,
    body: r.body,
    tag: r.tag,
    status: r.status,
    decidedBy: r.decided_by,
    blessings: r.blessings,
    reports: r.reports,
    createdAt: r.created_at,
    email: emails.get(r.user_id) ?? null,
  });
  return json({
    waiting: ((waiting.data ?? []) as WishRow[]).map(shape),
    recent: ((recent.data ?? []) as WishRow[]).map(shape),
  });
}

/** POST { id, status }：放行（shown）、收起（hidden）、刪除（removed）。走資料庫的 review_wish。 */
export async function adminWishReviewRequest(
  request: Request,
  database: Supabase | null,
  user: SessionUser | null,
  admins: readonly string[],
): Promise<Response> {
  if (!sameOriginPost(request) || !jsonRequest(request)) return errorResponse(400, 'bad_request');
  const denied = gate(user, admins, database);
  if (denied) return denied;
  let body: { id?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; status?: unknown };
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  const { id, status } = body;
  if (typeof id !== 'string' || !UUID.test(id)) return errorResponse(400, 'invalid_wish');
  if (typeof status !== 'string' || !(WISH_STATUSES as readonly string[]).includes(status))
    return errorResponse(400, 'invalid_status');
  const { data, error } = await (database as Supabase).rpc('review_wish', {
    p_wish_id: id,
    p_status: status,
  });
  if (error) return errorResponse(503, 'review_unavailable');
  if (data === 'not_found') return errorResponse(404, 'wish_not_found');
  if (data !== status) return errorResponse(400, 'invalid_status');
  return json({ id, status });
}

interface OrderLite {
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  checkout_ref: string | null;
  paid_at: string | null;
}

/** GET ?q=信箱片段：最近註冊的 200 位（或搜尋結果），附每人的正式付款筆數、金額、最近付款時間。 */
export async function adminUsersRequest(
  request: Request,
  database: Supabase | null,
  user: SessionUser | null,
  admins: readonly string[],
): Promise<Response> {
  const denied = gate(user, admins, database);
  if (denied) return denied;
  const db = database as Supabase;
  // 只留信箱會出現的字元，免得搜尋字串被當成篩選語法
  const q = (new URL(request.url).searchParams.get('q') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '')
    .slice(0, 60);
  let query = db.from('profiles').select('id,email,locale,created_at', { count: 'exact' });
  if (q) query = query.ilike('email', `%${q}%`);
  const { data, error, count } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) return errorResponse(503, 'users_unavailable');
  const profiles = (data ?? []) as { id: string; email: string; locale: string; created_at: string }[];
  const paid = new Map<string, { orders: number; byCurrency: Record<string, number>; last: string | null }>();
  const ids = profiles.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { data: orders } = await db
      .from('orders')
      .select('user_id,amount,currency,status,checkout_ref,paid_at')
      .eq('status', 'paid')
      .in('user_id', ids.slice(i, i + 100));
    for (const o of (orders ?? []) as OrderLite[]) {
      // 測試模式的單不算
      if (!o.checkout_ref?.startsWith('cs_live_')) continue;
      const row = paid.get(o.user_id) ?? { orders: 0, byCurrency: {} as Record<string, number>, last: null };
      row.orders++;
      const currency = o.currency.toUpperCase();
      row.byCurrency[currency] = (row.byCurrency[currency] ?? 0) + o.amount;
      if (o.paid_at && (!row.last || o.paid_at > row.last)) row.last = o.paid_at;
      paid.set(o.user_id, row);
    }
  }
  return json({
    total: count ?? profiles.length,
    query: q,
    users: profiles.map((p) => ({
      id: p.id,
      email: p.email,
      locale: p.locale,
      createdAt: p.created_at,
      admin: isAdminEmail(p.email, admins),
      paidOrders: paid.get(p.id)?.orders ?? 0,
      // Backward compatible HKD-only summary; never add cents across currencies.
      paidAmount: paid.get(p.id)?.byCurrency.HKD ?? 0,
      currency: 'HKD',
      paidAmountByCurrency: Object.entries(paid.get(p.id)?.byCurrency ?? {})
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      lastPaidAt: paid.get(p.id)?.last ?? null,
    })),
  });
}
