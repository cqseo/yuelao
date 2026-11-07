// 步驟 3：搖籤屏。靜態 JSX 骨架 + 引擎按 id 逐幀寫 DOM（transform、提示文案、進度）。
// 注意：hint/sub/pp-text 的初始文案是佔位，引擎在 startShakePhase 會重寫；
// React 重渲染時 JSX 不變，不會覆蓋引擎寫入的內容。

import { m } from '~/paraglide/messages.js';

export function TubeStage() {
  return (
    <section className="screen" id="scr-shake">
      <img className="bg-img" id="bg-shake" src="/ritual/temple-fair.jpg" alt="" fetchPriority="high" />
      <div className="scrim" />
      <div className="steps">
        <i />
        <i />
        <i className="on" />
        <i />
      </div>
      <div className="stage" id="stage">
        <div className="hint" id="shake-hint">
          {m.ritual_shake_title()}
        </div>
        <div className="subhint" id="shake-sub">
          {m.ritual_shake_sub_init()}
        </div>
        <div className="tube-zone">
          <div className="tube-wobble" id="tube-wobble">
            <img className="tube-img" src="/ritual/tube.webp" alt="" fetchPriority="high" />
            <div className="hero-stick" id="hero-stick">
              <img src="/ritual/stick-hero.png" alt="" />
            </div>
          </div>
          <div className="tube-shadow" id="tube-shadow" />
          <div className="falling-stick" id="falling-stick">
            <img src="/ritual/stick-hero.png" alt="" />
            <span className="fs-num" id="fs-num" />
          </div>
          <div className="land-shadow" id="land-shadow" />
          <div className="puff" id="puff1" />
          <div className="puff p2" id="puff2" />
        </div>
        <button className="press-btn" id="press-btn" type="button">
          {m.ritual_shake_press_label()}
        </button>
        <div className="press-progress" id="press-progress">
          <div className="pp-track">
            <div className="pp-fill" id="pp-fill" />
          </div>
          <div className="pp-text" id="pp-text">
            {m.ritual_shake_energy_0()}
          </div>
        </div>
        <p className="press-note">{m.ritual_shake_press_note()}</p>
      </div>
    </section>
  );
}
