import { useEffect, useRef, useState } from 'react';
import { GuestBindHint } from '~/components/GuestBindHint';
import { track } from '~/lib/track';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { STICKS, type Stick } from '~/ritual/sticks';
import { liteCheck, liteCheckout, liteGenerate, litePrice, liteReadingUrl } from './lite-billing';
import { saveLitePending, takeLitePending } from './lite-pending';
import { shareVerdict } from './engine/share.js';
import './lite-market.css';

type Situation = 'him' | 'single' | 'reunion';
type PaymentStatus = 'idle' | 'checking' | 'none' | 'pending' | 'unlocked' | 'ready' | 'generating' | 'error';
const WORDS: Record<string, {
  title: string; intro: string; question: string; choices: [string, string, string]; draw: string;
  again: string; reading: string; retry: string; home: string; label: string; notes: string;
  /** 分享籤圖（圖上不放問題）。 */
  share: string; saved: string;
}> = {
  'zh-Hant': {
    title: '月老殿 · 輕量模式',
    intro: '不必載入 3D，即可直接免費求籤、閱讀判詞；想體驗完整儀式，也可以隨時進入 3D 月下集市。',
    question: '心裡想問什麼？（可留空）', choices: ['曖昧／問他', '單身／脫單', '想復合'],
    draw: '免費求一支籤', again: '再求一支', reading: '閱讀完整免費判詞', retry: '重試 3D 集市', home: '返回首頁',
    label: '你現在的情況', notes: '數位籤詩是文化體驗與自我整理，不保證感情結果。輕量模式不使用 3D 動畫。',
    share: '分享籤圖', saved: '籤圖存好了，可以傳給朋友。圖上不會有你寫的問題。',
  },
  'zh-Hans': {
    title: '月老殿 · 轻量模式',
    intro: '无需加载 3D，即可直接免费求签、查看判词；想体验完整仪式，也可以随时进入 3D 月下集市。',
    question: '你想问什么？（可留空）', choices: ['暧昧／问他', '单身／脱单', '想复合'],
    draw: '免费求一支签', again: '再求一支', reading: '查看完整免费判词', retry: '重试 3D 集市', home: '返回首页',
    label: '你目前的情况', notes: '数字签诗仅供文化体验与自我整理，不保证感情结果。轻量模式不使用 3D 动画。',
    share: '分享签图', saved: '签图保存好了，可以发给朋友。图上不会有你写的问题。',
  },
  en: {
    title: 'Yuelao Hall · Lightweight mode',
    intro: '3D could not start on this device. You can still draw a free stick within the market page.',
    question: 'What is on your mind? (optional)', choices: ['A person I like', 'Finding love', 'Reconciliation'],
    draw: 'Draw a free stick', again: 'Draw again', reading: 'Read full free interpretation', retry: 'Retry 3D market', home: 'Back to home',
    label: 'Your situation', notes: 'A cultural reflection activity, not a prediction of relationship outcomes.',
    share: 'Share as image', saved: 'Image saved. Your question is not on it.',
  },
  ja: {
    title: '月老殿 · 軽量モード',
    intro: 'この端末では3Dを開始できませんでした。同じ市場ページで無料のおみくじを引けます。',
    question: '何について考えていますか？（任意）', choices: ['気になる人', '出会い', '復縁'],
    draw: '無料で引く', again: 'もう一度', reading: '無料の解説を読む', retry: '3D市場を再試行', home: 'トップに戻る',
    label: '現在の状況', notes: '文化体験と自己省察を目的とし、結果を保証するものではありません。',
    share: '画像で共有', saved: '画像を保存しました。質問は載っていません。',
  },
};

