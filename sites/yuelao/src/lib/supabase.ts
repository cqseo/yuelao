import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicConfig } from './public-config';

// Browser Supabase client (anon key + RLS). Created lazily from the server-provided public config.
// Returns null when Supabase isn't configured (P0: no project yet).
let client: SupabaseClient | null | undefined;

export async function getBrowserSupabase(): Promise<SupabaseClient | null> {
  if (client !== undefined) return client;
  const config = await getPublicConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    client = null;
    return null;
  }
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
