import assert from 'node:assert/strict';
import { accountSnapshot } from '../packages/core/src/account';
import {
  clearSessionResponse,
  sameOriginPost,
  sessionResponse,
  sessionTokens,
} from '../packages/core/src/auth-session';
import { paidReadingResponse, parseReadingParams } from '../packages/core/src/reading';

const makeRequest = (url: string, origin: string | null, cookie?: string) =>
  new Request(url, {
    method: 'POST',
    headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) },
  });

assert.equal(sameOriginPost(makeRequest('https://example.com/api/auth/verify', 'https://example.com')), true);
assert.equal(
  sameOriginPost(makeRequest('https://example.com/api/auth/verify', 'https://evil.example')),
  false,
);
assert.equal(sameOriginPost(makeRequest('https://example.com/api/auth/verify', null)), false);
assert.equal(sameOriginPost(makeRequest('https://example.com/api/auth/verify', 'null')), false);
assert.equal(
  sameOriginPost(makeRequest('https://example.com/api/auth/verify', 'https://example.com.evil.invalid')),
  false,
);
console.log('PASS: cross-origin POST and missing Origin rejected');

const request = makeRequest('https://example.com/api/auth/verify', 'https://example.com');
const fakeSession = {
  access_token: 'dummy.access.token',
  refresh_token: 'opaque_refresh_token',
  expires_in: 3600,
};
const set = sessionResponse(request, new Response('{}'), fakeSession as never);
const cookies = set.headers.getSetCookie();
assert.equal(cookies.length, 2);
assert.equal(
  cookies.every(
    (x) =>
      x.includes('HttpOnly') && x.includes('SameSite=Lax') && x.includes('Secure') && x.includes('Path=/'),
  ),
  true,
);
assert.equal(
  cookies.every((x) => x.startsWith('__Host-yl_')),
  true,
);
assert.equal(set.headers.get('cache-control'), 'no-store');
const restored = new Request('https://example.com/api/account/status', {
  headers: { cookie: cookies.map((x) => x.split(';')[0]).join('; ') },
});
assert.deepEqual(sessionTokens(restored), {
  access: fakeSession.access_token,
  refresh: fakeSession.refresh_token,
});
console.log('PASS: secure httpOnly cookie session round-trip');

const cleared = clearSessionResponse(request, new Response('ok'));
const expire = cleared.headers.getSetCookie();
assert.equal(expire.length, 2);
assert.equal(
  expire.every((x) => x.includes('Max-Age=0')),
  true,
);
console.log('PASS: logout expires access and refresh cookies');

const unauthorized = await accountSnapshot(null, null, false);
assert.equal(unauthorized.status, 401);
assert.equal((await unauthorized.json()).error.code, 'login_required');
console.log('PASS: unauthenticated account query rejected');

const readingRequest = new Request(
  'https://example.com/api/account/reading?stickId=8&category=him&locale=zh-Hant',
);
const anonymousReading = await paidReadingResponse(readingRequest, null, null);
assert.equal(anonymousReading.status, 401);
console.log('PASS: private reading blocked without validated identity');

assert.equal(
  parseReadingParams(
    new URL('https://example.com/api/account/reading?stickId=0&category=him&locale=zh-Hant'),
  ),
  null,
);
assert.equal(
  parseReadingParams(
    new URL('https://example.com/api/account/reading?stickId=101&category=him&locale=zh-Hant'),
  ),
  null,
);
assert.equal(
  parseReadingParams(
    new URL('https://example.com/api/account/reading?stickId=8&category=evil&locale=zh-Hant'),
  ),
  null,
);
console.log('PASS: invalid paid-reading selectors rejected');
