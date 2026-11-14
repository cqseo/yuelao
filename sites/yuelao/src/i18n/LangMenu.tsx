import { useEffect, useRef } from 'react';
import { getLocale } from '~/paraglide/runtime.js';
import { isZh, LANGS, switchLocale } from './locale';
import { tr } from './ui';
import './lang-menu.css';

// 語言選單（照站長給的樣式）：第一列「中」，右邊繁／簡二選一；下面 EN、日本語、ไทย、한국어。
// 按鈕只顯示目前語言（中／EN／日本語…），點開才看到全部，頂欄不會被擠滿。DESIGN.md「語言選單」。
export function LangMenu({ className = '' }: { className?: string }) {
  const locale = getLocale();
  const ref = useRef<HTMLDetailsElement>(null);
  const current = isZh(locale) ? '中' : (LANGS.find((l) => l.id === locale)?.label ?? 'EN');

  // 點選單外面就收起來
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return (
    <details className={`lang-menu ${className}`} ref={ref}>
      <summary aria-label="Language / 語言">
        <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        <span>{current}</span>
      </summary>
      <div className="lang-menu-list" role="menu">
        <div className="lang-menu-row" aria-current={isZh(locale) ? 'true' : undefined}>
          <span className="lang-menu-zh" lang="zh">
            中
          </span>
          <span className="lang-menu-script">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={locale === 'zh-Hant'}
              lang="zh-Hant"
              onClick={() => switchLocale('zh-Hant')}
            >
              繁
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={locale === 'zh-Hans'}
              lang="zh-Hans"
              onClick={() => switchLocale('zh-Hans')}
            >
              簡
            </button>
          </span>
        </div>
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="menuitemradio"
            aria-checked={locale === l.id}
            className="lang-menu-row"
            lang={l.id}
            onClick={() => switchLocale(l.id)}
          >
            {l.label}
          </button>
        ))}
        {!isZh(locale) && (
          <p className="lang-menu-note">{tr('機器翻譯初稿，審核中。籤詩與牌義暫為中文。')}</p>
        )}
      </div>
    </details>
  );
}
