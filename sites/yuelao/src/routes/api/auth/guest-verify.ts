import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 訪客綁信箱第二步：驗證碼對了，訪客帳號變成正式的信箱帳號（帳號 ID 不變）。
export const Route = createFileRoute('/api/auth/guest-verify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.auth.guestVerify(request);
        } catch {
          return errorResponse(503, 'auth_unavailable');
        }
      },
    },
  },
});
