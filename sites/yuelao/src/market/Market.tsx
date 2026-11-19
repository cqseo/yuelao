import { findProduct, formatPerUse, formatPrice, type Product, priceForLocale, salePlans } from '@yuelao/core/site';
import { useEffect, useRef, useState } from 'react';
import { LiteMarket } from './LiteMarket';
import { LiteFortune } from './LiteFortune';
import { LiteTarot } from './LiteTarot';
import { hasLiteFortunePending } from './lite-fortune-pending';
import { hasLiteTarotPending } from './lite-tarot-pending';
import { hasLitePending } from './lite-pending';
import { guestCheckoutOn, isGuest, withGuest } from '~/lib/guest';
import { track } from '~/lib/track';
import { COMPANION_STARTERS, type CompanionTheme, guidedReply } from '~/site/companion';
import site from '../../site.config';
import './market.css';
import { ensureContent } from '~/i18n/content';
import { watchTranslate } from '~/i18n/dom';
import { LangMenu } from '~/i18n/LangMenu';
import { contentLocale, uiPrefix } from '~/i18n/locale';
import { tr, uiDict } from '~/i18n/ui';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';

type AiStatus = { enabled: boolean; loginRequired: boolean; dailyLimit: number; remaining?: number };

// 月下集市（第一期）：一整片可以走動的 3D 夜市，月老殿與塔羅館兩間開張。
// 這裡只放外殼（畫布 + 介面骨架）；three.js 與場景在瀏覽器端才動態載入，
// 所以伺服器渲染和其他頁面都不會背到這包程式。
export function Market() {
  const root = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const [lite, setLite] = useState(false);
  const [liteTarot, setLiteTarot] = useState(false);
  const [liteFortune, setLiteFortune] = useState(false);

  // 手機頂欄選單：點選單外面就收起來
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const hud = document.getElementById('hud');
      if (!hud?.classList.contains('open')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('#hud-menu, #hud-more')) return;
      hud.classList.remove('open');
      hud.querySelector('#hud-more')?.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Fast tarot and returning paid tarot should avoid booting the WebGL world.
    const liteMode = new URLSearchParams(window.location.search).get('lite');
    if (hasLiteTarotPending() || liteMode === 'tarot') {
      track('market_lite_manual', { source: 'fast_tarot' });
      setLiteTarot(true);
      setLite(true);
      return;
    }
    // 輕量算命攤付款／登入回來，或 ?lite=bazi：不開 3D，直接回輕量算命攤
    if (hasLiteFortunePending() || liteMode === 'bazi') {
      track('market_lite_manual', { source: 'fast_fortune' });
      setLiteFortune(true);
      setLite(true);
      return;
    }
    // Bookmarkable same-route fallback for low-end devices and deterministic QA.
    if (liteMode === '1' || hasLitePending()) {
      track('market_lite_manual', { source: 'url' });
      setLite(true);
      return;
    }
    let stop: (() => void) | undefined;
    let gone = false;
    const locale = contentLocale();
    // 非中文介面：引擎寫進來的中文介面字換成當地語言（內容仍是中文）。
    const ui = uiPrefix();
    let untranslate: (() => void) | undefined;
    if (ui) {
      // 介面字典已在入口載好；內容字典（牌義、判詞）進集市才載，載好再換一次字典
      const dict = uiDict(ui);
      if (dict) untranslate = watchTranslate(el, dict, ui);
      void ensureContent(ui).then(() => {
        const full = uiDict(ui);
        if (gone || !full) return;
        untranslate?.();
        untranslate = watchTranslate(el, full, ui);
      });
    }

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
    // 從 Stripe 按「返回」沒付款：網址帶 pay=cancelled，讀一次就從網址拿掉
    let payCancelled = false;
    try {
      const here = new URL(window.location.href);
      if (here.searchParams.get('pay') === 'cancelled') {
        payCancelled = true;
        here.searchParams.delete('pay');
        window.history.replaceState(window.history.state, '', here.pathname + here.search + here.hash);
      }
    } catch {}
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
        // 沒登入：先給一個訪客帳號再結帳（lib/guest.ts）；伺服器沒開訪客時照舊請他登入
        const res = await withGuest(() =>
          authed(() =>
            fetch('/api/billing/checkout', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                ui: uiPrefix(),
                productId,
                currency: product?.prices[locale].currency,
                locale,
                from: 'market',
                ...extra,
              }),
            }),
          ),
        );
        if (res.status === 401) {
          track('checkout_login_required', { product: productId });
          return { state: 'login' as const };
        }
        if (res.status === 409) return { state: 'owned' as const };
        if (res.status === 429) {
          track('checkout_api_failure', { product: productId, status: 429 });
          return { state: 'busy' as const };
        }
        if (res.status === 201) {
          const data = (await res.json()) as { checkoutUrl?: string };
          // 只跳去 Stripe 的結帳網域；只有拿到有效網址才算建單成功。
          if (data.checkoutUrl && new URL(data.checkoutUrl).host === 'checkout.stripe.com') {
            track('checkout_session_created', { product: productId });
            return { state: 'redirect' as const, url: data.checkoutUrl };
          }
          track('checkout_api_failure', { product: productId, status: 201 });
          return { state: 'error' as const };
        }
        track('checkout_api_failure', { product: productId, status: res.status });
        return { state: res.status === 503 ? ('closed' as const) : ('error' as const) };
      } catch {
        track('checkout_api_failure', { product: productId, status: 0 });
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
    let triedRefresh = false;
    const wishes = {
      async list() {
        try {
          const get = () => fetch('/api/wishes', { credentials: 'same-origin', cache: 'no-store' });
          let res = await authed(get);
          if (!res.ok) return null;
          let data = (await res.json()) as { loginRequired?: boolean };
          // 列表對訪客回 200（不是 401），所以登入憑證過期（約一小時）時不會自動續期，
          // 明明登入過卻被叫去登入。看到「要登入」就先試著續期一次；真的沒登入的人只會多問這一次。
          if (data.loginRequired && !triedRefresh) {
            triedRefresh = true;
            const refreshed = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'same-origin',
            });
            if (refreshed.ok) {
              triedRefresh = false;
              res = await get();
              if (res.ok) data = (await res.json()) as { loginRequired?: boolean };
            }
          }
          return data;
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

    // 訪客買完：解讀下面提醒他綁信箱（不綁的話，換手機或清掉瀏覽器資料就找不回來）
    const bindHref = localizeHref('/account#bind');
    const deep = {
      get guest() {
        return isGuest();
      },
      bindHref,
      cancelled: payCancelled,
      price: unlock ? formatPrice(priceForLocale(unlock, locale), locale) : '',
      /**
       * 解鎖方案（站長 2026-11-19，參考占了么）：單次＋次數包。按鈕寫「低至每次多少」，點了在原地選方案。
       * popular：標「最多人選」的那一個。
       */
      plans: salePlans(site, locale).map((p) => ({
        id: p.id,
        uses: p.uses,
        price: formatPrice(p.price, locale),
        perUse: formatPerUse(p.perUse, p.price.currency),
        popular: p.id === 'pack_5',
      })),
      get from() {
        const plans = salePlans(site, locale);
        const low = plans.reduce((m, p) => (p.perUse < m.perUse ? p : m), plans[0]!);
        return low ? formatPerUse(low.perUse, low.price.currency) : '';
      },
      page: (stickId: number, category: string) =>
        localizeHref(`/account/reading?stickId=${stickId}&category=${category}&locale=${locale}`),
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
      /** 買單次（指定這支籤）或次數包（付完回來用一次解鎖這支籤，見 redeem）。 */
      buy(stickId: number, category: string, productId = 'unlock_1') {
        if (productId !== 'unlock_1') return checkout(productId);
        return checkout('unlock_1', { stickId, category });
      },
      /** 次數包還剩幾次（沒登入或查不到就是 0）。 */
      async packUses() {
        try {
          const res = await authed(() =>
            fetch('/api/account/status', { credentials: 'same-origin', cache: 'no-store' }),
          );
          if (!res.ok) return 0;
          const a = (await res.json()) as { packs?: { remaining_uses?: number }[] };
          return (a.packs ?? []).reduce((n, p) => n + Math.max(0, p.remaining_uses ?? 0), 0);
        } catch {
          return 0;
        }
      },
      /** 用次數包的一次解鎖這支籤。ok：解鎖了；none：沒有可用次數；failed：其他錯誤。 */
      async redeem(stickId: number, category: string) {
        try {
          const res = await authed(() =>
            fetch('/api/account/status', { credentials: 'same-origin', cache: 'no-store' }),
          );
          if (!res.ok) return 'failed' as const;
          const a = (await res.json()) as { packs?: { id: string; remaining_uses?: number; created_at?: string }[] };
          const pack = (a.packs ?? [])
            .filter((p) => (p.remaining_uses ?? 0) > 0)
            .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))[0];
          if (!pack) return 'none' as const;
          const r = await authed(() =>
            fetch('/api/account/redeem', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ packId: pack.id, stickId, category, locale }),
            }),
          );
          if (r.ok) {
            track('pack_redeem', { from: 'market' });
            return 'ok' as const;
          }
          // 409：這支籤已經解鎖過（不扣次數）——當作成功，接著去讀
          return r.status === 409 ? ('ok' as const) : ('failed' as const);
        } catch {
          return 'failed' as const;
        }
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
                ui: uiPrefix(),
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
      /** plan：買的是哪個方案（次數包付完回來要先用一次解鎖這支籤）。 */
      save(stickId: number, category: string, why: 'pay' | 'login' = 'login', question = '', plan = 'unlock_1') {
        try {
          sessionStorage.setItem(
            PENDING,
            JSON.stringify({ stickId, category, why, question: question.slice(0, 400), plan, at: Date.now() }),
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
                plan?: unknown;
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
              why:
                p.why === 'pay'
                  ? ('pay' as const)
                  : p.why === 'ritual'
                    ? ('ritual' as const)
                    : ('login' as const),
              question: typeof p.question === 'string' ? p.question.slice(0, 400) : '',
              plan: typeof p.plan === 'string' && /^(unlock_1|pack_\d+)$/.test(p.plan) ? p.plan : 'unlock_1',
            };
        } catch {}
        return null;
      },
    };

    // 塔羅館的完整解讀（付費）：一個「牌陣」= 牌組＋三張＋問題雜湊（格式見 packages/core/src/spread.ts）。
    // 和月老殿一樣：金額、訂單、解鎖都在伺服器；這裡只問狀態、帶去付款、請伺服器動筆。
    const spreadProduct = findProduct(site, 'spread_1');
    const SPREAD_PENDING = 'market-spread-pending';
    const spreadApi = {
      async check(key: string) {
        try {
          const res = await authed(() =>
            fetch(`/api/account/spread?spread=${encodeURIComponent(key)}&locale=${locale}`, {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
          );
          // 401：沒登入。付款鈕下方先說要登入，不要按了才被擋。
          // 沒登入：開了訪客結帳就不提示「需先登入」
          if (res.status === 401) return { state: 'none' as const, guest: !(await guestCheckoutOn()) };
          if (res.ok) {
            const d = (await res.json()) as { state?: string; body?: string };
            if (d.state === 'ready' && d.body) return { state: 'ready' as const, body: d.body };
            if (d.state === 'unlocked') return { state: 'unlocked' as const };
          }
        } catch {}
        return { state: 'none' as const };
      },
      async generate(key: string, question: string, sit: string) {
        try {
          const res = await authed(() =>
            fetch('/api/account/spread/generate', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                spread: key,
                locale,
                ui: uiPrefix(),
                question: question.slice(0, 400),
                sit,
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
    };
    const spread = {
      get guest() {
        return isGuest();
      },
      bindHref,
      cancelled: payCancelled,
      price: spreadProduct ? formatPrice(priceForLocale(spreadProduct, locale), locale) : '',
      check: spreadApi.check,
      buy: (key: string) => checkout('spread_1', { spread: key }),
      generate: spreadApi.generate,
      /** 去付款／登入前記下這一把牌（問題只存在本機，回來重算出同一組牌）。 */
      save(p: { deck: string; question: string; sit: string; day: string; why: 'pay' | 'login' }) {
        try {
          sessionStorage.setItem(
            SPREAD_PENDING,
            JSON.stringify({ ...p, question: p.question.slice(0, 100), at: Date.now() }),
          );
        } catch {}
      },
      take() {
        try {
          const raw = sessionStorage.getItem(SPREAD_PENDING);
          sessionStorage.removeItem(SPREAD_PENDING);
          const p = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          if (
            p &&
            (p.deck === 'tarot' || p.deck === 'lnm') &&
            typeof p.question === 'string' &&
            typeof p.sit === 'string' &&
            typeof p.day === 'string' &&
            /^\d{4}-\d{1,2}-\d{1,2}$/.test(p.day) &&
            typeof p.at === 'number' &&
            Date.now() - p.at < 45 * 60 * 1000
          )
            return {
              deck: p.deck,
              question: p.question.slice(0, 100),
              sit: p.sit,
              day: p.day,
              why: p.why === 'pay' ? ('pay' as const) : ('login' as const),
            };
        } catch {}
        return null;
      },
    };

    // 算命攤．合緣配對（付費完整解讀）：同一套牌陣解讀（識別字串 match:…，見 packages/core/src/match.ts）。
    // 生日只在本機：去付款前存在 sessionStorage，回來重算同一個識別字串；不送進訂單。
    const matchProduct = findProduct(site, 'match_1');
    const FORTUNE_PENDING = 'market-fortune-pending';
    const fortune = {
      get guest() {
        return isGuest();
      },
      bindHref,
      cancelled: payCancelled,
      price: matchProduct ? formatPrice(priceForLocale(matchProduct, locale), locale) : '',
      check: spreadApi.check,
      buy: (key: string) => checkout('match_1', { spread: key }),
      generate: spreadApi.generate,
      save(p: { you: string; them: string; question: string; sit: string; day: string; why: 'pay' | 'login' }) {
        try {
          sessionStorage.setItem(
            FORTUNE_PENDING,
            JSON.stringify({ ...p, question: p.question.slice(0, 100), at: Date.now() }),
          );
        } catch {}
      },
      take() {
        try {
          const raw = sessionStorage.getItem(FORTUNE_PENDING);
          sessionStorage.removeItem(FORTUNE_PENDING);
          const p = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
          if (
            p &&
            date(p.you) &&
            date(p.them) &&
            typeof p.question === 'string' &&
            typeof p.sit === 'string' &&
            typeof p.day === 'string' &&
            /^\d{4}-\d{1,2}-\d{1,2}$/.test(p.day) &&
            typeof p.at === 'number' &&
            Date.now() - p.at < 45 * 60 * 1000
          )
            return {
              you: p.you,
              them: p.them,
              question: p.question.slice(0, 100),
              sit: p.sit,
              day: p.day,
              why: p.why === 'pay' ? ('pay' as const) : ('login' as const),
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
    const activateLite = (reason: 'boot' | 'module') => {
      if (gone) return;
      track('market_3d_failure', { reason });
      if (window.location.hash === '#tarot') setLiteTarot(true);
      if (window.location.hash === '#bazi') setLiteFortune(true);
      stopRef.current?.();
      stopRef.current = undefined;
      setLite(true);
    };
    void import('./engine/main.js').then(({ startMarket }) => {
      if (gone) return;
      stop = startMarket(el, {
        onBootFailure: () => activateLite('boot'),
        onEvent: track,
        locale,
        starters: COMPANION_STARTERS.map((s) => s[locale]),
        aiStatus: () => ({ available: !!ai?.enabled && !ai.loginRequired && ai.remaining !== 0 }),
        ask,
        deep,
        spread,
        fortune,
        shop,
        wishes,
      });
      stopRef.current = stop;
    }).catch(() => activateLite('module'));
    return () => {
      gone = true;
      stopRef.current?.();
      stopRef.current = undefined;
      untranslate?.();
    };
  }, []);

  if (lite) return liteTarot ? <LiteTarot /> : liteFortune ? <LiteFortune /> : <LiteMarket />;

  return (
    <div className="mk" ref={root}>
      <canvas id="gl" />
      <div id="spots" />
      <button type="button" id="prompt" className="seal" />
      <div id="stick">
        <i />
      </div>
      <header id="hud">
        <div className="left">
          <button type="button" id="back" hidden>
            {tr('回到廣場')}
          </button>
          <span id="hud-title">{tr('月下集市')}</span>
          <button type="button" id="sky" aria-label={tr('天色')} />
          <span id="almanac" />
        </div>
        {/* 手機上右邊的按鈕收進這顆選單鈕（桌面不顯示）。見 market.css「手機頂欄」 */}
        <button
          type="button"
          id="hud-more"
          aria-label={tr('選單')}
          aria-expanded="false"
          aria-controls="hud-menu"
          onClick={(e) => {
            const open = e.currentTarget.closest('#hud')?.classList.toggle('open') ?? false;
            e.currentTarget.setAttribute('aria-expanded', String(open));
          }}
        >
          ☰
        </button>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: 只是在選了項目後把手機選單收起來，項目本身都是按鈕 */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上，鍵盤操作走各按鈕自己的事件 */}
        <div
          className="right"
          id="hud-menu"
          onClick={(e) => {
            // 選了「第一人稱／外觀／我的」就收起選單；聲音開關和語言清單留著，方便連按
            if (!(e.target as HTMLElement).closest('#view, #look, a')) return;
            const hud = e.currentTarget.closest('#hud');
            hud?.classList.remove('open');
            hud?.querySelector('#hud-more')?.setAttribute('aria-expanded', 'false');
          }}
        >
          <button type="button" id="view">
            {tr('第一人稱')}
          </button>
          <button type="button" id="look">
            {tr('外觀')}
          </button>
          <button type="button" id="sound">
            {tr('聲音　開')}
          </button>
          <a href={localizeHref('/account')}>{tr('我的')}</a>
          <LangMenu className="mk-lang" />
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
        <h1>{tr('月下集市')}</h1>
        <p className="lead">{tr('一座夜裡的集市，每間鋪子問一種事。四處逛逛，想問什麼，就走進哪一間。')}</p>
        <p className="almanac-line" id="almanac-line" hidden />
        <div className="row">
          <button type="button" className="seal" id="enter">
            {tr('入市')}
          </button>
          <a className="ghost" href={localizeHref('/')}>
            {tr('返回首頁')}
          </a>
        </div>
        <small>{tr('今晚開張：月老殿、塔羅館、大殿、抄經閣、許願池')}</small>
      </section>
      <section id="panel" />
      <section id="card" />
      <div id="fade" />
      <div id="boot">
        <p className="boot-title">{tr('月下集市')}</p>
        <div className="bar">
          <div id="boot-bar" />
        </div>
        <p id="boot-text">{tr('正在點燈')}</p>
        <button type="button" className="ghost" onClick={() => {
          track('market_lite_manual');
          if (window.location.hash === '#tarot') setLiteTarot(true);
          if (window.location.hash === '#bazi') setLiteFortune(true);
          stopRef.current?.();
          stopRef.current = undefined;
          setLite(true);
        }}>{getLocale() === 'en' ? 'Low-power mode' : getLocale() === 'ja' ? '軽量モード' : getLocale() === 'zh-Hans' ? '轻量模式' : '輕量模式'}</button>
        <a className="ghost" href={localizeHref('/')}>
          {tr('返回首頁')}
        </a>
      </div>
    </div>
  );
}
