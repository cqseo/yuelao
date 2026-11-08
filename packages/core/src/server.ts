import { env as workerEnv } from 'cloudflare:workers';
import { getUserFromRequest, type SessionUser } from './auth';
import { createTestCheckout } from './billing/checkout';
import { settleStripeWebhook } from './billing/settle';
import { StripeProvider } from './billing/stripe';
import type { CoreEnv } from './env';
import { errorResponse } from './http';
import type { SiteConfig } from './site';
import { createAnonClient, createServiceClient } from './supabase';

// Server entry for a site: call createCore(site) once in src/core.server.ts,
// and keep route files as thin forwarders, e.g. POST: ({ request }) => core.billing.webhook(request).
// Env is read lazily per call; missing keys never break the homepage — only the
// route that needs them throws a clear "missing env" error.

function required(env: CoreEnv, name: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'): string {
  const value = env[name];
  if (typeof value !== 'string' || !value) throw new Error(`missing env ${name}`);
  return value;
}

export function createCore(site: SiteConfig) {
  function context() {
    const env = workerEnv as unknown as CoreEnv;
    return {
      env,
      baseURL: (env.APP_URL ?? site.url).replace(/\/$/, ''),
      supabaseAnon: createAnonClient(env),
      supabaseService: createServiceClient(env),
    };
  }

  return {
    site,
    get env() {
      return context().env;
    },
    get baseURL() {
      return context().baseURL;
    },
    get supabaseAnon() {
      return context().supabaseAnon;
    },
    get supabaseService() {
      return context().supabaseService;
    },
    getUser: (request: Request): Promise<SessionUser | null> => getUserFromRequest(request, context().env),
    billing: {
      checkout: async (request: Request) => {
        const ctx = context();
        if (ctx.env.BILLING_ENABLE_TEST_CHECKOUT !== 'true') return errorResponse(503, 'checkout_disabled');
        // Never launch a live charge through an unreviewed test-only checkout path.
        if (!ctx.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
          return errorResponse(503, 'test_key_required');
        if (!ctx.supabaseAnon || !ctx.supabaseService) return errorResponse(503, 'supabase_not_configured');
        if (!ctx.env.STRIPE_WEBHOOK_SECRET) return errorResponse(503, 'webhook_not_configured');
        const user = await getUserFromRequest(request, ctx.env);
        if (!user) return errorResponse(401, 'login_required');
        const provider = new StripeProvider({
          secretKey: ctx.env.STRIPE_SECRET_KEY,
          webhookSecret: ctx.env.STRIPE_WEBHOOK_SECRET,
          automaticTax: site.billing.automaticTax,
        });
        return createTestCheckout({
          request,
          site,
          provider,
          database: ctx.supabaseService,
          user,
          baseUrl: ctx.baseURL,
        });
      },
      webhook: (request: Request) => {
        const ctx = context();
        const provider = new StripeProvider({
          secretKey: required(ctx.env, 'STRIPE_SECRET_KEY'),
          webhookSecret: required(ctx.env, 'STRIPE_WEBHOOK_SECRET'),
          automaticTax: site.billing.automaticTax,
        });
        return settleStripeWebhook({
          site,
          provider,
          supabase: ctx.supabaseService,
          request,
        });
      },
    },
  };
}

export type Core = ReturnType<typeof createCore>;
