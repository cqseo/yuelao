import { findProduct, formatPrice, priceForLocale } from '@yuelao/core/site';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { uiPrefix } from '~/i18n/locale';
import { tr, trf } from '~/i18n/ui';
import { withGuest } from '~/lib/guest';
import { track } from '~/lib/track';
import { liteRequest } from '~/market/lite-billing';
import site from '../../site.config';

// 追問月老（站長 2026-11-18）：放在付費解籤下面。一份解籤最多 3 次，每次單獨付款；
// 問了別的事、或需要先照顧安全時，月老只回一段短話，這次不算用掉。
// 伺服器：packages/core/src/reading-followup.ts（名額、生成）與 billing/checkout.ts（付款）。

type Selection = { stickId: number; category: 'him' | 'single' | 'reunion'; locale: 'zh-Hant' | 'zh-Hans' };
type Status = {
  enabled: boolean;
  readingReady: boolean;
  limit: number;
  open: number;
  remaining: number;
  answers: { body: string; answeredAt: string | null }[];
};

const product = findProduct(site, 'followup_1');
const QUESTION_MAX = 200;

/** 回答照段落顯示；外語介面的中文標記翻成介面語言。 */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs of one answer
          <p key={i}>{uiPrefix() ? p.replace(/【([^】]{1,12})】/g, (_, h: string) => tr(h)) : p}</p>
        ))}
    </>
  );
}

