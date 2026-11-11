import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { useState } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import type { RitualCat } from '~/ritual/physics';
import { stickById } from '~/ritual/sticks';
import { resolveStick } from '~/ritual/sticks-locale';
import site from '../../site.config';

// 首頁（P10「一條紅線」，見 DESIGN.md）：全幅廟會夜英雄區 + 一欄長卷。
// 一條朱紅直線從標題左側拉到頁尾，每一節是線上的一個結：
// 想問的事（他／脫單／複合，直接帶處境進搖籤）→ 其他去處 → 四步與範例籤
// → 一百支籤 → 問答。未上線的入口不放在首頁。
export const Route = createFileRoute('/')({
  head: () =>
    pageHead(site, {
      title: m.home_meta_title({ name: site.name }),
      description: m.home_meta_description(),
      // Canonical 是單棵樹（P7：繁/簡同路徑切換，網址不帶語言）。
      path: localizeHref('/', { locale: getLocale() }),
      // 首頁 OG 圖用同一張廟會夜；URL 跟 site.url 走（現仍是佔位域名，待定）。
      image: `${site.url}/ritual/temple-fair.jpg`,
      jsonLd: [
        {
          '@type': 'WebApplication',
          name: site.name,
          url: site.url,
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Web',
        },
        {
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({
            '@type': 'Question',
            name: f.q(),
            acceptedAnswer: { '@type': 'Answer', text: f.a() },
          })),
        },
      ],
    }),
  component: HomePage,
});

const QUESTIONS: Array<{ cat: RitualCat; word: () => string; desc: () => string }> = [
  { cat: 'him', word: () => m.ritual_cat_him(), desc: () => m.ritual_cat_him_desc() },
  { cat: 'single', word: () => m.ritual_cat_single(), desc: () => m.ritual_cat_single_desc() },
  { cat: 'reunion', word: () => m.ritual_cat_reunion(), desc: () => m.ritual_cat_reunion_desc() },
];

const MORE: Array<{ to: string; name: () => string; desc: () => string }> = [
  { to: '/daily', name: () => m.home_more_daily(), desc: () => m.home_more_daily_desc() },
  { to: '/chat', name: () => m.home_more_chat(), desc: () => m.home_more_chat_desc() },
  { to: '/tests', name: () => m.home_more_tests(), desc: () => m.home_more_tests_desc() },
];

const HOW_STEPS = [
  { title: () => m.home_how_step_1_title(), desc: () => m.home_how_step_1_desc() },
  { title: () => m.home_how_step_2_title(), desc: () => m.home_how_step_2_desc() },
  { title: () => m.home_how_step_3_title(), desc: () => m.home_how_step_3_desc() },
  { title: () => m.home_how_step_4_title(), desc: () => m.home_how_step_4_desc() },
];

const HOW_NUMS = ['一', '二', '三', '四'];

const FAQS = [
  { q: () => m.home_faq_q1(), a: () => m.home_faq_a1() },
  { q: () => m.home_faq_q2(), a: () => m.home_faq_a2() },
  { q: () => m.home_faq_q3(), a: () => m.home_faq_a3() },
  { q: () => m.home_faq_q4(), a: () => m.home_faq_a4() },
  { q: () => m.home_faq_q5(), a: () => m.home_faq_a5() },
  { q: () => m.home_faq_q6(), a: () => m.home_faq_a6() },
];

