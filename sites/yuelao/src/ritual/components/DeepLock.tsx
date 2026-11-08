// 深度解讀付費牆：方案選擇（單次/問事包）+ 解鎖。未登入時先用 email 一次性
// 驗證碼登入（Supabase Auth email OTP，不用密碼），驗證通過後自動接著結帳，
// 呼叫 /api/checkout 取得 Stripe Checkout 連結並跳轉。沿用 DESIGN.md 既有令牌：
// 方案選擇抄 .q-pick（選中整塊填朱紅），不新開一套元件庫。

import { checkoutProduct, findProduct, formatPrice, type Product } from '@yuelao/core/site';
import { useState } from 'react';
import { requestEmailCode, useSupabaseSession, verifyEmailCode } from '~/lib/auth';
import { startCheckout } from '~/lib/checkout';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import site from '../../../site.config';
import type { RitualCat } from '../physics';
import type { Stick } from '../sticks';

type Stage = 'idle' | 'loading' | 'email' | 'code';

export function DeepLock({ stick, cat, teaserLine }: { stick: Stick; cat: RitualCat; teaserLine: string }) {
  const locale = getLocale();
  const { session, ready } = useSupabaseSession();
  // 不賣訂閱（P4 範圍外）：只有單次解鎖與問事包兩種是真的方案。
  const tiers: Product[] = site.products.filter((p) => p.kind === 'unlock' || p.kind === 'pack');
  const [productId, setProductId] = useState<string>(tiers[0]?.id ?? 'unlock_1');
  const [stage, setStage] = useState<Stage>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const product = findProduct(site, productId);
  const price = product ? formatPrice(checkoutProduct(product).price, locale) : '';

  async function buy() {
    if (!product) return;
    setError(null);
    setStage('loading');
    const failure = await startCheckout({
      productId: product.id,
      locale,
      ...(product.kind === 'unlock' ? { stickId: stick.id, category: cat } : {}),
    });
    if (!failure) return; // success redirects the page away
    if (failure.kind === 'unauthenticated') {
      setStage('email');
      return;
    }
    setError(m.ritual_deep_error());
    setStage('idle');
  }

  function onCtaClick() {
    if (!ready || stage === 'loading') return;
    if (session) {
      void buy();
      return;
    }
    setError(null);
    setStage('email');
  }

  async function sendCode() {
    if (!email.includes('@')) {
      setError(m.ritual_deep_email_invalid());
      return;
    }
    setError(null);
    setStage('loading');
    const failure = await requestEmailCode(email);
    if (failure) {
      setError(m.ritual_deep_error());
      setStage('email');
      return;
    }
    setStage('code');
  }

  async function verifyCode() {
    if (code.trim().length < 4) {
      setError(m.ritual_deep_code_invalid());
      return;
    }
    setError(null);
    setStage('loading');
    const failure = await verifyEmailCode(email, code.trim());
    if (failure) {
      setError(m.ritual_deep_error());
      setStage('code');
      return;
    }
    await buy();
  }

  function cancelAuth() {
    setStage('idle');
    setError(null);
    setCode('');
  }

  return (
    <div className="deep-lock">
      <h3>
        {m.ritual_deep_title()}
        {!session && <span className="soon-tag">{m.ritual_deep_login_tag()}</span>}
      </h3>
      <p className="teaser">
        {m.ritual_deep_teaser_lead()}
        <br />
        {m.ritual_deep_teaser_line({ line: teaserLine })}
      </p>
      <ul>
        <li>{m.ritual_deep_item_1()}</li>
        <li>{m.ritual_deep_item_2()}</li>
        <li>{m.ritual_deep_item_3()}</li>
        <li>{m.ritual_deep_item_4()}</li>
        <li>{m.ritual_deep_item_5()}</li>
      </ul>

      <fieldset className="tier-row">
        <legend className="tier-label">{m.ritual_deep_tier_label()}</legend>
        {tiers.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className={`tier-pick${tier.id === productId ? ' sel' : ''}`}
            disabled={stage === 'loading'}
            onClick={() => {
              setProductId(tier.id);
              setError(null);
            }}
          >
            <span className="tier-name">{tier.shortName ?? tier.name}</span>
            <span className="tier-price">{formatPrice(checkoutProduct(tier).price, locale)}</span>
          </button>
        ))}
      </fieldset>

      <div className="trust">
        <div>{m.ritual_deep_trust_1()}</div>
        <div>{m.ritual_deep_trust_2()}</div>
        <div>{m.ritual_deep_trust_3()}</div>
      </div>

      {stage === 'email' && (
        <div className="auth-step">
          <label className="auth-label" htmlFor="dl-email">
            {m.ritual_deep_email_label()}
          </label>
          <input
            id="dl-email"
            className="auth-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={m.ritual_deep_email_placeholder()}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="cta" type="button" onClick={() => void sendCode()}>
            {m.ritual_deep_send_code()}
          </button>
          <button className="auth-cancel" type="button" onClick={cancelAuth}>
            {m.ritual_deep_cancel()}
          </button>
        </div>
      )}

      {stage === 'code' && (
        <div className="auth-step">
          <p className="auth-sent">{m.ritual_deep_code_sent({ email })}</p>
          <input
            className="auth-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={m.ritual_deep_code_placeholder()}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="cta" type="button" onClick={() => void verifyCode()}>
            {m.ritual_deep_verify_cta({ price })}
          </button>
          <button className="auth-cancel" type="button" onClick={() => void sendCode()}>
            {m.ritual_deep_resend()}
          </button>
        </div>
      )}

      {(stage === 'idle' || stage === 'loading') && (
        <button className="cta" type="button" disabled={stage === 'loading' || !ready} onClick={onCtaClick}>
          {stage === 'loading' ? m.ritual_deep_cta_loading() : m.ritual_deep_cta({ price })}
        </button>
      )}

      {error && <p className="auth-error">{error}</p>}
      <p className="cta-note">{m.ritual_deep_cta_note()}</p>
    </div>
  );
}
