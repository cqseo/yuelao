import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Test checkout API. Live purchases are intentionally impossible on this route
// because core.billing.checkout requires a sk_test_* key and explicit opt-in.
export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.billing.checkout(request);
        } catch (error) {
          console.error('test checkout failed', error instanceof Error ? error.name : 'unknown');
          return errorResponse(503, 'checkout_unavailable');
        }
      },
    },
  },
});
