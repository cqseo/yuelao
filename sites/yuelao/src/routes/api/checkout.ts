import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '@yuelao/core/http';

// Frontend: POST with Authorization: Bearer <supabase access token> and a JSON body
// { productId, locale, stickId?, category? } (stickId/category required for 'unlock' products,
// see site.config.ts). Responds { url } to redirect to Stripe Checkout.
export const Route = createFileRoute('/api/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.billing.checkout(request);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('missing env')) {
            return errorResponse(503, 'not_configured', error.message);
          }
          throw error;
        }
      },
    },
  },
});
