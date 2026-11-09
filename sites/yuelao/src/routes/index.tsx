import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@yuelao/core/seo';
import { useState } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import type { RitualCat } from '~/ritual/physics';
import { type Stick, stickById } from '~/ritual/sticks';
import { resolveStick } from '~/ritual/sticks-locale';
import site from '../../site.config';

// 問事總目首頁（V1 方案第 4 節版式）：頂部簽系切換 + 右上直接解簽，
// 左欄 01 問他 / 02 脫單 / 03 複合 / 04 每日，右欄每類 4 個入口。
// 每行都是入口、不是新工具：上線的落到搖籤（/ritual，帶處境與問題預設），
// 未上線的標「即將推出」（不設死鏈）。
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

type HomeCat = 'him' | 'single' | 'reunion' | 'daily';

const CATEGORIES: Array<{
  key: HomeCat;
  num: string;
  title: () => string;
  desc: () => string;
}> = [
  { key: 'him', num: '01', title: () => m.home_category_him(), desc: () => m.home_category_him_desc() },
  {
    key: 'single',
    num: '02',
    title: () => m.home_category_single(),
    desc: () => m.home_category_single_desc(),
  },
  {
    key: 'reunion',
    num: '03',
    title: () => m.home_category_reunion(),
    desc: () => m.home_category_reunion_desc(),
  },
  { key: 'daily', num: '04', title: () => m.home_category_daily(), desc: () => m.home_category_daily_desc() },
];

interface Entry {
  name: () => string;
  desc: () => string;
  badge: 'free' | 'featured' | null;
  /** 上線的入口：搖籤連結（處境 + 問題預設）。缺省 = 未上線，標「即將推出」。
   * q 必須是 thunk：模組頂層求值時伺服器還沒進 paraglide 的 AsyncLocalStorage，
   * 訊息會永遠解成 base locale（繁體），簡體下 SSR 與客戶端水合對不上。 */
  live?: { cat?: RitualCat; q: () => string };
}

const ENTRIES: Record<HomeCat, Entry[]> = {
  him: [
    {
      name: () => m.home_entry_him_1_name(),
      desc: () => m.home_entry_him_1_desc(),
      badge: 'free',
      live: { cat: 'him', q: () => m.home_entry_him_1_name() },
    },
    { name: () => m.home_entry_him_2_name(), desc: () => m.home_entry_him_2_desc(), badge: 'featured' },
    { name: () => m.home_entry_him_3_name(), desc: () => m.home_entry_him_3_desc(), badge: 'featured' },
    { name: () => m.home_entry_him_4_name(), desc: () => m.home_entry_him_4_desc(), badge: null },
  ],
  single: [
    {
      name: () => m.home_entry_single_1_name(),
      desc: () => m.home_entry_single_1_desc(),
      badge: 'free',
      live: { cat: 'single', q: () => m.home_entry_single_1_name() },
    },
    { name: () => m.home_entry_single_2_name(), desc: () => m.home_entry_single_2_desc(), badge: null },
    {
      name: () => m.home_entry_single_3_name(),
      desc: () => m.home_entry_single_3_desc(),
      badge: 'free',
      live: { cat: 'single', q: () => m.home_entry_single_3_name() },
    },
    { name: () => m.home_entry_single_4_name(), desc: () => m.home_entry_single_4_desc(), badge: 'featured' },
  ],
  reunion: [
    {
      name: () => m.home_entry_reunion_1_name(),
      desc: () => m.home_entry_reunion_1_desc(),
      badge: 'free',
      live: { cat: 'reunion', q: () => m.home_entry_reunion_1_name() },
    },
    { name: () => m.home_entry_reunion_2_name(), desc: () => m.home_entry_reunion_2_desc(), badge: null },
    { name: () => m.home_entry_reunion_3_name(), desc: () => m.home_entry_reunion_3_desc(), badge: null },
    {
      name: () => m.home_entry_reunion_4_name(),
      desc: () => m.home_entry_reunion_4_desc(),
      badge: 'featured',
    },
  ],
  daily: [
    {
      name: () => m.home_entry_daily_1_name(),
      desc: () => m.home_entry_daily_1_desc(),
      badge: 'free',
      live: { q: () => m.home_entry_daily_1_name() },
    },
    { name: () => m.home_entry_daily_2_name(), desc: () => m.home_entry_daily_2_desc(), badge: 'free' },
    { name: () => m.home_entry_daily_3_name(), desc: () => m.home_entry_daily_3_desc(), badge: null },
    { name: () => m.home_entry_daily_4_name(), desc: () => m.home_entry_daily_4_desc(), badge: null },
  ],
};

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

