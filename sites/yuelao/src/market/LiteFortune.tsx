import {
  BAZI_TITLE_TEXT,
  type BaziChart,
  baziChart,
  baziLines,
  branchElement,
  ELEMENTS,
  type Gender,
  STEMS,
  stemElement,
} from '@yuelao/core/bazi';
import {
  LOVE_TITLE_TEXT,
  type LoveChart,
  loveChart,
  loveLines,
  starsLabel,
  yearGanzhi,
} from '@yuelao/core/love';
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
import { keepBirthday, loadBirthday } from '~/ritual/birthday';
import site from '../../site.config';
import { DateSelect } from './DateSelect';
import { liteRequest } from './lite-billing';
import { saveLiteFortunePending, takeLiteFortunePending } from './lite-fortune-pending';
import './lite-market.css';

// 輕量算命攤．合緣配對：3D 載不起來、或從輕量版付款回來時用。
// 和 3D 算命攤同一套伺服器（/api/account/spread、/api/billing/checkout 的 match_1）。生日只在本機。

const PRODUCTS = {
  match: findProduct(site, 'match_1'),
  love: findProduct(site, 'love_1'),
  bazi: findProduct(site, 'bazi_1'),
};
const YEAR_PRODUCT = findProduct(site, 'year_1');
type Topic = 'love' | 'career' | 'wealth' | 'year';
const TOPIC_SECTIONS: Record<Exclude<Topic, 'love'>, string[]> = {
  career: [
    '你的工作底色',
    '適合的方向',
    '貴人與助力',
    '容易卡住的地方',
    '今年的事業運',
    '對著你的問題',
    '留給你的一句話',
  ],
  wealth: [
    '你的財運底色',
    '賺錢的路子',
    '守財與破財',
    '貴人與合作',
    '今年的財運',
    '對著你的問題',
    '留給你的一句話',
  ],
  year: [
    '這一年的總體',
    '事業',
    '財運',
    '感情',
    '人際與貴人',
    '上半年與下半年',
    '對著你的問題',
    '留給你的一句話',
  ],
};
const TOPIC_WORDS: Record<Topic, [string, string]> = {
  love: ['感情', '感情'],
  career: ['事業', '事业'],
  wealth: ['財運', '财运'],
  year: ['年運', '年运'],
};
const nextYearLabel = () => {
  const d = new Date();
  return d.getMonth() + 1 >= 10 ? d.getFullYear() + 1 : d.getFullYear();
};
type Mode = 'match' | 'love' | 'bazi';
const BAZI_SECTIONS = [
  '你的命盤底色',
  '五行的偏與缺',
  '夫妻宮與另一半',
  '桃花與緣分的時機',
  '今年的感情運',
  '對著你的問題',
  '留給你的一句話',
];
const HOURS = '子丑寅卯辰巳午未申酉戌亥'
  .split('')
  .map(
    (z, i) => `${z}時 ${String((i * 2 + 23) % 24).padStart(2, '0')}–${String(i * 2 + 1).padStart(2, '0')}`,
  );
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const SITS = [
  ['single', '單身', '单身'],
  ['crush', '曖昧中', '暧昧中'],
  ['dating', '交往中', '交往中'],
  ['reunion', '想復合', '想复合'],
  ['married', '已婚', '已婚'],
] as const;
const LOVE_SECTIONS = [
  '你的姻緣底色',
  '你的桃花在哪裡',
  '紅鸞天喜什麼時候到',
  '今年的感情運',
  '和誰處得來',
  '對著你的問題',
  '留給你的一句話',
];
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

