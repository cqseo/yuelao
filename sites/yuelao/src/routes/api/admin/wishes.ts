import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長後台：許願池審核（GET 列表、POST 放行／收起／刪除）。權限與邏輯在 packages/core/src/admin-manage.ts。
export const Route = createFileRoute('/api/admin/wishes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminWishes(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminWishes(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
