import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長後台的數字：只有 site.adminEmails（或 ADMIN_EMAILS）裡的帳號拿得到。邏輯在 packages/core/src/admin-stats.ts。
export const Route = createFileRoute('/api/admin/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminStats(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
