import { createFileRoute } from '@tanstack/react-router';
import { llmsTxt } from '@yuelao/core/seo';
import site from '../../site.config';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        llmsTxt(
          site,
          '線上月老求籤：搖一支月老籤，問他、問脫單、問複合；擲筊確認，月老親批。免費求籤，深度解讀付費解鎖。',
          [
            { title: '月老首頁', path: '/', description: '線上月老求籤：問事總目，免費搖籤。' },
            { title: '隱私權', path: '/privacy', description: '我們如何處理你的資料。' },
            { title: '服務條款', path: '/terms', description: '使用本站的規則。' },
            { title: '退款政策', path: '/refunds', description: '付費解鎖的退款規則。' },
          ],
        ),
    },
  },
});
