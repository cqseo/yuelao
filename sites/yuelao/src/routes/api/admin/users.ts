import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長後台：用戶列表。權限與邏輯在 packages/core/src/admin-manage.ts。
export const Route = createFileRoute('/api/admin/users')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminUsers(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
