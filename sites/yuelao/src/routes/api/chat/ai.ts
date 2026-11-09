import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Both handlers are server-side. Public Worker has AI_CHAT_ENABLED=false.
export const Route = createFileRoute('/api/chat/ai')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.companion.status(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.companion.chat(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
