import { sessionTokens } from './auth-session';
import type { CoreEnv } from './env';
import { createAnonClient } from './supabase';

export interface SessionUser {
  id: string;
  email: string;
}

/** Payment, purchase and account APIs require verified non-anonymous email identity. */
export function hasVerifiedEmailIdentity(
  user:
    | {
        email?: string | null;
        email_confirmed_at?: string | null;
        is_anonymous?: boolean;
      }
    | null
    | undefined,
): boolean {
  return Boolean(user?.email && user.email_confirmed_at && user.is_anonymous !== true);
}

/**
 * Reads the Supabase JWT from the Authorization header and verifies it.
 * Returns null when signed out, when the token is invalid, or when Supabase isn't configured.
 */
export async function getUserFromRequest(request: Request, env: CoreEnv): Promise<SessionUser | null> {
  const header = request.headers.get('authorization');
  const token = (header?.startsWith('Bearer ') ? header.slice(7) : null) ?? sessionTokens(request).access;
  if (!token) return null;
  const supabase = createAnonClient(env);
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || !hasVerifiedEmailIdentity(data.user)) return null;
  return { id: data.user.id, email: data.user.email as string };
}
