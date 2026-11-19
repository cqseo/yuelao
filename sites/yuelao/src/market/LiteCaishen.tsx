import { findProduct, formatPrice, priceForLocale } from '@yuelao/core/site';
import { useEffect, useRef, useState } from 'react';
import { GuestBindHint } from '~/components/GuestBindHint';
import { contentLocale, uiPrefix } from '~/i18n/locale';
import { withGuest } from '~/lib/guest';
import { track } from '~/lib/track';
import { localizeHref } from '~/paraglide/runtime.js';
import { CAI_STICKS, caiStickByNo } from '~/ritual/caishen';
import site from '../../site.config';
import { liteRequest } from './lite-billing';
import { saveLiteCaiPending, takeLiteCaiPending } from './lite-cai-pending';
import './lite-market.css';

// 輕量財神殿．求財籤（2026-11-19）：3D 載不起來、或從輕量版付款回來時用。
// 和 3D 財神殿同一套伺服器（/api/account/spread、/api/billing/checkout 的 cai_1）。問題只在本機。

const PRODUCT = findProduct(site, 'cai_1');
const SECTIONS = ['這支籤在說什麼', '落在你的事', '可以做與先別做', '對著你的問題', '時機', '財神爺的一句話'];
type Topic = 'career' | 'wealth';
type Access = 'idle' | 'checking' | 'none' | 'unlocked' | 'generating' | 'ready' | 'pending' | 'error';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
async function caiKey(no: number, topic: Topic, question: string, day: string) {
  const src = `${day}|${topic}|${no}|${question.replace(/\s+/g, '')}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
  const hex = [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cai:${String(no).padStart(3, '0')}_${topic === 'career' ? 'c' : 'w'}|${hex}`;
}

