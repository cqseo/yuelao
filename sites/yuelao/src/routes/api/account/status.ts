import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Only the authenticated user's own orders and entitlements are returned.
export const Route = createFileRoute('/api/account/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.snapshot(request);
        } catch {
          return errorResponse(503, 'account_unavailable');
        }
      },
    },
  },
});
