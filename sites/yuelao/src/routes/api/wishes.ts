import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 許願池：GET 列出樹上的願望牌；POST 許願、同願、檢舉、撤下。邏輯都在 packages/core/src/wishes.ts。
export const Route = createFileRoute('/api/wishes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.wishes.list(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.wishes.act(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
