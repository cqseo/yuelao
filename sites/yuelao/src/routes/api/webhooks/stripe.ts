import { createFileRoute } from '@tanstack/react-router';
import { WebhookSignatureError } from '@yuelao/core/billing/provider';
import { errorResponse } from '@yuelao/core/http';

// In the Stripe dashboard set the webhook URL to https://<domain>/api/webhooks/stripe.
// Events are listed in docs/local-development.md. Untested until P4 (no Stripe keys yet).
export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.billing.webhook(request);
        } catch (error) {
          if (error instanceof WebhookSignatureError) return errorResponse(400, 'invalid_signature');
          if (error instanceof Error && error.message.startsWith('missing env')) {
            return errorResponse(503, 'not_configured', error.message);
          }
          throw error;
        }
      },
    },
  },
});
