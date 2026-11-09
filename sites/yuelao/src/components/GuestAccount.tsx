import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { EmailTurnstile } from './EmailTurnstile';

type GuestStatus = {
  enabled?: boolean;
  kind?: 'none' | 'guest' | 'member' | 'disabled' | 'stale';
  displayId?: string;
  email?: string | null;
};

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

async function requestJson(path: string, payload: Record<string, string>) {
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
}

export function GuestAccount() {
  const simplified = getLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (simplified ? hans : hant);
  const [phase, setPhase] = useState<'loading' | 'captcha' | 'guest' | 'sent' | 'member' | 'stale' | 'error'>(
    'loading',
  );
  const [displayId, setDisplayId] = useState('');
  const [guestToken, setGuestToken] = useState('');
  const [linkToken, setLinkToken] = useState('');
  const [guestReset, setGuestReset] = useState(0);
  const [linkReset, setLinkReset] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  const guestCreationPending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch('/api/auth/guest/status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('status_failed');
        const result = (await response.json()) as GuestStatus;
        if (!alive) return;
        if (!result.enabled || !turnstileSiteKey) {
          setPhase('error');
        } else if (result.kind === 'guest' && result.displayId) {
          setDisplayId(result.displayId);
          setPhase('guest');
        } else if (result.kind === 'member') {
          setPhase('member');
        } else if (result.kind === 'stale') {
          setPhase('stale');
        } else {
          setPhase('captcha');
        }
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'captcha' || !guestToken || guestCreationPending.current) return;
    guestCreationPending.current = true;
    setBusy(true);
    void (async () => {
      try {
        const response = await requestJson('/api/auth/guest', { captchaToken: guestToken });
        const result = (await response.json()) as GuestStatus;
        if (!mounted.current) return;
        if (response.ok && result.kind === 'guest' && result.displayId) {
          setDisplayId(result.displayId);
          setMessage('');
          setPhase('guest');
          return;
        }
        if (response.ok && result.kind === 'member') {
          setPhase('member');
          return;
        }
        setMessage(
          simplified
            ? '暂时无法创建游客身份，请稍后重试；免费内容仍可使用。'
            : '暫時無法建立訪客身份，請稍後再試；免費內容仍可使用。',
        );
      } catch {
        if (mounted.current) {
          setMessage(simplified ? '连接失败，请稍后重试。' : '連線失敗，請稍後重試。');
        }
      } finally {
        guestCreationPending.current = false;
        if (mounted.current) {
          setGuestToken('');
          setGuestReset((value) => value + 1);
          setBusy(false);
        }
      }
    })();
  }, [guestToken, phase, simplified]);

  async function sendLink() {
    if (busy || !linkToken || !email.includes('@')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await requestJson('/api/auth/guest/link', {
        email: email.trim(),
        captchaToken: linkToken,
      });
      if (!response.ok) throw new Error('email_link_unavailable');
      setPhase('sent');
      setMessage(t('驗證碼已寄送，請檢查郵箱。', '验证码已发送，请检查邮箱。'));
    } catch {
      setMessage(
        t(
          '暫時無法寄送驗證碼，請檢查郵箱或稍後重試。',
          '暂时无法发送验证码，请检查邮箱或稍后重试。',
        ),
      );
    } finally {
      setBusy(false);
      setLinkToken('');
      setLinkReset((value) => value + 1);
    }
  }

  async function confirmLink() {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await requestJson('/api/auth/guest/verify', {
        email: email.trim(),
        code,
      });
      if (!response.ok) throw new Error('verification_failed');
      const result = (await response.json()) as GuestStatus & { linked?: boolean };
      if (!result.linked || result.kind !== 'member' || result.displayId !== displayId) {
        throw new Error('account_identity_mismatch');
      }
      window.location.assign(localizeHref('/account'));
    } catch {
      setMessage(t('驗證碼無效、過期，或帳號綁定未完成。', '验证码无效、过期，或账号绑定未完成。'));
      setBusy(false);
    }
  }

  return (
    <section className="account-card guest-account" aria-labelledby="guest-title">
      <p className="auth-kicker">{t('月老 · 姻緣簿', '月老 · 姻缘簿')}</p>
      <h2 id="guest-title">{t('我的訪客身份', '我的游客身份')}</h2>
      {phase === 'loading' && <p role="status">{t('正在確認身份…', '正在确认身份…')}</p>}
      {phase === 'error' && (
        <p role="status">
          {t(
            '訪客帳戶尚未開放，免費求籤和每日心箋可直接使用。',
            '游客账户尚未开放，免费求签和每日心笺可直接使用。',
          )}
        </p>
      )}
      {phase === 'stale' && (
        <p role="alert" className="guest-warning">
          {t(
            '這個訪客身份目前無法恢復。請勿反覆建立新帳號；若先前已綁定郵箱，請使用郵箱登入。',
            '这个游客身份目前无法恢复。请勿反复创建新账号；如果已经绑定邮箱，请用邮箱登录。',
          )}
          {' '}
          <Link to={localizeHref('/login')}>{t('使用郵箱登入', '使用邮箱登录')}</Link>
        </p>
      )}
      {phase === 'captcha' && (
        <>
          <p>{t('正在建立訪客身份，不需填寫郵箱。', '正在创建游客身份，无需填写邮箱。')}</p>
          <p className="guest-warning">
            {t(
              '未綁定郵箱前，清除網站資料或更換設備可能失去記錄。',
              '未绑定邮箱前，清除网站数据或更换设备可能丢失记录。',
            )}
          </p>
          <EmailTurnstile
            siteKey={turnstileSiteKey}
            resetSignal={guestReset}
            onToken={setGuestToken}
            action="guest_create"
          />
          {busy && <p role="status">{t('正在建立…', '正在创建…')}</p>}
        </>
      )}
      {(phase === 'guest' || phase === 'sent') && (
        <>
          <p>
            {t('訪客號碼', '游客编号')}：<strong>{displayId}</strong>
          </p>
          <p className="guest-warning">
            {t(
              '這是展示編號，不是找回帳號的密碼。未綁定郵箱前，清除瀏覽器資料可能無法找回。',
              '这是展示编号，不是找回账号的密码。未绑定邮箱前，清除浏览器数据可能无法找回。',
            )}
          </p>
          {phase === 'guest' ? (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendLink();
              }}
            >
              <h3>{t('綁定郵箱，保留這個帳號', '绑定邮箱，保留这个账号')}</h3>
              <label htmlFor="guest-email">{t('電子郵箱', '电子邮箱')}</label>
              <input
                id="guest-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <EmailTurnstile
                siteKey={turnstileSiteKey}
                resetSignal={linkReset}
                onToken={setLinkToken}
                action="email_link"
              />
              <button type="submit" disabled={busy || !linkToken || !email.includes('@')}>
                {t('寄送綁定驗證碼', '发送绑定验证码')}
              </button>
            </form>
          ) : (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmLink();
              }}
            >
              <p>{email}</p>
              <label htmlFor="guest-code">{t('六位數驗證碼', '六位数验证码')}</label>
              <input
                id="guest-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button type="submit" disabled={busy || code.length !== 6}>
                {t('驗證並保留原帳號', '验证并保留原账号')}
              </button>
              <button type="button" className="auth-text-button" onClick={() => setPhase('guest')}>
                {t('更換郵箱／重新寄送', '更换邮箱／重新发送')}
              </button>
            </form>
          )}
        </>
      )}
      {phase === 'member' && (
        <p>
          <Link to={localizeHref('/login')}>{t('已有郵箱帳號，請登入', '已有邮箱账号，请登录')}</Link>
        </p>
      )}
      {message && <p role="status" className="auth-notice">{message}</p>}
      <p>
        <Link to={localizeHref('/daily')}>{t('先看每日心箋', '先看每日心笺')}</Link>
        {' · '}
        <Link to={localizeHref('/ritual')}>{t('免費求籤', '免费求签')}</Link>
      </p>
    </section>
  );
}
