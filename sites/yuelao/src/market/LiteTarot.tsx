import { useEffect, useMemo, useRef, useState } from 'react';
import { GuestBindHint } from '~/components/GuestBindHint';
import { withGuest } from '~/lib/guest';
import { findProduct, formatPrice, priceForLocale } from '@yuelao/core/site';
import { contentLocale, uiPrefix } from '~/i18n/locale';
import { track } from '~/lib/track';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { drawThree, flowLine, POSITIONS, type LenormandCard } from '~/ritual/lenormand';
import { drawTarot, TAROT_POSITIONS } from '~/ritual/tarot';
import site from '../../site.config';
import { liteRequest } from './lite-billing';
import { saveLiteTarotPending, takeLiteTarotPending, type LiteTarotDeck } from './lite-tarot-pending';
import './lite-market.css';

type Result = { deck: LiteTarotDeck; question: string; sit: string; day: string };
type State = 'idle' | 'checking' | 'none' | 'unlocked' | 'ready' | 'generating' | 'pending' | 'error';
const PRODUCT = findProduct(site, 'spread_1');
const OPTIONS = [
  ['single', '單身', '单身'],
  ['crush', '曖昧', '暧昧'],
  ['dating', '交往中', '交往中'],
  ['reunion', '復合', '复合'],
  ['married', '婚姻', '婚姻'],
] as const;

const COPY = {
  'zh-Hant': {
    title: '塔羅館 · 快速抽牌', intro: '不用載入 3D，直接抽三張塔羅或雷諾曼。兩種體驗都可免費看牌義。',
    question: '你現在想問什麼？', placeholder: '例如：我該不該主動聯絡對方？', defaultQ: '我接下來應如何面對感情？',
    situation: '你的情況', draw: '免費抽三張牌', redraw: '換一件事再問', tarot: '塔羅', lnm: '雷諾曼',
    premium: '想把三張牌連在一起看？', premiumNote: '完整解讀會依你寫的問題，結合三張牌分析現況、相互關係、可採取的行動等七段內容；不承諾預測現實結果。',
    buy: '解鎖完整解讀', generate: '生成已購解讀', owned: '這份牌陣已解鎖，不會重複收費。',
    consent: '我已閱讀條款及隱私說明，同意將我自願輸入的問題傳給第三方自動化解讀服務。',
    check: '正在核對購買紀錄…', waiting: '付款尚未確認，不用再付款；可稍後重查。',
    cancelled: '已取消付款。牌面已保留，沒有扣款。', error: '暫時無法完成，若已付款請勿重複下單，可稍後重查。',
    login: '繼續付款前需要登入，登入後會回到這三張牌。', store: '無法保存此牌陣的會話資料。為免付款後遺失，請允許瀏覽器工作階段儲存。',
    agree: '付款即表示同意服務條款與隱私說明。',
    retry: '重新核對狀態', market: '體驗 3D 塔羅館', back: '回首頁', note: '牌義用於文化體驗與自我反思，不代表對方的真實心意或未來。',
  },
  'zh-Hans': {
    title: '塔罗馆 · 快速抽牌', intro: '无需加载 3D，直接抽三张塔罗或雷诺曼牌。两种体验都能免费查看牌义。',
    question: '你想问什么？', placeholder: '例如：我该不该主动联系对方？', defaultQ: '我接下来应该如何面对感情？',
    situation: '你的情况', draw: '免费抽三张牌', redraw: '换一件事再问', tarot: '塔罗', lnm: '雷诺曼',
    premium: '想把三张牌连起来看？', premiumNote: '完整解读会根据你的问题，结合三张牌分析现状、相互关系、可采取的行动等七段内容；不承诺预测现实结果。',
    buy: '解锁完整解读', generate: '生成已购解读', owned: '这份牌阵已解锁，不会重复收费。',
    consent: '我已阅读条款和隐私说明，同意将自愿输入的问题发送给第三方自动化解读服务。',
    check: '正在核对购买记录…', waiting: '付款尚未确认，请不要重复付款；可稍后核对。',
    cancelled: '已取消付款。牌面已保留，没有扣款。', error: '暂时无法完成。如果已付款请勿重复下单，可稍后重查。',
    login: '付款前需要登录，登录后会回到这三张牌。', store: '浏览器无法保存本次牌阵，为免付款返回后丢失，请允许会话存储。',
    agree: '付款即表示同意服务条款与隐私说明。',
    retry: '重新核对状态', market: '体验 3D 塔罗馆', back: '返回首页', note: '牌义仅供文化体验与自我反思，不代表对方真实心意或未来。',
  },
};