const SITUATIONS: Situation[] = ['him', 'single', 'reunion'];
const PAY: Record<string, {
  title: string; note: string; consent: string; buy: string; generate: string; view: string;
  checking: string; generating: string; pending: string; verify: string; owned: string;
  cancelled: string; failed: string; login: string; storage: string; pack: string;
  /** 追問月老的入口（付費解籤下面）。 */
  followup: string;
}> = {
  'zh-Hant': {
    title: '付費完整解籤', note: '完整解籤會結合你的問題，提供原典提示、現況分析、可以採取的行動等七段個人化解讀。單次港幣 HKD 付款；同一支籤與情境不重複收費。',
    consent: '我已閱讀條款和隱私說明，同意將自願輸入的問題提供給第三方自動化解讀服務，用於生成個人化解籤。',
    buy: '解鎖完整解籤', generate: '請月老寫我的完整解籤', view: '在帳戶查看完整解籤',
    checking: '正在核對有沒有已購權益…', generating: '正在寫完整解籤，請勿重複付款…',
    pending: '付款尚未確認，請勿重複付款。可稍後再核對或在帳戶查看紀錄。',
    verify: '重新確認付款／解鎖狀態', owned: '已解鎖，無需再次付款。',
    cancelled: '已取消付款，這支籤仍保留。', failed: '暫時無法核對或生成。若已付款，請先查看帳戶，勿重複付款。',
    login: '請先登入，回來後會接著這支籤。', storage: '瀏覽器未能保存求籤進度，為防付款後遺失記錄，請允許工作階段儲存。',
    pack: '已有問事包？去帳戶兌換',
    followup: '還想問月老一句？',
  },
  'zh-Hans': {
    title: '付费完整解签', note: '完整解签结合你的问题，包含原典提示、现况分析、可采取的行动等七段个性化解读。单次港币 HKD 付款；同一支签与情境不会重复收费。',
    consent: '我已阅读条款和隐私说明，同意将自愿输入的问题提供给第三方自动化解读服务，用于生成个性化解签。',
    buy: '解锁完整解签', generate: '请月老写我的完整解签', view: '在账户查看完整解签',
    checking: '正在核对已购权益…', generating: '正在生成完整解签，请勿重复付款…',
    pending: '付款尚未确认，请勿重复付款。可稍后核对或在账户查看订单。',
    verify: '重新核对付款／解锁状态', owned: '已解锁，无需再次付款。',
    cancelled: '已取消付款，这支签仍然保留。', failed: '暂时无法核对或生成。若已付款，请先查看账户，不要重复付款。',
    login: '请先登录，回来后继续这支签。', storage: '浏览器无法保存求签进度。请允许会话存储，以免付款返回后丢失记录。',
    pack: '已有问事包？前往账户兑换',
    followup: '还想问月老一句？',
  },
  en: {
    title: 'Optional paid in-depth reading', note: 'Actual charge is in HKD. The same stick/category is never charged twice after unlocking.',
    consent: 'I have read the Terms and Privacy Policy, and agree that my optional question may be sent to a third-party automated reading service to generate a personalized interpretation.',
    buy: 'Unlock full reading', generate: 'Generate my full reading', view: 'View saved reading in my account',
    checking: 'Checking existing access…', generating: 'Generating your reading. Do not pay again…',
    pending: 'Payment has not yet been confirmed. Do not pay again; check later or view your account.',
    verify: 'Check payment and access again', owned: 'Already unlocked. No second payment is needed.',
    cancelled: 'Checkout cancelled. Your stick is still here.', failed: 'Cannot verify or generate right now. If you paid, check your account before buying again.',
    login: 'Sign in first, then return to this stick.', storage: 'Session storage is unavailable. Enable it to keep your reading across checkout.',
    pack: 'Already have a question pack? Redeem in your account',
    followup: 'Ask Yue Lao one more question',
  },
  ja: {
    title: '有料の詳しい解説', note: '実際の請求通貨は香港ドル（HKD）です。同じおみくじと状況は二重請求しません。',
    consent: '利用規約とプライバシーポリシーを読み、任意で入力した質問を個別の解説生成のため第三者の自動解説サービスへ送信することに同意します。',
    buy: '詳しい解説を購入', generate: '詳しい解説を生成', view: '購入済みの解説を見る',
    checking: '権利を確認しています…', generating: '生成しています。再度支払わないでください…',
    pending: 'まだ決済が確認できません。再度支払わず、しばらく後で確認してください。',
    verify: '支払いを再確認', owned: '購入済みです。再購入は不要です。',
    cancelled: 'お支払いをキャンセルしました。', failed: '一時的に確認できません。購入済みの場合は再購入しないでください。',
    login: 'ログイン後、このおみくじに戻ります。', storage: '決済後に戻るため、セッション保存を有効にしてください。',
    pack: '回数パックはアカウントから利用',
    followup: '月下老人にもう一つ聞く',
  },
};


