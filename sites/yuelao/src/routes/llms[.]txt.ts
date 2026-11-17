import { createFileRoute } from '@tanstack/react-router';
import { llmsTxt } from '@yuelao/core/seo';
import site from '../../site.config';

// One file, one language tree (P7): the 繁/簡 toggle is a same-path cookie
// switch, so there is no separate Simplified URL tree to list. The summary
// notes the toggle and the honesty rule: the 100 sticks are the traditional
// 月老靈籤一百首 (classical quotations, checked against the originals,
// source named on each sign page); the verdicts are newly written for this
// site. No temple provenance is claimed anywhere.
const CONTENT = {
  summary:
    '線上月老求籤：搖一支月老籤，問他、問脫單、問複合；擲筊確認，月老親批。免費求籤，深度解讀付費解鎖。右上角可切繁體／簡體（同一網址，不換路徑）。一百支籤用流傳已久的月老靈籤一百首，籤詩按公開流傳版本整理，部分籤標示可辨識的典故出處；判詞為本站新寫，並非對他人心意的事實預測。',
  pages: [
    { title: '月老首頁', path: '/', description: '線上月老求籤：3D 月下集市，免費搖籤、擲筊、看判詞。' },
    {
      title: '月老殿互動求籤',
      path: '/market#yuelao',
      description: '在 3D 月下集市的月老殿搖籤、擲筊、看判詞。原獨立求籤頁 /ritual 已永久轉向此處。',
    },
    { title: '百籤總覽', path: '/signs', description: '月老靈籤100首的可索引文字索引，連結各支籤詩及解讀。' },
    { title: '關於月下', path: '/about', description: '月下的 3D 虛擬集市、免費求籤流程及文化體驗定位。' },
    { title: '籤文來源及方法', path: '/methodology', description: '籤詩參考來源、免費固定判詞和可選 AI 解讀的分別與限制。' },
    { title: '擲筊結果指南', path: '/jiaobei', description: '聖筊、笑筊、陰筊的文化含義、公開來源與數位月老求籤流程。' },
    { title: '月老提問指南', path: '/questions', description: '單身、曖昧、交往、婚姻與復合的具體提問範例，附免費求籤入口。' },
    { title: '每日心箋', path: '/daily', description: '免費每日反思提示及簽到。' },
    { title: '情感測驗', path: '/tests', description: '免費的關係自我整理測驗。' },
    {
      title: '籤頁',
      path: '/sign/1',
      description: '每支籤有獨立解籤頁（/sign/1…100）：籤詩、吉凶、三種問法的判詞。',
    },
    { title: '隱私權', path: '/privacy', description: '我們如何處理你的資料。' },
    { title: '服務條款', path: '/terms', description: '使用本站的規則。' },
    { title: '退款政策', path: '/refunds', description: '付費解鎖的退款規則。' },
  ],
};

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () => llmsTxt(site, CONTENT.summary, CONTENT.pages),
    },
  },
});
