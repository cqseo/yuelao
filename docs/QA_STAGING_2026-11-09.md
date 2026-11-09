# YueLao V2 – Isolated Cloudflare staging validation (2026-11-09)

## Deployment

- Public, temporary QA Worker: `https://yuelao-v2-staging-20261109.cqseo.workers.dev`
- Worker script: `yuelao-v2-staging-20261109` within the `cqseo` Cloudflare account. Not the existing production Worker `yuelao`.
- Uses the Vite Cloudflare environment: `CLOUDFLARE_ENV=staging` at **build time**, with `VITE_SITE_STAGING=true` to display the staging banner. The generated `dist/server/wrangler.json` was inspected before upload.
- No Supabase URL or anon key, no service_role, no Stripe key/webhook secret, no OpenAI key. `BILLING_ENABLE_TEST_CHECKOUT=false` and `AI_ENABLE_TEST_GENERATION=false`.
- Worker responses include `X-Robots-Tag: noindex, nofollow, noarchive`, and `/robots.txt` returns `Disallow: /`. The site visibly announces staging.
- Public preview is **not access-controlled**. Never upload real secrets, personal data, or real database test records. If staging integration is required, enable Cloudflare Access first and use a separate test database.
- Cloudflare account connected inside ChatGPT is **not** the same as the `cqseo` Wrangler OAuth account. Do not deploy this Worker using the wrong connected account.

## Acceptance

- Node 24 `pnpm check` and `pnpm lint` pass (site still has a pre-existing supportEmail placeholder warning and Vite CSS sourcemap warning).
- `node tools/smoke-staging.mjs`: checks preview noindex, disallow robots, all five free quiz routes, account denial, disabled OTP, disabled checkout and unauthorized AI.
- Real Chromium mobile E2E after deployment: all five quiz pages, full 8-question result, login UI, anonymous account gating, original ritual page and no unhandled JS errors.
- A deployed mobile screenshot caught missing staging-banner Chinese glyphs. Rebuilt Noto Serif TC/SC subsetting, changed banner to the site's Chinese serif family, redeployed and verified `document.fonts.check('14px "Noto Serif TC"')` is true, Chinese characters render correctly.
- Production URL `https://yuelao.cqseo.workers.dev/` independently returned HTTP 200; this staging rollout did not deploy to or replace it.

## Next: real integration (blocked, not attempted)

1. Supabase currently has no branch; create an isolated staging DB and set migration version, separate keys and Auth templates. Do not point this public worker at production.
2. The connected Stripe accounts list includes `yuelao` in live mode but no separate `yuelao` sandbox. Create/connect the Yuelao sandbox before any real test payment; do not use another project's sandbox.
3. Add a real test email sender with six-digit OTP template, request throttling and Cloudflare Turnstile before enabling publicly.
4. Add OpenAI restricted credential and chosen tested model as Worker **secret** in a protected integration environment, with spend limits.
5. Stage DB migrations, then run the actual OTP → Stripe test payment → webhook → unlock → AI generation → refund/revocation E2E.
6. Replace placeholder support email, verify legal/privacy/refunds/data deletion requirements, evaluate login and user data protection before production activation.

## Reproduce

```bash
cd sites/yuelao
CLOUDFLARE_ENV=staging VITE_SITE_STAGING=true pnpm build
CLOUDFLARE_ENV=staging pnpm exec wrangler deploy --dry-run
# Only after verifying distinct staging worker name and bindings:
CLOUDFLARE_ENV=staging pnpm exec wrangler deploy
cd ../..
node tools/smoke-staging.mjs
```

This is UI/staging QA, **not** evidence of a complete paid production transaction.
