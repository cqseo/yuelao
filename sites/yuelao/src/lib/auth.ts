import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { getBrowserSupabase } from './supabase';

// Thin wrapper over Supabase Auth's email OTP (one-time code, no password).
// signInWithOtp() sends the code; verifyOtp() redeems it and starts the session.
// The checkout flow (src/lib/checkout.ts) is what actually needs the session —
// this hook just tracks it so a page can ask "is someone logged in yet".

export function useSupabaseSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const supabase = await getBrowserSupabase();
      if (!supabase) {
        if (!cancelled) setReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
      const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
      unsubscribe = () => listener.subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { session, ready };
}

/** Sends a 6-digit email code. Returns an error message, or null on success. */
export async function requestEmailCode(email: string): Promise<string | null> {
  const supabase = await getBrowserSupabase();
  if (!supabase) return 'not_configured';
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? error.message : null;
}

/** Redeems the code and starts the session. Returns an error message, or null on success. */
export async function verifyEmailCode(email: string, token: string): Promise<string | null> {
  const supabase = await getBrowserSupabase();
  if (!supabase) return 'not_configured';
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  return error ? error.message : null;
}
