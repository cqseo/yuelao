import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 站長後台：功德排行榜（GET 統計、POST 收起／放回法號）。權限與邏輯在 packages/core/src/admin-merit.ts。
export const Route = createFileRoute('/api/admin/merit')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminMerit(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.adminMerit(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
