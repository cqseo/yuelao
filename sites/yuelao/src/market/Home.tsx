import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { LangMenu } from '~/i18n/LangMenu';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { SUPPORT_EMAIL } from '~/site/legal';
import site from '../../site.config';
import './home.css';

// 首頁（整頁重做，2026-11-12）：月下集市的門面。自帶頂欄與頁腳，不掛舊的站點外殼。
// 這裡只有圖和連結，3D 在 /market 才載入，所以首頁仍然打開就能用（鐵律：首屏零等待）。

export const FAQS = [
  { q: () => m.home_faq_q1(), a: () => m.home_faq_a1() },
  { q: () => m.home_faq_q2(), a: () => m.home_faq_a2() },
  { q: () => m.home_faq_q3(), a: () => m.home_faq_a3() },
  { q: () => m.home_faq_q4(), a: () => m.home_faq_a4() },
  { q: () => m.home_faq_q5(), a: () => m.home_faq_a5() },
  { q: () => m.home_faq_q6(), a: () => m.home_faq_a6() },
];

const NAV = [
  { to: '/market#enter', label: () => m.home_market_nav_market(), hard: true },
  // 求籤只在 3D 月老殿裡。首頁與導覽可透過 #yuelao 直接開殿。
  { to: '/market#yuelao', label: () => m.home_market_nav_ritual(), hard: true },
  { to: '/market#sutra', label: () => m.home_market_nav_daily(), hard: true },
  { to: '/tests', label: () => m.home_market_nav_tests() },
];

const ROOMS = [
  {
    img: '/market/yuelao.jpg',
    name: () => m.home_market_room_yuelao(),
    desc: () => m.home_market_room_yuelao_desc(),
    hash: 'yuelao',
  },
  {
    img: '/market/tarot.jpg',
    name: () => m.home_market_room_tarot(),
    desc: () => m.home_market_room_tarot_desc(),
    hash: 'tarot',
  },
  {
    img: '/market/hall.jpg',
    name: () => m.home_market_room_hall(),
    desc: () => m.home_market_room_hall_desc(),
    hash: 'hall',
  },
  {
    img: '/market/wish.jpg',
    name: () => m.home_market_room_wish(),
    desc: () => m.home_market_room_wish_desc(),
    hash: 'wish',
  },
];

const STEPS = [
  { title: () => m.home_market_how_1(), desc: () => m.home_market_how_1_desc() },
  { title: () => m.home_market_how_2(), desc: () => m.home_market_how_2_desc() },
  { title: () => m.home_market_how_3(), desc: () => m.home_market_how_3_desc() },
];

const INDEX_COPY: Record<string, { name: string; desc: string }> = {
  'zh-Hant': { name: '百籤總覽', desc: '從第一籤到第一百籤，查原文、吉凶與解說。' },
  'zh-Hans': { name: '百签总览', desc: '从第一签到第一百签，查看签诗、吉凶与解说。' },
  en: { name: 'All 100 oracle sticks', desc: 'Browse each verse, grade and relationship interpretation.' },
  ja: { name: '全100首のおみくじ', desc: '原文と吉凶・恋愛の解説を読む。' },
};
const indexCopy = () => INDEX_COPY[getLocale()] ?? INDEX_COPY.en!;

const WAYS = [
  { to: '/signs', hard: false, name: () => indexCopy().name, desc: () => indexCopy().desc },
  { to: '/market#yuelao', hard: true, name: () => m.home_market_way_ritual(), desc: () => m.home_market_way_ritual_desc() },
  { to: '/daily', hard: false, name: () => m.home_market_way_daily(), desc: () => m.home_market_way_daily_desc() },
  { to: '/tests', hard: false, name: () => m.home_market_way_tests(), desc: () => m.home_market_way_tests_desc() },
];

