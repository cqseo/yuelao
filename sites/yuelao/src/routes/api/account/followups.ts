import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 追問月老：這份解籤的追問狀態與已答內容。邏輯在 packages/core/src/reading-followup.ts。
export const Route = createFileRoute('/api/account/followups')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.followups(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