const person = (p: { zodiac: number; sign: number }) =>
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
  const [mode, setMode] = useState<Mode>(() => {
    const q = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('mode');
    return q === 'love' || q === 'bazi' ? q : 'match';
  });
  const [bazi, setBazi] = useState<BaziChart | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [gender, setGender] = useState<Gender>('n');
  const [topic, setTopic] = useState<Topic>(() => {
    const q = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('topic');
    return q === 'career' || q === 'wealth' || q === 'year' ? q : 'love';
  });
  const [chart, setChart] = useState<LoveChart | null>(null);
  const [you, setYou] = useState('');
  const [keep, setKeep] = useState(false);
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
  const PRODUCT = mode === 'bazi' && topic === 'year' ? YEAR_PRODUCT : PRODUCTS[mode];
  const productId =
    mode === 'bazi' ? (topic === 'year' ? 'year_1' : 'bazi_1') : mode === 'love' ? 'love_1' : 'match_1';
  const wordsOfTopic = (x: Topic) => (hans ? TOPIC_WORDS[x][1] : TOPIC_WORDS[x][0]);
  const solo = mode !== 'match';
  const price = PRODUCT ? formatPrice(priceForLocale(PRODUCT, locale), locale) : '';

  async function compute(
    md: Mode,
    y: string,
    th: string,
    s: string,
    q: string,
    hr: number | null = hour,
    gd: Gender = gender,
    tp: Topic = topic,
  ) {
    const m = await import('~/ritual/match');
    if (md === 'bazi') {
      const flow = tp === 'year' ? m.reportYear() : m.flowYear();
      const input = m.baziOf(y, hr, gd, flow, tp);
      const k = input && (await m.baziKey(y, hr, gd, flow, s, q, tp));
      if (!input || !k) return false;
      setResult(null);
      setChart(null);
      setBazi(baziChart(input));
      setKey(k);
      return true;
    }
    if (md === 'love') {
      const me = m.personOf(y);
      if (!me) return false;
      const year = m.flowYear();
      const k = await m.loveKey(y, year, s, q);
      if (!k) return false;
      setResult(null);
      setBazi(null);
      setChart(loveChart(me.zodiac, me.sign, year));
      setKey(k);
      return true;
    }
    const a = m.personOf(y);
    const b = m.personOf(th);
    if (!a || !b) return false;
    const k = await m.matchKey(y, th, s, q);
    if (!k) return false;
    setChart(null);
    setBazi(null);
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
    if (!pending) {
      const saved = loadBirthday();
      if (saved) {
        setYou(saved);
        setKeep(true);
      }
      return;
    }
    setMode(pending.mode);
    setHour(pending.hour);
    setGender(pending.gender);
    setTopic(pending.topic);
    setYou(pending.you);
    setThem(pending.them);
    setSit(pending.sit);
    setQuestion(pending.question);
    setWaiting(pending.why === 'pay' && !cancelled);
    void compute(
      pending.mode,
      pending.you,
      pending.them,
      pending.sit,
      pending.question,
      pending.hour,
      pending.gender,
      pending.topic,
    );
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

  const shown = result || chart || bazi;
  useEffect(() => {
    if (!shown) return;
    const frame = requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  const reset = () => {
    setResult(null);
    setChart(null);
    setBazi(null);
    setKey('');
    setBody('');
    setAccess('idle');
    setConsent(false);
    setMessage('');
  };

  async function go(md: Mode = mode, asked: string = question) {
    if (busy || waiting) return;
    setNote('');
    if (!you) return setNote(t('先填你的生日。', '先填你的生日。'));
    if (md === 'match' && !them) return setNote(t('兩個人的生日都要填。', '两个人的生日都要填。'));
    setBusy(true);
    try {
      const q = asked.replace(/\s+/g, ' ').trim().slice(0, 100);
      setQuestion(q);
      const ok = await compute(md, you, them, sit, q);
      if (!ok)
        setNote(
          t(
            '這個日期算不了，請確認日期真的存在（例如沒有 2 月 30 日）。',
            '这个日期算不了，请确认日期真的存在（例如没有 2 月 30 日）。',
          ),
        );
      else {
        keepBirthday(you, keep);
        track('ritual_begin', { kind: md, lite: true });
        track('reading_done', { kind: md, lite: true, ...(md === 'bazi' ? { topic } : {}) });
      }
    } catch {
      setNote(t('暫時算不了，請稍後再試。', '暂时算不了，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!key || !PRODUCT || access !== 'none' || busy) return;
    const pending = {
      mode,
      you,
      them: mode === 'match' ? them : '',
      hour: mode === 'bazi' ? hour : null,
      gender: mode === 'bazi' ? gender : ('n' as const),
      topic: mode === 'bazi' ? topic : ('love' as const),
      question,
      sit,
      day: today(),
    };
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
    track('unlock_click', { product: productId, lite: true });
    track('checkout_start', { product: productId, from: 'market', lite: true });
    try {
      const res = await withGuest(() =>
        liteRequest('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId,
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
      track('checkout_session_created', { product: productId, lite: true });
      window.location.assign(url.href);
    } catch {
      track('checkout_api_failure', { product: productId, lite: true });
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
            track('deep_read', { product: productId, lite: true });
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
          <h1 id="lf-title">
            {mode === 'bazi'
              ? t('八字命盤', '八字命盘')
              : mode === 'love'
                ? t('我的姻緣盤', '我的姻缘盘')
                : t('合緣配對', '合缘配对')}
          </h1>
          <div className="lm__chips lm__modes">
            {(['match', 'love', 'bazi'] as const).map((md) => (
              <button
                key={md}
                type="button"
                aria-pressed={mode === md}
                disabled={locked}
                onClick={() => {
                  if (md === mode) return;
                  setMode(md);
                  reset();
                }}
              >
                {md === 'bazi'
                  ? t('八字命盤', '八字命盘')
                  : md === 'love'
                    ? t('我的姻緣盤', '我的姻缘盘')
                    : t('合緣配對', '合缘配对')}
              </button>
            ))}
          </div>
          <p className="lm__lead">
            {mode === 'bazi'
              ? t(
                  '填你的生日（公曆、農曆都可以；知道時辰更準），排出四柱八字、五行、夫妻宮與今年感情運。以立春換年、節氣換月；生日只在這台裝置裡算，不會送出。',
                  '填你的生日（公历、农历都可以；知道时辰更准），排出四柱八字、五行、夫妻宫与今年感情运。以立春换年、节气换月；生日只在这台设备里算，不会发送。',
                )
              : mode === 'love'
                ? t(
                    '填你的生日（公曆、農曆都可以），排出你的桃花、紅鸞、天喜和今年的感情運。生肖以立春換年；生日只在這台裝置裡算，不會送出。',
                    '填你的生日（公历、农历都可以），排出你的桃花、红鸾、天喜和今年的感情运。生肖以立春换年；生日只在这台设备里算，不会发送。',
                  )
                : t(
                    '填你和對方的生日（公曆、農曆都可以），看生肖合沖與星座元素。生肖以立春換年；生日只在這台裝置裡算，不會送出。',
                    '填你和对方的生日（公历、农历都可以），看生肖合冲与星座元素。生肖以立春换年；生日只在这台设备里算，不会发送。',
                  )}
          </p>
          <div className={mode === 'love' ? 'lm__dates is-one' : 'lm__dates'}>
            <DateSelect
              label={t('你的生日', '你的生日')}
              value={you}
              hans={hans}
              disabled={locked}
              onChange={(v) => {
                setYou(v);
                if (shown) reset();
              }}
            />
            {mode === 'match' && (
              <DateSelect
                label={t('對方的生日', '对方的生日')}
                value={them}
                hans={hans}
                disabled={locked}
                onChange={(v) => {
                  setThem(v);
                  if (shown) reset();
                }}
              />
            )}
            {mode === 'bazi' && (
              <label>
                <span className="lm__label">{t('出生時辰', '出生时辰')}</span>
                <select
                  value={hour === null ? '' : String(hour)}
                  disabled={locked}
                  onChange={(e) => {
                    setHour(e.target.value === '' ? null : Number(e.target.value));
                    if (shown) reset();
                  }}
                >
                  <option value="">{t('不知道', '不知道')}</option>
                  {HOURS.map((h, i) => (
                    <option key={h} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="lm__keep">
            <input
              type="checkbox"
              checked={keep}
              disabled={locked}
              onChange={(e) => setKeep(e.target.checked)}
            />
            <span>
              {t(
                '在這台裝置記住我的生日（只存在本機，取消勾選就刪除）',
                '在这台设备记住我的生日（只存在本机，取消勾选就删除）',
              )}
            </span>
          </label>
          {mode === 'bazi' && (
            <fieldset className="lm__sits">
              <legend className="lm__label">{t('看哪方面', '看哪方面')}</legend>
              <div className="lm__chips">
                {(['love', 'career', 'wealth', 'year'] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={topic === x}
                    disabled={locked}
                    onClick={() => {
                      setTopic(x);
                      if (shown) reset();
                    }}
                  >
                    {x === 'year' ? `${nextYearLabel()}${wordsOfTopic(x)}` : wordsOfTopic(x)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {mode === 'bazi' && (
            <fieldset className="lm__sits">
              <legend className="lm__label">{t('性別（看配偶星用）', '性别（看配偶星用）')}</legend>
              <div className="lm__chips">
                {(
                  [
                    ['f', '女', '女'],
                    ['m', '男', '男'],
                    ['n', '不說', '不说'],
                  ] as const
                ).map(([g, a, b]) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={gender === g}
                    disabled={locked}
                    onClick={() => {
                      setGender(g);
                      if (shown) reset();
                    }}
                  >
                    {hans ? b : a}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="lm__sits">
            <legend className="lm__label">
              {solo ? t('你現在的情況', '你现在的情况') : t('你們現在的情況', '你们现在的情况')}
            </legend>
            <div className="lm__chips">
              {SITS.map(([id, hant, hansWord]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={sit === id}
                  disabled={locked}
                  onClick={() => {
                    setSit(id);
                    if (shown) reset();
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
              placeholder={
                solo
                  ? t('例：我什麼時候會遇到對的人', '例：我什么时候会遇到对的人')
                  : t('例：我們會不會一直吵下去', '例：我们会不会一直吵下去')
              }
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (shown) reset();
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
            {solo
              ? shown
                ? t('重新排一盤', '重新排一盘')
                : t('排一盤', '排一盘')
              : shown
                ? t('重新合一合', '重新合一合')
                : t('合一合', '合一合')}
          </button>
          <p className="lm__fine">
            {mode === 'bazi'
              ? t(
                  '八字命盤為簡化的傳統命理，屬文化參考與自我反思，不代表現實預測，也不構成投資或職業建議。',
                  '八字命盘为简化的传统命理，属文化参考与自我反思，不代表现实预测，也不构成投资或职业建议。',
                )
              : mode === 'love'
                ? t(
                    '生肖流年姻緣是文化習俗與自我反思，不代表現實預測。',
                    '生肖流年姻缘是文化习俗与自我反思，不代表现实预测。',
                  )
                : t(
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
          </>
        )}

        {chart && (
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
                <b>{ZODIAC[chart.zodiac - 1]}</b>
                <span>{person(chart)}</span>
              </div>
              <i aria-hidden="true">✿</i>
              <div>
                <small>{t('桃花', '桃花')}</small>
                <b>{ZODIAC[chart.taohua - 1]}</b>
                <span>{`紅鸞 ${ZODIAC[chart.hongluan - 1]}．天喜 ${ZODIAC[chart.tianxi - 1]}`}</span>
              </div>
            </div>
            <h2 className="lm__grade lm__mtitle" id="lf-result">
              {chart.title}
            </h2>
            <p className="lm__verdict">{`${chart.year} ${yearGanzhi(chart.year)}年：${LOVE_TITLE_TEXT[chart.title]}`}</p>
            <section className="lm__plain">
              <dl>
                {loveLines(chart).map((l) => (
                  <div key={l.label}>
                    <dt>{l.label}</dt>
                    <dd>{l.text}</dd>
                  </div>
                ))}
              </dl>
              <ul className="lm__years">
                {chart.years.slice(0, 6).map((y) => (
                  <li key={y.year}>
                    <b>{y.year}</b>
                    <span>{yearGanzhi(y.year)}</span>
                    <em>{starsLabel(y.stars)}</em>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}

        {bazi && (
          <section className="lm__result" ref={resultRef} aria-labelledby="lf-result">
            {(question || sitWord) && (
              <p className="lm__asked">
                {question ? `${t('問', '问')}．${question}` : ''}
                {sitWord && <span>{sitWord}</span>}
              </p>
            )}
            <div className="lm__pillars">
              {(
                [
                  ['時', bazi.hour],
                  ['日', bazi.day],
                  ['月', bazi.month],
                  ['年', bazi.year],
                ] as const
              ).map(([l, p]) => (
                <div key={l} className={l === '日' ? 'is-me' : undefined}>
                  <small>{`${l}柱`}</small>
                  <b>{p ? STEMS[p.stem] : '？'}</b>
                  <i>{p ? stemElement(p.stem) : ''}</i>
                  <b>{p ? ZHI[p.branch] : '？'}</b>
                  <i>{p ? branchElement(p.branch) : t('不詳', '不详')}</i>
                </div>
              ))}
            </div>
            <h2 className="lm__grade lm__mtitle" id="lf-result">
              {bazi.title}
            </h2>
            <p className="lm__verdict">{BAZI_TITLE_TEXT[bazi.title]}</p>
            <ul className="lm__elements">
              {ELEMENTS.map((e) => (
                <li key={e}>
                  <span>{e}</span>
                  <i
                    style={{
                      width: `${Math.round((bazi.counts[e] / Math.max(1, ...ELEMENTS.map((x) => bazi.counts[x]))) * 100)}%`,
                    }}
                  />
                  <b>{bazi.counts[e]}</b>
                </li>
              ))}
            </ul>
            <section className="lm__plain">
              <dl>
                {baziLines(bazi).map((l) => (
                  <div key={l.label}>
                    <dt>{l.label}</dt>
                    <dd>{l.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </section>
        )}

        {shown && (
          <section className="lm__deep" aria-labelledby="lf-deep">
            <h2 id="lf-deep">
              {mode === 'bazi'
                ? topic === 'year'
                  ? `${bazi?.flow ?? ''} ${t('年運完整報告', '年运完整报告')}`
                  : `${t('完整八字', '完整八字')}${wordsOfTopic(topic)}`
                : mode === 'love'
                  ? t('完整姻緣盤', '完整姻缘盘')
                  : t('完整合緣', '完整合缘')}
            </h2>
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
                  {bazi && bazi.topic === 'career'
                    ? `${STEMS[bazi.day.stem]}${bazi.dayMaster}日主${bazi.strength}，官殺 ${bazi.roles.官殺}、印 ${bazi.roles.印}、食傷 ${bazi.roles.食傷}。把這幾股力量放在一起看，你在工作上最該先調整的，其實是……`
                    : bazi && bazi.topic === 'wealth'
                      ? `${STEMS[bazi.day.stem]}${bazi.dayMaster}日主${bazi.strength}，財星 ${bazi.roles.財}、比劫 ${bazi.roles.比劫}。放在一起看，你的錢最容易漏掉的地方，其實是……`
                      : bazi && bazi.topic === 'year'
                        ? `${bazi.flow} 年對你的日主是「${bazi.flowRole}」，和生肖${bazi.flowToZodiac}。這一年最該把握的時機，其實是……`
                        : bazi
                          ? `${STEMS[bazi.day.stem]}${bazi.dayMaster}日主${bazi.strength}，夫妻宮坐${ZHI[bazi.spousePalace]}${bazi.missing.length ? `，命裡缺${bazi.missing.join('、')}` : ''}。把這幾樣放在一起看，你在感情裡最常卡住的，其實是……`
                          : chart
                            ? `你的桃花在${ZODIAC[chart.taohua - 1]}；${chart.year} ${yearGanzhi(chart.year)}年對你來說是「${chart.title}」。把桃花、紅鸞、流年連起來看，真正會讓你錯過緣分的，其實是……`
                            : result &&
                              `${ZODIAC[result.a.zodiac - 1]}配${ZODIAC[result.b.zodiac - 1]}是${ZODIAC_RELATION_NAME[result.zodiac]}，${SIGNS[result.a.sign - 1]}配${SIGNS[result.b.sign - 1]}是${SIGN_RELATION_NAME[result.sign]}。放在一起看，你們最容易卡住的地方，其實是……`}
                </p>
                <ol className="lm__sections">
                  {(mode === 'bazi'
                    ? topic === 'love'
                      ? BAZI_SECTIONS
                      : TOPIC_SECTIONS[topic]
                    : mode === 'love'
                      ? LOVE_SECTIONS
                      : SECTIONS
                  ).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <button
                  className="lm__pay"
                  type="button"
                  disabled={busy || !price}
                  onClick={() => void buy()}
                >
                  {`${mode === 'bazi' ? (topic === 'year' ? t('解鎖完整年運報告', '解锁完整年运报告') : `${t('解鎖完整八字', '解锁完整八字')}${wordsOfTopic(topic)}`) : mode === 'love' ? t('解鎖完整姻緣盤', '解锁完整姻缘盘') : t('解鎖完整合緣', '解锁完整合缘')} · ${price}`}
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
        )}

        {shown && !locked && (
          <section className="lm__cross" aria-label={t('其他玩法', '其他玩法')}>
            <p className="lm__label">{t('生日已經填好，也可以看看', '生日已经填好，也可以看看')}</p>
            {(
              [
                [
                  'love',
                  t('看你自己的姻緣盤', '看你自己的姻缘盘'),
                  t('桃花、紅鸞、今年感情運', '桃花、红鸾、今年感情运'),
                ],
                ['bazi', t('排你的八字命盤', '排你的八字命盘'), t('四柱五行、夫妻宮', '四柱五行、夫妻宫')],
                ['match', t('和他合一合', '和他合一合'), t('填對方生日，看合不合', '填对方生日，看合不合')],
              ] as const
            )
              .filter(([m]) => m !== mode)
              .map(([m, title, desc]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    track('fortune_cross', { to: m, lite: true });
                    setMode(m);
                    reset();
                    setQuestion('');
                    if (m === 'match') {
                      setThem('');
                      document.getElementById('lf-title')?.scrollIntoView({ block: 'start' });
                    } else void go(m, '');
                  }}
                >
                  <b>{title}</b>
                  <small>{desc}</small>
                </button>
              ))}
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
