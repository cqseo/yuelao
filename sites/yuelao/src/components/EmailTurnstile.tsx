import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

export function EmailTurnstile({
  siteKey,
  resetSignal,
  onToken,
}: {
  siteKey: string;
  resetSignal: number;
  onToken: (token: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      const api = (window as TurnstileWindow).turnstile;
      if (cancelled || !element.current || !api) return;
      widgetId.current = api.render(element.current, {
        sitekey: siteKey,
        action: 'auth_send',
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };
    script.onerror = () => onToken('');
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      const api = (window as TurnstileWindow).turnstile;
      if (widgetId.current && api) api.remove(widgetId.current);
      widgetId.current = null;
      script.remove();
    };
  }, [siteKey, onToken]);

  useEffect(() => {
    const api = (window as TurnstileWindow).turnstile;
    if (resetSignal > 0 && widgetId.current && api) {
      api.reset(widgetId.current);
      onToken('');
    }
  }, [resetSignal, onToken]);

  return <div ref={element} aria-label="安全驗證" />;
}
