import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';

export const Route = createFileRoute('/account/reading')({
  head: () => ({
    meta: [{ title: '月老 · 我的深度解讀' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: Reading,
});

function Reading() {
  const zh = getLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : hant);
  const [status, setStatus] = useState<'loading' | 'ready' | 'login' | 'missing' | 'error'>('loading');
  const [body, setBody] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const search = window.location.search;
      async function request() {
        return fetch(`/api/account/reading${search}`, { credentials: 'same-origin', cache: 'no-store' });
      }
      try {
        let response = await request();
        if (response.status === 401) {
          const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
          if (r.ok) response = await request();
        }
        if (!active) return;
        if (response.status === 401) {
          setStatus('login');
          return;
        }
        if (response.status === 404) {
          setStatus('missing');
          return;
        }
        if (!response.ok) {
          setStatus('error');
          return;
        }
        const data = (await response.json()) as { body: string };
        if (!active) return;
        setBody(data.body);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="account-page account-panel private-reading">
      <p className="auth-kicker">{t('月老 · 專屬解讀', '月老 · 专属解读')}</p>
      <h1>{t('我的深度解讀', '我的深度解读')}</h1>
      {status === 'loading' && <p role="status">{t('正在核對已購權益…', '正在核对已购权益…')}</p>}
      {status === 'ready' && <div className="private-reading-body">{body}</div>}
      {status === 'login' && (
        <p>
          {t('請先登入帳戶後查看已購內容。', '请先登录账户后查看已购内容。')}
          <Link to={localizeHref('/login')}>{t('前往登入', '前往登录')}</Link>
        </p>
      )}
      {status === 'missing' && (
        <p role="alert">
          {t(
            '目前沒有可查看的解讀。可能尚未付款、權益已撤銷，或正文尚未準備完成。請不要重複付款。',
            '目前没有可查看的解读。可能尚未付款、权益已撤销，或正文尚未准备完成。请不要重复付款。',
          )}
        </p>
      )}
      {status === 'error' && <p role="alert">{t('讀取失敗，請稍後再試。', '读取失败，请稍后再试。')}</p>}
      <p>
        <Link to={localizeHref('/account')}>{t('返回我的帳戶', '返回我的账户')}</Link>
      </p>
    </article>
  );
}
