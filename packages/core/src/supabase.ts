import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CoreEnv } from './env';

export type Supabase = SupabaseClient;

function configured(url: string | undefined, key: string | undefined): boolean {
  return typeof url === 'string' && url.length > 0 && typeof key === 'string' && key.length > 0;
}

/** Browser/anon client (RLS applies). Returns null when Supabase isn't configured. */
export function createAnonClient(
  env: Pick<CoreEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>,
): SupabaseClient | null {
  if (!configured(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

/**
 * Service-role client (bypasses RLS). Server only — never pass this to the browser.
 * Returns null when unconfigured; callers must handle null (503), not crash.
 */
export function createServiceClient(
  env: Pick<CoreEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
): SupabaseClient | null {
  if (!configured(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

export function hasSupabase(env: Pick<CoreEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>): boolean {
  return configured(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