const nowDay = () => {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
};

function chooseCards(result: Result | null) {
  if (!result) return null;
  if (result.deck === 'lnm') {
    const cards = drawThree(result.question, result.sit, result.day);
    return {
      cards: cards.map((d, i) => ({
        key: String(d.n).padStart(2, '0'),
        name: d.name,
        position: POSITIONS[i],
        tag: d.kw.join(' · '),
        meaning: d.pos[i] + ' ' + d.love,
        image: '/market/cards/lnm/' + String(d.n).padStart(2, '0') + '.webp',
      })),
      summary: flowLine(cards[0] as LenormandCard, cards[1] as LenormandCard, cards[2] as LenormandCard),
    };
  }
  const cards = drawTarot(result.question, result.sit, result.day);
  return {
    cards: cards.map((d, i) => ({
      key: d.card.img + (d.rev ? '~' : ''),
      name: d.card.name,
      position: TAROT_POSITIONS[i],
      tag: d.rev ? '逆位' : '正位',
      meaning: d.rev ? d.card.rev : d.card.up,
      image: '/market/cards/rws/' + d.card.img + '.webp',
    })),
    summary: '',
  };
}

async function makeKey(result: Result, ids: string[]) {
  const source = result.day + '|' + result.sit + '|' + result.question.replace(/\s+/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const hex = [...new Uint8Array(digest)].slice(0, 8).map((n) => n.toString(16).padStart(2, '0')).join('');
  return result.deck + ':' + ids.join(',') + '|' + hex;
}

/** The same server-verified /api/account/spread and /api/billing/checkout
 * endpoints power the 3D room and this lightweight interface.
 */
export function LiteTarot() {
  const locale = contentLocale();
  const zh = getLocale() === 'zh-Hans';
  const c = zh ? COPY['zh-Hans'] : COPY['zh-Hant'];
  const [deck, setDeck] = useState<LiteTarotDeck>('tarot');
  const [sit, setSit] = useState('crush');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const reading = useMemo(() => chooseCards(result), [result]);
  const [key, setKey] = useState('');
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [access, setAccess] = useState<State>('idle');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const pendingRef = useRef(false);
  const resultRef = useRef<HTMLElement>(null);
  const offerRef = useRef<HTMLElement>(null);
  const price = PRODUCT ? formatPrice(priceForLocale(PRODUCT, locale), locale) : '';

  useEffect(() => {
    const pending = takeLiteTarotPending();
    const url = new URL(window.location.href);
    const cancelled = url.searchParams.get('pay') === 'cancelled';
    if (cancelled) {
      url.searchParams.delete('pay');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (pending) {
      setDeck(pending.deck);
      setSit(pending.sit);
      setQuestion(pending.question);
      setResult({ deck: pending.deck, sit: pending.sit, question: pending.question, day: pending.day });
      setWaiting(pending.why === 'pay' && !cancelled);
    }
    if (cancelled) setMessage(c.cancelled);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!reading || !result) {
      setKey('');
      return;
    }
    let ignore = false;
    void makeKey(result, reading.cards.map((d) => d.key))
      .then((next) => { if (!ignore) setKey(next); })
      .catch(() => { if (!ignore) setAccess('error'); });
    return () => { ignore = true; };
  }, [reading, result]);

  useEffect(() => {
    if (!ready || !key) return;
    let ignore = false;
    const check = async () => {
      setAccess('checking');
      for (let i = 0; i < (waiting ? 35 : 1); i++) {
        const res = await liteRequest('/api/account/spread?spread=' + encodeURIComponent(key) + '&locale=' + encodeURIComponent(locale));
        if (ignore) return;
        if (res.status === 401 || res.status === 404) {
          if (!waiting) { setAccess('none'); return; }
        } else if (res.ok) {
          const data = (await res.json()) as { state?: string; body?: string };
          if (data.state === 'ready' && data.body) {
            setBody(data.body);
            setAccess('ready');
            setWaiting(false);
            return;
          }
          if (data.state === 'unlocked') {
            setAccess('unlocked');
            setWaiting(false);
            return;
          }
          if (!waiting) { setAccess('none'); return; }
        } else {
          setAccess('error');
          return;
        }
        if (i < 34) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!ignore) setAccess('pending');
    };
    void check().catch(() => { if (!ignore) setAccess('error'); });
    return () => { ignore = true; };
  }, [ready, key, locale, revision, waiting]);

  useEffect(() => {
    if (!result) return;
    const frame = requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const target = offerRef.current;
    if (!target) return;
    let recorded = false;
    const observer = new IntersectionObserver((entries) => {
      if (recorded || !entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.2)) return;
      recorded = true;
      observer.disconnect();
      track('offer_view', { product: 'spread_1', lite: true });
      track('offer_seen', { product: 'spread_1', lite: true, where: 'section' });
    }, { threshold: 0.2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [result]);

  const resetReading = () => {
    // A change to the question, situation or deck invalidates the previous
    // deterministic spread and its paid entitlement lookup.
    setResult(null);
    setKey('');
    setBody('');
    setConsent(false);
    setMessage('');
    setAccess('idle');
    setWaiting(false);
  };

  const draw = () => {
    if (busy || waiting) return;
    const chosen = question.trim() || c.defaultQ;
    const next: Result = { deck, sit, question: chosen, day: nowDay() };
    setResult(next);
    setQuestion(chosen);
    setKey('');
    setBody('');
    setConsent(false);
    setMessage('');
    setAccess('checking');
    track('ritual_begin', { kind: deck, lite: true });
    track('reading_done', { kind: deck, lite: true });
  };

  async function buy() {
    if (!result || !key || !PRODUCT || access !== 'none' || busy || pendingRef.current) return;
    if (!saveLiteTarotPending({ ...result, why: 'login' })) {
      setMessage(c.store); return;
    }
    pendingRef.current = true;
    setBusy(true);
    setMessage('');
    track('unlock_click', { product: 'spread_1', lite: true });
    track('checkout_start', { product: 'spread_1', from: 'market', lite: true });
    try {
      // 沒登入：先給一個訪客帳號再結帳（lib/guest.ts）
      const response = await withGuest(() => liteRequest('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: 'spread_1',
          locale,
          currency: priceForLocale(PRODUCT, locale).currency,
          ui: uiPrefix(),
          from: 'market',
          spread: key,
        }),
      }));
      if (response.status === 401) {
        track('checkout_login_required', { product: 'spread_1', lite: true });
        window.location.assign(localizeHref('/login'));
        return;
      }
      if (response.status === 409) {
        setRevision((v) => v + 1);
        return;
      }
      if (response.status !== 201) {
        track('checkout_api_failure', { product: 'spread_1', status: response.status, lite: true });
        setMessage(c.error);
        return;
      }
      const data = (await response.json()) as { checkoutUrl?: unknown };
      if (typeof data.checkoutUrl !== 'string') throw new Error('missing_checkout_url');
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('bad_checkout_url');
      if (!saveLiteTarotPending({ ...result, why: 'pay' })) {
        setMessage(c.store);
        return;
      }
      track('checkout_session_created', { product: 'spread_1', lite: true });
      window.location.assign(url.href);
    } catch {
      track('checkout_api_failure', { product: 'spread_1', status: 0, lite: true });
      setMessage(c.error);
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }

  async function generate() {
    if (!result || !key || access !== 'unlocked' || !consent || busy) return;
    setBusy(true);
    setAccess('generating');
    setMessage('');
    try {
      const res = await liteRequest('/api/account/spread/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spread: key, locale, ui: uiPrefix(), question: result.question, sit: result.sit, consent: true }),
      });
      if (!res.ok) throw new Error('generate_failed');
      for (let i = 0; i < 30; i++) {
        const check = await liteRequest('/api/account/spread?spread=' + encodeURIComponent(key) + '&locale=' + encodeURIComponent(locale));
        if (check.ok) {
          const payload = (await check.json()) as { state?: string; body?: string };
          if (payload.state === 'ready' && payload.body) {
            setBody(payload.body); setAccess('ready');
            track('deep_read', { product: 'spread_1', lite: true });
            return;
          }
        }
        if (i < 29) await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      throw new Error('generate_timeout');
    } catch {
      setAccess('unlocked');
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || waiting;
  return (
    <main className="lite-market lite-tarot">
      <div className="lite-market__night">
        <article className="lite-market__paper">
          <p className="lite-market__eyebrow">YUEXIA · 月下</p>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
          <fieldset>
            <legend>{c.question}</legend>
            <textarea aria-label={c.question} rows={2} maxLength={100} placeholder={c.placeholder}
              value={question} disabled={disabled} onChange={(e) => {
                setQuestion(e.target.value);
                if (result) resetReading();
              }} />
          </fieldset>
          <fieldset>
            <legend>{c.situation}</legend>
            <div className="lite-market__choices">
              {OPTIONS.map(([id, hant, hans]) => (
                <button key={id} type="button" aria-pressed={sit === id} disabled={disabled}
                  onClick={() => {
                    if (id !== sit) {
                      setSit(id);
                      resetReading();
                    }
                  }}>{zh ? hans : hant}</button>
              ))}
            </div>
          </fieldset>
          <div className="lite-market__choices lite-tarot__decks">
            <button type="button" aria-pressed={deck === 'tarot'} disabled={disabled}
              onClick={() => {
                if (deck !== 'tarot') {
                  setDeck('tarot');
                  resetReading();
                }
              }}>{c.tarot} · 78</button>
            <button type="button" aria-pressed={deck === 'lnm'} disabled={disabled}
              onClick={() => {
                if (deck !== 'lnm') {
                  setDeck('lnm');
                  resetReading();
                }
              }}>{c.lnm} · 36</button>
          </div>
          <button className="lite-market__draw" type="button" disabled={disabled}
            onClick={draw}>{result ? c.redraw : c.draw}</button>

          {result && reading && (
            <section ref={resultRef} className="lite-market__result" aria-live="polite">
              <p className="lite-tarot__question">{result.question}</p>
              <div className="lite-tarot__cards">
                {reading.cards.map((card) => (
                  <div className="lite-tarot__card" key={card.key}>
                    <img src={card.image} alt={card.name} loading="eager" decoding="async" width={180} height={300} />
                    <strong>{card.position} · {card.name}</strong>
                    <small>{card.tag}</small>
                    <p>{card.meaning}</p>
                  </div>
                ))}
              </div>
              {reading.summary && <p className="lite-tarot__summary">{reading.summary}</p>}
            </section>
          )}

          {result && reading && (
            <section ref={offerRef} className="lite-market__premium" aria-label={c.premium}>
              <h2>{c.premium}</h2>
              <p>{c.premiumNote}</p>
              {price && <strong className="lite-market__price">{price}</strong>}
              {access === 'checking' && <p role="status">{c.check}</p>}
              {access === 'pending' && <p role="status">{c.waiting}</p>}
              {access === 'ready' && (
                <><p>{c.owned}</p><div className="lite-market__deep-body">{body}</div><GuestBindHint /></>
              )}
              {access === 'unlocked' && <p>{c.owned}</p>}
              {access === 'none' && (
                <>
                  <button className="lite-market__pay" type="button" disabled={busy || !price} onClick={() => void buy()}>
                    {c.buy + ' · ' + price}
                  </button>
                  <p className="lite-market__agree">
                    {c.agree}{' '}
                    <a href={localizeHref('/terms')} target="_blank" rel="noopener noreferrer">Terms</a>{' · '}
                    <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">Privacy</a>
                  </p>
                </>
              )}
              {/* 勾選同意只在生成解讀時（那一步才把問題送去解讀服務）；付款不用先勾 */}
              {access === 'unlocked' && (
                <>
                  <label className="lite-market__consent">
                    <input type="checkbox" checked={consent} disabled={busy}
                      onChange={(e) => setConsent(e.target.checked)} />
                    <span>{c.consent}{' '}
                      <a href={localizeHref('/terms')} target="_blank" rel="noopener noreferrer">Terms</a>{' · '}
                      <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">Privacy</a>
                    </span>
                  </label>
                  <button className="lite-market__pay" type="button" disabled={!consent || busy}
                    onClick={() => void generate()}>
                    {c.generate}
                  </button>
                </>
              )}
              {(access === 'error' || access === 'pending') && (
                <button type="button" className="lite-market__retry" disabled={busy}
                  onClick={() => setRevision((v) => v + 1)}>{c.retry}</button>
              )}
              {message && <p className="lite-market__warning" role="alert">{message}</p>}
            </section>
          )}

          <p className="lite-market__note">{c.note}</p>
          <nav className="lite-market__nav">
            <a href={localizeHref('/market#tarot')}>{c.market}</a>
            <a href={localizeHref('/')}>{c.back}</a>
          </nav>
        </article>
      </div>
    </main>
  );
}