function HomePage() {
  const [cat, setCat] = useState<HomeCat>('him');
  const [directOpen, setDirectOpen] = useState(false);
  const [directNo, setDirectNo] = useState('');
  const [directError, setDirectError] = useState(false);
  const [directStick, setDirectStick] = useState<Stick | null>(null);

  // 直接解簽的判詞需要一個處境：選中的大類若是「每日」則預設問他。
  const verdictCat: RitualCat = cat === 'daily' ? 'him' : cat;
  const resolvedDirect = directStick ? resolveStick(directStick, getLocale()) : null;
  // 長卷範例：第一籤的免費判詞全文（真籤、真判詞，不是示意文字）。
  const sampleStick = stickById(1);
  const resolvedSample = sampleStick ? resolveStick(sampleStick, getLocale()) : null;

  const submitDirect = (e: React.FormEvent): void => {
    e.preventDefault();
    const n = Number.parseInt(directNo, 10);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setDirectError(true);
      setDirectStick(null);
      return;
    }
    setDirectError(false);
    setDirectStick(stickById(n) ?? null);
  };

  return (
    <>
      {/* 英雄區：與儀式頁同一幅廟會夜。簽系名、搖一搖、直接解簽、其他問法
          都壓在同一張 temple-fair.jpg 上；圖未載入時暖底頂著。 */}
      <section className="serene-home-intro" aria-labelledby="serene-home-title">
        <div className="serene-home-copy">
          <span className="serene-eyebrow">THE RED THREAD / 月老 · 心的棲所</span>
          <h1 id="serene-home-title">
            {getLocale() === 'zh-Hans' ? (
              <>
                有些心事，<em>慢慢说。</em>
              </>
            ) : (
              <>
                有些心事，<em>慢慢說。</em>
              </>
            )}
          </h1>
          <p>
            {getLocale() === 'zh-Hans'
              ? '不必急着求答案。来这里说一句心里话，收下一封每日心笺，或求一支属于此刻的签。'
              : '不必急著求答案。來這裡說一句心裡話，收下一封每日心箋，或求一支屬於此刻的籤。'}
          </p>
          <div className="serene-home-actions">
            <Link className="serene-primary" to={localizeHref('/chat')}>
              {getLocale() === 'zh-Hans' ? '与月老聊聊' : '與月老聊聊'} <span>↗</span>
            </Link>
            <Link to={localizeHref('/daily')}>
              {getLocale() === 'zh-Hans' ? '领取今日心笺' : '領取今日心箋'} <span>↗</span>
            </Link>
          </div>
          <div className="serene-home-foot">
            <span>01 {getLocale() === 'zh-Hans' ? '说心事' : '說心事'}</span>
            <span>02 {getLocale() === 'zh-Hans' ? '每日签到' : '每日簽到'}</span>
            <span>03 {getLocale() === 'zh-Hans' ? '免费求签' : '免費求籤'}</span>
          </div>
        </div>
        <div className="serene-home-art" aria-hidden="true">
          <span className="serene-art-top">願 · 以 心 相 見</span>
          <div className="serene-art-loop">
            <div className="serene-art-seal">緣</div>
          </div>
          <p>
            緣起有時
            <br />
            心安一生
          </p>
          <span className="serene-art-bottom">月下有約</span>
        </div>
      </section>

      <div className="ask-hero">
        <img className="ask-hero-img" src="/ritual/temple-fair.jpg" alt="" fetchPriority="high" />
        <div className="ask-hero-scrim" aria-hidden="true" />
        <div className="ask-top">
          <div className="ask-system">
            {/* 英雄區簽系名就是首頁 H1（P7）：「線上月老求籤」，40px 書法，同款式。 */}
            <h2 className="name">{m.home_title()}</h2>
            <span className="badge-free">{m.home_entry_free()}</span>
            <Link className="ask-shake" to={localizeHref('/ritual')}>
              {m.home_top_shake()}
            </Link>
          </div>
          <button
            className="ask-direct-btn"
            type="button"
            aria-expanded={directOpen}
            onClick={() => setDirectOpen((v) => !v)}
          >
            {m.home_top_direct()}
          </button>
        </div>

        <div className="ask-ways">
          <span className="label">{m.home_other_ways()}</span>
          <Link to={localizeHref('/ritual')}>{m.home_way_shake()}</Link>
          <span className="sep">·</span>
          <span className="soon">
            {m.home_way_jiao()}（{m.home_entry_soon()}）
          </span>
          <span className="sep">·</span>
          <Link to={localizeHref('/ritual')} search={{ q: m.home_way_daily() }}>
            {m.home_way_daily()}
          </Link>
          <span className="sep">·</span>
          <span className="soon">
            {m.home_way_book()}（{m.home_entry_soon()}）
          </span>
        </div>
      </div>

      <section className="home-test-entry" aria-labelledby="home-tests-heading">
        <div>
          <p className="tests-eyebrow">
            {getLocale() === 'zh-Hans' ? '月老 · 情感研究所' : '月老 · 情感研究所'}
          </p>
          <h2 id="home-tests-heading">
            {getLocale() === 'zh-Hans' ? '有些心事，先做个小测试' : '有些心事，先做個小測驗'}
          </h2>
          <p>
            {getLocale() === 'zh-Hans'
              ? '8 个问题，免费整理关系中的信任、暧昧与界限；不必注册。'
              : '8 個問題，免費整理關係中的信任、曖昧與界線；不必註冊。'}
          </p>
        </div>
        <div className="home-test-links">
          <Link to={localizeHref('/tests/red-flags')}>
            {getLocale() === 'zh-Hans' ? '渣男渣女行为自查' : '渣男渣女行為自查'}
          </Link>
          <Link to={localizeHref('/tests/cheating-signs')}>
            {getLocale() === 'zh-Hans' ? '出轨信号自查' : '出軌信號自查'}
          </Link>
          <Link to={localizeHref('/tests/crush')}>
            {getLocale() === 'zh-Hans' ? '暧昧关系测试' : '曖昧關係測驗'}
          </Link>
          <Link to={localizeHref('/tests')}>
            {getLocale() === 'zh-Hans' ? '全部免费测试 →' : '全部免費測驗 →'}
          </Link>
        </div>
      </section>

      {directOpen && (
        <section className="ask-direct" aria-label={m.home_direct_title()}>
          <h2>{m.home_direct_title()}</h2>
          <p>{m.home_direct_hint()}</p>
          <form onSubmit={submitDirect}>
            <input
              type="text"
              inputMode="numeric"
              value={directNo}
              onChange={(e) => setDirectNo(e.target.value)}
              placeholder={m.home_direct_placeholder()}
              aria-label={m.home_direct_placeholder()}
            />
            <button type="submit">{m.home_direct_button()}</button>
          </form>
          {directError && <p className="error">{m.home_direct_error()}</p>}
          {resolvedDirect && (
            <div className="ask-direct-result">
              <div className="no">{resolvedDirect.stick.no}</div>
              <div className="grade">{resolvedDirect.stick.grade}</div>
              <p className="poem">{resolvedDirect.stick.poem}</p>
              <p className="verdict">{resolvedDirect.stick.verdict[verdictCat]}</p>
              {resolvedDirect.fallback && <p className="muted">{m.ritual_locale_note()}</p>}
              <Link className="cta-link" to={localizeHref('/ritual')}>
                {m.home_direct_cta()}
              </Link>
            </div>
          )}
        </section>
      )}

      <section className="ask-index">
        <h2>{m.home_pick_heading()}</h2>
        <div className="ask-cats" role="tablist" aria-label={m.home_categories_heading()}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              className="ask-cat"
              aria-selected={cat === c.key}
              onClick={() => setCat(c.key)}
            >
              <span className="num">{c.num}</span>
              <span className="cat-name">{c.title()}</span>
              <span className="cat-desc">{c.desc()}</span>
            </button>
          ))}
        </div>
        <div className="ask-entries">
          {ENTRIES[cat].map((e) => {
            const badge =
              e.badge === 'free' ? (
                <span className="badge badge-free">{m.home_entry_free()}</span>
              ) : e.badge === 'featured' ? (
                <span className="badge badge-featured">{m.home_entry_featured()}</span>
              ) : null;
            const soon = !e.live ? <span className="badge badge-soon">{m.home_entry_soon()}</span> : null;
            const body = (
              <>
                <span className="entry-name">{e.name()}</span>
                <span className="entry-desc">{e.desc()}</span>
                {badge}
                {soon}
              </>
            );
            if (e.live) {
              return (
                <Link
                  key={e.name()}
                  className="ask-entry"
                  to={localizeHref('/ritual')}
                  search={e.live.cat ? { cat: e.live.cat, q: e.live.q() } : { q: e.live.q() }}
                >
                  {body}
                </Link>
              );
            }
            return (
              <div key={e.name()} className="ask-entry" aria-disabled="true">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* 首頁長卷（P5）：問事總目之下的三章——怎麼問 / 這一百支籤 / 問答。
          文案誠實：籤詩是流傳已久的月老靈籤一百首（借古籍原句、對過原典、
          寫明出處），不認任何廟宇出處；判詞為本站新寫。 */}
      <div className="home-chapters">
        <section className="home-chapter">
          <p className="kicker">{m.home_how_kicker()}</p>
          <h2>{m.home_how_title()}</h2>
          <p>{m.home_how_intro()}</p>
          <ol className="how-steps">
            {HOW_STEPS.map((s, i) => (
              <li key={s.title()}>
                <div className="num">{HOW_NUMS[i]}</div>
                <h3>{s.title()}</h3>
                <p>{s.desc()}</p>
              </li>
            ))}
          </ol>
          <div className="home-sample">
            <p className="sample-label">{m.home_how_sample_title()}</p>
            <p>{m.home_how_sample_note()}</p>
            {resolvedSample && (
              <div className="ask-direct-result">
                <div className="no">{resolvedSample.stick.no}</div>
                <div className="grade">{resolvedSample.stick.grade}</div>
                <p className="poem">{resolvedSample.stick.poem}</p>
                <p className="verdict">{resolvedSample.stick.verdict.him}</p>
                {resolvedSample.fallback && <p className="muted">{m.ritual_locale_note()}</p>}
                <Link className="cta-link" to={localizeHref('/ritual')}>
                  {m.home_direct_cta()}
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="home-chapter">
          <p className="kicker">{m.home_sticks_kicker()}</p>
          <h2>{m.home_sticks_title()}</h2>
          <p>{m.home_sticks_body_1()}</p>
          <p>{m.home_sticks_body_2()}</p>
          <p>
            <Link to={localizeHref('/sign/1')}>{m.home_sticks_cta()}</Link>
          </p>
        </section>

        <section className="home-chapter">
          <p className="kicker">{m.home_faq_kicker()}</p>
          <h2>{m.home_faq_title()}</h2>
          <div className="faq-list">
            {FAQS.map((f) => (
              <div className="faq-item" key={f.q()}>
                <h3>{f.q()}</h3>
                <p>{f.a()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
