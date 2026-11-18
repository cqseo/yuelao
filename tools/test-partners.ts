// 分銷：推廣代號、只算第一單、手續費與佣金、退款不算、推廣人數據頁的 token。全離線（假資料庫、假 Stripe）。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  adminPartnersRequest,
  partnerReport,
  partnerSelfRequest,
  refForCheckout,
  refFromRequest,
  sha256Hex,
  validRefCode,
} from '../packages/core/src/partners';

type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  const updates: { table: string; set: Row; id: unknown }[] = [];
  const inserts: { table: string; row: Row }[] = [];
  const get = (r: Row, k: string) =>
    k.includes('->>') ? (r[k.split('->>')[0]!] as Row)?.[k.split('->>')[1]!] : r[k];
  const db = {
    updates,
    inserts,
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let head = false;
      let mode: 'select' | 'update' | 'insert' = 'select';
      let patch: Row = {};
      const q = {
        select(_c?: string, opts?: { head?: boolean }) {
          head = Boolean(opts?.head);
          return q;
        },
        eq(k: string, v: unknown) {
          if (mode === 'update') {
            for (const r of rows.filter((x) => x[k] === v)) {
              Object.assign(r, patch);
              updates.push({ table, set: patch, id: v });
            }
            return Promise.resolve({ error: null });
          }
          rows = rows.filter((r) => get(r, k) === v);
          return q;
        },
        in(k: string, vs: unknown[]) {
          rows = rows.filter((r) => vs.includes(r[k]));
          return q;
        },
        order(k: string, o?: { ascending?: boolean }) {
          rows.sort((a, b) => String(a[k]).localeCompare(String(b[k])) * (o?.ascending === false ? -1 : 1));
          return q;
        },
        limit() {
          return q;
        },
        update(set: Row) {
          mode = 'update';
          patch = set;
          return q;
        },
        insert(row: Row) {
          inserts.push({ table, row });
          (tables[table] ??= []).push(row);
          return Promise.resolve({ error: null });
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then(res: (v: unknown) => void) {
          res(head ? { count: rows.length, error: null } : { data: rows, error: null });
        },
      };
      return q;
    },
  };
  return db as typeof db & SupabaseClient;
}

// ---------- 代號 ----------
assert.ok(validRefCode('ab3k9z'));
assert.ok(!validRefCode('AB'));
assert.ok(!validRefCode('a b'));
assert.equal(
  refFromRequest(new Request('https://x.test', { headers: { cookie: 'a=1; yl_ref=lin7; b=2' } })),
  'lin7',
);
assert.equal(refFromRequest(new Request('https://x.test', { headers: { cookie: 'yl_ref=<script>' } })), null);
assert.equal(refFromRequest(new Request('https://x.test')), null);
console.log('PASS: referral codes are strictly shaped');

// ---------- 結帳：只在第一筆付款前記 ----------
const partner = { code: 'lin7', name: 'Lin', share: 0.5, active: true, token_hash: '' };
{
  const db = fakeDb({ partners: [partner], orders: [] });
  assert.equal(await refForCheckout(db, 'u1', 'lin7'), 'lin7');
  assert.equal(await refForCheckout(db, 'u1', 'nope'), null, 'unknown partner');
  assert.equal(await refForCheckout(db, 'u1', null), null);
  const paid = fakeDb({ partners: [partner], orders: [{ id: 'o0', user_id: 'u1', status: 'paid' }] });
  assert.equal(await refForCheckout(paid, 'u1', 'lin7'), null, 'not the first order');
  const off = fakeDb({ partners: [{ ...partner, active: false }], orders: [] });
  assert.equal(await refForCheckout(off, 'u1', 'lin7'), null, 'inactive partner');
  console.log('PASS: checkout records the partner only before a first payment');
}