export function LiteMarket() {
  const c = WORDS[getLocale()] ?? WORDS.en!;
  const payC = PAY[getLocale()] ?? PAY.en!;
  const [situation, setSituation] = useState<Situation>('him');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<Stick | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [payment, setPayment] = useState<PaymentStatus>('idle');
  const [report, setReport] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const inFlight = useRef(false);
  const resultRef = useRef<HTMLElement>(null);
  const offerRef = useRef<HTMLElement>(null);
  const price = litePrice();

  useEffect(() => {
    // The normal login + Stripe return URL is /market#yuelao. Restore the
    // same lite reading from sessionStorage, without ever putting the question in a URL.
    const pending = takeLitePending();
    const url = new URL(window.location.href);
    const cancelled = url.searchParams.get('pay') === 'cancelled';
    if (cancelled) {
      url.searchParams.delete('pay');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (pending) {
      setSituation(pending.category);
      setQuestion(pending.question);
      setResult(STICKS[pending.stickId - 1] ?? null);
      setWaitingForPayment(pending.why === 'pay' && !cancelled);
      if (cancelled) setMessage(payC.cancelled);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !result) return;
    let cancelled = false;
    const id = result.id;
    const check = async () => {
      setPayment('checking');
      const attempts = waitingForPayment ? 35 : 1;
      for (let i = 0; i < attempts; i++) {
        const access = await liteCheck(id, situation);
        if (cancelled) return;
        if (access.state === 'ready' || access.state === 'unlocked') {
          setPayment(access.state);
          setReport(access.state === 'ready' ? access.body : '');
          if (waitingForPayment) setWaitingForPayment(false);
          return;
        }
        if (access.state === 'error') {
          setPayment('error');
          return;
        }
        if (!waitingForPayment) {
          setPayment('none');
          return;
        }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setPayment('pending'); // Never offer a second charge after return.
    };
    void check();
    return () => { cancelled = true; };
  }, [hydrated, result, situation, refresh, waitingForPayment]);

  const draw = () => {
    if (busy || waitingForPayment) return;
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const stick = STICKS[bytes[0]! % STICKS.length]!;
    setResult(stick);
    setShareNote('');
    setReport('');
    setConsent(false);
    setMessage('');
    setPayment('checking');
    setRefresh((n) => n + 1);
    track('ritual_begin', { category: situation, lite: true, hasQuestion: question.trim().length > 0 });
    track('reading_done', { category: situation, lite: true, stickId: stick.id });
  };

  async function buy() {
    if (!result || busy || inFlight.current || payment !== 'none' || !consent || !price) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    track('unlock_click', { product: 'unlock_1', lite: true });
    track('checkout_start', { product: 'unlock_1', from: 'market', lite: true });
    try {
      const response = await liteCheckout(result.id, situation);
      if (response.state === 'login') {
        track('checkout_login_required', { product: 'unlock_1', lite: true });
        if (!saveLitePending(result.id, situation, question, 'login')) {
          setMessage(payC.storage);
          return;
        }
        window.location.assign(localizeHref('/login'));
      } else if (response.state === 'redirect') {
        track('checkout_session_created', { product: 'unlock_1', lite: true });
        if (!saveLitePending(result.id, situation, question, 'pay')) {
          setMessage(payC.storage);
          return;
        }
        window.location.assign(response.url);
      } else if (response.state === 'owned') {
        setPayment('checking');
        setRefresh((n) => n + 1);
      } else {
        track('checkout_api_failure', { product: 'unlock_1', lite: true, reason: response.state });
        setMessage(payC.failed);
        setPayment('error');
      }
    } catch {
      track('checkout_api_failure', { product: 'unlock_1', lite: true, reason: 'network' });
      setMessage(payC.failed);
      setPayment('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function generate() {
    if (!result || busy || inFlight.current || payment !== 'unlocked' || !consent) return;
    inFlight.current = true;
    setBusy(true);
    setPayment('generating');
    setMessage('');
    try {
      const status = await liteGenerate(result.id, situation, question);
      if (status === 'error') {
        setPayment('unlocked'); // Keep purchased entitlement and retry option.
        setMessage(payC.failed);
        return;
      }
      for (let i = 0; i < 30; i++) {
        const access = await liteCheck(result.id, situation);
        if (access.state === 'ready') {
          setReport(access.body);
          setPayment('ready');
          setQuestion('');
          track('deep_read', { product: 'unlock_1', lite: true });
          return;
        }
        if (access.state === 'error') break;
        if (i < 29) await new Promise((r) => setTimeout(r, 2500));
      }
      setPayment('unlocked');
      setMessage(payC.failed);
    } catch {
      setPayment('unlocked');
      setMessage(payC.failed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

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
      track('offer_view', { product: 'unlock_1', lite: true });
    }, { threshold: 0.2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [result]);

  const readingHref = result ? localizeHref(liteReadingUrl(result.id, situation)) : '';
  const checking = payment === 'checking' || payment === 'generating';
  const canPurchase = payment === 'none';
  const canGenerate = payment === 'unlocked';
  const showConsent = canPurchase || canGenerate;

  return (
    <main className="lite-market">
      <div className="lite-market__night">
        <article className="lite-market__paper">
          <p className="lite-market__eyebrow">YUEXIA · 月下集市</p>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
          <label htmlFor="lite-question">{c.question}</label>
          <textarea
            id="lite-question"
            rows={2}
            maxLength={100}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <fieldset>
            <legend>{c.label}</legend>
            <div className="lite-market__choices">
              {SITUATIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={situation === s}
                  disabled={busy || waitingForPayment}
                  onClick={() => {
                    setSituation(s);
                    setResult(null);
                    setPayment('idle');
                    setConsent(false);
                    setMessage('');
                    setWaitingForPayment(false);
                  }}
                >{c.choices[i]}</button>
              ))}
            </div>
          </fieldset>
          <button
            className="lite-market__draw"
            type="button"
            disabled={busy || waitingForPayment}
            onClick={draw}
          >{result ? c.again : c.draw}</button>
          {result && (
            <section ref={resultRef} className="lite-market__result" aria-live="polite">
              <h2>{result.no} · {result.grade}</h2>
              <p className="lite-market__poem">{result.poem}</p>
              <p>{result.verdict[situation]}</p>
              <a href={localizeHref('/sign/' + result.id)}>{c.reading}</a>
              <button
                type="button"
                className="lite-market__share"
                onClick={() => {
                  // 圖上只放籤與判詞，不放問的那句話（私事）
                  void shareVerdict({
                    id: result.id,
                    no: result.no,
                    grade: result.grade,
                    poem: result.poem,
                    source: result.source,
                    verdict: result.verdict[situation],
                    cat: '',
                  }).then((r: string) => {
                    track('share_image', { kind: 'sign', result: r, stickId: result.id, lite: true });
                    if (r === 'saved') setShareNote(c.saved);
                  });
                }}
              >
                {c.share}
              </button>
              {shareNote && <p role="status">{shareNote}</p>}
            </section>
          )}
          {result && (
            <section ref={offerRef} className="lite-market__premium" aria-label={payC.title}>
              <h2>{payC.title}</h2>
              <strong className="lite-market__price">{price}</strong>
              <p>{payC.note}</p>
              {checking && <p role="status">{payment === 'generating' ? payC.generating : payC.checking}</p>}
              {payment === 'ready' && (
                <>
                  <p>{payC.owned}</p>
                  <div className="lite-market__deep-body">{report}</div>
                  <GuestBindHint />
                  <a href={readingHref}>{payC.view}</a>
                  <a href={`${readingHref}#followup`}>{payC.followup}</a>
                </>
              )}
              {canGenerate && <p>{payC.owned}</p>}
              {showConsent && (
                <>
                  <label className="lite-market__consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      {payC.consent}{' '}
                      <a href={localizeHref('/terms')} target="_blank" rel="noopener noreferrer">Terms</a>
                      {' · '}
                      <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">Privacy</a>
                    </span>
                  </label>
                  <button
                    className="lite-market__pay"
                    type="button"
                    disabled={!consent || busy || !price}
                    onClick={() => void (canGenerate ? generate() : buy())}
                  >{canGenerate ? payC.generate : payC.buy + ' · ' + price}</button>
                </>
              )}
              {(payment === 'pending' || payment === 'error') && (
                <>
                  <p role="status">{payment === 'pending' ? payC.pending : payC.failed}</p>
                  <button className="lite-market__retry" type="button" onClick={() => setRefresh((n) => n + 1)}>
                    {payC.verify}
                  </button>
                </>
              )}
              {message && <p role="alert" className="lite-market__warning">{message}</p>}
              <p><a href={localizeHref('/account')}>{payC.pack}</a></p>
            </section>
          )}
          <p className="lite-market__note">{c.notes}</p>
          <nav className="lite-market__nav">
            <a href={localizeHref('/account')}>{getLocale() === 'en' ? 'My paid readings' : getLocale() === 'ja' ? '購入済み解説' : getLocale() === 'zh-Hans' ? '我的已购解读' : '我的已購解讀'}</a>
            <a href={localizeHref('/market#yuelao')}>{c.retry}</a>
            <a href={localizeHref('/')}>{c.home}</a>
          </nav>
        </article>
      </div>
    </main>
  );
}
