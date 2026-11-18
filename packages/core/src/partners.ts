import type { SupabaseClient } from '@supabase/supabase-js';
import { sameOriginPost } from './auth-session';
import type { PaymentProvider } from './billing/provider';
import { errorResponse, json } from './http';

// 分銷（站長 2026-11-18）：推廣人拿 ?ref=代號 的連結去發。訪客點進來，瀏覽器記 30 天（yl_ref cookie，
// 最後一次點的連結為準）；這 30 天內結帳，訂單記上推廣人。只算「這位顧客的第一筆付款」。
// 佣金 = （實收 − Stripe 手續費）× 分成（預設 0.5）；退款、爭議的單不算。站長月底手動結算。
// 推廣人看自己的數據頁（私密連結，不用登入），只看得到數字，看不到顧客資料。
// 資料庫：supabase/migrations/20261118080001_partners.sql。

export const REF_COOKIE = 'yl_ref';
const CODE = /^[a-z0-9]{3,16}$/;
const TOKEN = /^[0-9a-f]{64}$/;

export function validRefCode(value: unknown): value is string {
  return typeof value === 'string' && CODE.test(value);
}

/** 結帳請求帶來的推廣人代號（cookie）；格式不對就當沒有。 */
export function refFromRequest(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)yl_ref=([^;]*)/);
  const code = m ? decodeURIComponent(m[1]!) : '';
  return validRefCode(code) ? code : null;
}

/** 推廣人有效、而且這位顧客還沒付過款，才回代號（「只算第一單」）。 */
export async function refForCheckout(
  database: SupabaseClient,
  userId: string,
  code: string | null,
): Promise<string | null> {
  if (!code) return null;
  const [{ data: partner }, { count }] = await Promise.all([
    database.from('partners').select('code').eq('code', code).eq('active', true).maybeSingle(),
    database
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'paid'),
  ]);
  if (!partner || (count ?? 0) > 0) return null;
  return code;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 隨機代號：小寫英數，避開容易看錯的 0/o/1/l。 */
function randomCode(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => chars[b % chars.length]).join('');
}

export type PartnerOrder = {
  date: string;
  product: string;
  amount: number;
  currency: string;
  /** counted：算佣金；refunded：退款／爭議不算；repeat：不是這位顧客的第一單；pending：手續費還沒入帳。 */
  status: 'counted' | 'refunded' | 'repeat' | 'pending';
  fee: number | null;
  net: number | null;
  commission: number | null;
  feeCurrency: string | null;
};

export type PartnerReport = {
  code: string;
  name: string;
  share: number;
  visitors: number;
  orders: PartnerOrder[];
  /** 依結算幣別加總、依月份（UTC+8）分組。 */
  months: { month: string; currency: string; orders: number; net: number; commission: number }[];
};

type OrderRow = {
  id: string;
  user_id: string;
  product_id: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
};
type PaymentRow = {
  id: string;
  order_id: string;
  payment_ref: string;
  amount_refunded: number | null;
  dispute_status: string | null;
  fee_amount: number | null;
  net_amount: number | null;
  fee_currency: string | null;
};

const monthOf = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 7);