export function Home() {
  const navigate = useNavigate();
  const [no, setNo] = useState('');
  const [bad, setBad] = useState(false);

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(no, 10);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setBad(true);
      return;
    }
    setBad(false);
    void navigate({ to: localizeHref(`/sign/${n}`) });
  };

  return (
    <div className="mh">
      <header className="mh-top">
        <Link to="/" className="mh-brand">
          {tr(site.name)}
        </Link>
        <nav className="mh-nav" aria-label={m.home_market_nav_label()}>
          {NAV.map((n) =>
            n.hard ? (
              <a key={n.to} href={localizeHref(n.to)}>
                {n.label()}
              </a>
            ) : (
              <Link key={n.to} to={localizeHref(n.to)}>
                {n.label()}
              </Link>
            ),
          )}
          {import.meta.env.VITE_AUTH_ENABLED === 'true' && (
            <Link to={localizeHref('/account')}>{m.home_market_nav_account()}</Link>
          )}
        </nav>
        <LangMenu className="mh-lang" />
      </header>

      <main>
        <section className="mh-hero" aria-labelledby="mh-title">
          <img className="mh-hero-img" src="/market/plaza.jpg" alt="" fetchPriority="high" />
          <div className="mh-hero-copy">
            <h1 id="mh-title">{m.home_market_title()}<span className="mh-title-seo">{m.home_title()}</span></h1>
            <p className="mh-lead">{m.home_market_lead()}</p>
            <div className="mh-actions">
              <a
                className="mh-enter"
                href={localizeHref('/market#enter')}
                data-rybbit-event="home_market_enter"
                onClick={() => track('home_market_enter_click', { destination: 'market' })}
              >
                {m.home_market_enter()}
              </a>
              <a className="mh-plain" href={localizeHref('/market#yuelao')} data-rybbit-event="home_market_yuelao_direct" onClick={() => track('home_yuelao_click', { destination: 'market_yuelao' })}>
                {m.home_market_plain()}
              </a>
            </div>
            <p className="mh-note">{m.home_market_note()}</p>
          </div>
        </section>

        <section className="mh-sec" aria-labelledby="mh-rooms">
          <h2 id="mh-rooms">{m.home_market_rooms()}</h2>
          <ul className="mh-rooms">
            {ROOMS.map((r) => (
              <li key={r.img}>
                <img src={r.img} alt="" loading="lazy" width={900} height={675} />
                <h3>{r.name()}</h3>
                <p>{r.desc()}</p>
                {r.hash ? (
                  <a
                    href={localizeHref(`/market#${r.hash}`)}
                    data-rybbit-event={`home_market_room_${r.hash}`} onClick={() => track('home_room_click', { room: r.hash })}
                  >
                    {m.home_market_room_go()}
                  </a>
                ) : (
                  <span>{m.home_market_room_soon()}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mh-sec" aria-labelledby="mh-how">
          <h2 id="mh-how">{m.home_market_how_title()}</h2>
          <ol className="mh-steps">
            {STEPS.map((s) => (
              <li key={s.title()}>
                <h3>{s.title()}</h3>
                <p>{s.desc()}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mh-sec" aria-labelledby="mh-other">
          <h2 id="mh-other">{m.home_market_other_title()}</h2>
          <ul className="mh-ways">
            {WAYS.map((w) => (
              <li key={w.to}>
                {w.hard ? (
                  <a href={localizeHref(w.to)}>
                    <b>{w.name()}</b>
                    <span>{w.desc()}</span>
                  </a>
                ) : (
                  <Link to={localizeHref(w.to)}>
                    <b>{w.name()}</b>
                    <span>{w.desc()}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <form className="mh-lookup" onSubmit={lookup} noValidate>
            <label htmlFor="mh-no">{m.home_direct_title()}</label>
            <p>{m.home_direct_hint()}</p>
            <div>
              <input
                id="mh-no"
                inputMode="numeric"
                maxLength={3}
                value={no}
                onChange={(e) => setNo(e.target.value)}
                placeholder={m.home_direct_placeholder()}
                aria-invalid={bad || undefined}
                aria-describedby={bad ? 'mh-no-err' : undefined}
              />
              <button type="submit">{m.home_direct_button()}</button>
            </div>
            {bad && (
              <p id="mh-no-err" className="mh-err" role="alert">
                {m.home_direct_error()}
              </p>
            )}
          </form>
        </section>

        <section className="mh-sec" aria-labelledby="mh-faq">
          <h2 id="mh-faq">{m.home_faq_title()}</h2>
          <div className="mh-faq">
            {FAQS.map((f) => (
              <details key={f.q()}>
                <summary>{f.q()}</summary>
                <p>{f.a()}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mh-foot">
        <span>{m.common_footer_notice({ year: new Date().getFullYear(), name: tr(site.name) })}</span>
        <nav>
          <Link to={localizeHref('/about')}>{getLocale() === 'en' ? 'About YUEXIA' : getLocale() === 'ja' ? '月下について' : getLocale() === 'zh-Hans' ? '关于月下' : '關於月下'}</Link>
          <Link to={localizeHref('/methodology')}>{getLocale() === 'en' ? 'Sources & methodology' : getLocale() === 'ja' ? '出典と解説方法' : getLocale() === 'zh-Hans' ? '来源与解读方法' : '來源與解讀方法'}</Link>
          <Link to="/privacy">{m.common_footer_privacy()}</Link>
          <Link to="/terms">{m.common_footer_terms()}</Link>
          <Link to="/refunds">{m.common_footer_refunds()}</Link>
          <Link to="/dmca">{m.common_footer_dmca()}</Link>
          <a href={localizeHref('/llms.txt')}>{m.common_footer_llms()}</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{m.common_footer_contact()}</a>
        </nav>
      </footer>
    </div>
  );
}
