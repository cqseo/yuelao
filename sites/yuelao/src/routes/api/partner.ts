import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 分銷：推廣人用私密連結看自己的數據（不用登入）。邏輯在 packages/core/src/partners.ts。
export const Route = createFileRoute('/api/partner')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.partner(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
