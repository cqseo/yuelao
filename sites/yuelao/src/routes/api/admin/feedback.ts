import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長後台：用戶意見列表與標記。邏輯在 packages/core/src/feedback.ts。
export const Route = createFileRoute('/api/admin/feedback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminFeedback(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminFeedback(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
