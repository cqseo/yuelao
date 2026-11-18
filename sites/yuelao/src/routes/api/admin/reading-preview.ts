import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長預覽解籤：同一支籤、同一個問題，用第一版或第二版提示詞各生成一份對照。
// 只回給站長，不存、不扣權益。邏輯在 packages/core/src/ai-reading.ts previewReadingRequest。
export const Route = createFileRoute('/api/admin/reading-preview')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.readingPreview(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
