import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 用戶意見：任何人都能留一句（不用登入）。邏輯在 packages/core/src/feedback.ts。
export const Route = createFileRoute('/api/feedback')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.feedback(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
