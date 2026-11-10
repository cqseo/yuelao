import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Guest identities are gated by GUEST_AUTH_ENABLED; the browser never receives auth tokens.
export const Route = createFileRoute('/api/auth/guest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.auth.createGuest(request);
        } catch {
          return errorResponse(503, 'auth_unavailable');
        }
      },
    },
  },
});
