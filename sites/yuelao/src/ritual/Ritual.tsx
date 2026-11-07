// 儀式頁（/ritual）：原型 5 屏 + 擲筊 + 判詞卡。
// React 管：大類選擇、判詞卡內容、分享、抽籤記錄（localStorage）。
// 引擎（physics.ts）管：屏切換、搖籤/掉籤/擲筊物理、感應、提示文案。
// 巡演模式已刪；首屏零等待（圖片按需載入，無全屏等待畫面）。

import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { m } from '~/paraglide/messages.js';
import { localizeHref } from '~/paraglide/runtime.js';
import { JiaoArena } from './components/JiaoArena';
import { TubeStage } from './components/TubeStage';
import { type Verdict, VerdictCard } from './components/VerdictCard';
import { type RitualCat, RitualEngine, type RitualStrings } from './physics';
import type { Stick } from './sticks';

const CATS: RitualCat[] = ['him', 'single', 'reunion'];

function catName(cat: RitualCat): string {
  if (cat === 'single') return m.ritual_cat_single();
  if (cat === 'reunion') return m.ritual_cat_reunion();
  return m.ritual_cat_him();
}

function catDesc(cat: RitualCat): string {
  if (cat === 'single') return m.ritual_cat_single_desc();
  if (cat === 'reunion') return m.ritual_cat_reunion_desc();
  return m.ritual_cat_him_desc();
}

/** 搖籤前可選的具體問題（P7）：每類 3–4 個預設 + 默念兜底，不打字。
 * 問題只帶到判詞卡上顯示，不改變預先寫好的判詞正文。 */
function catQuestions(cat: RitualCat): string[] {
  if (cat === 'single')
    return [m.ritual_q_single_1(), m.ritual_q_single_2(), m.ritual_q_single_3(), m.ritual_q_single_4()];
  if (cat === 'reunion')
    return [m.ritual_q_reunion_1(), m.ritual_q_reunion_2(), m.ritual_q_reunion_3(), m.ritual_q_reunion_4()];
  return [m.ritual_q_him_1(), m.ritual_q_him_2(), m.ritual_q_him_3(), m.ritual_q_him_4()];
}

/** 訪客抽籤記錄（localStorage）。登入後同步與 draws 寫庫是 P2 的事，留 TODO。 */
const DRAWS_KEY = 'yuelao:draws';

interface DrawRecord {
  stickId: number;
  cat: RitualCat;
  at: string;
}