export function LiteCaishen() {
  const locale = contentLocale();
  const hans = locale === 'zh-Hans';
  const t = (hant: string, hansText: string) => (hans ? hansText : hant);
  const [topic, setTopic] = useState<Topic>('wealth');
  const [question, setQuestion] = useState('');
  const [no, setNo] = useState(0);
  const [day, setDay] = useState('');
  const [key, setKey] = useState('');
  const [access, setAccess] = useState<Access>('idle');
  const [waiting, setWaiting] = useState(false);
  const [body, setBody] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const resultRef = useRef<HTMLElement>(null);
  const price = PRODUCT ? formatPrice(priceForLocale(PRODUCT, locale), locale) : '';
  const stick = no ? caiStickByNo(no) : null;
  const topicWord = topic === 'career' ? t('事業', '事业') : t('財運', '财运');

  // biome-ignore lint/correctness/useExhaustiveDependencies: restore once on mount
  useEffect(() => {
    const pending = takeLiteCaiPending();
    const url = new URL(window.location.href);
    const cancelled = url.searchParams.get('pay') === 'cancelled';
    if (cancelled) {
      url.searchParams.delete('pay');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      setMessage(t('已取消付款，沒有扣款。', '已取消付款，没有扣款。'));
    }
    if (!pending) return;
    setTopic(pending.topic);
    setQuestion(pending.question);
    setNo(pending.no);
    setDay(pending.day);
    setWaiting(pending.why === 'pay' && !cancelled);
    void caiKey(pending.no, pending.topic, pending.question, pending.day).then(setKey);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision re-runs the check on demand
  useEffect(() => {
    if (!key) return;
    let ignore = false;
    void (async () => {
      setAccess('checking');
      for (let i = 0; i < (waiting ? 35 : 1); i++) {
        try {
          const res = await liteRequest(
            `/api/account/spread?spread=${encodeURIComponent(key)}&locale=${encodeURIComponent(locale)}`,
          );
          if (ignore) return;
          if (res.ok) {
            const d = (await res.json()) as { state?: string; body?: string };
            if (d.state === 'ready' && d.body) {
              setBody(d.body);
              setAccess('ready');
              setWaiting(false);
              return;
            }
            if (d.state === 'unlocked') {
              setAccess('unlocked');
              setWaiting(false);
              return;
            }
          } else if (res.status !== 401 && res.status !== 404) {
            setAccess('error');
            return;
          }
          if (!waiting) {
            setAccess('none');
            return;
          }
        } catch {
          if (!ignore) setAccess('error');
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!ignore) setAccess('pending');
    })();
    return () => {
      ignore = true;
    };
  }, [key, locale, waiting, revision]);

  useEffect(() => {
    if (!no) return;
    const frame = requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [no]);

  async function draw() {
    if (busy || waiting) return;
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    const n = (a[0]! % CAI_STICKS.length) + 1;
    const d = today();
    const q = question.replace(/\s+/g, ' ').trim().slice(0, 100);
    setQuestion(q);
    setBody('');
    setConsent(false);
    setMessage('');
    setNo(n);
    setDay(d);
    setKey(await caiKey(n, topic, q, d));
    track('ritual_begin', { kind: 'cai', topic, lite: true });
    track('reading_done', { kind: 'cai', topic, lite: true });
  }

  async function buy() {
    if (!key || !PRODUCT || access !== 'none' || busy) return;
    const pending = { no, topic, question, day };
    if (!saveLiteCaiPending({ ...pending, why: 'login' })) {
      setMessage(
        t(
          '瀏覽器無法暫存這次的資料，請允許工作階段儲存後再試。',
          '浏览器无法暂存这次的数据，请允许会话存储后再试。',
        ),
      );
      return;
    }
    setBusy(true);
    setMessage('');
    track('unlock_click', { product: 'cai_1', lite: true });
    track('checkout_start', { product: 'cai_1', from: 'market', lite: true });
    try {
      const res = await withGuest(() =>
        liteRequest('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId: 'cai_1',
            locale,
            currency: priceForLocale(PRODUCT, locale).currency,
            ui: uiPrefix(),
            from: 'market',
            spread: key,
          }),
        }),
      );
      if (res.status === 401) {
        window.location.assign(localizeHref('/login'));
        return;
      }
      if (res.status === 409) {
        setRevision((v) => v + 1);
        return;
      }
      if (res.status !== 201) throw new Error('checkout_failed');
      const data = (await res.json()) as { checkoutUrl?: unknown };
      const url = typeof data.checkoutUrl === 'string' ? new URL(data.checkoutUrl) : null;
      if (url?.protocol !== 'https:' || !url || url.hostname !== 'checkout.stripe.com')
        throw new Error('bad_url');
      saveLiteCaiPending({ ...pending, why: 'pay' });
      track('checkout_session_created', { product: 'cai_1', lite: true });
      window.location.assign(url.href);
    } catch {
      track('checkout_api_failure', { product: 'cai_1', lite: true });
      setMessage(t('暫時無法付款，沒有扣款，請稍後再試。', '暂时无法付款，没有扣款，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!key || access !== 'unlocked' || !consent || busy) return;
    setBusy(true);
    setAccess('generating');
    setMessage('');
    try {
      const res = await liteRequest('/api/account/spread/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spread: key, locale, ui: uiPrefix(), question, sit: '', consent: true }),
      });
      if (!res.ok && res.status !== 202) throw new Error('generate_failed');
      for (let i = 0; i < 30; i++) {
        const check = await liteRequest(
          `/api/account/spread?spread=${encodeURIComponent(key)}&locale=${encodeURIComponent(locale)}`,
        );
        if (check.ok) {
          const d = (await check.json()) as { state?: string; body?: string };
          if (d.state === 'ready' && d.body) {
            setBody(d.body);
            setAccess('ready');
            track('deep_read', { product: 'cai_1', lite: true });
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      throw new Error('timeout');
    } catch {
      setAccess('unlocked');
      setMessage(
        t('這次沒寫成。已付款的不會重複扣款，請再試一次。', '这次没写成。已付款的不会重复扣款，请再试一次。'),
      );
    } finally {
      setBusy(false);
    }
  }

  const locked = busy || waiting;
  const main = stick ? (topic === 'career' ? stick.career : stick.wealth) : '';
  const other = stick ? (topic === 'career' ? stick.wealth : stick.career) : '';
  return (
    <main className="lm">
      <div className="lm__sky">
        <header className="lm__bar">
          <span className="lm__place">{t('財神殿', '财神殿')}</span>
          <a href={localizeHref('/market#caishen')} className="lm__link">
            {t('進 3D 集市', '进 3D 集市')}
          </a>
        </header>

        <section className="lm__ask" aria-labelledby="lc-title">
          <h1 id="lc-title">{t('求財籤', '求财签')}</h1>
          <p className="lm__lead">
            {t(
              '選你想問的方面，可以寫下想問的事，財神爺給你一支籤。籤詩是本站原創，供文化體驗與自我反思，不構成投資或職業建議。',
              '选你想问的方面，可以写下想问的事，财神爷给你一支签。签诗是本站原创，供文化体验与自我反思，不构成投资或职业建议。',
            )}
          </p>
          <div className="lm__chips lm__modes">
            {(['wealth', 'career'] as const).map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={topic === x}
                disabled={locked}
                onClick={() => {
                  setTopic(x);
                  setNo(0);
                  setKey('');
                  setAccess('idle');
                }}
              >
                {x === 'career' ? t('事業', '事业') : t('財運', '财运')}
              </button>
            ))}
          </div>
          <label htmlFor="lc-q" className="lm__label lm__qlabel">
            {t('想問的事（選填）', '想问的事（选填）')}
          </label>
          <div className="lm__qbox">
            <textarea
              id="lc-q"
              rows={2}
              maxLength={100}
              disabled={locked}
              placeholder={
                topic === 'career'
                  ? t('例：明年適合換工作嗎', '例：明年适合换工作吗')
                  : t('例：這半年怎麼存得下錢', '例：这半年怎么存得下钱')
              }
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (no) {
                  setNo(0);
                  setKey('');
                  setAccess('idle');
                }
              }}
            />
            <span className="lm__count">{question.length}/100</span>
          </div>
          <button className="lm__draw" type="button" onClick={() => void draw()} disabled={locked}>
            {no ? t('再求一支', '再求一支') : t('求一支籤', '求一支签')}
          </button>
        </section>

        {stick && (
          <section className="lm__result" ref={resultRef} aria-labelledby="lc-no">
            {question && <p className="lm__asked">{`${t('問', '问')}．${question}`}</p>}
            <article className="lm__card">
              <p className="lm__no" id="lc-no">
                {`第 ${stick.no} 籤`}
              </p>
              <h2 className="lm__grade">{stick.grade}</h2>
              <p className="lm__poem">{stick.poem.join('\n')}</p>
              <i className="lm__rule" />
              <p className="lm__verdict">{stick.plain}</p>
              <span className="lm__seal" aria-hidden="true">
                財神
                <br />
                賜籤
              </span>
            </article>
            <section className="lm__plain">
              <dl>
                <div>
                  <dt>{topicWord}</dt>
                  <dd>{main}</dd>
                </div>
                <div>
                  <dt>{topic === 'career' ? t('財運', '财运') : t('事業', '事业')}</dt>
                  <dd>{other}</dd>
                </div>
                <div>
                  <dt>{t('提醒', '提醒')}</dt>
                  <dd>{stick.advice}</dd>
                </div>
              </dl>
            </section>
          </section>
        )}

        {stick && (
          <section className="lm__deep" aria-labelledby="lc-deep">
            <h2 id="lc-deep">{t('完整解籤', '完整解签')}</h2>
            {(access === 'checking' || access === 'generating') && (
              <p role="status">
                {access === 'generating'
                  ? t('廟公正在寫，大約半分鐘…', '庙公正在写，大约半分钟…')
                  : waiting
                    ? t('正在確認付款，通常幾秒鐘…', '正在确认付款，通常几秒钟…')
                    : t('正在核對購買紀錄…', '正在核对购买记录…')}
              </p>
            )}
            {access === 'ready' && (
              <>
                <div className="lm__report">
                  {body
                    .split(/\n{2,}/)
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((b, i) => {
                      const head = b.match(/^【[^】]{1,12}】/);
                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs of one reading
                        <p key={i}>
                          {head && <b>{head[0]}</b>}
                          {head ? b.slice(head[0].length).replace(/^\n/, '') : b}
                        </p>
                      );
                    })}
                </div>
                <GuestBindHint />
              </>
            )}
            {access === 'unlocked' && (
              <>
                <p>{t('已解鎖，不會重複收費。', '已解锁，不会重复收费。')}</p>
                <label className="lm__consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={busy}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    {t(
                      '我同意把籤號與我自願填寫的問題傳給第三方自動化解讀服務。',
                      '我同意把签号与我自愿填写的问题发送给第三方自动化解读服务。',
                    )}{' '}
                    <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">
                      Privacy
                    </a>
                  </span>
                </label>
                <button
                  className="lm__pay"
                  type="button"
                  disabled={!consent || busy}
                  onClick={() => void generate()}
                >
                  {t('請廟公動筆', '请庙公动笔')}
                </button>
              </>
            )}
            {access === 'none' && (
              <>
                <p className="lm__teaser">
                  {`${question ? `你問「${question.slice(0, 22)}${question.length > 22 ? '…' : ''}」。` : `你問的是${topicWord}。`}第${stick.no}籤${stick.grade}，「${stick.poem[0]}」。落在你這件事上，最要緊的其實是……`}
                </p>
                <ol className="lm__sections">
                  {SECTIONS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <button
                  className="lm__pay"
                  type="button"
                  disabled={busy || !price}
                  onClick={() => void buy()}
                >
                  {`${t('解鎖完整解籤', '解锁完整解签')} · ${price}`}
                </button>
                <p className="lm__fine">
                  {t(
                    '付款即表示同意服務條款與隱私說明。不構成投資或職業建議。',
                    '付款即表示同意服务条款与隐私说明。不构成投资或职业建议。',
                  )}{' '}
                  <a href={localizeHref('/terms')} target="_blank" rel="noopener noreferrer">
                    Terms
                  </a>
                  {' · '}
                  <a href={localizeHref('/privacy')} target="_blank" rel="noopener noreferrer">
                    Privacy
                  </a>
                </p>
              </>
            )}
            {(access === 'pending' || access === 'error') && (
              <>
                <p role="status">
                  {access === 'pending'
                    ? t(
                        '付款確認還沒到，不用重新付款，等一下再查。',
                        '付款确认还没到，不用重新付款，等一下再查。',
                      )
                    : t('暫時查不到，若已付款請勿重複下單。', '暂时查不到，若已付款请勿重复下单。')}
                </p>
                <button className="lm__ghost" type="button" onClick={() => setRevision((n) => n + 1)}>
                  {t('重新核對', '重新核对')}
                </button>
              </>
            )}
            {message && (
              <p role="alert" className="lm__warn">
                {message}
              </p>
            )}
          </section>
        )}

        <nav className="lm__nav">
          <a href={localizeHref('/account')}>{t('我的紀錄', '我的记录')}</a>
          <a href={localizeHref('/feedback?from=/market')}>{t('提意見', '提意见')}</a>
          <a href={localizeHref('/')}>{t('回首頁', '回首页')}</a>
        </nav>
      </div>
    </main>
  );
}
