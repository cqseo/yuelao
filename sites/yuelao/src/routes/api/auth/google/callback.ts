import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { core } = await import('~/core.server');
        try {
          return await core.auth.googleCallback(request);
        } catch {
          // Never reflect identity provider errors or auth tokens into the URL.
          return new Response(null, {
            status: 303,
            headers: {
              location: new URL('/login?google=failed', request.url).toString(),
              'cache-control': 'private, no-store',
            },
          });
        }
      },
    },
  },
});