function Chevron() {
  return (
    <svg
      className="chev"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [directOpen, setDirectOpen] = useState(false);
  const [directNo, setDirectNo] = useState('');
  const [directError, setDirectError] = useState(false);

  // 長卷範例：第一籤的免費判詞全文（真籤、真判詞，不是示意文字）。
  const sampleStick = stickById(1);
  const resolvedSample = sampleStick ? resolveStick(sampleStick, getLocale()) : null;

  // 直接解籤：籤號有效就去籤頁（/sign/:id），那裡有三種問法的完整判詞。
  const submitDirect = (e: React.FormEvent): void => {
    e.preventDefault();
    const n = Number.parseInt(directNo, 10);
    if (!Number.isInteger(n) || !stickById(n)) {
      setDirectError(true);
      return;
    }
    setDirectError(false);
    void navigate({ to: localizeHref(`/sign/${n}`) });
  };

  return (
    <div className="home">
      <section className="home-hero">
        <img className="home-hero-img" src="/ritual/temple-fair.jpg" alt="" fetchPriority="high" />
        <div className="home-hero-scrim" aria-hidden="true" />
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1>{m.home_title()}</h1>
            <p className="home-hero-lead">{m.home_hero_lead()}</p>
            <div className="home-hero-actions">
              <Link className="btn-seal" to={localizeHref('/ritual')}>
                {m.home_hero_cta()}
              </Link>
              <button
                className="btn-text"
                type="button"
                aria-expanded={directOpen}
                aria-controls="home-direct"
                onClick={() => setDirectOpen((v) => !v)}
              >
                {m.home_top_direct()}
              </button>
            </div>
            {directOpen && (
              <div className="home-direct" id="home-direct">
                <form onSubmit={submitDirect}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={directNo}
                    onChange={(e) => setDirectNo(e.target.value)}
                    placeholder={m.home_direct_placeholder()}
                    aria-label={m.home_direct_placeholder()}
                    aria-invalid={directError}
                    // biome-ignore lint/a11y/noAutofocus: 使用者剛按下「直接解籤」，焦點落在輸入欄是預期行為。
                    autoFocus
                  />
                  <button type="submit">{m.home_direct_button()}</button>
                </form>
                {directError && (
                  <p className="error" role="alert">
                    {m.home_direct_error()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="home-scroll">
        <section className="home-section">
          <h2>{m.home_pick_heading()}</h2>
          <ul className="home-rows">
            {QUESTIONS.map((q) => (
              <li key={q.cat}>
                <Link className="home-row" to={localizeHref('/ritual')} search={{ cat: q.cat }}>
                  <span className="word">{q.word()}</span>
                  <span className="desc">{q.desc()}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-section">
          <h2>{m.home_more_title()}</h2>
          <ul className="home-rows">
            {MORE.map((item) => (
              <li key={item.to}>
                <Link className="home-row plain" to={localizeHref(item.to)}>
                  <span className="name">{item.name()}</span>
                  <span className="desc">{item.desc()}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 文案誠實：籤詩是流傳已久的月老靈籤一百首（借古籍原句、對過原典、
            寫明出處），不認任何廟宇出處；判詞為本站新寫。 */}
        <section className="home-section">
          <h2>{m.home_how_title()}</h2>
          <p>{m.home_how_intro()}</p>
          <ol className="how-steps">
            {HOW_STEPS.map((s, i) => (
              <li key={s.title()}>
                <div className="num" aria-hidden="true">
                  {HOW_NUMS[i]}
                </div>
                <h3>{s.title()}</h3>
                <p>{s.desc()}</p>
              </li>
            ))}
          </ol>
          {resolvedSample && (
            <div className="home-sample">
              <p>{m.home_how_sample_note()}</p>
              <div className="sample-card">
                <div className="no">{resolvedSample.stick.no}</div>
                <div className="grade">{resolvedSample.stick.grade}</div>
                <p className="poem">{resolvedSample.stick.poem}</p>
                <p className="verdict">{resolvedSample.stick.verdict.him}</p>
                {resolvedSample.fallback && <p className="muted">{m.ritual_locale_note()}</p>}
                <Link className="cta-link" to={localizeHref('/ritual')}>
                  {m.home_direct_cta()}
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="home-section">
          <h2>{m.home_sticks_title()}</h2>
          <p>{m.home_sticks_body_1()}</p>
          <p>{m.home_sticks_body_2()}</p>
          <Link className="more-link" to={localizeHref('/sign/1')}>
            {m.home_sticks_cta()}
          </Link>
        </section>

        <section className="home-section">
          <h2>{m.home_faq_title()}</h2>
          <div className="faq-list">
            {FAQS.map((f) => (
              <details className="faq-item" key={f.q()}>
                <summary>
                  {f.q()}
                  <span className="mark" aria-hidden="true" />
                </summary>
                <p>{f.a()}</p>
              </details>
            ))}
          </div>
        </section>

        <img className="home-knot" src="/ritual/knot-tongxin.webp" alt="" loading="lazy" />
      </div>
    </div>
  );
}
