import type { SupabaseClient } from '@supabase/supabase-js';

// Reads for unlocks / pack uses. All money writes go through RPCs (see billing/settle.ts);
// this module only reads, and only via the service client from the Worker.

export async function hasUnlock(
  supabase: SupabaseClient,
  userId: string,
  stickId: number,
  category: string,
  locale: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('unlocks')
    .select('id')
    .eq('user_id', userId)
    .eq('stick_id', stickId)
    .eq('category', category)
    .eq('locale', locale)
    .eq('revoked', false)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Returns the deep-reading body for an unlocked stick, or null when not unlocked.
 * The RPC checks the unlock itself; this function never returns body without one.
 */
export async function getDeepReading(
  supabase: SupabaseClient,
  userId: string,
  stickId: number,
  category: string,
  locale: string,
): Promise<string | null> {
  // Prefer the per-user AI report; legacy static readings are still supported.
  const { data: personalized, error: personalizedError } = await supabase.rpc('get_paid_ai_reading', {
    p_user_id: userId,
    p_stick_id: stickId,
    p_category: category,
    p_locale: locale,
  });
  if (personalizedError) throw personalizedError;
  if (typeof personalized === 'string' && personalized.length > 0) return personalized;

  const { data, error } = await supabase.rpc('get_deep_reading', {
    p_user_id: userId,
    p_stick_id: stickId,
    p_category: category,
    p_locale: locale,
  });
  if (error) return null;
  return typeof data === 'string' ? data : null;
}
