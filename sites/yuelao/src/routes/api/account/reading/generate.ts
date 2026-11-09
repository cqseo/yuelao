import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Server-only: requires verified Supabase session, entitlements and test AI enablement.
export const Route = createFileRoute('/api/account/reading/generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.generate(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
