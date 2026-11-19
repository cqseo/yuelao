import {
  BRANCH,
  type MatchResult,
  matchOf,
  SIGN_RELATION_NAME,
  SIGNS,
  signElement,
  signRelationText,
  TITLE_TEXT,
  ZODIAC,
  ZODIAC_RELATION_NAME,
  ZODIAC_RELATION_TEXT,
} from '@yuelao/core/match';
import { findProduct, formatPrice, priceForLocale } from '@yuelao/core/site';
import { useEffect, useRef, useState } from 'react';
import { GuestBindHint } from '~/components/GuestBindHint';
import { contentLocale, uiPrefix } from '~/i18n/locale';
import { withGuest } from '~/lib/guest';
import { track } from '~/lib/track';
import { localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';
import { liteRequest } from './lite-billing';
import { saveLiteFortunePending, takeLiteFortunePending } from './lite-fortune-pending';
import './lite-market.css';

// 輕量算命攤．合緣配對：3D 載不起來、或從輕量版付款回來時用。
// 和 3D 算命攤同一套伺服器（/api/account/spread、/api/billing/checkout 的 match_1）。生日只在本機。

const PRODUCT = findProduct(site, 'match_1');
const SITS = [
  ['single', '單身', '单身'],
  ['crush', '曖昧中', '暧昧中'],
  ['dating', '交往中', '交往中'],
  ['reunion', '想復合', '想复合'],
  ['married', '已婚', '已婚'],
] as const;
const SECTIONS = [
  '你們兩個湊在一起',
  '生肖怎麼看',
  '星座怎麼看',
  '容易吵的地方',
  '對著你的問題',
  '相處上的三件事',
  '留給你們的一句話',
];
type Access = 'idle' | 'checking' | 'none' | 'unlocked' | 'generating' | 'ready' | 'pending' | 'error';

const person = (p: MatchResult['a']) =>
  `${BRANCH[p.zodiac - 1]}${ZODIAC[p.zodiac - 1]}．${SIGNS[p.sign - 1]}（${signElement(p.sign)}象）`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function LiteFortune() {
  const locale = contentLocale();
  const hans = locale === 'zh-Hans';
  // 內容（生肖說明）保留繁體；介面字照語系
  const t = (hant: string, hansText: string) => (hans ? hansText : hant);
  const [you, setYou] = useState('');
  const [them, setThem] = useState('');
  const [sit, setSit] = useState('dating');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [key, setKey] = useState('');
  const [note, setNote] = useState('');
  const [access, setAccess] = useState<Access>('idle');
  const [waiting, setWaiting] = useState(false);
  const [body, setBody] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const resultRef = useRef<HTMLElement>(null);
  const price = PRODUCT ? formatPrice(priceForLocale(PRODUCT, locale), locale) : '';

  async function compute(y: string, th: string, s: string, q: string) {
    const m = await import('~/ritual/match');
    const a = m.personOf(y);
    const b = m.personOf(th);
    if (!a || !b) return false;
    const k = await m.matchKey(y, th, s, q);
    if (!k) return false;
    setResult(matchOf(a, b));
    setKey(k);
    return true;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: restore once on mount
  useEffect(() => {
    const pending = takeLiteFortunePending();
    const url = new URL(window.location.href);
    const cancelled = url.searchParams.get('pay') === 'cancelled';
    if (cancelled) {
      url.searchParams.delete('pay');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      setMessage(t('已取消付款，沒有扣款。', '已取消付款，没有扣款。'));
    }
    if (!pending) return;
    setYou(pending.you);
    setThem(pending.them);
    setSit(pending.sit);
    setQuestion(pending.question);
    setWaiting(pending.why === 'pay' && !cancelled);
    void compute(pending.you, pending.them, pending.sit, pending.question);
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
    if (!result) return;
    const frame = requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [result]);

  const reset = () => {
    setResult(null);
    setKey('');
    setBody('');
    setAccess('idle');
    setConsent(false);
    setMessage('');
  };

  async function go() {
    if (busy || waiting) return;
    setNote('');
    if (!you || !them) return setNote(t('兩個人的生日都要填。', '两个人的生日都要填。'));
    setBusy(true);
    try {
      const q = question.replace(/\s+/g, ' ').trim().slice(0, 100);
      setQuestion(q);
      const ok = await compute(you, them, sit, q);
      if (!ok)
        setNote(
          t(
            '這個日期算不了，請確認是 1901 到 2099 年間的真實日期。',
            '这个日期算不了，请确认是 1901 到 2099 年间的真实日期。',
          ),
        );
      else {
        track('ritual_begin', { kind: 'match', lite: true });
        track('reading_done', { kind: 'match', lite: true });
      }
    } catch {
      setNote(t('暫時算不了，請稍後再試。', '暂时算不了，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!key || !PRODUCT || access !== 'none' || busy) return;
    const pending = { you, them, question, sit, day: today() };
    if (!saveLiteFortunePending({ ...pending, why: 'login' })) {
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
    track('unlock_click', { product: 'match_1', lite: true });
    track('checkout_start', { product: 'match_1', from: 'market', lite: true });
    try {
      const res = await withGuest(() =>
        liteRequest('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId: 'match_1',
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
      saveLiteFortunePending({ ...pending, why: 'pay' });
      track('checkout_session_created', { product: 'match_1', lite: true });
      window.location.assign(url.href);
    } catch {
      track('checkout_api_failure', { product: 'match_1', lite: true });
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
        body: JSON.stringify({ spread: key, locale, ui: uiPrefix(), question, sit, consent: true }),
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
            track('deep_read', { product: 'match_1', lite: true });
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
  const sitWord = SITS.find((s) => s[0] === sit)?.[hans ? 2 : 1] ?? '';
  return (
    <main className="lm">
      <div className="lm__sky">
        <header className="lm__bar">
          <span className="lm__place">{t('算命攤', '算命摊')}</span>
          <a href={localizeHref('/market#bazi')} className="lm__link">
            {t('進 3D 集市', '进 3D 集市')}
          </a>
        </header>

        <section className="lm__ask" aria-labelledby="lf-title">
          <h1 id="lf-title">{t('合緣配對', '合缘配对')}</h1>
          <p className="lm__lead">
            {t(
              '填你和對方的國曆生日，看生肖合沖與星座元素。生肖以立春換年；生日只在這台裝置裡算，不會送出。',
              '填你和对方的公历生日，看生肖合冲与星座元素。生肖以立春换年；生日只在这台设备里算，不会发送。',
            )}
          </p>
          <div className="lm__dates">
            <label>
              <span className="lm__label">{t('你的生日', '你的生日')}</span>
              <input
                type="date"
                min="1901-01-01"
                max="2099-12-31"
                value={you}
                disabled={locked}
                onChange={(e) => {
                  setYou(e.target.value);
                  if (result) reset();
                }}
              />
            </label>
            <label>
              <span className="lm__label">{t('對方的生日', '对方的生日')}</span>
              <input
                type="date"
                min="1901-01-01"
                max="2099-12-31"
                value={them}
                disabled={locked}
                onChange={(e) => {
                  setThem(e.target.value);
                  if (result) reset();
                }}
              />
            </label>
          </div>
          <fieldset className="lm__sits">
            <legend className="lm__label">{t('你們現在的情況', '你们现在的情况')}</legend>
            <div className="lm__chips">
              {SITS.map(([id, hant, hansWord]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={sit === id}
                  disabled={locked}
                  onClick={() => {
                    setSit(id);
                    if (result) reset();
                  }}
                >
                  {hans ? hansWord : hant}
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor="lf-q" className="lm__label lm__qlabel">
            {t('想問的事（選填）', '想问的事（选填）')}
          </label>
          <div className="lm__qbox">
            <textarea
              id="lf-q"
              rows={2}
              maxLength={100}
              disabled={locked}
              placeholder={t('例：我們會不會一直吵下去', '例：我们会不会一直吵下去')}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (result) reset();
              }}
            />
            <span className="lm__count">{question.length}/100</span>
          </div>
          {note && (
            <p className="lm__hint is-warn" role="alert">
              {note}
            </p>
          )}
          <button className="lm__draw" type="button" onClick={() => void go()} disabled={locked}>
            {result ? t('重新合一合', '重新合一合') : t('合一合', '合一合')}
          </button>
          <p className="lm__fine">
            {t(
              '生肖星座合緣是文化習俗與自我反思，不代表現實預測。',
              '生肖星座合缘是文化习俗与自我反思，不代表现实预测。',
            )}
          </p>
        </section>

        {result && (
          <>
            <section className="lm__result" ref={resultRef} aria-labelledby="lf-result">
              {(question || sitWord) && (
                <p className="lm__asked">
                  {question ? `${t('問', '问')}．${question}` : ''}
                  {sitWord && <span>{sitWord}</span>}
                </p>
              )}
              <div className="lm__pair">
                <div>
                  <small>{t('你', '你')}</small>
                  <b>{ZODIAC[result.a.zodiac - 1]}</b>
                  <span>{person(result.a)}</span>
                </div>
                <i aria-hidden="true">×</i>
                <div>
                  <small>{t('對方', '对方')}</small>
                  <b>{ZODIAC[result.b.zodiac - 1]}</b>
                  <span>{person(result.b)}</span>
                </div>
              </div>
              <h2 className="lm__grade lm__mtitle" id="lf-result">
                {result.title}
              </h2>
              <p className="lm__verdict">{TITLE_TEXT[result.title]}</p>
              <section className="lm__plain">
                <dl>
                  <dt>{`生肖．${ZODIAC_RELATION_NAME[result.zodiac]}`}</dt>
                  <dd>{ZODIAC_RELATION_TEXT[result.zodiac]}</dd>
                  <dt>{`星座．${SIGN_RELATION_NAME[result.sign]}`}</dt>
                  <dd>{signRelationText(result)}</dd>
                </dl>
              </section>
            </section>

            <section className="lm__deep" aria-labelledby="lf-deep">
              <h2 id="lf-deep">{t('完整合緣', '完整合缘')}</h2>
              {(access === 'checking' || access === 'generating') && (
                <p role="status">
                  {access === 'generating'
                    ? t('師傅正在寫，大約半分鐘…', '师傅正在写，大约半分钟…')
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
                  <p>{t('這一對已解鎖，不會重複收費。', '这一对已解锁，不会重复收费。')}</p>
                  <label className="lm__consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={busy}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      {t(
                        '我同意把生肖、星座與我自願填寫的問題傳給第三方自動化解讀服務（不含生日）。',
                        '我同意把生肖、星座与我自愿填写的问题发送给第三方自动化解读服务（不含生日）。',
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
                    {t('請師傅動筆', '请师傅动笔')}
                  </button>
                </>
              )}
              {access === 'none' && (
                <>
                  <p className="lm__teaser">
                    {`${ZODIAC[result.a.zodiac - 1]}配${ZODIAC[result.b.zodiac - 1]}是${ZODIAC_RELATION_NAME[result.zodiac]}，${SIGNS[result.a.sign - 1]}配${SIGNS[result.b.sign - 1]}是${SIGN_RELATION_NAME[result.sign]}。放在一起看，你們最容易卡住的地方，其實是……`}
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
                    {`${t('解鎖完整合緣', '解锁完整合缘')} · ${price}`}
                  </button>
                  <p className="lm__fine">
                    {t('付款即表示同意服務條款與隱私說明。', '付款即表示同意服务条款与隐私说明。')}{' '}
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
          </>
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
