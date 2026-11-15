import { createFileRoute } from '@tanstack/react-router';

// 第一方行為紀錄：瀏覽器批次送事件進來，邏輯在 packages/core/src/site-events.ts。永遠回 204。
export const Route = createFileRoute('/api/track')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.analytics.track(request);
        } catch {
          return new Response(null, { status: 204 });
        }
      },
    },
  },
});
