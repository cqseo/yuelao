import { env as workerEnv } from 'cloudflare:workers';
import { accountSnapshot } from './account';
import { aiGenerationEnabled, generatePaidReadingRequest } from './ai-reading';
import { getUserFromRequest, type SessionUser } from './auth';
import { logoutUser, refreshLogin, sendEmailCode, verifyEmailCode } from './auth-handlers';
import { sameOriginPost } from './auth-session';
import { createTestCheckout } from './billing/checkout';
import { billingMode, buyerAllowed, checkoutGate, keyMatchesMode } from './billing/mode';
import { settleStripeWebhook } from './billing/settle';
import { StripeProvider } from './billing/stripe';
import { companionChatRequest, companionStatus } from './companion-chat';
import { dailyCheckinRequest } from './daily-checkin';
import type { CoreEnv } from './env';
import { hallOfferingRequest } from './hall-offering';
import { errorResponse } from './http';
import { redeemPackRequest } from './pack-redemption';
import { paidReadingResponse } from './reading';
import type { SiteConfig } from './site';
import { generateSpreadReadingRequest, spreadReadingResponse } from './spread-reading';
import { createAnonClient, createServiceClient } from './supabase';
import { listWishesResponse, wishActionRequest } from './wishes';

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
    auth: {
      send: (request: Request) => sendEmailCode(request, context().supabaseAnon),
      verify: (request: Request) => verifyEmailCode(request, context().supabaseAnon),
      refresh: (request: Request) => refreshLogin(request, context().supabaseAnon),
      logout: (request: Request) => logoutUser(request, context().supabaseService),
    },
    companion: {
      status: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return companionStatus(ctx.supabaseService, ctx.env, user);
      },
      chat: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return companionChatRequest(request, ctx.supabaseService, user, ctx.env);
      },
    },
    hall: {
      offering: async (request: Request) => {
        const ctx = context();
        return hallOfferingRequest(request, ctx.supabaseService, site.id);
      },
    },
    wishes: {
      list: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return listWishesResponse(ctx.supabaseService, user, ctx.env);
      },
      act: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return wishActionRequest(request, ctx.supabaseService, user, ctx.env);
      },
    },
    account: {
      generate: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return generatePaidReadingRequest(request, ctx.supabaseService, user, ctx.env);
      },
      redeem: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return redeemPackRequest(request, ctx.supabaseService, user, ctx.env);
      },
      reading: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return paidReadingResponse(request, ctx.supabaseService, user);
      },
      daily: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return dailyCheckinRequest(request, ctx.supabaseService, user);
      },
      spread: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return spreadReadingResponse(request, ctx.supabaseService, user);
      },
      spreadGenerate: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return generateSpreadReadingRequest(request, ctx.supabaseService, user, ctx.env);
      },
      snapshot: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        const enabled = checkoutGate(ctx.env) === null && Boolean(ctx.supabaseService);
        return accountSnapshot(ctx.supabaseService, user, enabled, aiGenerationEnabled(ctx.env));
      },
    },
    billing: {
      checkout: async (request: Request) => {
        if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
        const ctx = context();
        // 測試模式要 BILLING_ENABLE_TEST_CHECKOUT 與測試金鑰；正式模式（BILLING_MODE=live）只收正式金鑰。
        const gate = checkoutGate(ctx.env);
        if (gate) return errorResponse(503, gate);
        // A staging purchase must never redirect back to the live site.
        if (new URL(ctx.baseURL).origin !== new URL(request.url).origin) {
          return errorResponse(503, 'checkout_origin_mismatch');
        }
        // Do not accept any payment before an AI fulfillment pipeline is available.
        if (!aiGenerationEnabled(ctx.env)) return errorResponse(503, 'paid_content_unavailable');
        if (!ctx.supabaseAnon || !ctx.supabaseService) return errorResponse(503, 'supabase_not_configured');
        const { data: deliveryReady, error: deliveryError } =
          await ctx.supabaseService.rpc('paid_ai_delivery_ready');
        if (deliveryError || deliveryReady !== true) return errorResponse(503, 'delivery_schema_unavailable');
        const user = await getUserFromRequest(request, ctx.env);
        if (!user) return errorResponse(401, 'login_required');
        // 測試模式：測試卡號是公開的，只讓白名單上的帳號結帳，其他人看到的跟「沒開賣」一樣。正式模式不限。
        if (!buyerAllowed(ctx.env, user.email)) {
          return errorResponse(503, 'checkout_disabled');
        }
        const provider = new StripeProvider({
          secretKey: required(ctx.env, 'STRIPE_SECRET_KEY'),
          webhookSecret: required(ctx.env, 'STRIPE_WEBHOOK_SECRET'),
          automaticTax: site.billing.automaticTax,
          taxCode: site.billing.taxCode,
          taxBehavior: site.billing.taxBehavior,
          live: billingMode(ctx.env) === 'live',
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
        // Keep refund events processable even when checkout is switched off,
        // but only with a key that matches the billing mode (test key in test mode, live key in live mode).
        if (!keyMatchesMode(ctx.env)) {
          return errorResponse(503, 'key_mode_mismatch');
        }
        const provider = new StripeProvider({
          secretKey: required(ctx.env, 'STRIPE_SECRET_KEY'),
          webhookSecret: required(ctx.env, 'STRIPE_WEBHOOK_SECRET'),
          automaticTax: site.billing.automaticTax,
          taxCode: site.billing.taxCode,
          taxBehavior: site.billing.taxBehavior,
          live: billingMode(ctx.env) === 'live',
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
