import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { useEffect, useState } from 'react';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import {
  checkedInToday,
  checkIn,
  DAILY_FOCI,
  type DailyFocus,
  type DailyRecord,
  dailyReading,
  emptyDailyRecord,
  localDayKey,
  sanitizeDailyRecord,
} from '~/site/daily';
import site from '../../site.config';

export const Route = createFileRoute('/daily')({
  head: () =>
    pageHead(site, {
      title: '月老每日運勢與簽到｜每日心箋 · 免費',
      description:
        '每天來月老領一封心箋，免費簽到記錄一點點溫柔；選擇緣分、溝通、心境或行動，收下今天的自我反思指引。',
      path: localizeHref('/daily', { locale: getLocale() }),
    }),
  component: DailyPage,
});

const STORAGE_KEY = 'yuelao:daily:v1';
const FOCI: DailyFocus[] = ['connection', 'communication', 'self', 'courage'];
const STAMP_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function DailyPage() {
  const locale = getLocale();
  const zh = locale === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : hant);
  const [today, setToday] = useState('');
  const [focus, setFocus] = useState<DailyFocus>('connection');
  const [record, setRecord] = useState<DailyRecord>(emptyDailyRecord);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const day = localDayKey(new Date());
    setToday(day);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const previous = sanitizeDailyRecord(JSON.parse(raw));
        setRecord(previous);
        setSaved(previous.lastDate === day);
      }
    } catch {
      // Private / quota-limited browsers still get today's local daily card.
    }
    setReady(true);
  }, []);

  const done = Boolean(today && checkedInToday(record, today));
  const reading = today ? dailyReading(today, focus, locale) : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const currentStreak = done ? record.streak : record.lastDate === localDayKey(yesterday) ? record.streak : 0;

  function signToday() {
    const key = localDayKey(new Date());
    setToday(key);
    const next = checkIn(record, key);
    setRecord(next);
    setSaved(next.lastDate === key);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setSaved(false);
    }
  }

  return (
    <article className="serene-page daily-page">
      <header className="daily-heading">
        <span className="serene-eyebrow">{t('月下日曆', '月下日历')}</span>
        <h1>{t('每日，與心相見。', '每日，与心相见。')}</h1>
        <p>{t('不問明天一定如何，只陪你把今天過得更清楚。', '不问明天一定如何，只陪你把今天过得更清楚。')}</p>
      </header>

      <div className="daily-grid">
        <section className="daily-letter" aria-labelledby="daily-letter-title">
          <div className="daily-letter-top">
            <span>{t('月老 · 今日心箋', '月老 · 今日心笺')}</span>
            <time dateTime={today}>{today || '···· ·· ··'}</time>
          </div>
          <div className="daily-letter-main">
            <div className="daily-thread" aria-hidden="true">
              <span>緣</span>
            </div>
            <span className="serene-eyebrow">{t('今日想照顧的是', '今天想照顾的是')}</span>
            <div className="daily-focus-options">
              {FOCI.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={focus === key ? 'selected' : ''}
                  aria-pressed={focus === key}
                  onClick={() => setFocus(key)}
                >
                  {DAILY_FOCI[key].label[locale]}
                </button>
              ))}
            </div>

            {reading ? (
              <div className="daily-reading" id="daily-letter-title" aria-live="polite">
                <span className="daily-reading-focus">
                  {t('今日心語', '今日心语')} / {reading.focus}
                </span>
                <h2>{reading.name}</h2>
                <blockquote>{reading.verse}</blockquote>
                <p>{reading.insight}</p>
                <div className="daily-one-step">
                  <span>{t('今天可以做的一件小事', '今天可以做的一件小事')}</span>
                  <strong>{reading.action}</strong>
                </div>
              </div>
            ) : (
              <p role="status" className="daily-loading">
                {t('正在翻開今天的心箋…', '正在翻开今天的心笺…')}
              </p>
            )}
          </div>
          <footer className="daily-letter-footer">
            <span>{t('一頁心情提示，不是命運預測。', '一页心情提示，不是命运预测。')}</span>
            <Link to={localizeHref('/chat')}>
              {t('想多說幾句？與月老聊聊 →', '想多说几句？与月老聊聊 →')}
            </Link>
          </footer>
        </section>

        <aside className="daily-checkin" aria-labelledby="checkin-title">
          <span className="serene-eyebrow">{t('有時候，陪伴是一種習慣', '有时候，陪伴是一种习惯')}</span>
          <h2 id="checkin-title">{t('每日簽到', '每日签到')}</h2>
          <p>{t('一天來一次，留下一點點認真生活的痕跡。', '一天来一次，留下一点点认真生活的痕迹。')}</p>

          <div className="daily-streak-number" aria-live="polite">
            <strong>{ready ? currentStreak : '—'}</strong>
            <span>{t('連續日', '连续天')}</span>
          </div>

          <ol className="daily-stamps" aria-label={t('七日簽到進度', '七日签到进度')}>
            {STAMP_DAYS.map((day) => (
              <li className={day <= Math.min(currentStreak, 7) ? 'filled' : ''} key={day}>
                <span>{day}</span>
                <small>{t('日', '日')}</small>
              </li>
            ))}
          </ol>

          <button
            className="daily-checkin-button"
            type="button"
            onClick={signToday}
            disabled={!ready || done}
          >
            {done ? t('今日已簽到 ✓', '今日已签到 ✓') : t('收下今日心意 · 簽到', '收下今日心意 · 签到')}
          </button>
          {done && (
            <p className="daily-confirmation" role="status">
              {saved
                ? t('今日已記錄。明天再來，紅線又多一寸。', '今日已记录。明天再来，红线又多一寸。')
                : t('已完成今日簽到；瀏覽器暫未允許保存紀錄。', '已完成今日签到；浏览器暂未允许保存记录。')}
            </p>
          )}
          <p className="daily-privacy">
            {t(
              '目前是免費的瀏覽器本機簽到，不計入充值餘額，也不跨設備同步。清除網站資料會失去紀錄。',
              '目前是免费的浏览器本地签到，不计入充值余额，也不跨设备同步。清除网站数据会失去记录。',
            )}
          </p>
          <div className="daily-side-ornament" aria-hidden="true">
            月 下 有 約
          </div>
        </aside>
      </div>

      <section className="daily-after">
        <span className="serene-eyebrow">{t('讓今天再多一點溫柔', '让今天再多一点温柔')}</span>
        <h2>{t('有心事，還可以慢慢說。', '有心事，还可以慢慢说。')}</h2>
        <div>
          <Link to={localizeHref('/chat')}>
            {t('與月老聊聊', '与月老聊聊')} <span>↗</span>
          </Link>
          <Link to={localizeHref('/ritual')}>
            {t('免費求一支籤', '免费求一支签')} <span>↗</span>
          </Link>
          <Link to={localizeHref('/tests')}>
            {t('做一個情感測驗', '做一个情感测试')} <span>↗</span>
          </Link>
        </div>
      </section>
    </article>
  );
}