// ---------- 報表 ----------
const t = (d: string) => `2026-${d}T04:00:00Z`;
const tables = () => ({
  partners: [partner],
  orders: [
    // u1：第一單 HK$18（計佣）、第二單也是 lin7 帶的（不計）
    {
      id: 'o1',
      user_id: 'u1',
      product_id: 'unlock_1',
      amount: 1800,
      currency: 'HKD',
      status: 'paid',
      ref_partner: 'lin7',
      paid_at: t('11-18'),
      created_at: t('11-18'),
    },
    {
      id: 'o2',
      user_id: 'u1',
      product_id: 'followup_1',
      amount: 800,
      currency: 'HKD',
      status: 'paid',
      ref_partner: 'lin7',
      paid_at: t('11-19'),
      created_at: t('11-19'),
    },
    // u2：退款
    {
      id: 'o3',
      user_id: 'u2',
      product_id: 'unlock_1',
      amount: 1800,
      currency: 'HKD',
      status: 'paid',
      ref_partner: 'lin7',
      paid_at: t('11-20'),
      created_at: t('11-20'),
    },
    // u3：手續費已存（12 月）
    {
      id: 'o4',
      user_id: 'u3',
      product_id: 'unlock_1',
      amount: 1800,
      currency: 'HKD',
      status: 'paid',
      ref_partner: 'lin7',
      paid_at: t('12-02'),
      created_at: t('12-02'),
    },
    // u4：自己先付過一單（沒推廣），後來點了連結再買 → 不是第一單
    {
      id: 'o5',
      user_id: 'u4',
      product_id: 'unlock_1',
      amount: 1800,
      currency: 'HKD',
      status: 'paid',
      ref_partner: null,
      paid_at: t('11-01'),
      created_at: t('11-01'),
    },
    {
      id: 'o6',
      user_id: 'u4',
      product_id: 'unlock_1',
      amount: 1800,
      currency: 'HKD',
      status: 'paid',
      ref_partner: 'lin7',
      paid_at: t('11-21'),
      created_at: t('11-21'),
    },
  ],
  payments: [
    {
      id: 'p1',
      order_id: 'o1',
      payment_ref: 'pi_1',
      amount_refunded: 0,
      dispute_status: null,
      fee_amount: null,
      net_amount: null,
      fee_currency: null,
    },
    {
      id: 'p2',
      order_id: 'o2',
      payment_ref: 'pi_2',
      amount_refunded: 0,
      dispute_status: null,
      fee_amount: null,
      net_amount: null,
      fee_currency: null,
    },
    {
      id: 'p3',
      order_id: 'o3',
      payment_ref: 'pi_3',
      amount_refunded: 1800,
      dispute_status: null,
      fee_amount: null,
      net_amount: null,
      fee_currency: null,
    },
    {
      id: 'p4',
      order_id: 'o4',
      payment_ref: 'pi_4',
      amount_refunded: 0,
      dispute_status: null,
      fee_amount: 296,
      net_amount: 1504,
      fee_currency: 'HKD',
    },
    {
      id: 'p6',
      order_id: 'o6',
      payment_ref: 'pi_6',
      amount_refunded: 0,
      dispute_status: null,
      fee_amount: null,
      net_amount: null,
      fee_currency: null,
    },
  ],
  site_events: [
    { vid: 'v1', name: 'ref_visit', props: { ref: 'lin7' } },
    { vid: 'v1', name: 'ref_visit', props: { ref: 'lin7' } },
    { vid: 'v2', name: 'ref_visit', props: { ref: 'lin7' } },
    { vid: 'v3', name: 'ref_visit', props: { ref: 'other' } },
  ],
});
const asked: string[] = [];
const stripe = {
  fetchFee: async (ref: string) => {
    asked.push(ref);
    return { fee: 297, net: 1503, currency: 'HKD' };
  },
};
{
  const db = fakeDb(tables());
  const r = await partnerReport(db, partner, stripe);
  const by = (status: string) => r.orders.filter((o) => o.status === status).length;
  assert.deepEqual([by('counted'), by('repeat'), by('refunded')], [2, 2, 1]);
  assert.deepEqual(asked, ['pi_1'], 'fee fetched only for counted orders without a cached fee');
  assert.deepEqual(
    db.updates.map((u) => u.id),
    ['p1'],
    'fetched fee is saved',
  );
  const o1 = r.orders.find((o) => o.date === t('11-18'))!;
  assert.equal(o1.commission, 751, 'floor(1503 × 0.5)');
  assert.deepEqual(
    r.months.map((m) => [m.month, m.orders, m.net, m.commission]),
    [
      ['2026-12', 1, 1504, 752],
      ['2026-11', 1, 1503, 751],
    ],
  );
  assert.equal(r.visitors, 2);
  console.log(
    'PASS: only first orders count, refunds excluded, commission = floor(net × share), months grouped',
  );
}
{
  const db = fakeDb(tables());
  const r = await partnerReport(db, partner, { fetchFee: async () => null });
  assert.equal(r.orders.filter((o) => o.status === 'pending').length, 1, 'fee not yet available');
  console.log('PASS: orders without a settled fee show as pending');
}

// ---------- 推廣人數據頁 ----------
{
  const token = 'a'.repeat(64);
  const db = fakeDb({ ...tables(), partners: [{ ...partner, token_hash: await sha256Hex(token) }] });
  const post = (body: unknown, origin = 'https://yuexia.app') =>
    new Request('https://yuexia.app/api/partner', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const ok = await partnerSelfRequest(post({ token }), db, stripe);
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as Record<string, unknown>;
  assert.equal(body.code, 'lin7');
  assert.ok(!JSON.stringify(body).includes('u1'), 'no customer ids');
  assert.ok(!JSON.stringify(body).includes('pi_'), 'no payment refs');
  assert.equal((await partnerSelfRequest(post({ token: 'b'.repeat(64) }), db, stripe)).status, 404);
  assert.equal((await partnerSelfRequest(post({ token: 'short' }), db, stripe)).status, 404);
  assert.equal((await partnerSelfRequest(post({ token }, 'https://evil.example'), db, stripe)).status, 403);
  console.log('PASS: the partner page needs the exact token and shows no customer data');
}

// ---------- 站長新增推廣人 ----------
{
  const db = fakeDb({ partners: [] });
  const res = await adminPartnersRequest(
    new Request('https://yuexia.app/api/admin/partners', {
      method: 'POST',
      headers: { origin: 'https://yuexia.app', 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  阿林  ' }),
    }),
    db,
    stripe,
    'https://yuexia.app',
  );
  assert.equal(res.status, 201);
  const out = (await res.json()) as { code: string; link: string; dashboard: string };
  assert.match(out.link, /^https:\/\/yuexia\.app\/\?ref=[a-z0-9]{6}$/);
  const token = out.dashboard.split('#t=')[1]!;
  assert.match(token, /^[0-9a-f]{64}$/);
  const row = db.inserts[0]!.row;
  assert.equal(row.name, '阿林');
  assert.equal(row.token_hash, await sha256Hex(token), 'only the hash is stored');
  assert.ok(!JSON.stringify(row).includes(token));
  console.log('PASS: creating a partner stores only the token hash and returns both links once');
}
