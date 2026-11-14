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
    '線上月老求籤：搖一支月老籤，問他、問脫單、問複合；擲筊確認，月老親批。免費求籤，深度解讀付費解鎖。右上角可切繁體／簡體（同一網址，不換路徑）。一百支籤用流傳已久的月老靈籤一百首，籤詩借古籍原句、對過原典、寫明出處；判詞為本站新寫。',
  pages: [
    { title: '月老首頁', path: '/', description: '線上月老求籤：3D 月下集市，免費搖籤、擲筊、看判詞。' },
    {
      title: '搖籤',
      path: '/ritual',
      description: '把手機當籤筒，真搖一支月老籤，擲筊確認，月老親批。',
    },
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
