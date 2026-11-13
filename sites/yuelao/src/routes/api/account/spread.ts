import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 塔羅館完整解讀的狀態與正文：只回登入者自己的，no-store。
export const Route = createFileRoute('/api/account/spread')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.spread(request);
        } catch {
          return errorResponse(503, 'reading_unavailable');
        }
      },
    },
  },
});
