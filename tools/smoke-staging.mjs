#!/usr/bin/env node
// Smoke-test the isolated public UI preview only. Never target production.
// Staging must be demonstrably isolated before sending even harmless POST probes.
import assert from 'node:assert/strict';

const base = process.env.STAGING_URL ?? 'https://yuelao-v2-staging-20261109.cqseo.workers.dev';
const url = new URL(base);
if (url.protocol !== 'https:' || !/^yuelao-v2-staging-[\w-]+\.cqseo\.workers\.dev$/.test(url.hostname)) {
  throw new Error('Refusing to probe a non-YueLao staging hostname.');
}

const headers = { 'user-agent': 'Mozilla/5.0 (staging QA)', accept: '*/*' };
async function get(path) {
  const response = await fetch(new URL(path, url), { headers, redirect: 'manual' });
  return { status: response.status, response, body: await response.text() };
}
async function post(path, data) {
  const response = await fetch(new URL(path, url), {
    method: 'POST',
    headers: { ...headers, origin: url.origin, 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  return { status: response.status, body: await response.text() };
}
const robots = await get('/robots.txt');
assert.equal(robots.status, 200);
assert.match(robots.body, /Disallow:\s*\//);
assert.match(robots.response.headers.get('x-robots-tag') ?? '', /noindex/);
console.log('PASS staging crawler access disabled');

const home = await get('/');
assert.equal(home.status, 200);
assert.match(home.body, /預覽環境/);
assert.match(home.response.headers.get('x-robots-tag') ?? '', /noindex/);
console.log('PASS staging-specific UI flag and noindex');

for (const path of [
  '/tests',
  '/tests/red-flags',
  '/tests/cheating-signs',
  '/tests/crush',
  '/tests/get-back-together',
  '/tests/attachment-style',
  '/login',
  '/account',
  '/ritual',
]) {
  const result = await get(path);
  assert.equal(result.status, 200, `Route failure: ${path}`);
  assert.match(result.response.headers.get('x-robots-tag') ?? '', /noindex/);
}
console.log('PASS public routes and all five relationship tests');

const status = await get('/api/account/status');
assert.equal(status.status, 401);
assert.match(status.body, /login_required/);
console.log('PASS anonymous account denied');

const otp = await post('/api/auth/send', { email: 'nobody@example.invalid' });
assert.equal(otp.status, 503);
assert.match(otp.body, /auth_not_configured/);
console.log('PASS staging cannot email login codes');

const checkout = await post('/api/billing/checkout', {
  productId: 'pack_3',
  locale: 'zh-Hant',
  currency: 'HKD',
});
assert.equal(checkout.status, 503);
assert.match(checkout.body, /checkout_disabled/);
console.log('PASS staging cannot initiate payments');

const webhook = await post('/api/webhooks/stripe', { object: 'forged_event' });
assert.equal(webhook.status, 503);
assert.match(webhook.body, /test_webhook_only/);
console.log('PASS staging webhook refuses processing without a test Stripe key');

const ai = await post('/api/account/reading/generate', {
  stickId: 8,
  category: 'him',
  locale: 'zh-Hant',
  consent: true,
});
assert.equal(ai.status, 401);
assert.match(ai.body, /login_required/);
console.log('PASS anonymous AI reading generation denied');

console.log('ALL STAGING SMOKE TESTS PASSED', url.origin);
