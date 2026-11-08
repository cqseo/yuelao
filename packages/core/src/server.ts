import { env as workerEnv } from 'cloudflare:workers';
import { getUserFromRequest, type SessionUser } from './auth';
import type { CheckoutBody } from './billing/checkout';
import { createCheckoutSession } from './billing/checkout';
import { settleStripeWebhook } from './billing/settle';
import { StripeProvider } from './billing/stripe';
import type { CoreEnv } from './env';
import { errorResponse, readJson } from './http';
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

  // webhookSecret is unused by createCheckout; only parseWebhook (the webhook route) reads it.
  // Pass requireWebhookSecret: true from that route so a misconfigured secret fails loudly there,
  // not here.
  function stripeProvider(env: CoreEnv, requireWebhookSecret: boolean) {
    return new StripeProvider({
      secretKey: required(env, 'STRIPE_SECRET_KEY'),
      webhookSecret: requireWebhookSecret ? required(env, 'STRIPE_WEBHOOK_SECRET') : (env.STRIPE_WEBHOOK_SECRET ?? ''),
      automaticTax: site.billing.automaticTax,
    });
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
      webhook: (request: Request) => {
        const ctx = context();
        return settleStripeWebhook({
          site,
          provider: stripeProvider(ctx.env, true),
          supabase: ctx.supabaseService,
          request,
        });
      },
      checkout: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        if (!user) return errorResponse(401, 'unauthenticated');
        if (!ctx.supabaseService) {
          return errorResponse(503, 'supabase_not_configured', 'Supabase is not configured for this worker');
        }
        const body = await readJson<CheckoutBody>(request);
        if (!body || typeof body.productId !== 'string' || typeof body.locale !== 'string') {
          return errorResponse(400, 'invalid_body');
        }
        return createCheckoutSession({
          site,
          provider: stripeProvider(ctx.env, false),
          supabase: ctx.supabaseService,
          user,
          baseURL: ctx.baseURL,
          body,
        });
      },
    },
  };
}

export type Core = ReturnType<typeof createCore>;
