import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 大殿上香計數：POST 記一次，回今天上過香的人數（見 DESIGN.md「今天已有 N 人在大殿上過香」）。
export const Route = createFileRoute('/api/plaza/offering')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.hall.offering(request);
        } catch {
          return errorResponse(503, 'count_unavailable');
        }
      },
    },
  },
});
