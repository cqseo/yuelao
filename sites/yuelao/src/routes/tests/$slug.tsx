import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { contentLocale } from '~/i18n/locale';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { getTest, inLocale } from '~/tests/catalog';
import { TestRunner } from '~/tests/components/TestRunner';
import site from '../../../site.config';

export const Route = createFileRoute('/tests/$slug')({
  loader: ({ params }) => {
    if (!getTest(params.slug)) throw notFound();
    return {};
  },
  head: ({ params }) => {
    const test = getTest(params.slug);
    if (!test) return { meta: [{ name: 'robots', content: 'noindex' }] };
    const locale = contentLocale();
    return pageHead(site, {
      title: `${inLocale(test.title, locale)} | ${tr(site.name)}`,
      description: inLocale(test.summary, locale),
      path: localizeHref(`/tests/${test.slug}`, { locale: getLocale() }),
      jsonLd: [
        {
          '@type': 'WebApplication',
          name: inLocale(test.title, locale),
          description: inLocale(test.summary, locale),
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Web',
          isAccessibleForFree: true,
        },
      ],
    });
  },
  component: TestPage,
});

function TestPage() {
  const { slug } = Route.useParams();
  const test = getTest(slug);
  if (!test) throw notFound();
  const locale = contentLocale();
  const zh = locale === 'zh-Hans';
  return (
    <article className="tests-section test-detail">
      <nav className="tests-breadcrumb" aria-label={zh ? '面包屑导航' : tr('麵包屑導覽')}>
        <Link to={localizeHref('/tests')}>{zh ? '情感测试' : tr('情感測驗')}</Link>
        <span aria-hidden="true">/</span>
        <span>{inLocale(test.category, locale)}</span>
      </nav>
      <header className="test-intro">
        <p className="tests-eyebrow">
          {inLocale(test.category, locale)} · {zh ? '免费' : tr('免費')}
        </p>
        <h1>{inLocale(test.title, locale)}</h1>
        <p>{inLocale(test.summary, locale)}</p>
        <div className="test-intro-notes">
          <span>{zh ? '8 个问题' : tr('8 個問題')}</span>
          <span>{zh ? '约 2 分钟' : tr('約 2 分鐘')}</span>
          <span>{zh ? '结果免费' : tr('結果免費')}</span>
        </div>
      </header>
      <TestRunner key={test.slug} test={test} />
      <section className="test-explainer">
        <h2>{zh ? '测试结果应该怎样理解？' : tr('測驗結果應該怎樣理解？')}</h2>
        <p>{inLocale(test.caution, locale)}</p>
        <p>
          {zh
            ? '结果只根据你对这 8 个问题的选择进行归纳。它不会读取对方的真实想法、私人行为或未来决定，也不是经过验证的心理诊断。'
            : tr(
                '結果只根據你對這 8 個問題的選擇進行歸納。它不會讀取對方的真實想法、私人行為或未來決定，也不是經過驗證的心理診斷。',
              )}
        </p>
        <p>
          {zh
            ? '如果这段关系中有威胁、暴力、跟踪或强迫控制的情况，请优先寻求现实中的支持，不必等待测试结果。'
            : tr(
                '如果這段關係中有威脅、暴力、跟蹤或強迫控制的情況，請優先尋求現實中的支持，不必等待測驗結果。',
              )}
        </p>
      </section>
    </article>
  );
}