export function FollowUp({ selection }: { selection: Selection }) {
  const zh = selection.locale === 'zh-Hans';
  const t = (hant: string, hans: string) => (zh ? hans : tr(hant));
  const tf = (hant: string, hans: string, value: string) =>
    zh ? hans.replace('{0}', value) : trf(hant, value);
  const [status, setStatus] = useState<Status | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [redirect, setRedirect] = useState('');
  const [error, setError] = useState('');
  const price = product ? formatPrice(priceForLocale(product, selection.locale), selection.locale) : '';
  const query = new URLSearchParams({
    stickId: String(selection.stickId),
    category: selection.category,
    locale: selection.locale,
  }).toString();

  const load = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await liteRequest(`/api/account/followups?${query}`);
      if (!res.ok) return null;
      const data = (await res.json()) as Status;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, [query]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const paid = params.get('followup') === 'paid';
    void (async () => {
      const first = await load();
      // 剛付完：Stripe 的通知可能晚幾秒才到，名額出現前先等一下（最多約 40 秒）。
      if (paid && first && first.open === 0 && active) {
        setWaitingPayment(true);
        for (let i = 0; i < 20 && active; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const next = await load();
          if (next && next.open > 0) break;
        }
        if (active) setWaitingPayment(false);
      }
      if (paid || params.get('followup') === 'cancelled') {
        params.delete('followup');
        const rest = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  async function buy() {
    if (busy || !product) return;
    setBusy(true);
    setError('');
    track('followup_checkout_click');
    try {
      const res = await withGuest(() =>
        liteRequest('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            currency: priceForLocale(product, selection.locale).currency,
            locale: selection.locale,
            ui: uiPrefix(),
            stickId: selection.stickId,
            category: selection.category,
          }),
        }),
      );
      if (res.status === 201) {
        const data = (await res.json()) as { checkoutUrl?: unknown };
        const url = typeof data.checkoutUrl === 'string' ? new URL(data.checkoutUrl) : null;
        if (url && url.protocol === 'https:' && url.hostname === 'checkout.stripe.com') {
          window.location.href = url.href;
          return;
        }
      }
      const code = ((await res.json().catch(() => ({}))) as { error?: { code?: string } }).error?.code;
      if (code === 'followup_credit_open' || code === 'followup_limit') await load();
      setError(
        code === 'followup_limit'
          ? t('這份解籤的追問次數已滿。', '这份解签的追问次数已满。')
          : res.status === 429
            ? t('操作太頻繁，請稍後再試。', '操作太频繁，请稍后再试。')
            : t('暫時無法付款，請稍後再試。', '暂时无法付款，请稍后再试。'),
      );
    } catch {
      setError(t('連線失敗，請稍後再試。', '连接失败，请稍后再试。'));
    } finally {
      setBusy(false);
    }
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (busy || !q) return;
    setBusy(true);
    setError('');
    setRedirect('');
    try {
      const res = await liteRequest('/api/account/followups/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...selection, ui: uiPrefix(), question: q }),
      });
      if (res.ok) {
        const data = (await res.json()) as { status?: string; body?: string };
        if (data.status === 'redirected' && data.body) {
          track('followup_redirected');
          setRedirect(data.body);
        } else if (data.status === 'processing' || res.status === 202) {
          setError(t('月老正在回答上一個問題，請稍後刷新頁面。', '月老正在回答上一个问题，请稍后刷新页面。'));
        } else {
          track('followup_answered');
          setQuestion('');
        }
        await load();
        return;
      }
      if (res.status === 402) await load();
      setError(
        t(
          '暫時無法回答。這次追問仍然保留，請稍後重試，不用再付款。',
          '暂时无法回答。这次追问仍然保留，请稍后重试，不用再付款。',
        ),
      );
    } catch {
      setError(t('連線失敗，這次追問仍然保留，請稍後重試。', '连接失败，这次追问仍然保留，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  }

  if (!status?.enabled || !status.readingReady || !product) return null;
  const used = status.answers.length;

  return (
    <section className="followup" id="followup" aria-labelledby="followup-title">
      <h2 id="followup-title">{t('追問月老', '追问月老')}</h2>

      {status.answers.map((a, i) => (
        <div className="followup-answer" key={a.answeredAt ?? i}>
          <p className="followup-label">{tf('第 {0} 問', '第 {0} 问', String(i + 1))}</p>
          <Paragraphs text={a.body} />
        </div>
      ))}

      {redirect && (
        <div className="followup-answer followup-redirect" role="status">
          <Paragraphs text={redirect} />
          <p className="followup-note">
            {t('這一次不算次數，追問仍然保留。', '这一次不算次数，追问仍然保留。')}
          </p>
        </div>
      )}

      {waitingPayment && <p role="status">{t('正在確認付款，請稍候…', '正在确认付款，请稍候…')}</p>}

      {status.open > 0 ? (
        <form className="reading-generate-form" onSubmit={ask}>
          <label htmlFor="followup-question">
            {t(
              '就這件事，還想問月老哪一句？（一次問一件事，200 字以內）',
              '就这件事，还想问月老哪一句？（一次问一件事，200 字以内）',
            )}
          </label>
          <textarea
            id="followup-question"
            rows={3}
            maxLength={QUESTION_MAX}
            placeholder={t(
              '例：如果他一直不回，我要等多久才放下？',
              '例：如果他一直不回，我要等多久才放下？',
            )}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <p className="reading-consent">
            {t(
              '問題原文不寫入本站資料庫，只保存月老的回答。問別的事或需要先照顧安全時，這次不算次數。',
              '问题原文不存入本站数据库，只保存月老的回答。问别的事或需要先照顾安全时，这次不算次数。',
            )}
          </p>
          <button type="submit" disabled={busy || !question.trim()}>
            {busy ? t('月老正在想…', '月老正在想…') : t('請月老回答', '请月老回答')}
          </button>
        </form>
      ) : status.remaining > 0 ? (
        !waitingPayment && (
          <div className="followup-offer">
            <p>
              {used === 0
                ? t(
                    '讀完還有放不下的地方？就這件事，可以再問月老一句。',
                    '读完还有放不下的地方？就这件事，可以再问月老一句。',
                  )
                : tf('還可以再追問 {0} 次。', '还可以再追问 {0} 次。', String(status.remaining))}
            </p>
            <button type="button" onClick={() => void buy()} disabled={busy}>
              {busy ? t('前往付款…', '前往付款…') : tf('追問一句 · {0}', '追问一句 · {0}', price)}
            </button>
          </div>
        )
      ) : (
        <p className="followup-note">
          {t(
            '這件事該問的都問了。一事一籤，若是另一件事，再到殿前求一支籤吧。',
            '这件事该问的都问了。一事一签，若是另一件事，再到殿前求一支签吧。',
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </section>
  );
}
