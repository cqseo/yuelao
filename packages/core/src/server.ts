import { env as workerEnv } from 'cloudflare:workers';
import { getUserFromRequest, type SessionUser } from './auth';
import { settleStripeWebhook } from './billing/settle';
import { StripeProvider } from './billing/stripe';
import type { CoreEnv } from './env';
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
