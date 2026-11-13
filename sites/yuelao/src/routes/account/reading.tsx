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
  const [status, setStatus] = useState<'loading' | 'ready' | 'login' | 'missing' | 'processing' | 'error'>(
    'loading',
  );
  const [body, setBody] = useState('');
  const [canGenerate, setCanGenerate] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
          const account = await fetch('/api/account/status', {
            credentials: 'same-origin',
            cache: 'no-store',
          });
          if (account.ok) {
            const state = (await account.json()) as {
              aiTestEnabled?: boolean;
              unlocks?: { stick_id: number; category: string; locale: string; revoked: boolean }[];
            };
            const params = new URLSearchParams(search);
            const unlocked = state.unlocks?.some(
              (u) =>
                !u.revoked &&
                u.stick_id === Number(params.get('stickId')) &&
                u.category === params.get('category') &&
                u.locale === params.get('locale'),
            );
            setCanGenerate(Boolean(state.aiTestEnabled && unlocked));
          }
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

  async function generate() {
    if (busy || !canGenerate) return;
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams(window.location.search);
      const response = await fetch('/api/account/reading/generate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stickId: Number(params.get('stickId')),
          category: params.get('category'),
          locale: params.get('locale'),
          question,
          consent: true,
        }),
      });
      if (response.status === 202) {
        setStatus('processing');
      } else if (response.ok) {
        window.location.reload(); // Re-check server-side entitlement + saved report.
      } else {
        setError(
          t(
            '暫時無法生成。你的權益仍然保留，請稍後重試，無需再次付款。',
            '暂时无法生成。你的权益仍然保留，稍后重试即可，无需再次付款。',
          ),
        );
      }
    } catch {
      setError(t('連線失敗，稍後可再次嘗試，不需重新付款。', '连接失败，稍后可再次尝试，无需重新付款。'));
    } finally {
      setBusy(false);
    }
  }

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
        <div>
          <p role="status">
            {t(
              '目前沒有可查看的解讀，可能尚未取得權益，或正文尚未生成。不要重複付款。',
              '目前没有可查看的解读，可能尚未取得权益，或正文尚未生成。不要重复付款。',
            )}
          </p>
          {canGenerate && (
            <form
              className="reading-generate-form"
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <p>
                {t(
                  '已確認你持有這支籤的權益。每筆權益只生成並保存一份專屬報告。',
                  '已确认你拥有这支签的权益。每笔权益只生成并保存一份专属报告。',
                )}
              </p>
              <label htmlFor="reading-question">
                {t('想問的事（選填，不超過 400 字）', '想问的问题（选填，不超过 400 字）')}
              </label>
              <textarea
                id="reading-question"
                rows={4}
                maxLength={400}
                placeholder={t(
                  '例：我們最近很少聊天，我該如何開口？',
                  '例：我们最近很少聊天，我该如何开口？',
                )}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <p className="reading-consent">
                {t(
                  '你寫的問題會送至第三方 AI 模型服務（可能經由 API 中轉服務）生成解讀，結果存入你的帳戶；問題原文不寫入本站資料庫。',
                  '你写的问题会发送给第三方 AI 模型服务（可能经由 API 中转服务）生成解读，结果保存至你的账户；问题原文不存入本站数据库。',
                )}
              </p>
              <button disabled={busy} type="submit">
                {busy
                  ? t('正在整理心事…', '正在整理问题…')
                  : t('生成我的 AI 深度解讀', '生成我的 AI 深度解读')}
              </button>
              {error && (
                <p role="alert" className="auth-error">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      )}
      {status === 'processing' && (
        <div role="status">
          <p>
            {t(
              '這支籤已有生成中的任務，請稍後重新查閱。毋須再次扣款或耗用次數。',
              '这支签已有生成中的任务，请稍后重新查看。无需再次扣费或消耗次数。',
            )}
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            {t('刷新狀態', '刷新状态')}
          </button>
        </div>
      )}
      {status === 'error' && <p role="alert">{t('讀取失敗，請稍後再試。', '读取失败，请稍后再试。')}</p>}
      <p>
        <Link to={localizeHref('/account')}>{t('返回我的帳戶', '返回我的账户')}</Link>
      </p>
    </article>
  );
}
