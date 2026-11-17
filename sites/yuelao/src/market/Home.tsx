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

const QUICK_ACTION_COPY = {
  'zh-Hant': {
    ritual: '立即抽籤',
    ritualHint: '月老靈籤 · 擲筊',
    tarot: '立即抽塔羅',
    tarotHint: '塔羅／雷諾曼 · 三張牌',
  },
  'zh-Hans': {
    ritual: '立即抽签',
    ritualHint: '月老灵签 · 掷筊',
    tarot: '立即抽塔罗',
    tarotHint: '塔罗／雷诺曼 · 三张牌',
  },
} as const;

const NAV = [
  { to: '/market#enter', label: () => m.home_market_nav_market(), hard: true },
  // 一般求籤不強制載入 3D；需要沉浸儀式的訪客仍可選擇完整集市。
  { to: '/market?lite=1#yuelao', label: () => m.home_market_nav_ritual(), hard: true },
  { to: '/market#tarot', label: () => m.home_market_room_tarot(), hard: true },
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

// Text-first explanations are present in SSR HTML; the 3D ritual still starts at /market#yuelao.
const RITUAL_STEPS = [
  { title: () => m.home_how_step_1_title(), desc: () => m.home_how_step_1_desc() },
  { title: () => m.home_how_step_2_title(), desc: () => m.home_how_step_2_desc() },
  { title: () => m.home_how_step_3_title(), desc: () => m.home_how_step_3_desc() },
  { title: () => m.home_how_step_4_title(), desc: () => m.home_how_step_4_desc() },
];

const TOPICS = [
  { id: 'single', title: () => m.home_category_single(), desc: () => m.home_category_single_desc() },
  { id: 'him', title: () => m.home_category_him(), desc: () => m.home_category_him_desc() },
  { id: 'reunion', title: () => m.home_category_reunion(), desc: () => m.home_category_reunion_desc() },
];

const INDEX_COPY: Record<string, { name: string; desc: string }> = {
  'zh-Hant': { name: '查看月老靈籤100首', desc: '依籤號查原文、吉凶及感情情境解讀。' },
  'zh-Hans': { name: '查看月老灵签100首', desc: '按签号查原文、吉凶及感情情境解读。' },
  en: { name: 'Browse all 100 Yue Lao sticks', desc: 'Read the verses, grades and relationship interpretations.' },
  ja: { name: '月老おみくじ全100首を見る', desc: '番号から詩の原文・吉凶・恋愛解説を確認。' },
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
  const quick = getLocale() === 'zh-Hans' ? QUICK_ACTION_COPY['zh-Hans'] : QUICK_ACTION_COPY['zh-Hant'];
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
            <p className="mh-eyebrow">{m.home_market_title()}</p>
            <h1 id="mh-title">{m.home_title()}</h1>
            <p className="mh-title-seo">{m.home_seo_subtitle()}</p>
            <div className="mh-quick-actions">
              <a
                className="mh-quick-card mh-quick-card--ritual"
                href={localizeHref('/market?lite=1#yuelao')}
                data-rybbit-event="home_quick_yuelao"
                onClick={() => track('home_quick_entry_click', { destination: 'yuelao' })}
              >
                <strong>{quick.ritual}</strong>
                <small>{quick.ritualHint}</small>
                <span className="mh-quick-arrow" aria-hidden="true">→</span>
              </a>
              <a
                className="mh-quick-card mh-quick-card--tarot"
                href={localizeHref('/market#tarot')}
                data-rybbit-event="home_quick_tarot"
                onClick={() => track('home_quick_entry_click', { destination: 'tarot' })}
              >
                <strong>{quick.tarot}</strong>
                <small>{quick.tarotHint}</small>
                <span className="mh-quick-arrow" aria-hidden="true">→</span>
              </a>
            </div>
            <div className="mh-hero-aux">
              <a
                href={localizeHref('/market#enter')}
                data-rybbit-event="home_market_enter"
                onClick={() => track('home_market_enter_click', { destination: 'market' })}
              >
                {m.home_market_enter()} <span aria-hidden="true">→</span>
              </a>
              <Link to={localizeHref('/signs')}>
                {indexCopy().name} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mh-lead">{m.home_market_lead()}</p>
            <p className="mh-note">{m.home_market_note()}</p>
          </div>
        </section>

        <section className="mh-sec mh-ritual" aria-labelledby="mh-ritual-heading">
          <p className="mh-kicker">{m.home_how_kicker()}</p>
          <h2 id="mh-ritual-heading">{m.home_how_title()}</h2>
          <p className="mh-sec-lead">{m.home_how_intro()}</p>
          <ol className="mh-ritual-steps">
            {RITUAL_STEPS.map((step) => (
              <li key={step.title()}>
                <h3>{step.title()}</h3>
                <p>{step.desc()}</p>
              </li>
            ))}
          </ol>
          <a className="mh-section-link" href={localizeHref('/market#yuelao')}>
            {m.home_market_plain()} <span aria-hidden="true">→</span>
          </a>
          <div className="mh-signs-links">
            <Link to={localizeHref('/jiaobei')}>
              {m.home_how_step_4_title()} <span aria-hidden="true">→</span>
            </Link>
            <Link to={localizeHref('/questions')}>
              {m.home_pick_heading()} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="mh-sec mh-topic-section" aria-labelledby="mh-topics-heading">
          <h2 id="mh-topics-heading">{m.home_pick_heading()}</h2>
          <ul className="mh-topics">
            {TOPICS.map((topic) => (
              <li key={topic.id}>
                <a
                  href={localizeHref('/market#yuelao')}
                  onClick={() => track('home_topic_click', { topic: topic.id })}
                  aria-label={`${topic.title()}：${m.home_market_plain()}`}
                >
                  <h3>{topic.title()}</h3>
                  <p>{topic.desc()}</p>
                  <span className="mh-topic-action">{m.home_market_way_ritual()} <span aria-hidden="true">→</span></span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mh-sec mh-signs" aria-labelledby="mh-signs-heading">
          <p className="mh-kicker">{m.home_sticks_kicker()}</p>
          <h2 id="mh-signs-heading">{m.home_sticks_title()}</h2>
          <p>{m.home_sticks_body_1()}</p>
          <p>{m.home_sticks_body_2()}</p>
          <div className="mh-signs-links">
            <Link to={localizeHref('/signs')}>{indexCopy().name} <span aria-hidden="true">→</span></Link>
            <Link to={localizeHref('/sign/1')}>{m.home_sticks_cta()} <span aria-hidden="true">→</span></Link>
            <Link to={localizeHref('/methodology')}>{m.home_faq_q6()} <span aria-hidden="true">→</span></Link>
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
