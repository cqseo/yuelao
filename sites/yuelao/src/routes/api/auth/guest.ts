import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 訪客帳號：沒登入的人按解鎖時建（packages/core/src/guest-auth.ts）。憑證只放 HttpOnly cookie。
export const Route = createFileRoute('/api/auth/guest')({
  server: {
    handlers: {
      // 前端用來決定要不要寫「需先登入」：開了訪客，沒登入也能直接付款
      GET: async () => {
        const { core } = await import('~/core.server');
        try {
          return await core.auth.guestStatus();
        } catch {
          return errorResponse(503, 'auth_unavailable');
        }
      },
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.auth.guest(request);
        } catch {
          return errorResponse(503, 'auth_unavailable');
        }
      },
    },
  },
});
