import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { getPublicConfig } from '~/lib/public-config';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: tr('月老 · 登入') }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: Login,
});

const GOOGLE_COPY: Record<string, { login: string; divider: string; failed: string; busy: string }> = {
  'zh-Hant': {
    login: '使用 Google 帳戶繼續',
    divider: '或使用電子信箱登入',
    failed: 'Google 登入未完成，請再試一次或改用電子信箱。',
    busy: '正在前往 Google…',
  },
  'zh-Hans': {
    login: '使用 Google 账号继续',
    divider: '或使用邮箱登录',
    failed: 'Google 登录未完成，请重试或使用邮箱登录。',
    busy: '正在前往 Google…',
  },
  en: {
    login: 'Continue with Google',
    divider: 'Or sign in with email',
    failed: 'Google sign-in did not complete. Try again or use email.',
    busy: 'Opening Google…',
  },
  ja: {
    login: 'Google でログイン',
    divider: 'またはメールでログイン',
    failed: 'Google ログインに失敗しました。再試行するかメールをご利用ください。',
    busy: 'Google に移動しています…',
  },
  ko: {
    login: 'Google로 계속하기',
    divider: '또는 이메일로 로그인',
    failed: 'Google 로그인에 실패했습니다. 다시 시도하거나 이메일을 사용해 주세요.',
    busy: 'Google로 이동 중…',
  },
  th: {
    login: 'ดำเนินการต่อด้วย Google',
    divider: 'หรือเข้าสู่ระบบด้วยอีเมล',
    failed: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ โปรดลองอีกครั้งหรือใช้อีเมล',
    busy: 'กำลังเปิด Google…',
  },
};

function Login() {
  const zh = getLocale() === 'zh-Hans';
  const text = (hant: string, hans: string) => (zh ? hans : tr(hant));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const googleCopy = GOOGLE_COPY[getLocale()] ?? GOOGLE_COPY.en!;

  useEffect(() => {
    if (import.meta.env.VITE_AUTH_ENABLED !== 'true') return;
    let active = true;
    void getPublicConfig()
      .then((config) => {
        if (active) setGoogleEnabled(config.googleAuthEnabled === true);
      })
      .catch(() => {
        if (active) setGoogleEnabled(false);
      });
    const url = new URL(window.location.href);
    if (url.searchParams.get('google') === 'failed') {
      setError((GOOGLE_COPY[getLocale()] ?? GOOGLE_COPY.en!).failed);
      url.searchParams.delete('google');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    return () => { active = false; };
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

  async function startGoogle() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/auth/google/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const payload = (await res.json()) as { url?: string };
      if (!res.ok || !payload.url) throw new Error('google_auth_unavailable');
      const url = new URL(payload.url);
      if (url.protocol !== 'https:' || !url.pathname.endsWith('/auth/v1/authorize')) {
        throw new Error('unexpected_auth_url');
      }
      try { sessionStorage.setItem('yuelao-google-locale', getLocale()); } catch {}
      window.location.assign(url.toString());
    } catch {
      setError(googleCopy.failed);
      setBusy(false);
    }
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
        track('login');
        // 從集市的月老殿過來登入的，登入後回月老殿（固定路徑，不接受外部傳入的網址）。
        let next = localizeHref('/account');
        try {
          if (sessionStorage.getItem('market-lite-tarot-pending') !== null) next = localizeHref('/market?lite=tarot#tarot');
          else if (sessionStorage.getItem('market-pending') !== null) next = localizeHref('/market#yuelao');
          else if (sessionStorage.getItem('market-spread-pending') !== null) next = localizeHref('/market#tarot');
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
        {step === 'email' && googleEnabled && (
          <div className="auth-social">
            <button className="auth-google-button" type="button" disabled={busy} onClick={() => void startGoogle()}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
                <path fill="#4285F4" d="M21.35 12.2c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.5 4.5 0 0 1-1.95 2.95v2.46h3.17c1.86-1.72 2.89-4.25 2.89-7.24z" />
                <path fill="#34A853" d="M12 21.7c2.65 0 4.87-.88 6.49-2.38l-3.17-2.46c-.88.59-2 .94-3.32.94-2.56 0-4.73-1.73-5.51-4.05H3.22v2.53A9.81 9.81 0 0 0 12 21.7z" />
                <path fill="#FBBC05" d="M6.49 13.75a5.89 5.89 0 0 1 0-3.5V7.72H3.22a9.81 9.81 0 0 0 0 8.56z" />
                <path fill="#EA4335" d="M12 6.1c1.44 0 2.73.5 3.75 1.48l2.81-2.81A9.59 9.59 0 0 0 12 2.3a9.81 9.81 0 0 0-8.78 5.42l3.27 2.53C7.27 7.83 9.44 6.1 12 6.1z" />
              </svg>
              <span>{busy ? googleCopy.busy : googleCopy.login}</span>
            </button>
            <p className="auth-social-divider"><span>{googleCopy.divider}</span></p>
          </div>
        )}
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
