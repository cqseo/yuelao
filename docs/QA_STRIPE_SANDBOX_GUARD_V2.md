# YueLao V2 – Stripe webhook safety + isolated integration readiness (2026-11-09)

Branch: `feat/yuelao-stripe-qa`, based on the UI staging PR #7. This is **test-only**. No production Supabase SQL, no real Stripe charges, no real OpenAI requests.

## What changed

- `packages/core/src/billing/stripe.ts`: verify the HMAC webhook signature with Stripe SDK **and** require `event.livemode === false`. Correctly signed live Stripe events are rejected with HTTP 403 `live_event_forbidden`; unsigned/tampered events are rejected with HTTP 400.
- Only ordinary `sk_test_*` and restricted `rk_test_*` Stripe API keys are accepted. Never accept `sk_live_*` or `rk_live_*`. Restricted keys must have Checkout / Customer / PaymentIntent permissions provisioned in the sandbox.
- Handle `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired` as explicit lookup targets. **Only successful, Stripe-refetched paid facts may grant entitlements**; unpaid/failure events are acknowledged without granting.
- Keep the webhook capable of processing refund/revocation events when the test Checkout entrypoint is switched off, provided a TEST API key is still configured. For the public staging preview (which has no API key), all webhook requests fail closed.
- `packages/core/src/server.ts`: before creating any Checkout Session, require `APP_URL` to have the exact same origin as the incoming request. This prevents an isolated staging purchase accidentally redirecting back to the production `yuelao` Worker.
- `sites/yuelao/wrangler.jsonc` staging environment now has `APP_URL=https://yuelao-v2-staging-20261109.cqseo.workers.dev`. Payment and AI toggles remain false, Supabase URL remains empty. There are no deployed Stripe/OpenAI/Supabase secrets.
- `tools/smoke-staging.mjs` now checks that the publicly accessible staging webhook cannot operate without a test-only key.

## Tests and reproducibility

```bash
# On the development machine with Node.js 24, pnpm and installed project dependencies
npm exec --yes --package=tsx@4 -- tsx tools/test-stripe-webhook.ts
node tools/smoke-staging.mjs
pnpm lint
CLOUDFLARE_ENV=staging VITE_SITE_STAGING=true pnpm check
```

`test-stripe-webhook.ts` uses the **real Stripe SDK's webhook HMAC signing and verification**, with fake payments and an in-memory mock of Supabase's RPC, and makes **no calls to Stripe's API**. It covers:
- Valid test webhook signature, missing/forged signature, correctly signed live event rejected.
- Paid Checkout Session settles with a verified server-refetched payment; event payload is not treated as authority.
- Delayed payment success settles only when the refetched payment is paid.
- Pending/delayed failed Checkout Sessions never grant paid entitlements.
- Refund/dispute invokes both settlement and revocation RPCs.
- Database and revocation RPC errors return HTTP 500, prompting Stripe retries.
- `sk_test_` and `rk_test_` recognized; both live key families rejected.

This complements the existing disposable PostgreSQL tests in `tools/test-billing-hardening.sql`, `tools/test-ai-paid-readings.sql`, and `tools/test-ai-pack-refund.sql`. They do **not** replace a real end-to-end test transaction.

## Known blockers / no-go for launch

1. **Supabase paid staging branch approval is required:** the connected `cqseo/yuelao` project has no existing preview branches. The service quoted **USD 0.01344 per hour** for a new branch (approximately USD 0.32256/day while continuously running). An attempted `create_branch` returned a mandatory paid-cost confirmation workflow. No branch was created and **no fee was incurred**; user must expressly accept the recurring hourly cost before creation.
2. **Stripe sandbox:** connected Stripe accounts include a `yuelao` live-mode context but not a connected `yuelao` sandbox context. Do not repurpose the unrelated YuHua/dtcgame sandboxes, and do not use live charges for testing.
3. **OTP / AI:** staging has no Supabase Auth or SMTP configured and cannot send OTP; no secret model key. Obtain separate test SMTP and approved AI credentials. If the Worker is made to access real sensitive data, protect integration staging using Cloudflare Access.
4. **Business and data operations:** support email placeholder, complete privacy/retention/deletion policy, real Stripe test-mode refund and Webhook retry test, payment reconciliation, real AI content quality and human support/failed-delivery recovery.
5. **Delayed failure UX:** `checkout.session.async_payment_failed` is recognized and does not grant entitlements. The order is not yet marked failed or emailed to the customer; a proper pending/failed/expired lifecycle + notification requires a separate integration acceptance test. Do not claim this part is complete.
6. **Before live charging:** replace the explicit test-only gate with a **separate, reviewed** production billing feature and verified live webhook scheme. This PR intentionally cannot charge or settle live Stripe transactions.

## Isolation and rollback

Only the separate `yuelao-v2-staging-20261109` Worker is in scope; the existing `yuelao.cqseo.workers.dev` is untouched. Deploy only after inspecting the generated `dist/server/wrangler.json` to verify Worker name and disabled secrets/flags. Do not merge the stacked draft PRs until the dependencies are verified.
