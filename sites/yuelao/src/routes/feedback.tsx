import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { getLocale } from '~/paraglide/runtime.js';

// 用戶意見（站長 2026-11-18：「這樣才知道用戶想要什麼」）。不用登入；只有站長在後台看得到。
// 伺服器：packages/core/src/feedback.ts。
export const Route = createFileRoute('/feedback')({
  head: () => ({
    meta: [{ title: tr('月老 · 意見回饋') }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: FeedbackPage,
});

type Kind = 'idea' | 'problem' | 'other';

function FeedbackPage() {
  const zh = contentLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : tr(hant));
  const [kind, setKind] = useState<Kind>('idea');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const kinds: [Kind, string][] = [
    ['idea', t('想要的功能或內容', '想要的功能或内容')],
    ['problem', t('遇到問題', '遇到问题')],
    ['other', t('其他想說的', '其他想说的')],
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || message.trim().length < 2) return;
    setBusy(true);
    setError('');
    const from = new URLSearchParams(window.location.search).get('from');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          contact: contact.trim() || null,
          page: from?.startsWith('/') ? from : null,
          locale: getLocale(),
        }),
      });
      if (res.ok) {
        track('feedback_sent', { kind });
        setSent(true);
        return;
      }
      setError(
        res.status === 429
          ? t('送出太頻繁，請過一分鐘再試。', '提交太频繁，请过一分钟再试。')
          : t('暫時送不出去，請稍後再試。', '暂时提交不了，请稍后再试。'),
      );
    } catch {
      setError(t('連線失敗，請稍後再試。', '连接失败，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="account-page account-panel feedback-page">
      <p className="auth-kicker">{t('月老 · 意見回饋', '月老 · 意见反馈')}</p>
      <h1>{t('想跟我們說什麼？', '想跟我们说什么？')}</h1>
      {sent ? (
        <div role="status">
          <p>{t('收到了，謝謝你。每一則我們都會看。', '收到了，谢谢你。每一条我们都会看。')}</p>
          <p>
            <a href="/">{t('回到首頁', '回到首页')}</a>
          </p>
        </div>
      ) : (
        <form className="reading-generate-form" onSubmit={submit}>
          <p>
            {t(
              '想要什麼新功能、哪裡不好用、哪支籤說得不準，都可以寫。只有站長看得到，不會公開。',
              '想要什么新功能、哪里不好用、哪支签说得不准，都可以写。只有站长看得到，不会公开。',
            )}
          </p>
          <fieldset className="feedback-kinds">
            <legend>{t('是哪一種？', '是哪一种？')}</legend>
            {kinds.map(([k, label]) => (
              <label key={k}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                {label}
              </label>
            ))}
          </fieldset>
          <label htmlFor="feedback-message">{t('想說的話（1000 字以內）', '想说的话（1000 字以内）')}</label>
          <textarea
            id="feedback-message"
            rows={5}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <label htmlFor="feedback-contact">
            {t(
              '聯絡方式（選填：信箱或 IG，想要我們回覆再留）',
              '联系方式（选填：邮箱或 IG，想要我们回复再留）',
            )}
          </label>
          <input
            id="feedback-contact"
            maxLength={120}
            autoComplete="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <button type="submit" disabled={busy || message.trim().length < 2}>
            {busy ? t('送出中…', '提交中…') : t('送出', '提交')}
          </button>
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
        </form>
      )}
    </article>
  );
}
