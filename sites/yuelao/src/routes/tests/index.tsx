import { createFileRoute, Link } from '@tanstack/react-router';
import { ensureContent } from '~/i18n/content';
import { contentLocale } from '~/i18n/locale';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { inLocale, TESTS } from '~/tests/catalog';
import site from '../../../site.config';

export const Route = createFileRoute('/tests/')({
  // 非中文：站內換頁進來時先載內容字典
  loader: () => ensureContent(),
  head: () => {
    const locale = contentLocale();
    const zh = locale === 'zh-Hans';
    return pageHead(site, {
      title: `${zh ? '免费情感测试中心' : tr('免費情感測驗中心')} | ${tr(site.name)}`,
      description: zh
        ? '免费完成5项情感自查：渣男渣女行为、出轨信号、暧昧关系、复合和恋爱安全感。无需登录，结果免费。'
        : tr(
            '免費完成五項情感自查：渣男渣女行為、出軌信號、曖昧關係、複合與戀愛安全感。無需登入，結果免費。',
          ),
      path: localizeHref('/tests', { locale: getLocale() }),
      jsonLd: [
        {
          '@type': 'CollectionPage',
          name: zh ? '情感测试中心' : tr('情感測驗中心'),
          description: zh
            ? '免费的关系自我整理工具，不作心理诊断或事实预测。'
            : tr('免費的關係自我整理工具，不作心理診斷或事實預測。'),
        },
      ],
    });
  },
  component: TestsIndex,
});

function TestsIndex() {
  const locale = contentLocale();
  const zh = locale === 'zh-Hans';
  return (
    <div className="tests-section">
      <header className="tests-hero">
        <p className="tests-eyebrow">{zh ? '月老 · 情感研究所' : tr('月老 · 情感研究所')}</p>
        <h1>{zh ? '从一个问题，读懂自己的心' : tr('從一個問題，讀懂自己的心')}</h1>
        <p>
          {zh
            ? '不必急着猜对方在想什么。先用几分钟，整理这段关系里的事实、感受和界限。'
            : tr('不必急著猜對方在想什麼。先用幾分鐘，整理這段關係裡的事實、感受與界線。')}
        </p>
        <div className="tests-hero-facts">
          <span>{zh ? '5 项免费自查' : tr('5 項免費自查')}</span>
          <span>{zh ? '无需登录' : tr('無需登入')}</span>
          <span>{zh ? '结果立即查看' : tr('結果立即查看')}</span>
        </div>
      </header>
      <section className="tests-list" aria-labelledby="tests-list-heading">
        <div className="tests-section-heading">
          <span className="tests-eyebrow">{zh ? '免费工具' : tr('免費工具')}</span>
          <h2 id="tests-list-heading">{zh ? '选择你想理清的问题' : tr('選擇你想釐清的問題')}</h2>
        </div>
        <div className="tests-grid">
          {TESTS.map((test, i) => (
            <Link className="tests-tile" key={test.slug} to={localizeHref(`/tests/${test.slug}`)}>
              <div className="tests-tile-top">
                <span className="tests-number">0{i + 1}</span>
                <span className="tests-label">{inLocale(test.category, locale)}</span>
              </div>
              <h3>{inLocale(test.title, locale)}</h3>
              <p>{inLocale(test.summary, locale)}</p>
              <span className="tests-tile-link">
                {zh ? '开始自查' : tr('開始自查')} <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <aside className="tests-bottom">
        <p>
          {zh
            ? '这些测试由本站编写，属于自我反思工具，并非临床心理量表。答题内容仅在当前页面计算；不收集你的具体选项。'
            : tr(
                '這些測驗由本站編寫，屬於自我反思工具，並非臨床心理量表。答題內容僅在目前頁面計算；不收集你的具體選項。',
              )}
        </p>
        <Link to={localizeHref('/ritual')}>
          {zh ? '或者，先去求一支月老签' : tr('或者，先去求一支月老籤')}
        </Link>
      </aside>
    </div>
  );
}
