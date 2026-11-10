import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../sites/yuelao/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const projectUrl = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
assert.ok(anonKey, 'Missing disposable Supabase anon key');
const mailpitUrl = 'http://127.0.0.1:54324';
const email = 'yuelao-ci-guest@example.invalid';

const makeClient = () =>
  createClient(projectUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

async function getMailCode(prefix) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const listResponse = await fetch(mailpitUrl + '/api/v1/messages');
    assert.equal(listResponse.status, 200, 'Mailpit did not respond');
    const list = await listResponse.json();
    for (const message of list.messages || []) {
      const detailResponse = await fetch(mailpitUrl + '/api/v1/message/' + message.ID);
      const detail = await detailResponse.json();
      const allText = JSON.stringify(detail);
      const index = allText.indexOf(prefix);
      if (index !== -1) {
        const match = allText.slice(index).match(/(\\d{6})/);
        if (match) return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error('Local Mailpit did not receive expected ' + prefix + ' OTP');
}

const guest = makeClient();
const start = await guest.auth.signInAnonymously();
assert.ifError(start.error);
const originalId = start.data.user?.id;
assert.ok(originalId && start.data.session, 'Anonymous sign-in did not establish a session');
assert.equal(start.data.user.is_anonymous, true);
console.log('PASS real Supabase GoTrue anonymous signup and session');

const change = await guest.auth.updateUser({ email });
assert.ifError(change.error);
const otp = await getMailCode('YUELAO-EMAIL-CHANGE-CODE:');
const verified = await guest.auth.verifyOtp({ email, token: otp, type: 'email_change' });
assert.ifError(verified.error);
assert.equal(verified.data.user?.id, originalId, 'Email binding must preserve visitor UUID');
assert.equal(verified.data.user?.is_anonymous, false, 'Anonymous account did not upgrade');
assert.ok(verified.data.user?.email_confirmed_at, 'Linked email was not verified');
console.log('PASS real local email-change OTP kept the original anonymous user UUID');

const secondDevice = makeClient();
const sendLogin = await secondDevice.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false },
});
assert.ifError(sendLogin.error);
const loginCode = await getMailCode('YUELAO-EMAIL-LOGIN-CODE:');
const signedIn = await secondDevice.auth.verifyOtp({
  email,
  token: loginCode,
  type: 'email',
});
assert.ifError(signedIn.error);
assert.equal(signedIn.data.user?.id, originalId, 'Cross-device login must recover same user');
assert.equal(signedIn.data.user?.is_anonymous, false);
console.log('PASS real local cross-device email sign-in recovers original UUID');
console.log('ALL REAL ISOLATED GOTRUE AUTH TESTS PASSED; EMAILS CAPTURED BY MAILPIT ONLY');
