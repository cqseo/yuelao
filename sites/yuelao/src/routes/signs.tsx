import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { STICKS } from '~/ritual/sticks';
import site from '../../site.config';
import './signs.css';

type Copy = {
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  lead: string;
  source: string;
  note: string;
  ritual: string;
  home: string;
};

const COPY: Record<string, Copy> = {
  'zh-Hant': {
    title: '月老靈籤100首完整目錄',
    metaTitle: '月老靈籤100首｜籤詩原文、吉凶與姻緣解籤',
    description: '月老靈籤100首完整索引。依籤號查看籤詩、吉凶、典故出處，及單身、曖昧、復合三種情境的解讀。',
    eyebrow: '月下籤譜 · 一百支籤',
    lead: '從第一籤到第一百籤，依序讀原文、看吉凶，再按自己的處境細讀。每一支籤都有獨立頁面。',
    source: '典故出處',
    note: '籤詩原文依公開流傳版本整理；處境判詞與行動建議為本站撰寫。籤詩用於文化體驗與自我整理，不保證感情結果。',
    ritual: '親自求一支月老籤',
    home: '返回月下集市首頁',
  },
  'zh-Hans': {
    title: '月老灵签100首完整目录',
    metaTitle: '月老灵签100首｜签诗原文、吉凶与姻缘解签',
    description: '月老灵签100首完整索引。按签号查看签诗、吉凶、典故出处，以及单身、暧昧、复合三种情境的解读。',
    eyebrow: '月下签谱 · 一百支签',
    lead: '从第一签到第一百签，依次读原文、看吉凶，再根据自己的处境细读。每一支签都有独立页面。',
    source: '典故出处',
    note: '签诗使用繁体原文（简体译本审核中）；处境判词与行动建议由本站编写。仅供文化体验与自我整理，不保证感情结果。',
    ritual: '亲自求一支月老签',
    home: '返回月下集市首页',
  },
  en: {
    title: '100 Yuelao Love Oracle Sticks',
    metaTitle: '100 Yuelao Love Oracle Sticks | Verses and Interpretations',
    description: 'Browse all 100 Yuelao love oracle sticks, with original Chinese verses, grades, classical references and relationship interpretations.',
    eyebrow: 'Yuelao · Complete index',
    lead: 'Explore all 100 numbered Yuelao oracle sticks, each with its original verse and relationship interpretations.',
    source: 'Classical reference',
    note: 'The original verses are presented in Chinese; translations are being reviewed. Interpretations are written for this site. This is a cultural reflection tool, not a prediction of outcomes.',
    ritual: 'Draw your own oracle stick',
    home: 'Back to YUEXIA',
  },
  ja: {
    title: '月老おみくじ全100首一覧',
    metaTitle: '月老おみくじ100首｜原文・吉凶・恋愛の解説',
    description: '月老おみくじ100首の一覧。番号ごとに詩の原文、吉凶、典拠、および恋愛の解説を確認できます。',
    eyebrow: '月下のくじ · 全100首',
    lead: '1番から100番まで、詩の原文と吉凶、恋愛の解説を読むことができます。',
    source: '典拠',
    note: '詩の原文は中国語で掲載しています。翻訳は確認中です。解説は当サイト独自のもので、結果を保証するものではありません。',
    ritual: '月老おみくじを引く',
    home: '月下のトップへ',
  },
};

function copyFor(locale: string): Copy {
  return COPY[locale] ?? COPY.en!;
}

export const Route = createFileRoute('/signs')({
  head: () => {
    const locale = getLocale();
    const copy = copyFor(locale);
    return pageHead(site, {
      title: copy.metaTitle,
      description: copy.description,
      path: localizeHref('/signs', { locale }),
      jsonLd: [
        {
          '@type': 'CollectionPage',
          name: copy.title,
          description: copy.description,
          inLanguage: locale,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: STICKS.length,
            itemListElement: STICKS.map((stick) => ({
              '@type': 'ListItem',
              position: stick.id,
              name: stick.no,
              url: site.url + localizeHref('/sign/' + stick.id, { locale }),
            })),
          },
        },
      ],
    });
  },
  component: SignsIndex,
});

function SignsIndex() {
  const copy = copyFor(getLocale());
  return (
    <article className="signs-index">
      <header className="signs-index__hero">
        <p className="signs-index__eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
        <div className="signs-index__actions">
          <Link to={localizeHref('/ritual')}>{copy.ritual}</Link>
          <Link to="/">{copy.home}</Link>
        </div>
      </header>

      <section aria-label={copy.title}>
        <ol className="signs-index__list">
          {STICKS.map((stick) => (
            <li key={stick.id}>
              <Link to={localizeHref('/sign/' + stick.id)}>
                <span className="signs-index__number">{String(stick.id).padStart(3, '0')}</span>
                <span className="signs-index__body">
                  <strong>{stick.no}</strong>
                  <span>{stick.poem.split('\n')[0]}</span>
                  {stick.source && <small>{copy.source}：{stick.source}</small>}
                </span>
                <span className="signs-index__grade">{stick.grade}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <p className="signs-index__notice">{copy.note}</p>
    </article>
  );
}
