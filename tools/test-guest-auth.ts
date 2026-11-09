import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createGuest,
  guestStatus,
  sendGuestEmailLink,
  verifyGuestEmailLink,
} from '../packages/core/src/guest-auth';

const origin = 'https://yuelao-test.example.invalid';
const userId = '00000000-0000-4000-8000-000000000123';
const anotherId = '00000000-0000-4000-8000-000000000999';
const email = 'visitor@example.invalid';
const captcha = 'captcha-token-at-least-twenty-chars';
const secret = 'test-turnstile-secret';
const session = {
  access_token: 'guest-test-access',
  refresh_token: 'guest-test-refresh',
  expires_in: 3600,
};
const cookie = '__Host-yl_access=guest-test-access; __Host-yl_refresh=guest-test-refresh';
const anonUser = { id: userId, email: null, is_anonymous: true };
const linkedUser = {
  id: userId,
  email,
  is_anonymous: false,
  email_confirmed_at: '2026-11-09T12:00:00Z',
};

let signupCount = 0;
let updateCount = 0;
let currentUser: typeof anonUser | typeof linkedUser = anonUser;
let verifiedId = userId;
const auth = {
  signInAnonymously: async () => {
    signupCount++;
    return { data: { user: anonUser, session }, error: null };
  },
  getUser: async () => ({ data: { user: currentUser }, error: null }),
  refreshSession: async () => ({ data: { user: currentUser, session }, error: null }),
  setSession: async () => ({ data: { user: currentUser, session }, error: null }),
  updateUser: async ({ email: e }: { email: string }) => {
    assert.equal(e, email);
    updateCount++;
    return { data: { user: anonUser }, error: null };
  },
  verifyOtp: async ({ email: e, token, type }: { email: string; token: string; type: string }) => {
    assert.equal(e, email);
    assert.equal(token, '123456');
    assert.equal(type, 'email_change');
    return {
      data: { user: { ...linkedUser, id: verifiedId }, session },
      error: null,
    };
  },
} as unknown as SupabaseClient['auth'];
let profileInserts = 0;
let profileUpdates = 0;
const client = {
  auth,
  from: (table: string) => {
    assert.equal(table, 'profiles');
    return {
      upsert: async (
        value: { id: string; locale: string },
        opts: { onConflict: string; ignoreDuplicates: boolean },
      ) => {
        assert.equal(value.id, userId);
        assert.equal(value.locale, 'zh-Hant');
        assert.deepEqual(opts, { onConflict: 'id', ignoreDuplicates: true });
        profileInserts++;
        return { error: null };
      },
      update: (value: { email: string }) => {
        assert.equal(value.email, email);
        return {
          eq: async (column: string, id: string) => {
            assert.equal(column, 'id');
            assert.equal(id, userId);
            profileUpdates++;
            return { error: null };
          },
        };
      },
    };
  },
} as unknown as SupabaseClient;
const challenge = async (
  _request: Request,
  token: string,
  key: string,
  _fetch: typeof fetch,
  action = 'auth_send',
) => token === captcha && key === secret && ['guest_create', 'email_link'].includes(action);

function request(path: string, payload: unknown, cookies = '', hostile = false) {
  return new Request(origin + path, {
    method: 'POST',
    headers: {
      origin: hostile ? 'https://hostile.example.invalid' : origin,
      'content-type': 'application/json',
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: JSON.stringify(payload),
  });
}

assert.equal(
  (
    await createGuest(
      request('/api/auth/guest', { captchaToken: captcha }, '', true),
      client,
      true,
      secret,
    )
  ).status,
  403,
);
assert.equal(
  (await createGuest(request('/api/auth/guest', { captchaToken: captcha }), client, false, secret)).status,
  503,
);
assert.equal(
  (await createGuest(request('/api/auth/guest', {}), client, true, secret)).status,
  400,
);
assert.equal(
  (await createGuest(request('/api/auth/guest', { captchaToken: captcha }), client, true)).status,
  503,
);
assert.equal(signupCount, 0);
const created = await createGuest(
  request('/api/auth/guest', { captchaToken: captcha }),
  client,
  true,
  secret,
  challenge,
);
assert.equal(created.status, 201);
const createdBody = await created.json();
assert.equal(createdBody.created, true);
assert.equal(createdBody.kind, 'guest');
assert.equal(createdBody.displayId, userId.slice(0, 8).toUpperCase());
assert.equal(created.headers.getSetCookie().length, 2);
assert.equal(signupCount, 1);
assert.equal(profileInserts, 1);
console.log('PASS guest creation requires origin, captcha and persistent profile; issues Secure cookies');

const duplicate = await createGuest(request('/api/auth/guest', {}, cookie), client, true, secret);
assert.equal(duplicate.status, 200);
assert.equal((await duplicate.json()).created, false);
assert.equal(signupCount, 1);
const current = await guestStatus(
  new Request(origin + '/api/auth/guest/status', { headers: { cookie } }),
  client,
  true,
);
assert.equal((await current.json()).kind, 'guest');
console.log('PASS repeat visitor reuses identity and does not create a duplicate');

assert.equal(
  (await sendGuestEmailLink(request('/api/auth/guest/link', { email, captchaToken: captcha }),
    client, true, secret, challenge)).status,
  401,
);
assert.equal(
  (await sendGuestEmailLink(request('/api/auth/guest/link', { email }, cookie),
    client, true, secret, challenge)).status,
  400,
);
const sent = await sendGuestEmailLink(
  request('/api/auth/guest/link', { email, captchaToken: captcha }, cookie),
  client,
  true,
  secret,
  challenge,
);
assert.equal(sent.status, 200);
assert.equal((await sent.json()).sent, true);
assert.equal(updateCount, 1);
console.log('PASS visitor email link uses updateUser, not signInWithOtp');

assert.equal(
  (await verifyGuestEmailLink(request('/api/auth/guest/verify',
    { email, code: '12345' }, cookie), client, true)).status,
  400,
);
verifiedId = anotherId;
assert.equal(
  (await verifyGuestEmailLink(request('/api/auth/guest/verify',
    { email, code: '123456' }, cookie), client, true)).status,
  401,
);
verifiedId = userId;
const verified = await verifyGuestEmailLink(
  request('/api/auth/guest/verify', { email, code: '123456' }, cookie),
  client,
  true,
);
assert.equal(verified.status, 200);
const result = await verified.json();
assert.equal(result.linked, true);
assert.equal(result.kind, 'member');
assert.equal(result.displayId, userId.slice(0, 8).toUpperCase());
assert.equal(result.email, email);
assert.equal(result.profileSynced, true);
assert.equal(profileUpdates, 1);
assert.equal(verified.headers.getSetCookie().length, 2);
currentUser = linkedUser;
const member = await guestStatus(
  new Request(origin + '/api/auth/guest/status', { headers: { cookie } }),
  client,
  true,
);
assert.equal((await member.json()).kind, 'member');
console.log('PASS same-ID verification, mismatched-ID rejection, and permanent membership');
console.log('ALL MOCK GUEST AUTH TESTS PASSED; NO SUPABASE USERS OR EMAILS CREATED');
