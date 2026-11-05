import { createServerFn } from '@tanstack/react-start';

// Public config the browser needs (Supabase URL + anon key). Values come from wrangler vars
// or .dev.vars, not baked into the build. The anon key is public by design; RLS still applies.
export const getPublicConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const { core } = await import('~/core.server');
  const env = core.env;
  return {
    supabaseUrl: env.SUPABASE_URL || null,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || null,
  };
});
