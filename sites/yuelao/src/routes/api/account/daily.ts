import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 每日心箋簽到：登入者的簽到日子存在帳號裡（見 DESIGN.md「每日簽到同步到帳號」）。
export const Route = createFileRoute('/api/account/daily')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.daily(request);
        } catch {
          return errorResponse(503, 'daily_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.daily(request);
        } catch {
          return errorResponse(503, 'daily_unavailable');
        }
      },
    },
  },
});
