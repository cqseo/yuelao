import type { CoreEnv } from '../env';
import { testCheckoutAllowed } from './allowlist';
import { isStripeLiveApiKey, isStripeTestApiKey } from './stripe';

// 收款模式（站長 2026-11-14：準備切正式收款）。
// - test（預設）：只收測試金鑰（sk_test_／rk_test_），結帳只開給 BILLING_TEST_ALLOWED_EMAILS，和以前一樣。
// - live：BILLING_MODE="live" 才會進來；只收正式金鑰（sk_live_／rk_live_），所有登入的人都能結帳。
// 兩種模式絕不混用：test 模式拿到正式金鑰、live 模式拿到測試金鑰，一律關閉結帳與 webhook。

export type BillingMode = 'test' | 'live';

export function billingMode(env: Pick<CoreEnv, 'BILLING_MODE'>): BillingMode {
  return env.BILLING_MODE === 'live' ? 'live' : 'test';
}

/** 這個模式下金鑰對不對（webhook 也用這個判斷）。 */
export function keyMatchesMode(env: Pick<CoreEnv, 'BILLING_MODE' | 'STRIPE_SECRET_KEY'>): boolean {
  return billingMode(env) === 'live'
    ? isStripeLiveApiKey(env.STRIPE_SECRET_KEY)
    : isStripeTestApiKey(env.STRIPE_SECRET_KEY);
}

/** 結帳的開關（不含登入、資料庫等其他條件）。開著回 null，關著回原因。 */
export function checkoutGate(
  env: Pick<
    CoreEnv,
    'BILLING_MODE' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'BILLING_ENABLE_TEST_CHECKOUT'
  >,
): string | null {
  if (billingMode(env) === 'live') {
    if (!isStripeLiveApiKey(env.STRIPE_SECRET_KEY)) return 'live_key_required';
  } else {
    if (env.BILLING_ENABLE_TEST_CHECKOUT !== 'true') return 'checkout_disabled';
    if (!isStripeTestApiKey(env.STRIPE_SECRET_KEY)) return 'test_key_required';
  }
  if (!env.STRIPE_WEBHOOK_SECRET) return 'webhook_not_configured';
  return null;
}

/** 這個人能不能結帳：live 模式所有登入的人都可以；test 模式只有白名單。 */
export function buyerAllowed(
  env: Pick<CoreEnv, 'BILLING_MODE' | 'BILLING_TEST_ALLOWED_EMAILS'>,
  email: unknown,
): boolean {
  if (billingMode(env) === 'live') return true;
  return testCheckoutAllowed(env.BILLING_TEST_ALLOWED_EMAILS, email);
}
