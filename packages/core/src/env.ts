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
  /** Overrides site.url in local dev, e.g. http://localhost:5173. */
  APP_URL?: string;

  /** Configure the set matching billing.provider in site.config.ts. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Test checkouts are disabled unless explicitly set to "true". */
  BILLING_ENABLE_TEST_CHECKOUT?: string;
  /** 測試結帳只開給這些信箱（逗號分隔）；沒設就誰都不開。 */
  BILLING_TEST_ALLOWED_EMAILS?: string;
  /** AI delivery is disabled until staging review and explicit opt-in. */
  AI_ENABLE_TEST_GENERATION?: string;
  /** Secret: configured only in Worker secrets, never public code. */
  OPENAI_API_KEY?: string;
  /** Explicit allowlisted model ID for the Responses API. */
  OPENAI_MODEL?: string;
  /** OpenAI 相容中轉站的網址（https，例如 https://relay.example.com/v1）。設了就改走 chat/completions；不設走 OpenAI 官方。 */
  OPENAI_BASE_URL?: string;
  /** Private AI chat, intentionally disabled until a paid-model budget is accepted. */
  AI_CHAT_ENABLED?: string;
  /** Explicit model name; server-only, not exposed as a client configuration. */
  OPENAI_CHAT_MODEL?: string;

  /** 許願池：設成 "true" 才開放讀寫；預設關閉。 */
  WISHES_ENABLED?: string;
  /** 設成 "true" 才把願望文字送 OpenAI moderation 自動審核；否則每則都停在待審，等人工放行。 */
  WISH_AUTO_MODERATION?: string;

  /** Rybbit collector endpoint (e.g. https://events.example.com/api); the site's /stats/* is proxied here. */
  RYBBIT_UPSTREAM?: string;
}
