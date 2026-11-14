import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { absoluteUrl } from '@yuelao/core/seo';
import { ensureContent } from '~/i18n/content';
import { contentLocale, uiPrefix } from '~/i18n/locale';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { knotImage } from '~/ritual/knots';
import type { RitualCat } from '~/ritual/physics';
import { adviceFor } from '~/ritual/stick-advice';
import { STICKS, stickById } from '~/ritual/sticks';
import { resolveStick } from '~/ritual/sticks-locale';
import { STICK_PLAIN } from '~/ritual/sticks-plain';
import site from '../../../site.config';

// 每支籤獨立 URL（/sign/1…100，P5 程序化 SEO 頁）：籤詩、吉凶、三種問法
// 的判詞 + 三天/七日塊、前後籤與同籤等連結。簡體籤文未審時回落繁體原文。
function getStick(id: string) {
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n)) return null;
  return stickById(n) ?? null;
}

const SITUATIONS: RitualCat[] = ['him', 'single', 'reunion'];

function situationLabel(cat: RitualCat): string {
  if (cat === 'single') return m.ritual_cat_single();
  if (cat === 'reunion') return m.ritual_cat_reunion();
  return m.ritual_cat_him();
}

export const Route = createFileRoute('/sign/$id')({
  // 無效籤號在 loader 就擲 notFound：元件裡擲只會讓 SSR 報錯後退回客戶端
  // 渲染、HTTP 狀態仍是 200（軟 404）；loader 擲才是真正的 404。
  loader: async ({ params }) => {
    if (!getStick(params.id)) throw notFound();
    // 非中文：站內換頁進來時先載內容字典（判詞、建議的譯文）
    await ensureContent();
    return {};
  },
  head: ({ params }) => {
    const stick = getStick(params.id);
    if (!stick) return { meta: [{ name: 'robots', content: 'noindex' }] };
    const locale = getLocale();
    const path = localizeHref(`/sign/${stick.id}`, { locale });
    const firstLine = stick.poem.split('\n')[0] ?? '';
    return pageHead(site, {
      title: m.sign_meta_title({ no: tr(stick.no), grade: tr(stick.grade) }),
      description: m.sign_meta_description({ no: tr(stick.no), grade: tr(stick.grade), line: firstLine }),
      path,
      image: `${site.url}/ritual/temple-fair.jpg`,
      jsonLd: [
        {
          '@type': 'Article',
          headline: `${tr(stick.no)} ${tr(stick.grade)}`,
          inLanguage: locale,
          mainEntityOfPage: absoluteUrl(site, path),
        },
      ],
    });
  },
  component: SignPage,
});

function SignPage() {
  const { id } = Route.useParams();
  const stick = getStick(id);
  if (!stick) throw notFound();
  const resolved = resolveStick(stick, contentLocale());
  const s = resolved.stick;
  const advice = adviceFor(stick.id, contentLocale());
  const prev = stick.id > 1 ? stickById(stick.id - 1) : null;
  const next = stick.id < STICKS.length ? stickById(stick.id + 1) : null;
  const sameGrade = STICKS.filter((x) => x.grade === stick.grade && x.id !== stick.id).slice(0, 3);

  return (
    <article className="sign-page">
      <h1>
        {tr(s.no)} · {tr(s.grade)}
      </h1>
      <div className="sign-card">
        <div className="no">{tr(s.no)}</div>
        <div className="grade">{tr(s.grade)}</div>
        <p className="poem">{s.poem}</p>
        {uiPrefix() && STICK_PLAIN[s.id] && <p className="poem-tr">{tr(STICK_PLAIN[s.id]!.plain)}</p>}
        {s.source && <p className="source">{m.sign_source({ source: tr(s.source) })}</p>}
        <img className="sign-knot-img" src={knotImage(s.knot)} alt="" loading="lazy" />
        <div className="knot">{tr(s.knotName)}</div>
      </div>
      {resolved.fallback && <p className="muted">{m.ritual_locale_note()}</p>}

      <section className="sign-verdicts">
        <h2>{m.sign_verdicts_title()}</h2>
        {SITUATIONS.map((cat) => (
          <div className="sign-situation" key={cat}>
            <p className="eyebrow">{m.ritual_verdict_cat({ cat: situationLabel(cat) })}</p>
            <p>{tr(s.verdict[cat])}</p>
          </div>
        ))}
      </section>

      {/* 三天/七日建議是這支籤專屬的（stick-advice.ts），只出現一次，
          不再每種問法下各貼一份相同文案。 */}
      <section className="sign-advice">
        <p className="sign-block-label">{m.ritual_verdict_actions_title()}</p>
        <p>{tr(advice.actions)}</p>
        <p className="sign-block-label">{m.ritual_verdict_practice_title()}</p>
        <p>{tr(advice.practice)}</p>
      </section>

      <section className="sign-related">
        <h2>{m.sign_related_title()}</h2>
        <ul>
          {prev && (
            <li>
              <Link to={localizeHref(`/sign/${prev.id}`)}>
                <span>
                  {m.sign_prev()} · {tr(prev.no)}
                </span>
                <span className="grade">{tr(prev.grade)}</span>
              </Link>
            </li>
          )}
          {next && (
            <li>
              <Link to={localizeHref(`/sign/${next.id}`)}>
                <span>
                  {m.sign_next()} · {tr(next.no)}
                </span>
                <span className="grade">{tr(next.grade)}</span>
              </Link>
            </li>
          )}
          {sameGrade.map((x) => (
            <li key={x.id}>
              <Link to={localizeHref(`/sign/${x.id}`)}>
                <span>{tr(x.no)}</span>
                <span className="grade">{tr(x.grade)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="sign-nav">
        <Link className="primary" to={localizeHref('/ritual')}>
          {m.sign_ritual_cta()}
        </Link>
        <Link to="/">{m.sign_back_home()}</Link>
      </nav>
    </article>
  );
}
