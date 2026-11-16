import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

export const Route = createFileRoute('/api/auth/google/start')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.auth.googleStart(request);
        } catch {
          return errorResponse(503, 'google_login_unavailable');
        }
      },
    },
  },
});
