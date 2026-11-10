import { createFileRoute } from '@tanstack/react-router';
import { robotsTxt } from '@yuelao/core/seo';
import site from '../../site.config';

// AI search crawlers are welcome; training crawlers are not (see docs/architecture.md).
const AI_RULES = [
  '',
  'User-agent: OAI-SearchBot',
  'Allow: /',
  '',
  'User-agent: ChatGPT-User',
  'Allow: /',
  '',
  'User-agent: PerplexityBot',
  'Allow: /',
  '',
  'User-agent: GPTBot',
  'Disallow: /',
  '',
  'User-agent: ClaudeBot',
  'Disallow: /',
  '',
  'User-agent: Claude-Web',
  'Disallow: /',
  '',
  'User-agent: CCBot',
  'Disallow: /',
  '',
  'User-agent: Google-Extended',
  'Disallow: /',
];

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        import.meta.env.VITE_SITE_STAGING === 'true'
          ? new Response('User-agent: *\\nDisallow: /\\n', {
              headers: {
                'content-type': 'text/plain; charset=utf-8',
                'cache-control': 'no-store',
                'x-robots-tag': 'noindex, nofollow',
              },
            })
          : robotsTxt(site, ['/api/', '/account', '/login', '/billing/'], AI_RULES),
    },
  },
});
