import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// 塔羅館完整解讀的生成：必須已登入、已付款（webhook 發的解鎖），且生成功能已開。
export const Route = createFileRoute('/api/account/spread/generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.account.spreadGenerate(request);
        } catch {
          return errorResponse(503, 'service_unavailable');
        }
      },
    },
  },
});
