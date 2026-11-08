import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Strictly server-verified and no-store; never expose deep_readings to anon clients.
export const Route = createFileRoute('/api/account/reading')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.reading(request);
        } catch {
          return errorResponse(503, 'reading_unavailable');
        }
      },
    },
  },
});