export async function partnerReport(
  database: SupabaseClient,
  partner: { code: string; name: string; share: number },
  provider: Pick<PaymentProvider, 'fetchFee'> | null,
): Promise<PartnerReport> {
  const { data: rows, error } = await database
    .from('orders')
    .select('id,user_id,product_id,amount,currency,paid_at,created_at')
    .eq('ref_partner', partner.code)
    .eq('status', 'paid')
    .order('paid_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error('partner_orders_failed');
  const orders = (rows ?? []) as OrderRow[];

  // 「第一單」：這位顧客最早的一筆已付款訂單就是這一筆
  const users = [...new Set(orders.map((o) => o.user_id))];
  const firstPaid = new Map<string, string>();
  if (users.length) {
    const { data: all, error: allError } = await database
      .from('orders')
      .select('id,user_id,paid_at')
      .in('user_id', users)
      .eq('status', 'paid')
      .order('paid_at', { ascending: true });
    if (allError) throw new Error('partner_orders_failed');
    for (const o of (all ?? []) as { id: string; user_id: string }[])
      if (!firstPaid.has(o.user_id)) firstPaid.set(o.user_id, o.id);
  }

  const payments = new Map<string, PaymentRow>();
  if (orders.length) {
    const { data: pays, error: payError } = await database
      .from('payments')
      .select('id,order_id,payment_ref,amount_refunded,dispute_status,fee_amount,net_amount,fee_currency')
      .in(
        'order_id',
        orders.map((o) => o.id),
      );
    if (payError) throw new Error('partner_payments_failed');
    for (const p of (pays ?? []) as PaymentRow[]) payments.set(p.order_id, p);
  }

  const out: PartnerOrder[] = [];
  for (const o of orders) {
    const base = {
      date: o.paid_at ?? o.created_at,
      product: o.product_id,
      amount: o.amount,
      currency: o.currency.toUpperCase(),
    };
    const pay = payments.get(o.id);
    if (firstPaid.get(o.user_id) !== o.id) {
      out.push({ ...base, status: 'repeat', fee: null, net: null, commission: null, feeCurrency: null });
      continue;
    }
    if (
      !pay ||
      (pay.amount_refunded ?? 0) > 0 ||
      pay.dispute_status === 'open' ||
      pay.dispute_status === 'lost'
    ) {
      out.push({
        ...base,
        status: pay ? 'refunded' : 'pending',
        fee: null,
        net: null,
        commission: null,
        feeCurrency: null,
      });
      continue;
    }
    let { fee_amount: fee, net_amount: net, fee_currency: feeCurrency } = pay;
    if (fee === null || net === null || !feeCurrency) {
      // 第一次用到：去 Stripe 取手續費並存下來，之後不再問
      try {
        const got = await provider?.fetchFee?.(pay.payment_ref);
        if (got) {
          fee = got.fee;
          net = got.net;
          feeCurrency = got.currency;
          await database
            .from('payments')
            .update({ fee_amount: fee, net_amount: net, fee_currency: feeCurrency })
            .eq('id', pay.id);
        }
      } catch {
        /* 下次再取 */
      }
    }
    if (fee === null || net === null || !feeCurrency) {
      out.push({ ...base, status: 'pending', fee: null, net: null, commission: null, feeCurrency: null });
      continue;
    }
    out.push({
      ...base,
      status: 'counted',
      fee,
      net,
      feeCurrency,
      commission: Math.floor(net * partner.share),
    });
  }

  const months = new Map<string, PartnerReport['months'][number]>();
  for (const o of out) {
    if (o.status !== 'counted' || o.net === null || o.commission === null || !o.feeCurrency) continue;
    const key = `${monthOf(o.date)}|${o.feeCurrency}`;
    const m = months.get(key) ?? {
      month: monthOf(o.date),
      currency: o.feeCurrency,
      orders: 0,
      net: 0,
      commission: 0,
    };
    m.orders += 1;
    m.net += o.net;
    m.commission += o.commission;
    months.set(key, m);
  }

  // 點連結進來的不同訪客數（同一瀏覽器算一位）
  const { data: visits } = await database
    .from('site_events')
    .select('vid')
    .eq('name', 'ref_visit')
    .eq('props->>ref', partner.code)
    .limit(10000);
  const visitors = new Set(((visits ?? []) as { vid: string }[]).map((v) => v.vid)).size;

  return {
    code: partner.code,
    name: partner.name,
    share: partner.share,
    visitors,
    orders: out.reverse(),
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
  };
}

/** POST /api/partner {token}：推廣人看自己的數據（私密連結裡的 token，不用登入）。 */
export async function partnerSelfRequest(
  request: Request,
  database: SupabaseClient | null,
  provider: Pick<PaymentProvider, 'fetchFee'> | null,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!database) return errorResponse(503, 'partner_unavailable');
  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown }).token;
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  if (typeof token !== 'string' || !TOKEN.test(token)) return errorResponse(404, 'partner_not_found');
  const { data: partner } = await database
    .from('partners')
    .select('code,name,share,active')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle();
  if (!partner) return errorResponse(404, 'partner_not_found');
  try {
    const report = await partnerReport(
      database,
      { code: partner.code, name: partner.name, share: Number(partner.share) },
      provider,
    );
    return json({ ...report, active: partner.active }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return errorResponse(503, 'partner_unavailable');
  }
}

/** GET：所有推廣人與報表；POST {name}：新增一位，回私密連結（只顯示這一次）。權限由呼叫端先檢查。 */
export async function adminPartnersRequest(
  request: Request,
  database: SupabaseClient,
  provider: Pick<PaymentProvider, 'fetchFee'> | null,
  baseUrl: string,
): Promise<Response> {
  if (request.method === 'POST') {
    if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
    let name: unknown;
    try {
      name = ((await request.json()) as { name?: unknown }).name;
    } catch {
      return errorResponse(400, 'invalid_json');
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60)
      return errorResponse(400, 'invalid_name');
    const token = randomHex(32);
    for (let i = 0; i < 5; i++) {
      const code = randomCode();
      const { error } = await database
        .from('partners')
        .insert({ code, name: name.trim(), token_hash: await sha256Hex(token), share: 0.5 });
      if (!error) {
        const link = new URL(`/?ref=${code}`, baseUrl).href;
        const dashboard = new URL(`/partner#t=${token}`, baseUrl).href;
        return json({ code, name: name.trim(), link, dashboard }, { status: 201 });
      }
      if (error.code !== '23505') return errorResponse(503, 'partner_create_failed');
    }
    return errorResponse(503, 'partner_create_failed');
  }
  const { data: partners, error } = await database
    .from('partners')
    .select('code,name,share,active,created_at')
    .order('created_at', { ascending: true });
  if (error) return errorResponse(503, 'partner_unavailable');
  try {
    const reports = [];
    for (const p of partners ?? [])
      reports.push({
        ...(await partnerReport(database, { code: p.code, name: p.name, share: Number(p.share) }, provider)),
        active: p.active,
        link: new URL(`/?ref=${p.code}`, baseUrl).href,
      });
    return json({ partners: reports }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return errorResponse(503, 'partner_unavailable');
  }
}
