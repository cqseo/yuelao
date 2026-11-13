import { findProduct, formatPrice, type Product, priceForLocale } from '@yuelao/core/site';
import { useEffect, useRef } from 'react';
import { track } from '~/lib/track';
import { getLocale } from '~/paraglide/runtime.js';
import { COMPANION_STARTERS, type CompanionTheme, guidedReply } from '~/site/companion';
import site from '../../site.config';
import './market.css';

type AiStatus = { enabled: boolean; loginRequired: boolean; dailyLimit: number; remaining?: number };

// 月下集市（第一期）：一整片可以走動的 3D 夜市，月老殿與塔羅館兩間開張。
// 這裡只放外殼（畫布 + 介面骨架）；three.js 與場景在瀏覽器端才動態載入，
// 所以伺服器渲染和其他頁面都不會背到這包程式。
export function Market() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let stop: (() => void) | undefined;
    let gone = false;
    const locale = getLocale();

    // 追問月老：預設用站內的引導式回答（免費、不出站）。AI 即時對話只有在
    // 伺服器開放、已登入、而且使用者在面板勾了同意時才用；失敗就退回引導式。
    let ai: AiStatus | null = null;
    void fetch('/api/chat/ai', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as AiStatus) : null))
      .then((status) => {
        ai = status;
      })
      .catch(() => {});
    // 深度解讀（付費）：價格讀站點設定；下單、核對都走伺服器既有的接口，這裡不碰金額。
    // 「等一下要回來的那支籤」暫存在 sessionStorage，登入或付款回來後月老殿接著演。
    const unlock = findProduct(site, 'unlock_1');
    const PENDING = 'market-pending';
    const readingUrl = (stickId: number, category: string) =>
      `/api/account/reading?stickId=${stickId}&category=${category}&locale=${locale}`;
    const authed = async (go: () => Promise<Response>) => {
      let res = await go();
      if (res.status === 401) {
        const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (refreshed.ok) res = await go();
      }
      return res;
    };
    /** 建單並取得 Stripe 結帳網址。金額由伺服器按商品決定，這裡只送「買哪個」。 */
    const checkout = async (productId: string, extra: Record<string, unknown> = {}) => {
      track('checkout_start', { product: productId, from: 'market' });
      const product = findProduct(site, productId);
      try {
        const res = await authed(() =>
          fetch('/api/billing/checkout', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              productId,
              currency: product?.prices[locale].currency,
              locale,
              from: 'market',
              ...extra,
            }),
          }),
        );
        if (res.status === 401) return { state: 'login' as const };
        if (res.status === 409) return { state: 'owned' as const };
        if (res.status === 429) return { state: 'busy' as const };
        if (res.status === 201) {
          const data = (await res.json()) as { checkoutUrl?: string };
          // 只跳去 Stripe 的結帳網域
          if (data.checkoutUrl && new URL(data.checkoutUrl).host === 'checkout.stripe.com')
            return { state: 'redirect' as const, url: data.checkoutUrl };
          return { state: 'error' as const };
        }
        return { state: res.status === 503 ? ('closed' as const) : ('error' as const) };
      } catch {
        return { state: 'error' as const };
      }
    };
    // 付費外觀等「永久擁有的物品」：價格讀站點設定，擁有清單讀帳戶。
    const BACK = 'market-back';
    try {
      sessionStorage.removeItem(BACK);
    } catch {}
    const shop = {
      prices: Object.fromEntries(
        // 目錄目前沒有 item 商品（外觀免費）；之後加了就會出現在這裡
        (site.products as readonly Product[])
          .filter((p) => p.kind === 'item')
          .map((p) => [p.id, formatPrice(priceForLocale(p, locale), locale)]),
      ),
      async owned(): Promise<string[]> {
        try {
          const res = await authed(() =>
            fetch('/api/account/status', { credentials: 'same-origin', cache: 'no-store' }),
          );
          if (!res.ok) return [];
          const data = (await res.json()) as { items?: unknown };
          return Array.isArray(data.items)
            ? data.items.filter((x): x is string => typeof x === 'string')
            : [];
        } catch {
          return [];
        }
      },
      buy: (itemId: string) => checkout(itemId),
      /** 記下「等一下要回集市」，登入頁與付款回程頁據此帶路。 */
      leaving() {
        try {
          sessionStorage.setItem(BACK, '1');
        } catch {}
      },
    };

    // 許願池：列表誰都能看；許願、同願、檢舉、撤下要登入。審核與限額都在伺服器。
    type WishResult = {
      ok: boolean;
      id?: string;
      status?: string;
      result?: string;
      code?: string;
      care?: boolean;
    };
    const wishPost = async (body: Record<string, unknown>): Promise<WishResult> => {
      try {
        const res = await authed(() =>
          fetch('/api/wishes', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          status?: string;
          result?: string;
          error?: { code?: string; care?: boolean };
        };
        if (res.ok) return { ok: true, id: data.id, status: data.status, result: data.result };
        return { ok: false, code: data.error?.code, care: data.error?.care === true };
      } catch {
        return { ok: false };
      }
    };
    const wishes = {
      async list() {
        try {
          const res = await authed(() =>
            fetch('/api/wishes', { credentials: 'same-origin', cache: 'no-store' }),
          );
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      },
      make: (body: string, tag: string) => wishPost({ action: 'make', body, tag, locale }),
      bless: (wishId: string) => wishPost({ action: 'bless', wishId }),
      report: (wishId: string, reason: string) => wishPost({ action: 'report', wishId, reason }),
      withdraw: (wishId: string) => wishPost({ action: 'withdraw', wishId }),
      leaving: () => shop.leaving(),
    };

    const deep = {
      price: unlock ? formatPrice(priceForLocale(unlock, locale), locale) : '',
      page: (stickId: number, category: string) =>
        `/account/reading?stickId=${stickId}&category=${category}&locale=${locale}`,
      /** ready：已解鎖且內文已生成；unlocked：已解鎖、內文待領取；none：尚未購買或未登入。 */
      async check(stickId: number, category: string) {
        try {
          const res = await authed(() =>
            fetch(readingUrl(stickId, category), { credentials: 'same-origin', cache: 'no-store' }),
          );
          if (res.ok) {
            const data = (await res.json()) as { body?: string };
            if (data.body) return { state: 'ready' as const, body: data.body };
          }
          if (res.status === 404) {
            const acc = await fetch('/api/account/status', { credentials: 'same-origin', cache: 'no-store' });
            if (acc.ok) {
              const a = (await acc.json()) as {
                unlocks?: { stick_id: number; category: string; locale: string; revoked: boolean }[];
              };
              const has = a.unlocks?.some(
                (u) => u.stick_id === stickId && u.category === category && u.locale === locale && !u.revoked,
              );
              if (has) return { state: 'unlocked' as const };
            }
          }
        } catch {
          // 查不到就當作還沒買
        }
        return { state: 'none' as const };
      },
      buy(stickId: number, category: string) {
        return checkout('unlock_1', { stickId, category });
      },
      /**
       * 請伺服器生成這支籤的深度解讀（已付款才會成功）。付款前已在面板上告知問題會送至 AI 服務，
       * 付款即同意，所以這裡帶 consent: true。回傳 ready／processing／failed。
       */
      async generate(stickId: number, category: string, question: string) {
        try {
          const res = await authed(() =>
            fetch('/api/account/reading/generate', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                stickId,
                category,
                locale,
                question: question.slice(0, 400),
                consent: true,
              }),
            }),
          );
          if (res.status === 202) return 'processing' as const;
          return res.ok ? ('ready' as const) : ('failed' as const);
        } catch {
          return 'failed' as const;
        }
      },
      /** why：'pay' 去付款、'login' 去登入。question 只存在本機，生成後就清掉。 */
      save(stickId: number, category: string, why: 'pay' | 'login' = 'login', question = '') {
        try {
          sessionStorage.setItem(
            PENDING,
            JSON.stringify({ stickId, category, why, question: question.slice(0, 400), at: Date.now() }),
          );
        } catch {}
      },
      /** 取出並清掉暫存的那支籤；超過 45 分鐘或格式不對就不算。 */
      take() {
        try {
          const raw = sessionStorage.getItem(PENDING);
          sessionStorage.removeItem(PENDING);
          const p = raw
            ? (JSON.parse(raw) as {
                stickId?: unknown;
                category?: unknown;
                why?: unknown;
                question?: unknown;
                at?: unknown;
              })
            : null;
          if (
            p &&
            typeof p.stickId === 'number' &&
            Number.isInteger(p.stickId) &&
            p.stickId >= 1 &&
            p.stickId <= 100 &&
            (p.category === 'him' || p.category === 'single' || p.category === 'reunion') &&
            typeof p.at === 'number' &&
            Date.now() - p.at < 45 * 60 * 1000
          )
            return {
              stickId: p.stickId,
              category: p.category,
              why: p.why === 'pay' ? ('pay' as const) : ('login' as const),
              question: typeof p.question === 'string' ? p.question.slice(0, 400) : '',
            };
        } catch {}
        return null;
      },
    };

    let theme: CompanionTheme = 'general';
    let turn = 0;
    const history: { role: 'user' | 'assistant'; text: string }[] = [];
    async function ask(text: string, o: { ai?: boolean }) {
      let answer: { text: string; followups: string[] } | undefined;
      if (o.ai && ai?.enabled && !ai.loginRequired) {
        try {
          const response = await fetch('/api/chat/ai', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: text, locale, history: history.slice(-6), consent: true }),
          });
          const content = response.ok ? ((await response.json()) as { answer?: string }) : null;
          if (content?.answer) {
            answer = { text: content.answer, followups: [] };
            if (ai.remaining !== undefined) ai.remaining = Math.max(0, ai.remaining - 1);
          }
        } catch {
          // 退回引導式
        }
      }
      if (!answer) {
        const reply = guidedReply(text, theme, turn, locale);
        theme = reply.theme;
        answer = { text: reply.text, followups: reply.followups };
      }
      turn++;
      history.push({ role: 'user', text }, { role: 'assistant', text: answer.text });
      track('market_npc_ask', { npc: 'yuelao', ai: !!o.ai });
      return answer;
    }
    void import('./engine/main.js').then(({ startMarket }) => {
      if (gone) return;
      stop = startMarket(el, {
        onEvent: track,
        starters: COMPANION_STARTERS.map((s) => s[locale]),
        aiStatus: () => ({ available: !!ai?.enabled && !ai.loginRequired && ai.remaining !== 0 }),
        ask,
        deep,
        shop,
        wishes,
      });
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);

  return (
    <div className="mk" ref={root}>
      <canvas id="gl" />
      <div id="spots" />
      <nav id="rail" aria-label="鋪子" />
      <button type="button" id="prompt" className="seal" />
      <div id="stick">
        <i />
      </div>
      <header id="hud">
        <div className="left">
          <button type="button" id="back" hidden>
            回到廣場
          </button>
          <span id="hud-title">月下集市</span>
          <button type="button" id="sky" aria-label="天色" />
        </div>
        <div className="right">
          <button type="button" id="view">
            第一人稱
          </button>
          <button type="button" id="look">
            外觀
          </button>
          <button type="button" id="sound">
            聲音　開
          </button>
          <a href="/account">我的</a>
        </div>
      </header>
      <div id="stack">
        <div id="say" aria-live="polite">
          <b />
          <p />
        </div>
        <p id="hint" role="status" />
      </div>
      <section id="menu">
        <h1>月下集市</h1>
        <p className="lead">一座夜裡的集市，每間鋪子問一種事。四處逛逛，想問什麼，就走進哪一間。</p>
        <div className="row">
          <button type="button" className="seal" id="enter">
            入市
          </button>
          <a className="ghost" href="/ritual">
            改用一般版求籤
          </a>
        </div>
        <small>今晚開張：月老殿、塔羅館、大殿</small>
      </section>
      <section id="panel" />
      <section id="card" />
      <div id="fade" />
      <div id="boot">
        <h1>月下集市</h1>
        <div className="bar">
          <div id="boot-bar" />
        </div>
        <p id="boot-text">正在點燈</p>
        <a className="ghost" href="/ritual">
          改用一般版求籤
        </a>
      </div>
    </div>
  );
}
