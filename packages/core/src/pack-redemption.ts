import type { SupabaseClient } from '@supabase/supabase-js';
import { aiGenerationEnabled } from './ai-reading';
import type { SessionUser } from './auth';
import { sameOriginPost } from './auth-session';
import type { CoreEnv } from './env';
import { errorResponse, json } from './http';
import { parseReadingParams } from './reading';

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export async function redeemPackRequest(
  request: Request,
  database: SupabaseClient | null,
  user: SessionUser | null,
  env: CoreEnv,
): Promise<Response> {
  if (!sameOriginPost(request)) return errorResponse(403, 'invalid_origin');
  if (!user) return errorResponse(401, 'login_required');
  if (!database || !aiGenerationEnabled(env)) return errorResponse(503, 'ai_delivery_disabled');
  const text = await request.text();
  if (text.length > 512) return errorResponse(413, 'request_too_large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return errorResponse(400, 'invalid_selection');
  const value = parsed as Record<string, unknown>;
  const params = new URL('https://example.invalid/');
  params.searchParams.set('stickId', String(value.stickId));
  params.searchParams.set('category', String(value.category));
  params.searchParams.set('locale', String(value.locale));
  const reading = parseReadingParams(params);
  if (!reading || typeof value.packId !== 'string' || !uuid.test(value.packId))
    return errorResponse(400, 'invalid_selection');

  const { data, error } = await database.rpc('consume_pack_use', {
    p_user_id: user.id,
    p_pack_id: value.packId,
    p_stick_id: reading.stickId,
    p_category: reading.category,
    p_locale: reading.locale,
  });
  if (error) {
    // Do not expose database internals or cross-user row identity.
    return errorResponse(error.code === 'P0001' ? 409 : 503, 'pack_redemption_unavailable');
  }
  if (typeof data !== 'string' || !uuid.test(data)) return errorResponse(503, 'pack_redemption_unavailable');
  return json({ unlockId: data, ...reading }, { status: 201 });
}
