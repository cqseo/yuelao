import { sessionTokens } from './auth-session';
import type { CoreEnv } from './env';
import { createAnonClient } from './supabase';

/** A full account: signed in with a verified email (code or Google). */
export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Anyone with a session, including a guest (Supabase anonymous user, no email yet).
 * Only the endpoints that let guests buy and read what they bought accept this
 * (checkout, paid readings, account status). Everything else keeps requiring a SessionUser.
 */
export interface AccountUser {
  id: string;
  email: string | null;
  guest?: boolean;
}

/** Verifies the session token and returns whoever it belongs to, guests included. */
export async function getAccountUser(request: Request, env: CoreEnv): Promise<AccountUser | null> {
  const header = request.headers.get('authorization');
  const token = (header?.startsWith('Bearer ') ? header.slice(7) : null) ?? sessionTokens(request).access;
  if (!token) return null;
  const supabase = createAnonClient(env);
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  if (data.user.is_anonymous) return { id: data.user.id, email: null, guest: true };
  if (!data.user.email) return null;
  return { id: data.user.id, email: data.user.email, guest: false };
}

/**
 * Reads the Supabase JWT from the Authorization header and verifies it.
 * Returns null when signed out, for guests, when the token is invalid, or when Supabase isn't configured.
 */
export async function getUserFromRequest(request: Request, env: CoreEnv): Promise<SessionUser | null> {
  const user = await getAccountUser(request, env);
  if (!user || user.guest || !user.email) return null;
  return { id: user.id, email: user.email };
}
