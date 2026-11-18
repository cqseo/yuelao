import { useEffect, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { tr, trf } from '~/i18n/ui';
import { track } from '~/lib/track';
import { localizeHref } from '~/paraglide/runtime.js';

// 「我的」頁面上方：最近一份付費解籤還能追問時，提醒一句（站長 2026-11-18：
// 第一位真實顧客付完、綁完信箱就停在這頁，沒看到追問）。查不到或不能追問就什麼都不顯示。

type Unlock = { stick_id: number; category: string; locale: string; revoked: boolean };

export function FollowUpHint({ unlocks }: { unlocks: Unlock[] }) {
  const zh = contentLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : tr(hant));
  const latest = unlocks.find((u) => !u.revoked);
  const [show, setShow] = useState(false);
  const query = latest
    ? new URLSearchParams({
        stickId: String(latest.stick_id),
        category: latest.category,
        locale: latest.locale,
      }).toString()
    : '';

  useEffect(() => {
    if (!query) return;
    let active = true;
    fetch(`/api/account/followups?${query}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) return;
        const s = (await r.json()) as {
          enabled?: boolean;
          readingReady?: boolean;
          open?: number;
          remaining?: number;
        };
        if (active && s.enabled && s.readingReady && ((s.open ?? 0) > 0 || (s.remaining ?? 0) > 0))
          setShow(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [query]);

  if (!show || !latest) return null;
  const no = String(latest.stick_id);
  return (
    <section className="account-panel followup-hint" aria-labelledby="followup-hint-title">
      <h2 id="followup-hint-title">{t('還想問月老一句？', '还想问月老一句？')}</h2>
      <p>
        {zh
          ? `就你最近求的第 ${no} 签，读完还有放不下的地方，可以再追问月老。`
          : trf('就你最近求的第 {0} 籤，讀完還有放不下的地方，可以再追問月老。', no)}
      </p>
      <a
        className="followup-hint-link"
        href={localizeHref(`/account/reading?${query}#followup`)}
        onClick={() => track('followup_hint_click')}
      >
        {t('去追問', '去追问')}
      </a>
    </section>
  );
}
