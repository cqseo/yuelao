import { env as workerEnv } from 'cloudflare:workers';
import { accountSnapshot } from './account';
import { adminUsersRequest, adminWishesRequest, adminWishReviewRequest } from './admin-manage';
import { adminStatsRequest } from './admin-stats';
import {
  aiGenerationEnabled,
  generatePaidReadingRequest,
  previewReadingRequest,
  type StickContextProvider,
} from './ai-reading';
import { getAccountUser, getUserFromRequest, type SessionUser } from './auth';
import { logoutUser, refreshLogin, sendEmailCode, verifyEmailCode } from './auth-handlers';
import { sameOriginPost } from './auth-session';
import { createTestCheckout } from './billing/checkout';
import { billingMode, buyerAllowed, checkoutGate, keyMatchesMode } from './billing/mode';
import { settleStripeWebhook } from './billing/settle';
import { StripeProvider } from './billing/stripe';
import { companionChatRequest, companionStatus } from './companion-chat';
import { dailyCheckinRequest } from './daily-checkin';
import type { CoreEnv } from './env';
import { createGuestRequest, guestsEnabled, sendGuestBindCode, verifyGuestBindCode } from './guest-auth';
import { hallOfferingRequest } from './hall-offering';
import { errorResponse, json } from './http';
import { finishGoogleLogin, startGoogleLogin } from './oauth-google';
import { redeemPackRequest } from './pack-redemption';
import { adminPartnersRequest, partnerSelfRequest } from './partners';
import { paidReadingResponse } from './reading';
import { askFollowupRequest, followupStatusRequest } from './reading-followup';
import type { SiteConfig } from './site';
import { trackRequest } from './site-events';
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

export interface CoreOptions {
  /** 付費解籤用的籤內容，要和籤頁顯示的一致（站點提供；沒有就退回資料庫 sticks 表）。 */
  stickContext?: StickContextProvider;
}

export function createCore(site: SiteConfig, options: CoreOptions = {}) {
  function context() {
    const env = workerEnv as unknown as CoreEnv;
    return {
      env,
      baseURL: (env.APP_URL ?? site.url).replace(/\/$/, ''),
      supabaseAnon: createAnonClient(env),
      supabaseService: createServiceClient(env),
    };
  }

  function admins(): string[] {
    const extra = (context().env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    return [...(site.adminEmails ?? [site.supportEmail]), ...extra];
  }

  /** 只為了查手續費（分銷結算）；沒設 Stripe 金鑰就回 null，報表照出，手續費標「待入帳」。 */
  function feeLookup(): StripeProvider | null {
    const env = context().env;
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return null;
    return new StripeProvider({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      automaticTax: site.billing.automaticTax,
      taxCode: site.billing.taxCode,
      taxBehavior: site.billing.taxBehavior,
      live: billingMode(env) === 'live',
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
    auth: {
      send: (request: Request) => sendEmailCode(request, context().supabaseAnon),
      verify: (request: Request) => verifyEmailCode(request, context().supabaseAnon),
      refresh: (request: Request) => refreshLogin(request, context().supabaseAnon),
      logout: (request: Request) => logoutUser(request, context().supabaseService),
      googleStart: (request: Request) => {
        const ctx = context();
        return startGoogleLogin(request, ctx.env, ctx.baseURL);
      },
      googleCallback: (request: Request) => {
        const ctx = context();
        return finishGoogleLogin(request, ctx.env, ctx.baseURL);
      },
      // 訪客帳號：按解鎖時建、之後綁信箱（guest-auth.ts）
      guestStatus: () => json({ enabled: guestsEnabled(context().env) }),
      guest: (request: Request) => {
        const ctx = context();
        return createGuestRequest(request, ctx.env, () => createAnonClient(ctx.env), ctx.supabaseService);
      },
      guestEmail: (request: Request) => {
        const ctx = context();
        return sendGuestBindCode(request, () => createAnonClient(ctx.env));
      },
      guestVerify: (request: Request) => {
        const ctx = context();
        return verifyGuestBindCode(request, () => createAnonClient(ctx.env));
      },
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
    analytics: {
      track: (request: Request) => {
        const ctx = context();
        return trackRequest(
          request,
          ctx.supabaseService,
          () => getUserFromRequest(request, ctx.env),
          admins(),
        );
      },
      adminStats: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return adminStatsRequest(request, ctx.supabaseService, user, admins());
      },
      adminWishes: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return request.method === 'POST'
          ? adminWishReviewRequest(request, ctx.supabaseService, user, admins())
          : adminWishesRequest(ctx.supabaseService, user, admins());
      },
      adminUsers: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return adminUsersRequest(request, ctx.supabaseService, user, admins());
      },
      /** 站長預覽解籤（新舊提示詞對照），不存、不扣權益。 */
      readingPreview: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        if (!user) return errorResponse(401, 'auth_required');
        if (!admins().some((a) => a.toLowerCase() === user.email.toLowerCase())) return errorResponse(403, 'forbidden');
        return previewReadingRequest(request, ctx.env, options.stickContext);
      },
      /** 分銷：GET 推廣人列表與報表；POST 新增推廣人。 */
      adminPartners: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        if (!user) return errorResponse(401, 'auth_required');
        if (!admins().some((a) => a.toLowerCase() === user.email.toLowerCase())) return errorResponse(403, 'forbidden');
        if (!ctx.supabaseService) return errorResponse(503, 'supabase_not_configured');
        return adminPartnersRequest(request, ctx.supabaseService, feeLookup(), ctx.baseURL);
      },
      /** 分銷：推廣人用私密連結看自己的數據（不用登入）。 */
      partner: async (request: Request) => {
        const ctx = context();
        return partnerSelfRequest(request, ctx.supabaseService, feeLookup());
      },
      isAdmin: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return Boolean(user && admins().some((a) => a.toLowerCase() === user.email.toLowerCase()));
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
        const user = await getAccountUser(request, ctx.env);
        return generatePaidReadingRequest(request, ctx.supabaseService, user, ctx.env, options.stickContext);
      },
      /** 追問月老：這份解籤的追問狀態與已答內容。 */
      followups: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
        return followupStatusRequest(request, ctx.supabaseService, user, ctx.env);
      },
      /** 追問月老：用掉一個已付錢的名額，請月老回答。 */
      followupAsk: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
        return askFollowupRequest(request, ctx.supabaseService, user, ctx.env, options.stickContext);
      },
      redeem: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
        return redeemPackRequest(request, ctx.supabaseService, user, ctx.env);
      },
      reading: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
        return paidReadingResponse(request, ctx.supabaseService, user);
      },
      daily: async (request: Request) => {
        const ctx = context();
        const user = await getUserFromRequest(request, ctx.env);
        return dailyCheckinRequest(request, ctx.supabaseService, user);
      },
      spread: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
        return spreadReadingResponse(request, ctx.supabaseService, user);
      },
      spreadGenerate: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
        return generateSpreadReadingRequest(request, ctx.supabaseService, user, ctx.env);
      },
      snapshot: async (request: Request) => {
        const ctx = context();
        const user = await getAccountUser(request, ctx.env);
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
        // 訪客也能結帳（買到的記在訪客帳號上，之後綁信箱帶走）
        const user = await getAccountUser(request, ctx.env);
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
