import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 功德排行榜：GET 看榜（?range=day|week|all）；POST 送這次多敲的下數。邏輯在 packages/core/src/merit-board.ts。
export const Route = createFileRoute('/api/merit')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.merit.board(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.merit.submit(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
