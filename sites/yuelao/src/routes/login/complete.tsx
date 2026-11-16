import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/login/complete')({
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  component: GoogleLoginComplete,
});

function GoogleLoginComplete() {
  useEffect(() => {
    let prefix = '';
    let target = '/account';
    try {
      // Only fixed language prefixes and first-party destinations are allowed.
      const locale = sessionStorage.getItem('yuelao-google-locale');
      sessionStorage.removeItem('yuelao-google-locale');
      if (locale && ['en', 'ja', 'th', 'ko'].includes(locale)) prefix = `/${locale}`;
      if (sessionStorage.getItem('market-pending') !== null) target = '/market#yuelao';
      else if (sessionStorage.getItem('market-back') !== null) target = '/market';
    } catch {
      // If sessionStorage is blocked, the account page remains a safe fallback.
    }
    window.location.replace(prefix + target);
  }, []);

  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p role="status" className="auth-intro">Signing in… / 登入中…</p>
      </div>
    </section>
  );
}
