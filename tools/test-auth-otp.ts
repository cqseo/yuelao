import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  logoutUser,
  refreshLogin,
  sendEmailCode,
  verifyEmailCaptcha,
  verifyEmailCode,
} from '../packages/core/src/auth-handlers';

const origin = 'https://auth-test.example.invalid';
let sent = 0,
  verified = 0,
  refreshed = 0;
const token = 'test_access_token_not_valid';
const refresh = 'test_refresh_token_not_valid';
const captchaToken = 'verified-captcha-token-for-local-tests';
const captchaSecret = 'test-only-turnstile-secret';
let captchaChecks = 0;
const captchaVerifier = async (request: Request, token: string, secret: string) => {
  captchaChecks++;
  assert.equal(new URL(request.url).origin, origin);
  assert.equal(token, captchaToken);
  assert.equal(secret, captchaSecret);
  return true;
};
function request(path: string, payload: unknown, cookie = '', hostileOrigin = '') {
  return new Request(origin + path, {
    method: 'POST',
    headers: {
      origin: hostileOrigin || origin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
}
const client = {
  auth: {
    signInWithOtp: async (args: unknown) => {
      sent++;
      assert.deepEqual(args, { email: 'safe@example.invalid', options: { shouldCreateUser: true } });
      return { data: {}, error: null };
    },
    verifyOtp: async (args: unknown) => {
      verified++;
      assert.deepEqual(args, { email: 'safe@example.invalid', token: '123456', type: 'email' });
      return {
        data: {
          user: { id: '00000000-0000-4000-8000-000000000001', email: 'safe@example.invalid' },
          session: { access_token: token, refresh_token: refresh, expires_in: 3600 },
        },
        error: null,
      };
    },
    refreshSession: async ({ refresh_token }: { refresh_token: string }) => {
      refreshed++;
      assert.equal(refresh_token, refresh);
      return {
        data: { session: { access_token: token, refresh_token: refresh, expires_in: 3600 } },
        error: null,
      };
    },
    admin: { signOut: async () => ({ error: null }) },
  },
} as unknown as SupabaseClient;
assert.equal(
  (
    await sendEmailCode(
      request('/api/auth/send', { email: 'safe@example.invalid' }, '', 'https://evil.invalid'),
      client,
    )
  ).status,
  403,
);
assert.equal(
  (
    await sendEmailCode(
      request('/api/auth/send', { email: 'bad-email' }),
      client,
      captchaSecret,
      captchaVerifier,
    )
  ).status,
  400,
);
assert.equal(
  (await sendEmailCode(request('/api/auth/send', { email: 'safe@example.invalid' }), null)).status,
  503,
);
assert.equal(sent, 0);
assert.equal(
  (
    await sendEmailCode(
      request('/api/auth/send', { email: 'safe@example.invalid' }),
      client,
      captchaSecret,
      captchaVerifier,
    )
  ).status,
  400,
);
assert.equal(
  (
    await sendEmailCode(
      request('/api/auth/send', { email: 'safe@example.invalid', captchaToken }),
      client,
    )
  ).status,
  503,
);
assert.equal(
  (
    await sendEmailCode(
      request('/api/auth/send', { email: 'safe@example.invalid', captchaToken }),
      client,
      captchaSecret,
      async () => false,
    )
  ).status,
  403,
);
const sentResp = await sendEmailCode(
  request('/api/auth/send', { email: 'SAFE@example.invalid', captchaToken }),
  client,
  captchaSecret,
  captchaVerifier,
);
assert.equal(sentResp.status, 200);
assert.equal(sent, 1);
assert.equal(captchaChecks, 1);
console.log('PASS: OTP send origin guard, real CAPTCHA gate, email normalization and bad inputs');
assert.equal(
  (
    await verifyEmailCode(
      request('/api/auth/verify', { email: 'safe@example.invalid', code: '12345' }),
      client,
    )
  ).status,
  400,
);
assert.equal(
  (
    await verifyEmailCode(
      request(
        '/api/auth/verify',
        { email: 'safe@example.invalid', code: '123456' },
        '',
        'https://evil.invalid',
      ),
      client,
    )
  ).status,
  403,
);
assert.equal(verified, 0);
const verifiedResp = await verifyEmailCode(
  request('/api/auth/verify', { email: 'safe@example.invalid', code: '123456' }),
  client,
);
assert.equal(verifiedResp.status, 200);
assert.equal(verified, 1);
const cookies = verifiedResp.headers.getSetCookie();
assert.equal(cookies.length, 2);
assert.ok(
  cookies.some(
    (c) =>
      c.includes('__Host-yl_access=') &&
      c.includes('HttpOnly') &&
      c.includes('Secure') &&
      c.includes('SameSite=Lax') &&
      c.includes('Path=/'),
  ),
);
assert.ok(
  cookies.some((c) => c.includes('__Host-yl_refresh=') && c.includes('HttpOnly') && c.includes('Secure')),
);
console.log('PASS: OTP verified, host-only Secure HttpOnly cookies issued');
const refreshCookie = `__Host-yl_refresh=${encodeURIComponent(refresh)}`;
assert.equal((await refreshLogin(request('/api/auth/refresh', {}, ''), client)).status, 401);
const refreshedResp = await refreshLogin(request('/api/auth/refresh', {}, refreshCookie), client);
assert.equal(refreshedResp.status, 200);
assert.equal(refreshed, 1);
console.log('PASS: session refresh requires server-managed cookie');
const loggedOut = await logoutUser(request('/api/auth/logout', {}, `__Host-yl_access=${token}`), client);
assert.equal(loggedOut.status, 200);
const cleared = loggedOut.headers.getSetCookie();
assert.equal(cleared.length, 2);
assert.ok(cleared.every((c) => c.includes('Max-Age=0')));
console.log('PASS: logout clears both session cookies');
const challengeResponse = async () => new Response(JSON.stringify({
  success: true,
  hostname: new URL(origin).hostname,
  action: 'auth_send',
}), { status: 200 });
assert.equal(
  await verifyEmailCaptcha(
    request('/api/auth/send', {}),
    captchaToken,
    captchaSecret,
    challengeResponse as typeof fetch,
  ),
  true,
);
const badChallengeResponse = async () => new Response(JSON.stringify({
  success: true,
  hostname: 'not-our-domain.invalid',
  action: 'auth_send',
}), { status: 200 });
assert.equal(
  await verifyEmailCaptcha(
    request('/api/auth/send', {}),
    captchaToken,
    captchaSecret,
    badChallengeResponse as typeof fetch,
  ),
  false,
);
console.log('PASS: Turnstile success and wrong-domain rejection');
console.log('ALL MOCK AUTH OTP TESTS PASSED; NO REAL EMAILS SENT');
