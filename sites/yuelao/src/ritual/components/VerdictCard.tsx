// 步驟 5：判詞卡。由 React 渲染（引擎只在聖筊後呼叫 onVerdict，不碰卡片 DOM）。
// 免費判詞全文 + 一句 teaser；「深度解讀」為鎖定態（五項解鎖清單 + 信任
// 話術，照抄 kaucim 付費牆結構），P4 才接支付。分享走 navigator.share
// 優先、剪貼板兜底（在 Ritual.tsx）。

import { findProduct, formatPrice, priceForLocale } from '@yuelao/core/site';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import site from '../../../site.config';
import { knotImage } from '../knots';
import type { RitualCat } from '../physics';
import { adviceFor } from '../stick-advice';
import type { Stick } from '../sticks';
import { showLocaleNote } from '../sticks-locale';

export interface Verdict {
  stick: Stick;
  cat: RitualCat;
  /** 搖籤前選的具體問題；null = 默念其他問題（不顯示）。判詞正文不變。 */
  question: string | null;
}

function catName(cat: RitualCat): string {
  if (cat === 'single') return m.ritual_cat_single();
  if (cat === 'reunion') return m.ritual_cat_reunion();
  return m.ritual_cat_him();
}

/** 「三天內可以做」與「七日練習」是每支籤專屬的（stick-advice.ts），
   以籤詩意象 + 判詞 + 吉凶逐支寫成；結論因處境而異，行動因籤而異。
   籤頁（/sign/:id）共用同一份建議。 */

/** 佔位卡（未出籤時判詞屏的靜態內容，與原型初始值一致）。 */
const PLACEHOLDER: Verdict = {
  stick: {
    id: 1,
    no: '第一籤',
    grade: '上上籤',
    level: 5,
    knot: 'tongxin',
    knotName: '同心結',
    poem: '關關雎鳩，在河之洲，\n窈窕淑女，君子好逑。',
    verdict: { him: '', single: '', reunion: '' },
  },
  cat: 'him',
  question: null,
};

export function VerdictCard({
  verdict,
  verdictCount,
  onShare,
}: {
  verdict: Verdict | null;
  /** 每出一支新籤 +1：印章靠 key 重掛重播蓋印動畫。 */
  verdictCount: number;
  onShare: () => void;
}) {
  const v = verdict ?? PLACEHOLDER;
  const locale = getLocale();
  const advice = adviceFor(v.stick.id, locale);
  const poemLines = v.stick.poem.split('\n');
  const teaserLine = poemLines[1] ?? poemLines[0] ?? '';
  // 價錢取自 site.config，不得在這裡寫死。深度解讀在 3D 月老殿裡買、裡面看：
  // 按鈕把這支籤暫存起來，帶到 /market#yuelao，月老殿接著這支籤打開深度解讀。
  const unlockProduct = findProduct(site, 'unlock_1');
  const unlockPrice = unlockProduct ? formatPrice(priceForLocale(unlockProduct, locale), locale) : '';
  return (
    <section className="screen" id="scr-verdict">
      <div className="verdict-card" id="verdict-card">
        <div className="vc-frame" />
        <div className="vc-cat" id="vc-cat">
          {m.ritual_verdict_cat({ cat: catName(v.cat) })}
        </div>
        {v.question && (
          <p className="vc-question" id="vc-question">
            {m.ritual_verdict_question({ q: v.question })}
          </p>
        )}
        <div className="vc-no" id="vc-no">
          {v.stick.no}
        </div>
        <div className="vc-grade" id="vc-grade">
          {v.stick.grade}
        </div>
        <div className="vc-divider" />
        <p className="vc-poem" id="vc-poem">
          {v.stick.poem}
        </p>
        <div className="vc-knot" id="vc-knot">
          <img src={knotImage(v.stick.knot)} alt="" loading="lazy" />
        </div>
        <div className="vc-knot-name" id="vc-knot-name">
          {v.stick.knotName}
        </div>
        <p className="vc-verdict" id="vc-verdict">
          {v.stick.verdict[v.cat]}
        </p>
        <div className="vc-actions">
          <h4>{m.ritual_verdict_actions_title()}</h4>
          <p>{advice.actions}</p>
        </div>
        <div className="vc-practice">
          <h4>{m.ritual_verdict_practice_title()}</h4>
          <p>{advice.practice}</p>
        </div>
        <p className="vc-free-done">{m.ritual_verdict_free_done()}</p>
        <div className="seal stamp" id="seal" key={verdictCount}>
          <span className="seal-in">{m.ritual_verdict_stamp()}</span>
        </div>
      </div>
      {showLocaleNote(getLocale()) && <p className="locale-note">{m.ritual_locale_note()}</p>}
      <div className="deep-lock">
        <h3>{m.ritual_deep_title()}</h3>
        <p className="teaser">
          {m.ritual_deep_teaser_lead()}
          <br />
          {m.ritual_deep_teaser_line({ line: teaserLine })}
        </p>
        <ul>
          <li>{m.ritual_deep_item_1()}</li>
          <li>{m.ritual_deep_item_2()}</li>
          <li>{m.ritual_deep_item_3()}</li>
          <li>{m.ritual_deep_item_4()}</li>
          <li>{m.ritual_deep_item_5()}</li>
        </ul>
        <div className="trust">
          <div>{m.ritual_deep_trust_1()}</div>
          <div>{m.ritual_deep_trust_2()}</div>
          <div>{m.ritual_deep_trust_3()}</div>
        </div>
        <button
          className="cta"
          type="button"
          data-rybbit-event="ritual_deep_to_market"
          onClick={() => {
            try {
              sessionStorage.setItem(
                'market-pending',
                JSON.stringify({
                  stickId: v.stick.id,
                  category: v.cat,
                  why: 'ritual',
                  question: '',
                  at: Date.now(),
                }),
              );
            } catch {}
            window.location.assign('/market#yuelao');
          }}
        >
          {m.ritual_deep_cta({ price: unlockPrice })}
        </button>
        <p className="cta-note">{m.ritual_deep_cta_note()}</p>
      </div>
      <div className="btn-row" style={{ marginTop: 24 }}>
        <button className="cta" id="share-btn" type="button" onClick={onShare}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          {m.ritual_verdict_share()}
        </button>
        <button className="cta ghost" id="again-btn" type="button">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {m.ritual_verdict_again()}
        </button>
      </div>
    </section>
  );
}
