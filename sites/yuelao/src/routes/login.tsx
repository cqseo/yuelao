import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { tr } from '~/i18n/ui';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: tr('月老 · 登入') }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: Login,
});

function Login() {
  const zh = getLocale() === 'zh-Hans';
  const text = (hant: string, hans: string) => (zh ? hans : tr(hant));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Public V2 release: free tools are online; email login and paid
  // delivery only appear after live Auth/Stripe/AI integration is verified.
  if (import.meta.env.VITE_AUTH_ENABLED !== 'true') {
    return (
      <section className="auth-page">
        <div className="auth-panel">
          <p className="auth-kicker">{text('月老 · 姻緣簿', '月老 · 姻缘簿')}</p>
          <h1>{text('姻緣簿即將開放', '姻缘簿即将开放')}</h1>
          <p className="auth-intro">
            {text(
              '免費求籤與情感測驗現已開放。帳戶與付費深度解讀仍在安全驗收中，尚未收費。',
              '免费求签与情感测试现已开放。账户与付费深度解读仍在安全验收中，尚未收费。',
            )}
          </p>
          <Link to={localizeHref('/tests')}>{text('前往免費情感測驗', '前往免费情感测试')}</Link>
        </div>
      </section>
    );
  }

  async function callAuth(action: 'send' | 'verify', data: Record<string, string>) {
    const res = await fetch(`/api/auth/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res;
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await callAuth('send', { email: email.trim() });
      if (res.ok) {
        setStep('code');
        setNotice(
          text(
            '驗證碼已寄出。請檢查收件匣與垃圾郵件資料夾。',
            '验证码已发送。请检查收件箱与垃圾邮件文件夹。',
          ),
        );
      } else if (res.status === 429) {
        setError(text('寄送太頻繁，請稍後再試。', '发送太频繁，请稍后再试。'));
      } else if (res.status === 400) {
        setError(text('請填寫有效的電子信箱。', '请填写有效的电子邮箱。'));
      } else {
        setError(text('目前無法寄送驗證碼，請稍後再試。', '暂时无法发送验证码，请稍后再试。'));
      }
    } catch {
      setError(text('連線失敗，請稍後再試。', '连接失败，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await callAuth('verify', { email: email.trim(), code: code.trim() });
      if (res.ok) {
        // 從集市的月老殿過來登入的，登入後回月老殿（固定路徑，不接受外部傳入的網址）。
        let next = localizeHref('/account');
        try {
          if (sessionStorage.getItem('market-pending') !== null) next = localizeHref('/market#yuelao');
          else if (sessionStorage.getItem('market-back') !== null) next = localizeHref('/market');
        } catch {}
        window.location.assign(next);
        return;
      }
      setError(
        res.status === 401
          ? text('驗證碼不正確或已過期，請重新取得。', '验证码不正确或已过期，请重新获取。')
          : text('驗證失敗，請稍後再試。', '验证失败，请稍后再试。'),
      );
    } catch {
      setError(text('連線失敗，請稍後再試。', '连接失败，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="auth-kicker">{text('月老 · 姻緣簿', '月老 · 姻缘簿')}</p>
        <h1>{text('登入，保存你的心事', '登录，保存你的心事')}</h1>
        <p className="auth-intro">
          {text(
            '使用信箱收取六位數驗證碼。無需密碼，你的訂單和已購權益只會顯示在自己的帳戶。',
            '使用邮箱接收六位验证码。无需密码，你的订单和已购权益只会显示在自己的账户。',
          )}
        </p>
        {step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="auth-form"
          >
            <label htmlFor="login-email">{text('電子信箱', '电子邮箱')}</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={busy}>
              {busy ? text('寄送中…', '发送中…') : text('取得驗證碼', '获取验证码')}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="auth-form"
          >
            <p className="auth-current-email">{email.trim()}</p>
            <label htmlFor="login-code">{text('六位數驗證碼', '六位数验证码')}</label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button type="submit" disabled={busy || code.length !== 6}>
              {busy ? text('驗證中…', '验证中…') : text('驗證並登入', '验证并登录')}
            </button>
            <button
              className="auth-text-button"
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
                setNotice('');
              }}
            >
              {text('更換信箱／重新寄送', '更换邮箱／重新发送')}
            </button>
          </form>
        )}
        {notice && (
          <p role="status" className="auth-notice">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        <p className="auth-footnote">
          {text('登入代表你同意本站的', '登录代表你同意本站的')}
          <Link to={localizeHref('/terms')}>{text('使用條款', '使用条款')}</Link>
          {text('與', '与')}
          <Link to={localizeHref('/privacy')}>{text('隱私政策', '隐私政策')}</Link>
          {text('。驗證碼由認證服務商寄送。', '。验证码由认证服务商发送。')}
        </p>
      </div>
    </section>
  );
}
