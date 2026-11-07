// 步驟 4：掉籤卡 + 擲筊競技場。籤卡 no/grade/poem 是佔位（引擎在 showStickScreen
// 寫入真值）；擲筊結果區由引擎寫 innerHTML；杯圖由引擎 paintCup 按面換圖。
// 擲筊前就講清三種結果（與 finishThrow 的判定/文案同一套定義）。

import { m } from '~/paraglide/messages.js';

export function JiaoArena() {
  return (
    <section className="screen" id="scr-stick">
      <img className="bg-img" src="/ritual/temple-fair.jpg" alt="" />
      <div className="scrim" />
      <div className="steps">
        <i />
        <i />
        <i />
        <i className="on" />
      </div>
      <div className="stick-card">
        <div className="no" id="stick-no">
          第一籤
        </div>
        <div className="grade" id="stick-grade">
          上上籤
        </div>
        <p className="poem" id="stick-poem">
          紅線一牽，千里同心
        </p>
      </div>
      <div className="jiao-zone">
        <h3 className="jiao-title">{m.ritual_jiao_title()}</h3>
        <p className="jiao-sub">
          {m.ritual_jiao_lead()}
          <br />
          {m.ritual_jiao_how_1()}
          <br />
          {m.ritual_jiao_how_2()}
          <br />
          {m.ritual_jiao_how_3()}
        </p>
        <div className="jiao-legend">
          <div>
            <b className="r-sheng">{m.ritual_jiao_sheng()}</b>
            {m.ritual_jiao_sheng_desc()}
          </div>
          <div>
            <b className="r-xiao">{m.ritual_jiao_xiao()}</b>
            {m.ritual_jiao_xiao_desc()}
          </div>
          <div>
            <b className="r-yin">{m.ritual_jiao_yin()}</b>
            {m.ritual_jiao_yin_desc()}
          </div>
        </div>
        <div className="jiao-arena" id="jiao-arena">
          <div className="jiao-cups" id="jiao-cups">
            <div className="jiao-cup" id="cup-a">
              <div className="cup-inner" />
              <div className="cup-shadow" />
              <div className="cup-dust" />
            </div>
            <div className="jiao-cup" id="cup-b">
              <div className="cup-inner" />
              <div className="cup-shadow" />
              <div className="cup-dust" />
            </div>
          </div>
        </div>
        <div className="jiao-mark-note">
          {m.ritual_jiao_legend()}
          <span className="mk">{m.ritual_jiao_legend_flat()}</span>
          {m.ritual_jiao_legend_flat_desc()} · <span className="mk">{m.ritual_jiao_legend_convex()}</span>
          {m.ritual_jiao_legend_convex_desc()}
        </div>
        <div className="sensor-note" id="sensor-note" style={{ display: 'none' }}>
          <span id="sensor-note-text">{m.ritual_jiao_sensor_off()}</span>
          <button className="sensor-btn" id="sensor-btn" type="button">
            {m.ritual_jiao_sensor_enable()}
          </button>
        </div>
        <div className="jiao-result" id="jiao-result" />
      </div>
      <div className="btn-row">
        <button className="cta ghost" id="throw-jiao" type="button">
          {m.ritual_jiao_cta_throw()}
        </button>
        <button className="cta" id="to-verdict" type="button" style={{ display: 'none' }}>
          {m.ritual_jiao_cta_verdict()}
        </button>
        <button className="cta ghost" id="jiao-restart" type="button" style={{ display: 'none' }}>
          {m.ritual_jiao_cta_yin()}
        </button>
      </div>
      <button className="mini-link" id="jiao-alt" type="button" style={{ display: 'none' }}>
        {m.ritual_jiao_cta_retry()}
      </button>
    </section>
  );
}
