import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';

export const Route = createFileRoute('/billing/return')({
  head: () => ({
    meta: [{ title: '付款狀態 · 月老' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const zh = getLocale() === 'zh-Hans';
  // 從集市的月老殿發起的付款：回程帶回月老殿（那支籤暫存在 sessionStorage）。
  const [pending, setPending] = useState(false);
  useEffect(() => {
    try {
      setPending(sessionStorage.getItem('market-pending') !== null);
    } catch {}
  }, []);
  return (
    <section className="legal">
      <h1>{zh ? '支付正在核实' : '付款正在核實'}</h1>
      <p>
        {zh
          ? '返回这个页面不代表交易已经完成，也不会自动解锁内容。付款权益仅在支付平台确认后，由服务器核发。'
          : '返回這個頁面不代表交易已經完成，也不會自動解鎖內容。付款權益僅在支付平台確認後，由伺服器核發。'}
      </p>
      <p>
        {zh
          ? '如果付款已经成功但内容没有解锁，请保留支付平台的收据，稍后在账户中查看交易记录。'
          : '如果付款已經成功但內容沒有解鎖，請保留支付平台的收據，稍後在帳戶中查看交易紀錄。'}
      </p>
      {pending ? (
        <p>
          <a href="/market#yuelao">{zh ? '回到月老殿，接着刚才那支签' : '回到月老殿，接著剛才那支籤'}</a>
        </p>
      ) : (
        <Link to={localizeHref('/ritual')}>{zh ? '返回月老求签' : '返回月老求籤'}</Link>
      )}
    </section>
  );
}