function recordDraw(stick: Stick, cat: RitualCat): void {
  try {
    const raw = localStorage.getItem(DRAWS_KEY);
    const list: DrawRecord[] = raw ? (JSON.parse(raw) as DrawRecord[]) : [];
    list.push({ stickId: stick.id, cat, at: new Date().toISOString() });
    // TODO(P2): 登入後把這份記錄同步進 draws 表（寫庫走 RPC，不在 P1 接 Auth）。
    localStorage.setItem(DRAWS_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    // 無痕/儲存被拒時靜默跳過，不擋儀式。
  }
}

export function Ritual({ initialCat, initialQ }: { initialCat?: RitualCat; initialQ?: string }) {
  const [cat, setCat] = useState<RitualCat | null>(initialCat ?? null);
  // 選中的具體問題：null = 默念其他問題（不選）。首頁入口帶來的 q（問題
  // 名稱）是初始值；換大類時預設問題跟著換，選擇歸零。
  const [question, setQuestion] = useState<string | null>(initialQ ?? null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictCount, setVerdictCount] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RitualEngine | null>(null);
  const catRef = useRef<RitualCat | null>(initialCat ?? null);
  const questionRef = useRef<string | null>(initialQ ?? null);

  useEffect(() => {
    catRef.current = cat;
  }, [cat]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  const handleVerdict = useCallback((stick: Stick, c: RitualCat) => {
    setVerdict({ stick, cat: c, question: questionRef.current });
    setVerdictCount((n) => n + 1);
    recordDraw(stick, c);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const strings: RitualStrings = {
      shakeTitle: m.ritual_shake_title(),
      shakeSubInit: m.ritual_shake_sub_init(),
      shakeHint0: m.ritual_shake_hint_0(),
      shakeHint1: m.ritual_shake_hint_1(),
      shakeHint2: m.ritual_shake_hint_2(),
      shakeHint3: m.ritual_shake_hint_3(),
      shakeHintStuck: m.ritual_shake_hint_stuck(),
      shakeHintDropped: m.ritual_shake_hint_dropped(),
      shakeSub0: m.ritual_shake_sub_0(),
      shakeSub0Press: m.ritual_shake_sub_0_press(),
      shakeSub1: m.ritual_shake_sub_1(),
      shakeSub2: m.ritual_shake_sub_2(),
      shakeSub3: m.ritual_shake_sub_3(),
      shakeSubStuck: m.ritual_shake_sub_stuck(),
      shakeSubStuckPress: m.ritual_shake_sub_stuck_press(),
      energy0: m.ritual_shake_energy_0(),
      energy: (pct) => m.ritual_shake_energy({ pct }),
      energyPress: (pct, sec) => m.ritual_shake_energy_press({ pct, sec }),
      jiaoWaiting: m.ritual_jiao_waiting(),
      jiaoFlying: m.ritual_jiao_flying(),
      jiaoShengName: m.ritual_jiao_sheng(),
      jiaoShengText: m.ritual_jiao_sheng_text(),
      jiaoXiaoName: m.ritual_jiao_xiao(),
      jiaoXiaoText: m.ritual_jiao_xiao_text(),
      jiaoYinName: m.ritual_jiao_yin(),
      jiaoYinText: m.ritual_jiao_yin_text(),
      sensorOff: m.ritual_jiao_sensor_off(),
      sensorDenied: m.ritual_jiao_sensor_denied(),
      sensorNoDevice: m.ritual_jiao_sensor_no_device(),
      sensorNoPerm: m.ritual_jiao_sensor_no_perm(),
      sensorOnToast: m.ritual_jiao_sensor_on(),
    };
    const engine = new RitualEngine(root, {
      strings,
      images: { cupFlat: '/ritual/cup-flat.webp', cupConvex: '/ritual/cup-convex.webp' },
      getCat: () => catRef.current,
      onVerdict: handleVerdict,
    });
    engineRef.current = engine;
    engine.mount();
    return () => {
      engine.unmount();
      engineRef.current = null;
    };
    // 只掛載一次：handleVerdict 是 [] 依賴的 useCallback，引用穩定；
    // 語言切換走整頁重載（URL 策略），不會中途換語言。
  }, [handleVerdict]);

  const share = useCallback(() => {
    if (!verdict) return;
    const s = verdict.stick;
    const qLine = verdict.question ? `${m.ritual_verdict_question({ q: verdict.question })}\n` : '';
    const text =
      '我把手機當籤筒，雙手搖出了月老的籤——\n' +
      `問「${catName(verdict.cat)}」· ${s.no} ${s.grade}\n` +
      qLine +
      `「${s.poem}」\n判詞：${s.verdict[verdict.cat]}\n（${s.knotName} · 月老已批）`;
    const toast = (msg: string): void => {
      engineRef.current?.toast(msg);
    };
    const okToast = (): void => toast(m.ritual_verdict_copied());
    const textareaFallback = (): void => {
      // 剪貼板 API 不可用/被拒時的兜底：臨時 textarea + execCommand。
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '0';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      if (ok) okToast();
      else toast(m.ritual_verdict_screenshot());
    };
    const copyFallback = (): void => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(okToast, textareaFallback);
      } else textareaFallback();
    };
    if (navigator.share) {
      // 系統分享優先；用戶主動取消（AbortError）不打擾，其他失敗才退回複製。
      navigator.share({ title: m.ritual_verdict_share_title(), text }).catch((err: unknown) => {
        if (err && (err as { name?: string }).name === 'AbortError') return;
        copyFallback();
      });
    } else copyFallback();
  }, [verdict]);

  const presets = cat ? catQuestions(cat) : [];

  return (
    <div className="ritual-page" ref={rootRef}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="ink-rough" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
          </filter>
        </defs>
      </svg>
      <div className="ritual-stage">
        {/* 桌面兩側欄（P5）：左欄搖籤四步、右欄籤的說明。窄屏隱藏，
            不動 .wrap 內的屏結構（引擎只認 .screen）。 */}
        <aside className="ritual-rail">
          <h3>{m.ritual_rail_steps_title()}</h3>
          <ol>
            <li>
              <span className="num">一</span>
              <span>{m.ritual_rail_step_1()}</span>
            </li>
            <li>
              <span className="num">二</span>
              <span>{m.ritual_rail_step_2()}</span>
            </li>
            <li>
              <span className="num">三</span>
              <span>{m.ritual_rail_step_3()}</span>
            </li>
            <li>
              <span className="num">四</span>
              <span>{m.ritual_rail_step_4()}</span>
            </li>
          </ol>
        </aside>
        <div className="wrap">
          {/* 步驟 1：選大類 */}
          <section className="screen active" id="scr-home">
            <img className="bg-img" id="bg-home" src="/ritual/temple-fair.jpg" alt="" fetchPriority="high" />
            <div className="scrim" />
            <div className="steps">
              <i className="on" />
              <i />
              <i />
              <i />
            </div>
            <h1 className="v-title">{m.ritual_home_title()}</h1>
            <div className="v-rule" aria-hidden="true" />
            <div className="home-lede">
              <p className="lede-big">
                {m.ritual_home_lead_1()}
                <br />
                {m.ritual_home_lead_2()}
              </p>
              <p className="lede-small">
                {m.ritual_home_lead_3()}
                <br />
                {m.ritual_home_lead_4()}
              </p>
            </div>
            <div className="home-bottom">
              <p className="q-label">{m.ritual_home_question()}</p>
              <div className="cat-list">
                {CATS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`cat-row${cat === c ? ' sel' : ''}`}
                    data-cat={c}
                    aria-pressed={cat === c}
                    onClick={() => {
                      if (c !== cat) {
                        setCat(c);
                        setQuestion(null);
                      }
                    }}
                  >
                    <span className="word">{catName(c)}</span>
                    <span className="desc">{catDesc(c)}</span>
                    <svg
                      className="chev"
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
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                ))}
              </div>
              <button className="cta" id="to-prep" type="button" disabled={!cat}>
                {cat ? m.ritual_home_cta_ready() : m.ritual_home_cta()}
              </button>
            </div>
          </section>

          {/* 步驟 2：儀式準備 */}
          <section className="screen" id="scr-prep">
            <div className="steps">
              <i />
              <i className="on" />
              <i />
              <i />
            </div>
            <div className="ritual">
              <h2>{m.ritual_prep_title()}</h2>
              {/* 搖籤前選問題（P7）：預設問題點一個，或默念就好；不打字。
                  選了只帶到判詞卡上顯示，判詞正文不變。 */}
              {cat && (
                <div className="q-picker">
                  <p className="q-label">{m.ritual_q_label()}</p>
                  <p className="q-hint">{m.ritual_q_hint()}</p>
                  <div className="q-list">
                    {presets.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`q-pick${question === q ? ' sel' : ''}`}
                        aria-pressed={question === q}
                        onClick={() => setQuestion(q)}
                      >
                        {q}
                      </button>
                    ))}
                    {question !== null && !presets.includes(question) && (
                      <button
                        type="button"
                        className="q-pick sel"
                        aria-pressed={true}
                        onClick={() => setQuestion(question)}
                      >
                        {question}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`q-pick${question === null ? ' sel' : ''}`}
                      aria-pressed={question === null}
                      onClick={() => setQuestion(null)}
                    >
                      {m.ritual_q_silent()}
                    </button>
                  </div>
                </div>
              )}
              <ol>
                <li>
                  <span className="num">一</span>
                  <span>
                    <b>{m.ritual_prep_step_1_lead()}</b>
                    {m.ritual_prep_step_1_rest()}
                  </span>
                </li>
                <li>
                  <span className="num">二</span>
                  <span>
                    <b>{m.ritual_prep_step_2_lead()}</b>
                    {m.ritual_prep_step_2_rest()}
                  </span>
                </li>
                <li>
                  <span className="num">三</span>
                  <span>
                    {m.ritual_prep_step_3_pre()}
                    <b>{m.ritual_prep_step_3_bold()}</b>
                    {m.ritual_prep_step_3_rest()}
                  </span>
                </li>
                <li>
                  <span className="num">四</span>
                  <span>
                    <b>{m.ritual_prep_step_4_lead()}</b>
                    {m.ritual_prep_step_4_rest()}
                  </span>
                </li>
              </ol>
              <p className="note">{m.ritual_prep_note()}</p>
            </div>
            <div className="btn-row">
              <button className="cta" id="start-shake" type="button">
                {m.ritual_prep_start()}
              </button>
              <button className="cta ghost" id="back-home" type="button">
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
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                {m.ritual_prep_change()}
              </button>
            </div>
          </section>

          <TubeStage />
          <JiaoArena />
          <VerdictCard verdict={verdict} verdictCount={verdictCount} onShare={share} />
        </div>
        <aside className="ritual-rail">
          <h3>{m.ritual_rail_sticks_title()}</h3>
          <p>{m.ritual_rail_sticks_body()}</p>
          <Link to={localizeHref('/sign/1')}>{m.ritual_rail_sticks_link()}</Link>
        </aside>
      </div>
      <div className="toast" id="toast" />
    </div>
  );
}
