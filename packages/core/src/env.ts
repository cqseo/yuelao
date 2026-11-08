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

  /** Rybbit collector endpoint (e.g. https://events.example.com/api); the site's /stats/* is proxied here. */
  RYBBIT_UPSTREAM?: string;
}
