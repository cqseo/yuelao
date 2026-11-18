// 用戶意見：欄位檢查、限流、站長權限外的標記檢查。全離線。
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoreEnv } from '../packages/core/src/env';
import { adminFeedbackRequest, parseFeedback, submitFeedbackRequest } from '../packages/core/src/feedback';

assert.ok(parseFeedback({ kind: 'idea', message: '想要合婚' }));
assert.equal(parseFeedback({ kind: 'spam', message: '想要合婚' }), null);
assert.equal(parseFeedback({ kind: 'idea', message: ' ' }), null);
assert.equal(parseFeedback({ kind: 'idea', message: 'x'.repeat(1001) }), null);
assert.equal(parseFeedback({ kind: 'idea', message: 'ok', contact: 'ab' }), null, 'contact too short');
assert.equal(parseFeedback({ kind: 'idea', message: 'ok', page: '/market?x=1#y' })?.page, '/market');
assert.equal(parseFeedback({ kind: 'idea', message: 'ok', page: 'https://evil.example' })?.page, null);
assert.equal(parseFeedback({ kind: 'other', message: 'ok', contact: '' })?.contact, null);
console.log('PASS: feedback fields are validated');

const inserted: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];
const db = {
  from: () => ({
    insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }),
    update: (set: Record<string, unknown>) => ({ eq: async () => (updated.push(set), { error: null }) }),
  }),
} as unknown as SupabaseClient;
let allowed = 2;
const env = {
  GUEST_RATE_LIMITER: { limit: async () => ({ success: allowed-- > 0 }) },
} as unknown as CoreEnv;
const post = (body: unknown, origin = 'https://yuexia.app') =>
  new Request('https://yuexia.app/api/feedback', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (iPhone)' },
    body: JSON.stringify(body),
  });
assert.equal(
  (await submitFeedbackRequest(post({ kind: 'idea', message: '想要合婚配對' }), db, null, env)).status,
  201,
);
assert.equal(inserted[0]!.device, 'mobile');
assert.equal(inserted[0]!.user_id, null);
assert.equal(
  (
    await submitFeedbackRequest(
      post({ kind: 'idea', message: 'hi' }),
      db,
      { id: 'u1', email: null, guest: true },
      env,
    )
  ).status,
  201,
);
assert.equal(inserted[1]!.user_id, 'u1');
assert.equal(
  (await submitFeedbackRequest(post({ kind: 'idea', message: 'third' }), db, null, env)).status,
  429,
);
assert.equal(
  (await submitFeedbackRequest(post({ kind: 'idea', message: 'x' }, 'https://evil.example'), db, null, env))
    .status,
  403,
);
console.log('PASS: anyone can send feedback, rate limited per IP, same origin only');

const mark = (body: unknown) =>
  adminFeedbackRequest(
    new Request('https://yuexia.app/api/admin/feedback', {
      method: 'POST',
      headers: { origin: 'https://yuexia.app', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    db,
  );
assert.equal((await mark({ id: '00000000-0000-4000-8000-000000000001', status: 'done' })).status, 200);
assert.equal(updated[0]!.status, 'done');
assert.equal((await mark({ id: 'x', status: 'done' })).status, 400);
assert.equal((await mark({ id: '00000000-0000-4000-8000-000000000001', status: 'deleted' })).status, 400);
console.log('PASS: admin marks feedback read or done');
