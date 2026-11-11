import { useEffect, useRef } from 'react';
import { track } from '~/lib/track';
import './market.css';

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
    void import('./engine/main.js').then(({ startMarket }) => {
      if (gone) return;
      stop = startMarket(el, { onEvent: track });
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
            回到街上
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
      <p id="hint" role="status" />
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
