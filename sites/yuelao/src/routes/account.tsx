import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';
import { GuestAccount } from '~/components/GuestAccount';

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [{ title: '月老 · 我的姻緣簿' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AccountRoute,
});

// Child pages such as /account/reading must render through an Outlet.
// The dashboard itself is the index view, not a layout around purchased content.
function AccountRoute() {
  const location = useLocation();
  return location.pathname === '/account/reading' ? <Outlet /> : <Account />;
}

type Order = {
  id: string;
  product_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};
type Pack = {
  id: string;
  product_id: string;
  total_uses: number;
  used_uses: number;
  remaining_uses: number;
  expires_at: string | null;
};
type Unlock = {
  id: string;
  stick_id: number;
  category: string;
  locale: string;
  revoked: boolean;
};
type AccountData = {
  email: string;
  orders: Order[];
  packs: Pack[];
  unlocks: Unlock[];
  billingTestEnabled: boolean;
  aiTestEnabled: boolean;
};

async function accountRequest(): Promise<Response> {
  return fetch('/api/account/status', { credentials: 'same-origin', cache: 'no-store' });
}

function Account() {
  const zh = getLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : hant);
  const [data, setData] = useState<AccountData | null>(null);
  const [view, setView] = useState<'loading' | 'ready' | 'login' | 'error'>('loading');
  const [currency, setCurrency] = useState<'HKD' | 'TWD'>('HKD');
  const [redeemStick, setRedeemStick] = useState('1');
  const [redeemCategory, setRedeemCategory] = useState<'him' | 'single' | 'reunion'>('him');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let response = await accountRequest();
        if (response.status === 401) {
          const refreshed = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'same-origin',
          });
          if (refreshed.ok) response = await accountRequest();
        }
        if (!active) return;
        if (response.status === 401) {
          setView('login');
          return;
        }
        if (!response.ok) {
          setView('error');
          return;
        }
        const body = (await response.json()) as AccountData;
        if (!active) return;
        setData(body);
        setView('ready');
      } catch {
        if (active) setView('error');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Logout failed');
      window.location.assign(localizeHref('/login'));
    } catch {
      setMessage(t('登出遇到網路問題，請重新嘗試。', '退出时遇到网络问题，请重试。'));
      setBusy(false);
    }
  }

  async function checkout(productId: string) {
    if (!data?.billingTestEnabled || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, currency, locale: getLocale() }),
      });
      if (!response.ok) {
        setMessage(
          response.status === 401
            ? t('登入已過期，請重新登入。', '登录已过期，请重新登录。')
            : t('測試結帳暫時無法使用，未產生扣款。', '测试结账暂不可用，未产生扣款。'),
        );
        return;
      }
      const payload = (await response.json()) as { checkoutUrl?: string };
      if (!payload.checkoutUrl) throw new Error('Missing checkout URL');
      const url = new URL(payload.checkoutUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') {
        throw new Error('Unexpected checkout destination');
      }
      window.location.assign(url.toString());
    } catch {
      setMessage(t('無法建立測試訂單，請稍後再試。', '无法创建测试订单，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function redeemPack() {
    if (busy || !data?.aiTestEnabled) return;
    const pack = data.packs.find(
      (p) => p.remaining_uses > 0 && (!p.expires_at || new Date(p.expires_at) > new Date()),
    );
    const stickId = Number(redeemStick);
    if (!pack || !Number.isInteger(stickId) || stickId < 1 || stickId > 100) {
      setMessage(t('請選擇有效籤號及可用問事包。', '请选择有效签号及可用问事包。'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/account/redeem', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          packId: pack.id,
          stickId,
          category: redeemCategory,
          locale: getLocale(),
        }),
      });
      if (!response.ok) {
        setMessage(
          t(
            '這次兌換未成功，未扣除額外次數；請檢查餘額或重新整理。',
            '本次兑换未成功，未额外扣除次数；请检查余额或刷新。',
          ),
        );
        return;
      }
      window.location.assign(
        `/account/reading?stickId=${stickId}&category=${redeemCategory}&locale=${getLocale()}`,
      );
    } catch {
      setMessage(t('連線失敗，請確認紀錄再重試。', '连接失败，请先核对记录后重试。'));
    } finally {
      setBusy(false);
    }
  }

  const money = (amount: number, code: string) =>
    `${code === 'HKD' ? 'HK$' : code === 'TWD' ? 'NT$' : code} ${(amount / 100).toFixed(0)}`;
  const day = (iso: string) => new Date(iso).toLocaleDateString(zh ? 'zh-CN' : 'zh-TW');

  return (
    <section className="account-page">
      <p className="auth-kicker">{t('月老 · 姻緣簿', '月老 · 姻缘簿')}</p>
      <h1>{t('我的帳戶', '我的账户')}</h1>
      {view === 'loading' && <p role="status">{t('正在確認登入狀態…', '正在确认登录状态…')}</p>}
      {view === 'login' && import.meta.env.VITE_AUTH_ENABLED === 'true' &&
        import.meta.env.VITE_GUEST_AUTH_ENABLED === 'true' && <GuestAccount />}
      {view === 'login' && !(import.meta.env.VITE_AUTH_ENABLED === 'true' &&
        import.meta.env.VITE_GUEST_AUTH_ENABLED === 'true') && (
        <div className="account-card">
          <h2>{t('先登入，才能查看個人紀錄', '请先登录，查看个人记录')}</h2>
          <p>{t('透過電子信箱取得驗證碼，查閱你的訂單與已購權益。', '通过邮箱验证码查看订单与已购权益。')}</p>
          <Link className="account-link" to={localizeHref('/login')}>
            {t('前往登入', '前往登录')}
          </Link>
        </div>
      )}
      {view === 'error' && (
        <p role="alert">{t('目前無法讀取帳戶資料，請稍後重試。', '暂时无法读取账户数据，请稍后重试。')}</p>
      )}
      {view === 'ready' && data && (
        <>
          <div className="account-intro">
            <span>{data.email}</span>
            <button type="button" onClick={() => void logout()} disabled={busy}>
              {t('登出', '退出登录')}
            </button>
          </div>
          <div className="account-stats">
            <div className="account-card">
              <p>{t('我的問事包', '我的问事包')}</p>
              <strong>{data.packs.reduce((sum, pack) => sum + pack.remaining_uses, 0)}</strong>
              <span>{t('可用次數', '可用次数')}</span>
            </div>
            <div className="account-card">
              <p>{t('已解鎖籤文', '已解锁签文')}</p>
              <strong>{data.unlocks.filter((x) => !x.revoked).length}</strong>
              <span>{t('有效權益', '有效权益')}</span>
            </div>
            <div className="account-card">
              <p>{t('訂單紀錄', '订单记录')}</p>
              <strong>{data.orders.length}</strong>
              <span>{t('最近二十筆', '最近二十笔')}</span>
            </div>
          </div>

          <section className="account-panel" aria-labelledby="account-packs">
            <h2 id="account-packs">{t('問事包與測試付款', '问事包与测试支付')}</h2>
            <p>
              {t(
                '測試付款只供開發驗收；未啟用時不會產生訂單，也不會收取費用。',
                '测试支付仅供开发验收；未启用时不会创建订单或收费。',
              )}
            </p>
            <label className="account-currency" htmlFor="payment-currency">
              {t('付款幣種', '支付币种')}
              <select
                id="payment-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'HKD' | 'TWD')}
              >
                <option value="HKD">{t('港幣 HKD', '港币 HKD')}</option>
                <option value="TWD">{t('新台幣 TWD', '新台币 TWD')}</option>
              </select>
            </label>
            <div className="account-offers">
              {site.products
                .filter((product) => product.kind === 'pack')
                .map((product) => {
                  const price = Object.values(product.prices).find((p) => p.currency === currency);
                  return (
                    <div className="account-offer" key={product.id}>
                      <h3>
                        {product.id === 'pack_3'
                          ? t('問事三次包', '问事三次包')
                          : t('問事八次包', '问事八次包')}
                      </h3>
                      <strong>{price ? money(price.amount, currency) : '—'}</strong>
                      <button
                        type="button"
                        disabled={!data.billingTestEnabled || busy}
                        onClick={() => void checkout(product.id)}
                      >
                        {data.billingTestEnabled
                          ? t('前往 Stripe 測試付款', '前往 Stripe 测试支付')
                          : t('測試支付未啟用', '测试支付未启用')}
                      </button>
                    </div>
                  );
                })}
            </div>
            {message && (
              <p role="alert" className="auth-error">
                {message}
              </p>
            )}
          </section>

          <section className="account-panel" aria-labelledby="account-redeem">
            <h2 id="account-redeem">{t('使用問事包：兌換一支籤', '使用问事包：兑换一支签')}</h2>
            <p>
              {t(
                '每支籤的同一情境只扣一次。AI 解讀未準備好前不會開放兌換。',
                '每支签的相同情境只扣一次。AI 解读未准备好前不会开放兑换。',
              )}
            </p>
            <div className="account-redeem-form">
              <label htmlFor="redeem-stick">
                {t('籤號（1–100）', '签号（1–100）')}
                <input
                  id="redeem-stick"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={redeemStick}
                  onChange={(e) => setRedeemStick(e.target.value)}
                />
              </label>
              <label htmlFor="redeem-category">
                {t('問事類型', '问事类型')}
                <select
                  id="redeem-category"
                  value={redeemCategory}
                  onChange={(e) => setRedeemCategory(e.target.value as 'him' | 'single' | 'reunion')}
                >
                  <option value="him">{t('問他', '问他')}</option>
                  <option value="single">{t('脫單', '脱单')}</option>
                  <option value="reunion">{t('複合', '复合')}</option>
                </select>
              </label>
              <button
                type="button"
                disabled={!data.aiTestEnabled || busy || data.packs.every((p) => p.remaining_uses <= 0)}
                onClick={() => void redeemPack()}
              >
                {data.aiTestEnabled
                  ? t('兌換並查看解讀', '兑换并查看解读')
                  : t('AI 解讀測試未啟用', 'AI 解读测试未启用')}
              </button>
            </div>
          </section>

          <section className="account-panel" aria-labelledby="account-orders">
            <h2 id="account-orders">{t('我的訂單', '我的订单')}</h2>
            {data.orders.length === 0 ? (
              <p>{t('尚未有訂單。', '暂无订单。')}</p>
            ) : (
              <ul className="account-rows">
                {data.orders.map((order) => (
                  <li key={order.id}>
                    <span>
                      {order.product_id} · {day(order.created_at)}
                    </span>
                    <span>
                      {money(order.amount, order.currency)} ·{' '}
                      {order.status === 'paid'
                        ? t('已支付', '已支付')
                        : order.status === 'pending'
                          ? t('等待付款確認', '等待支付确认')
                          : order.status === 'failed'
                            ? t('付款失敗', '支付失败')
                            : t('已失效', '已失效')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="account-panel" aria-labelledby="account-unlocks">
            <h2 id="account-unlocks">{t('已解鎖的籤', '已解锁的签')}</h2>
            {data.unlocks.length === 0 ? (
              <p>{t('還沒有解鎖紀錄。', '还没有解锁记录。')}</p>
            ) : (
              <ul className="account-rows">
                {data.unlocks.map((item) => (
                  <li key={item.id}>
                    {item.revoked ? (
                      <Link to={localizeHref(`/sign/${item.stick_id}`)}>
                        {t('第', '第')}
                        {item.stick_id}
                        {t('籤', '签')} · {item.category}
                      </Link>
                    ) : (
                      <a
                        href={`/account/reading?stickId=${item.stick_id}&category=${encodeURIComponent(item.category)}&locale=${encodeURIComponent(item.locale)}`}
                      >
                        {t('第', '第')}
                        {item.stick_id}
                        {t('籤深度解讀', '签深度解读')} · {item.category}
                      </a>
                    )}
                    <span>{item.revoked ? t('已撤銷', '已撤销') : t('查看內容', '查看内容')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="account-privacy">
            {t(
              '已購資料僅在完成身分驗證後顯示。若支付結果仍在處理，請勿重複付款。',
              '购买记录仅在验证身份后显示。若支付结果正在处理，请勿重复付款。',
            )}
          </p>
        </>
      )}
    </section>
  );
}
