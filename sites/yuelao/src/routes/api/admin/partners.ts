import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長後台：分銷推廣人列表、報表與新增。邏輯在 packages/core/src/partners.ts。
export const Route = createFileRoute('/api/admin/partners')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminPartners(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminPartners(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
