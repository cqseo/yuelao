import { useEffect, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { tr } from '~/i18n/ui';
import { isGuest } from '~/lib/guest';
import { localizeHref } from '~/paraglide/runtime.js';

/** 訪客買完、讀到解讀時的一行提醒：綁信箱，換手機也找得回來。正式帳號不顯示。 */
export function GuestBindHint() {
  const [guest, setGuest] = useState(false);
  useEffect(() => setGuest(isGuest()), []);
  if (!guest) return null;
  const zh = contentLocale() === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : tr(hant));
  return (
    <p className="guest-bind-hint">
      {t(
        '你現在是訪客身分。綁定信箱後，換手機或清掉瀏覽器資料也找得回來。',
        '你现在是访客身份。绑定邮箱后，换手机或清除浏览器数据也找得回来。',
      )}{' '}
      <a href={localizeHref('/account#bind')}>{t('綁定信箱保存', '绑定邮箱保存')}</a>
    </p>
  );
}
