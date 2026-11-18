import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import '~/site/admin.css';

// 分銷推廣人的數據頁（站長 2026-11-18）：私密連結 /partner#t=…，token 放在 # 後面，不會進伺服器紀錄或來源網址。
// 只顯示數字，不顯示任何顧客資料。伺服器：packages/core/src/partners.ts。
export const Route = createFileRoute('/partner')({
  head: () => ({
    meta: [{ title: '月老 · 推廣數據' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: PartnerPage,
});

type Report = {
  name: string;
  code: string;
  share: number;
  active: boolean;
  visitors: number;
  orders: {
    date: string;
    product: string;
    amount: number;
    currency: string;
    status: 'counted' | 'refunded' | 'repeat' | 'pending';
    commission: number | null;
    feeCurrency: string | null;
  }[];
  months: { month: string; currency: string; orders: number; net: number; commission: number }[];
};

const money = (cents: number, currency: string) =>
  `${currency === 'HKD' ? 'HK$' : currency === 'USD' ? 'US$' : `${currency} `}${(cents / 100).toFixed(2)}`;
const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function PartnerPage() {
  const zh = contentLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : hant);
  const STATUS = {
    counted: t('計佣', '计佣'),
    refunded: t('已退款，不計', '已退款，不计'),
    repeat: t('非首單，不計', '非首单，不计'),
    pending: t('手續費待入帳', '手续费待入账'),
  } as const;
  const [state, setState] = useState<'loading' | 'missing' | 'error' | Report>('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
    if (!token) {
      setState('missing');
      return;
    }
    fetch('/api/partner', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) =>
        r.ok ? setState((await r.json()) as Report) : setState(r.status === 404 ? 'missing' : 'error'),
      )
      .catch(() => setState('error'));
  }, []);

  if (state === 'loading')
    return (
      <main className="admin partner-page">
        <p className="admin-empty">{t('正在讀取…', '正在读取…')}</p>
      </main>
    );
  if (state === 'missing')
    return (
      <main className="admin partner-page">
        <p className="admin-empty">
          {t('連結無效。請向站長確認你的數據頁連結。', '链接无效。请向站长确认你的数据页链接。')}
        </p>
      </main>
    );
  if (state === 'error')
    return (
      <main className="admin partner-page">
        <p className="admin-empty">{t('暫時取不到數據，請稍後再試。', '暂时取不到数据，请稍后再试。')}</p>
      </main>
    );

  const link = `${window.location.origin}/?ref=${state.code}`;
  const counted = state.orders.filter((o) => o.status === 'counted').length;
  return (
    <main className="admin partner-page">
      <section className="admin-card">
        <h1>{t(`${state.name} 的推廣數據`, `${state.name} 的推广数据`)}</h1>
        <p>
          {t('你的推廣連結：', '你的推广链接：')}
          <code>{link}</code>
        </p>
        <p className="admin-muted">
          {t(
            `有人點這個連結進站，30 天內付款，而且是他在本站的第一筆付款，就算你的。佣金是實收扣掉 Stripe 手續費後的 ${Math.round(state.share * 100)}%，退款的單不算。站長每月結算一次。`,
            `有人点这个链接进站，30 天内付款，而且是他在本站的第一笔付款，就算你的。佣金是实收扣掉 Stripe 手续费后的 ${Math.round(state.share * 100)}%，退款的单不算。站长每月结算一次。`,
          )}
        </p>
        {!state.active && <p className="admin-muted">{t('這個推廣連結已停用。', '这个推广链接已停用。')}</p>}
        <p>
          {t(
            `點連結進來的訪客：${state.visitors} 位；計佣訂單：${counted} 筆`,
            `点链接进来的访客：${state.visitors} 位；计佣订单：${counted} 笔`,
          )}
        </p>
      </section>
      <section className="admin-card">
        <h2>{t('每月佣金', '每月佣金')}</h2>
        {state.months.length === 0 ? (
          <p className="admin-empty">{t('還沒有計佣的訂單。', '还没有计佣的订单。')}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('月份', '月份')}</th>
                <th>{t('訂單', '订单')}</th>
                <th>{t('實收（扣手續費）', '实收（扣手续费）')}</th>
                <th>{t('佣金', '佣金')}</th>
              </tr>
            </thead>
            <tbody>
              {state.months.map((m) => (
                <tr key={`${m.month}${m.currency}`}>
                  <td>{m.month}</td>
                  <td>{m.orders}</td>
                  <td>{money(m.net, m.currency)}</td>
                  <td>{money(m.commission, m.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {state.orders.length > 0 && (
        <section className="admin-card">
          <h2>{t('訂單明細', '订单明细')}</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('日期', '日期')}</th>
                <th>{t('金額', '金额')}</th>
                <th>{t('佣金', '佣金')}</th>
                <th>{t('狀態', '状态')}</th>
              </tr>
            </thead>
            <tbody>
              {state.orders.map((o, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 報表列，順序固定
                <tr key={i}>
                  <td>{dateFmt.format(new Date(o.date))}</td>
                  <td>{money(o.amount, o.currency)}</td>
                  <td>{o.commission !== null && o.feeCurrency ? money(o.commission, o.feeCurrency) : '—'}</td>
                  <td>{STATUS[o.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
