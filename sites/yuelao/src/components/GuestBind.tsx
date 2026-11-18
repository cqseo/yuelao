import { type FormEvent, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { tr, trf } from '~/i18n/ui';
import { track } from '~/lib/track';
import site from '../../site.config';

// 訪客綁信箱（站長 2026-11-18）。綁定是改「目前這個訪客帳號」的信箱，帳號不變，
// 已買的解讀、訂單都留在原地；之後換手機用這個信箱登入就找得回來。伺服器：packages/core/src/guest-auth.ts。

type Step = 'email' | 'code' | 'done';

export function GuestBind({ onBound }: { onBound: () => void }) {
  const zh = contentLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : tr(hant));
  // 帶變數的句子：{0} 換成實際的值（翻譯字典的鍵保留 {0}）
  const tf = (hant: string, hans: string, value: string) =>
    zh ? hans.replace('{0}', value) : trf(hant, value);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await post('/api/auth/guest-email', { email: email.trim() });
      if (res.ok) {
        track('guest_bind_code_sent');
        setStep('code');
        return;
      }
      const code = ((await res.json().catch(() => ({}))) as { error?: { code?: string } }).error?.code;
      setError(
        code === 'email_in_use'
          ? tf(
              '這個信箱已經有帳號了。請改用別的信箱綁定；如果想把這次買的解讀移到那個帳號，請來信 {0}（附上訂單號），我們幫你轉。',
              '这个邮箱已经有账号了。请改用别的邮箱绑定；如果想把这次买的解读移到那个账号，请来信 {0}（附上订单号），我们帮你转。',
              site.supportEmail,
            )
          : code === 'invalid_email'
            ? t('請填寫有效的電子信箱。', '请填写有效的电子邮箱。')
            : code === 'email_rate_limited'
              ? t('寄送太頻繁，請稍後再試。', '发送太频繁，请稍后再试。')
              : code === 'guest_required'
                ? t('訪客身分已過期，請重新整理頁面。', '访客身份已过期，请刷新页面。')
                : t('目前無法寄送驗證碼，請稍後再試。', '暂时无法发送验证码，请稍后再试。'),
      );
    } catch {
      setError(t('連線失敗，請稍後再試。', '连接失败，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await post('/api/auth/guest-verify', { email: email.trim(), code: code.trim() });
      if (res.ok) {
        track('guest_bound');
        setStep('done');
        onBound();
        return;
      }
      setError(t('驗證碼不正確或已過期，請重新取得。', '验证码不正确或已过期，请重新获取。'));
    } catch {
      setError(t('連線失敗，請稍後再試。', '连接失败，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-panel" id="bind" aria-labelledby="account-bind">
      <h2 id="account-bind">{t('綁定信箱，換手機也找得回來', '绑定邮箱，换手机也找得回来')}</h2>
      <p>
        {t(
          '你現在是訪客：買的解讀存在這個瀏覽器的訪客帳號裡。換手機、換瀏覽器或清掉瀏覽器資料，就看不到了。綁定信箱後，用這個信箱登入就能找回全部紀錄。',
          '你现在是访客：买的解读存在这个浏览器的访客账号里。换手机、换浏览器或清除浏览器数据，就看不到了。绑定邮箱后，用这个邮箱登录就能找回全部记录。',
        )}
      </p>
      {step === 'email' && (
        <form className="auth-form" onSubmit={sendCode} noValidate>
          <label htmlFor="bind-email">{t('電子信箱', '电子邮箱')}</label>
          <input
            id="bind-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? t('寄送中…', '发送中…') : t('寄驗證碼', '发送验证码')}
          </button>
        </form>
      )}
      {step === 'code' && (
        <form className="auth-form" onSubmit={verify} noValidate>
          <p>{tf('驗證碼已寄到 {0}。', '验证码已发到 {0}。', email.trim())}</p>
          <label htmlFor="bind-code">{t('六位數驗證碼', '六位数验证码')}</label>
          <input
            id="bind-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <button type="submit" disabled={busy || code.length !== 6}>
            {busy ? t('驗證中…', '验证中…') : t('綁定信箱', '绑定邮箱')}
          </button>
          <button
            type="button"
            className="auth-secondary"
            onClick={() => {
              setStep('email');
              setCode('');
              setError('');
            }}
          >
            {t('換一個信箱', '换一个邮箱')}
          </button>
        </form>
      )}
      {step === 'done' && <p role="status">{t('綁定好了。', '绑定好了。')}</p>}
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </section>
  );
}
