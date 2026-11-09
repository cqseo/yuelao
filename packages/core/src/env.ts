// Bindings and secrets a site Worker must provide. Configure the site's wrangler.jsonc and .dev.vars to match.

export interface CoreEnv {
  /** Supabase project URL, e.g. https://<ref>.supabase.co. Public; also exposed to the browser client. */
  SUPABASE_URL: string;
  /** Supabase anon key. Public; also exposed to the browser client (RLS still applies). */
  SUPABASE_ANON_KEY: string;
  /** Supabase service_role key. Secret: only in wrangler secret / .dev.vars, never in the browser bundle. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Sender address shown on emails. */
  EMAIL_FROM: string;
  /** Server-only Cloudflare Turnstile secret for email OTP anti-abuse. */
  TURNSTILE_SECRET_KEY?: string;
  /** Overrides site.url in local dev, e.g. http://localhost:5173. */
  APP_URL?: string;

  /** Configure the set matching billing.provider in site.config.ts. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Test checkouts are disabled unless explicitly set to "true". */
  BILLING_ENABLE_TEST_CHECKOUT?: string;
  /** AI delivery is disabled until staging review and explicit opt-in. */
  AI_ENABLE_TEST_GENERATION?: string;
  /** Secret: configured only in Worker secrets, never public code. */
  OPENAI_API_KEY?: string;
  /** Explicit allowlisted model ID for the Responses API. */
  OPENAI_MODEL?: string;
  /** Private AI chat, intentionally disabled until a paid-model budget is accepted. */
  AI_CHAT_ENABLED?: string;
  /** Explicit model name; server-only, not exposed as a client configuration. */
  OPENAI_CHAT_MODEL?: string;

  /** Rybbit collector endpoint (e.g. https://events.example.com/api); the site's /stats/* is proxied here. */
  RYBBIT_UPSTREAM?: string;
}
