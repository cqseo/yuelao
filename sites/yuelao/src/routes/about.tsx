import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

type Copy = {
  heading: string;
  title: string;
  description: string;
  intro: string;
  experienceTitle: string;
  experience: string;
  readingTitle: string;
  reading: string;
  boundaryTitle: string;
  boundary: string;
  method: string;
  signs: string;
  privacy: string;
};

const COPY: Record<string, Copy> = {
  'zh-Hant': {
    heading: '關於月下',
    title: '關於月下｜線上月老求籤與月下集市',
    description: '認識月下 yuexia.app：免費線上月老求籤、數位月下集市與感情自我整理工具，以及我們如何區分籤詩、判詞與 AI 深度解讀。',
    intro: '月下（yuexia.app）是一座可以走進去的數位月下集市，也提供百籤文字查詢與情感測驗；實際抽籤統一在集市內的月老殿進行。你可以免費閱讀籤詩與判詞，按自己的節奏整理心事。',
    experienceTitle: '不必進入 3D，也能使用',
    experience: '月下集市提供可自由探索的虛擬場景；如裝置不適合載入 3D，仍可查看 100 支籤的文字解讀；抽籤只在 3D 月老殿進行。基本判詞免費，無須付費入場。',
    readingTitle: '原文、本站判詞與可選 AI 解讀',
    reading: '籤詩引用流傳的月老聖籤版本；問他、脫單、複合的免費判詞與行動建議由本站編寫。需要更深入的個人化內容時，可自行選擇付費 AI 解讀。不同內容的產生方式會在解讀方法頁說明。',
    boundaryTitle: '我們如何看待求籤',
    boundary: '求籤是文化互動與自我反思，不是可驗證的命運預測。對方的真實想法、感情關係的結果，都不能靠一支籤確定。月下不代表任何實體廟宇，也不宣稱獲得廟宇授權。',
    method: '閱讀籤文來源與解讀方法',
    signs: '查看月老靈籤100首',
    privacy: '隱私權說明',
  },
  'zh-Hans': {
    heading: '关于月下',
    title: '关于月下｜线上月老求签与月下集市',
    description: '认识月下 yuexia.app：免费线上月老求签、数字月下集市和情感自我整理工具，了解签诗、判词与 AI 深度解读的区别。',
    intro: '月下（yuexia.app）是一座可以走进去的数字月下集市，也提供百签文字查询和情感测试；实际求签统一在集市里的月老殿进行。你可以免费阅读签诗与判词，按照自己的节奏整理心事。',
    experienceTitle: '无需进入 3D，也能使用',
    experience: '月下集市提供可以自由探索的虚拟场景；如果设备不适合加载 3D，仍可查阅 100 支签的文字解读；求签只在 3D 月老殿进行。基本判词免费，无需付费入场。',
    readingTitle: '原文、本站判词与可选 AI 解读',
    reading: '签诗参考流传的月老圣签版本；问他、脱单、复合的免费判词与行动建议由本站编写。需要更深入的个性化内容时，可自行选择付费 AI 解读。具体方法详见解读方法页。',
    boundaryTitle: '如何看待求签',
    boundary: '求签是文化互动和自我反思，并不是可以验证的命运预测。对方的真实想法与感情关系结果不能靠一支签确定。月下不代表任何实体庙宇，也不声称获得庙宇授权。',
    method: '阅读签文来源与解读方法',
    signs: '查看月老灵签100首',
    privacy: '隐私说明',
  },
  en: {
    heading: 'About YUEXIA',
    title: 'About YUEXIA | Yuelao Love Oracle and Virtual Night Market',
    description: 'Learn about YUEXIA, the online Yuelao oracle, its 3D night market, original relationship reflections and optional AI-powered readings.',
    intro: 'YUEXIA (yuexia.app) is an interactive moonlit night market with a free Yuelao love oracle, a 100-stick catalogue and relationship self-reflection tools. A text catalogue is available without opening the 3D world; drawing a new stick happens inside Yuelao Hall.',
    experienceTitle: 'A 3D world, with accessible text alternatives',
    experience: 'Explore the virtual market if you wish, or browse the written catalogue without 3D. Drawing a stick happens only inside the 3D hall, while existing verse interpretations are free to read.',
    readingTitle: 'Traditional verses, site-written guidance and optional AI',
    reading: 'The verses are based on publicly circulated Yuelao oracle texts. Free readings for different relationship situations are written for this site; optional paid AI-based interpretations are separate. Our methodology page explains the distinction.',
    boundaryTitle: 'What an oracle can and cannot tell you',
    boundary: 'The experience is for cultural exploration and personal reflection, not a verified prediction of fate. A verse cannot establish another person’s feelings or determine relationship outcomes. YUEXIA is not affiliated with or authorized by any particular temple.',
    method: 'Sources and methodology',
    signs: 'Browse all 100 oracle sticks',
    privacy: 'Privacy policy',
  },
  ja: {
    heading: '月下について',
    title: '月下について｜月老おみくじと3D夜市',
    description: '月下の無料月老おみくじ、3D夜市、恋愛についての自己整理ツール、AI解説の位置づけをご紹介します。',
    intro: '月下（yuexia.app）は、月夜の仮想市場を歩ける体験サイトです。抽選は3D市場の月老殿で行い、全100首の文章一覧や恋愛について考えるツールは3Dを開かずに読めます。',
    experienceTitle: '3Dを使わない閲覧方法',
    experience: '仮想市場を自由に探索することも、文章一覧から全100首を読むこともできます。新しく引く場合は3D市場の月老殿を利用します。基本解説は無料です。',
    readingTitle: '伝承の原文と当サイトの解説',
    reading: 'おみくじの詩は伝承される月老の文献を参照し、恋愛状況に応じた無料解説は当サイトが作成しています。有料のAIによる個別解説は別の機能です。',
    boundaryTitle: 'おみくじの限界',
    boundary: '文化体験と自己省察を目的としており、運命や他人の気持ちを確実に予測するものではありません。月下は特定の実在寺廟と提携・公認関係にありません。',
    method: '原文の出典と解説方法',
    signs: '全100首を読む',
    privacy: 'プライバシー',
  },
};

const copyFor = (locale: string) => COPY[locale] ?? COPY.en!;

export const Route = createFileRoute('/about')({
  head: () => {
    const locale = getLocale();
    const c = copyFor(locale);
    return pageHead(site, {
      title: c.title,
      description: c.description,
      path: localizeHref('/about', { locale }),
      jsonLd: [{ '@type': 'AboutPage', name: c.heading, description: c.description, inLanguage: locale }],
    });
  },
  component: About,
});

function About() {
  const c = copyFor(getLocale());
  return (
    <article className="legal">
      <h1>{c.heading}</h1>
      <p>{c.intro}</p>
      <h2>{c.experienceTitle}</h2>
      <p>{c.experience}</p>
      <h2>{c.readingTitle}</h2>
      <p>{c.reading}</p>
      <h2>{c.boundaryTitle}</h2>
      <p>{c.boundary}</p>
      <nav aria-label={c.heading}>
        <p><Link to={localizeHref('/methodology')}>{c.method}</Link></p>
        <p><Link to={localizeHref('/signs')}>{c.signs}</Link></p>
        <p><Link to={localizeHref('/privacy')}>{c.privacy}</Link></p>
      </nav>
    </article>
  );
}
