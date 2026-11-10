import assert from 'node:assert/strict';

const base = 'https://yuelao-v2-staging-20261109.cqseo.workers.dev';

for (const path of ['/', '/account', '/login', '/favicon.svg']) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(20000),
    redirect: 'manual',
  });
  console.log(`GET ${path} -> ${response.status} (${response.headers.get('content-type')})`);
  assert.equal(response.status, 200, `Unexpected HTTP status at ${path}`);
  if (path !== '/favicon.svg') {
    assert.match(response.headers.get('content-type') || '', /html/i);
    const body = await response.text();
    assert.ok(body.includes('月老'), `Missing app text at ${path}`);
  } else {
    await response.arrayBuffer();
  }
}

const state = await fetch(new URL('/api/auth/guest/status', base), {
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(20000),
});
console.log(`GET /api/auth/guest/status -> ${state.status}`);
assert.equal(state.status, 200);
const guest = await state.json();
assert.equal(guest.enabled, false, 'Preview must not create real Supabase visitors');
assert.equal(guest.kind, 'disabled', 'Preview guest auth must fail closed');

console.log('PASS: Cloudflare staging HTTP routes and disabled guest auth');
console.log('No authenticated users, OTP emails, orders or payment attempts were created.');
