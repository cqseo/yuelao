import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 追問月老：用掉一個已付錢的名額，請月老回答。邏輯在 packages/core/src/reading-followup.ts。
export const Route = createFileRoute('/api/account/followups/ask')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.followupAsk(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
