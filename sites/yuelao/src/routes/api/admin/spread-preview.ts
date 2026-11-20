import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長預覽塔羅館、算命攤、財神殿的完整解讀：同一把識別字串、同一個問題，用 version 2（目前）或 3（加「說中」寫法）
// 各生成一份對照。只回給站長，不存、不扣權益。邏輯在 packages/core/src/spread-reading.ts previewSpreadRequest。
export const Route = createFileRoute('/api/admin/spread-preview')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.spreadPreview(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
