import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { EmailTurnstile } from '~/components/EmailTurnstile';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';

const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: '月老 · 登入' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: Login,
});

function Login() {
  const zh = getLocale() === 'zh-Hans';
  const text = (hant: string, hans: string) => (zh ? hans : hant);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasGuestSession, setHasGuestSession] = useState(false);
  const [hasMemberSession, setHasMemberSession] = useState(false);
  const [staleSession, setStaleSession] = useState(false);
  const [guestCheckPending, setGuestCheckPending] = useState(
    import.meta.env.VITE_GUEST_AUTH_ENABLED === 'true',
  );

  useEffect(() => {
    if (import.meta.env.VITE_GUEST_AUTH_ENABLED !== 'true') return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/auth/guest/status', { credentials: 'same-origin', cache: 'no-store' });
        if (res.ok) {
          const body = (await res.json()) as { kind?: string };
          if (alive) {
            setHasGuestSession(body.kind === 'guest');
            setHasMemberSession(body.kind === 'member');
            setStaleSession(body.kind === 'stale');
          }
        }
      } finally {
        if (alive) setGuestCheckPending(false);
      }
    })().catch(() => {
      if (alive) setGuestCheckPending(false);
    });
    return () => {
      alive = false;
    };
  }, []);

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
          <p className="auth-disabled-note">
            {text('登入及訂單功能驗收完成後將在這裡開放。', '登录及订单功能验收完成后将在这里开放。')}
          </p>
          <Link className="auth-return-link" to={localizeHref('/tests')}>
            {text('先體驗免費情感測驗', '先体验免费情感测试')}
          </Link>
        </div>
      </section>
    );
  }

  if (guestCheckPending) {
    return <section className="auth-page"><div className="auth-panel">
      <p role="status">{text('正在確認訪客身份…', '正在确认游客身份…')}</p>
    </div></section>;
  }

  if (hasGuestSession) {
    return <section className="auth-page"><div className="auth-panel">
      <p className="auth-kicker">{text('月老 · 姻緣簿', '月老 · 姻缘簿')}</p>
      <h1>{text('保留你的訪客帳號', '保留你的游客账号')}</h1>
      <p className="auth-intro">{text(
        '你已有訪客身份。請在「我的」頁面綁定郵箱，保留原帳號與記錄，避免另建帳號。',
        '你已有游客身份。请在「我的」页面绑定邮箱，保留原账号与记录，避免创建第二个账号。',
      )}</p>
      <Link className="auth-return-link" to={localizeHref('/account')}>
        {text('前往我的姻緣簿', '前往我的姻缘簿')}
      </Link>
    </div></section>;
  }

  if (hasMemberSession) {
    return (
      <section className="auth-page">
        <div className="auth-panel">
          <h1>{text('你已登入', '你已登录')}</h1>
          <Link className="auth-return-link" to={localizeHref('/account')}>
            {text('返回我的姻緣簿', '返回我的姻缘簿')}
          </Link>
        </div>
      </section>
    );
  }

  if (staleSession) {
    return (
      <section className="auth-page">
        <div className="auth-panel">
          <h1>{text('舊訪客身份需要處理', '旧游客身份需要处理')}</h1>
          <p className="auth-intro">
            {text(
              '無法恢復先前的登入狀態。若該訪客尚未綁定郵箱，清除憑證後可能無法找回記錄。確認已綁定郵箱，或了解風險後才繼續。',
              '无法恢复之前的登录状态。如果游客尚未绑定邮箱，清除凭证后可能无法找回记录。请确认已绑定邮箱，或了解风险后再继续。',
            )}
          </p>
          <button type="button" className="auth-return-link" onClick={() => void resetStaleSession()} disabled={busy}>
            {text('清除舊憑證，改用郵箱登入', '清除旧凭证，改用邮箱登录')}
          </button>
          {error && <p role="alert" className="auth-error">{error}</p>}
        </div>
      </section>
    );
  }

  async function resetStaleSession() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('logout_failed');
      window.location.assign(localizeHref('/login'));
    } catch {
      setError(text('無法清除已失效的登入狀態，請稍後重試。', '无法清除失效的登录状态，请稍后重试。'));
      setBusy(false);
    }
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
    if (busy || !captchaToken) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await callAuth('send', { email: email.trim(), captchaToken });
      if (res.ok) {
        setStep('code');
        setNotice(
          text(
            '驗證碼已寄出。請檢查收件匣與垃圾郵件資料夾。',
            '验证码已发送。请检查收件箱与垃圾邮件文件夹。',
          ),
        );
      } else if (res.status === 409) {
        const payload = (await res.json()) as { error?: { code?: string } };
        if (payload.error?.code === 'guest_must_link_email') setHasGuestSession(true);
        else if (payload.error?.code === 'already_authenticated') setHasMemberSession(true);
        else setStaleSession(true);
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
      setCaptchaToken('');
      setCaptchaReset((value) => value + 1);
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
        window.location.assign(localizeHref('/account'));
        return;
      }
      if (res.status === 409) {
        const payload = (await res.json()) as { error?: { code?: string } };
        if (payload.error?.code === 'guest_must_link_email') setHasGuestSession(true);
        else if (payload.error?.code === 'already_authenticated') setHasMemberSession(true);
        else setStaleSession(true);
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
        <h1>{text('登入，查看我的姻緣簿', '登录，查看我的姻缘簿')}</h1>
        <p className="auth-intro">
          {text(
            '使用信箱收取六位數驗證碼。無需密碼，你的訂單和已購權益只會顯示在自己的帳戶。',
            '使用邮箱接收六位验证码。无需密码，你的订单和已购权益只会显示在自己的账户。',
          )}
        </p>
        <div className="auth-account-preview">
          <span>{text('已解鎖籤文', '已解锁签文')}</span>
          <span>{text('問事包餘額', '问事包余额')}</span>
          <span>{text('訂單紀錄', '订单记录')}</span>
        </div>
        <div className="auth-steps">
          <span aria-current={step === 'email' ? 'step' : undefined}>
            <b>01</b> {text('輸入信箱', '输入邮箱')}
          </span>
          <span aria-hidden="true" className="auth-step-divider" />
          <span aria-current={step === 'code' ? 'step' : undefined}>
            <b>02</b> {text('輸入驗證碼', '输入验证码')}
          </span>
        </div>
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
            {captchaSiteKey ? (
              <EmailTurnstile siteKey={captchaSiteKey} resetSignal={captchaReset} onToken={setCaptchaToken} />
            ) : (
              <p role="status" className="auth-notice">
                {text('安全驗證尚未配置，暫時無法寄送驗證碼。', '安全验证尚未配置，暂时无法发送验证码。')}
              </p>
            )}
            <button type="submit" disabled={busy || !captchaToken}>
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
        <p className="auth-back">
          <Link to={localizeHref('/tests')}>
            {text('暫不登入，先體驗免費測驗', '暂不登录，先体验免费测验')}
          </Link>
        </p>
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
