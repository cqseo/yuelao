import { useEffect, useRef } from 'react';
import { track } from '~/lib/track';
import { getLocale } from '~/paraglide/runtime.js';
import { COMPANION_STARTERS, type CompanionTheme, guidedReply } from '~/site/companion';
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
        <small>今晚開張：月老殿、塔羅館</small>
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
