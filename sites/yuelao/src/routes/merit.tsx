import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { shareMerit } from '~/market/engine/share.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import {
  bead as beadSound,
  chime,
  isSoundOn,
  setSound,
  templeAmbience,
  vibrate,
  warmAudio,
  woodblock,
} from '~/ritual/audio';
import { localDayKey } from '~/site/daily';
import {
  addMerit,
  BEADS_PER_ROUND,
  CHANTS,
  emptyMerit,
  JIAO_TEXT,
  type JiaoFace,
  type JiaoResult,
  MERIT_KEY,
  type MeritRecord,
  nextBead,
  sanitizeMerit,
  shengStreak,
  todayCount,
  tossJiao,
} from '~/site/merit';
import {
  addPending,
  type Board as BoardData,
  type BoardRange,
  beacon,
  fetchBoard,
  flush,
  nickname as savedNickname,
  setNickname,
} from '~/site/merit-sync';
import site from '../../site.config';
import './merit.css';

// 功德台（2026-11-21 重做成沉浸式）：殿內供桌的 3D 場景（three.js，懶載）＋手機 App 式的介面。
// 敲木魚、撥念珠、擲筊問事、功德排行榜。不用 AI、不用登入。
// 功德數記在這台瀏覽器，也匿名送上排行榜（只有自己取的法號，見 site/merit-sync.ts）。
// 每一樣玩完都接到月老殿求籤。

export const Route = createFileRoute('/merit')({
  head: () =>
    pageHead(site, {
      title: tr('功德台｜線上敲木魚、念珠、擲筊、功德排行榜 · 免費'),
      description: tr(
        '手機上的功德台：在殿前敲木魚功德 +1、撥 108 顆念珠、擲筊問月老一件事，上功德排行榜看誰今天敲得多。免費、免登入。',
      ),
      path: localizeHref('/merit', { locale: getLocale() }),
      image: `${site.url}/og/merit.jpg`,
    }),
  component: MeritPage,
});

const TABS = ['muyu', 'beads', 'jiao', 'board'] as const;
type Tab = (typeof TABS)[number];
type T = (hant: string, hans: string) => string;
type Scene = {
  hit: (power?: number) => void;
  bead: (round?: boolean) => void;
  celebrate: () => void;
  setMode: (m: string) => void;
  dispose: () => void;
};

function load(): MeritRecord {
  try {
    const raw = localStorage.getItem(MERIT_KEY);
    return raw ? sanitizeMerit(JSON.parse(raw)) : emptyMerit();
  } catch {
    return emptyMerit();
  }
}
function save(r: MeritRecord) {
  try {
    localStorage.setItem(MERIT_KEY, JSON.stringify(r));
  } catch {}
}

/** 這一回敲到幾下時給一個大一點的回應。 */
const MILESTONES: Record<number, [string, string]> = {
  10: ['心靜一點了', '心静一点了'],
  33: ['三十三下，煩惱放下', '三十三下，烦恼放下'],
  108: ['一百零八下，功德圓滿', '一百零八下，功德圆满'],
  300: ['三百下，心如止水', '三百下，心如止水'],
  1000: ['一千下，誠心可鑑', '一千下，诚心可鉴'],
};

function MeritPage() {
  const hans = contentLocale() === 'zh-Hans';
  const t: T = (hant, hansText) => (hans ? hansText : tr(hant));
  const [tab, setTab] = useState<Tab>('muyu');
  const [rec, setRec] = useState<MeritRecord>(emptyMerit);
  const recRef = useRef(rec);
  const [day, setDay] = useState('');
  const [sound, setSoundState] = useState(true);
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const [plus, setPlus] = useState<{ id: number; x: number }[]>([]);
  const [combo, setCombo] = useState(0);
  const [toast, setToast] = useState('');
  const [pop, setPop] = useState(0);
  const [session, setSession] = useState(0);
  const [round, setRound] = useState(false);
  const [chant, setChant] = useState<(typeof CHANTS)[number]['id']>('amitabha');
  const [note, setNote] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const hand = useRef<HTMLImageElement>(null);
  const mala = useRef<HTMLDivElement>(null);
  const [flicks, setFlicks] = useState(0);
  const scene = useRef<Scene | null>(null);
  const lastTap = useRef(0);
  const plusId = useRef(0);
  const seen = useRef(new Set<string>());
  const toastTimer = useRef(0);
  const hansRef = useRef(hans);
  hansRef.current = hans;

  useEffect(() => {
    const r = load();
    setRec(r);
    recRef.current = r;
    setDay(localDayKey(new Date()));
    setSoundState(isSoundOn());
    const read = () => {
      const h = location.hash.slice(1);
      setTab((TABS as readonly string[]).includes(h) ? (h as Tab) : 'muyu');
    };
    read();
    addEventListener('hashchange', read);
    // 3D 場景懶載：頁面先能點（計數照算），模型好了再接上
    let dead = false;
    import('~/merit/scene.js')
      .then(({ createMeritScene }) => {
        if (dead || !canvas.current) return;
        try {
          scene.current = createMeritScene(canvas.current, {
            onReady: () => setReady(true),
            handEl: hand.current,
            malaHand: true,
            // 槌子真的碰到木魚那一刻才出聲、震動（手要先伸進來，約 0.09 秒）
            onImpact: (power: number) => {
              woodblock();
              vibrate(power > 1 ? [30, 40, 30] : 14);
            },
          }) as Scene;
          // 截圖檢查姿勢用（網址帶 ?debug=pose 才掛上）
          if (location.search.includes('debug=pose'))
            (window as unknown as { __merit: Scene }).__merit = scene.current;
          scene.current.setMode(location.hash.slice(1) || 'muyu');
        } catch {
          setNoGl(true);
        }
      })
      .catch(() => setNoGl(true));
    // 排行榜：每 3 秒把剛敲的下數送出去；切走或關掉頁面時用 beacon 送最後一批
    const timer = window.setInterval(() => void flush(hansRef.current), 3000);
    const hide = () => {
      if (document.visibilityState === 'hidden') beacon(hansRef.current);
    };
    document.addEventListener('visibilitychange', hide);
    addEventListener('pagehide', hide);
    return () => {
      dead = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hide);
      removeEventListener('pagehide', hide);
      beacon(hansRef.current);
      removeEventListener('hashchange', read);
      scene.current?.dispose();
      templeAmbience(false);
    };
  }, []);
  useEffect(() => {
    scene.current?.setMode(tab);
    if (!seen.current.has(tab)) {
      seen.current.add(tab);
      track('merit_open', { tab });
    }
  }, [tab]);

  const choose = (x: Tab) => {
    setTab(x);
    setNote('');
    history.replaceState(null, '', `#${x}`);
  };
  const update = (r: MeritRecord) => {
    recRef.current = r;
    setRec(r);
    save(r);
  };
  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  };
  const floatPlus = () => {
    const id = ++plusId.current;
    setPlus((p) => [...p.slice(-8), { id, x: ((id * 47) % 120) - 60 }]);
    setTimeout(() => setPlus((p) => p.filter((x) => x.id !== id)), 1000);
  };
  const firstTouch = () => {
    warmAudio();
    if (sound) templeAmbience(true);
  };

  /** 敲一下或撥一顆。 */
  const tap = () => {
    firstTouch();
    const now = performance.now();
    const c = now - lastTap.current < 700 ? combo + 1 : 1;
    lastTap.current = now;
    setCombo(c);
    const d = day || localDayKey(new Date());
    const n = session + 1;
    setSession(n);
    setPop((p) => p + 1);
    floatPlus();
    addPending(1);
    if (tab === 'muyu') {
      update(addMerit(recRef.current, 1, d));
      const big = MILESTONES[n];
      if (scene.current) scene.current.hit(big ? 2 : 1);
      else {
        woodblock();
        vibrate(big ? [30, 40, 30] : 14);
      }
      if (big) {
        scene.current?.celebrate();
        chime(523);
        showToast(t(big[0], big[1]));
        track('merit_knock', { n });
      } else if (n === 1) track('merit_knock', { n });
    } else {
      const { rec: next, round: done } = nextBead(recRef.current, d);
      update(next);
      scene.current?.bead(done);
      setFlicks((f) => f + 1);
      // 拇指往下推一顆：整隻手跟著輕輕一沉再回來
      mala.current?.animate(
        [
          { transform: 'translateX(-40%) translateY(0) rotate(0deg)' },
          { transform: 'translateX(-40%) translateY(10px) rotate(1.2deg)', offset: 0.35 },
          { transform: 'translateX(-40%) translateY(0) rotate(0deg)' },
        ],
        { duration: 260, easing: 'ease-out' },
      );
      vibrate(done ? [30, 40, 30] : 8);
      if (done) {
        chime(523);
        setRound(true);
        showToast(t('撥滿一圈，功德圓滿', '拨满一圈，功德圆满'));
        track('merit_bead_round', { chant });
      } else beadSound();
    }
  };
  const toggleSound = () => {
    const on = setSound(!sound);
    setSoundState(on);
    templeAmbience(on);
  };
  const shareCount = async () => {
    setNote(t('正在做圖…', '正在做图…'));
    const r = await shareMerit({
      today: todayCount(rec, day),
      total: rec.total,
      kind: tab === 'beads' ? 'beads' : 'muyu',
      // 當下殿裡的畫面（木魚、燭火）當分享圖的上半
      shot: (scene.current as (Scene & { snapshot?: () => unknown }) | null)?.snapshot?.() as never,
    });
    track('share_image', { kind: 'merit', result: r });
    setNote(r === 'saved' ? t('存好了，可以放進限時動態。', '存好了，可以放进限时动态。') : '');
  };

  const today = day ? todayCount(rec, day) : 0;
  const tapping = tab === 'muyu' || tab === 'beads';
  const c0 = CHANTS.find((c) => c.id === chant) ?? CHANTS[0];
  const NAMES: Record<Tab, string> = {
    muyu: t('木魚', '木鱼'),
    beads: t('念珠', '念珠'),
    jiao: t('擲筊', '掷筊'),
    board: t('排行榜', '排行榜'),
  };

  return (
    <article className={`mt${ready ? ' ready' : ''}${tapping ? '' : ' dim'}`}>
      <canvas ref={canvas} className="mt-canvas" />
      {/* 第一人稱握槌的手：位置與揮動由 3D 場景每一格算好 */}
      <img
        ref={hand}
        className="mt-hand"
        src="/merit/hand.webp"
        alt=""
        width={760}
        height={507}
        decoding="async"
      />
      {/* 第一人稱撥念珠：左手掌心朝自己、拇指推珠；手上方那串是循環的珠子，每撥一下往下走一顆 */}
      {tab === 'beads' && (
        <div ref={mala} className="mt-mala" aria-hidden="true">
          <div className="mt-mala-strand" style={{ '--n': flicks } as React.CSSProperties} />
          <img src="/merit/mala-hand.webp" alt="" width={640} height={960} decoding="async" />
        </div>
      )}
      {!ready && !noGl && <div className="mt-loading">{t('正在進殿…', '正在进殿…')}</div>}

      <header className="mt-top">
        <a href={localizeHref('/')} className="mt-back">
          {t('← 月下', '← 月下')}
        </a>
        <h1>{t('功德台', '功德台')}</h1>
        <button type="button" className="mt-sound" onClick={toggleSound} aria-pressed={sound}>
          {sound ? t('聲音開', '声音开') : t('聲音關', '声音关')}
        </button>
      </header>

      <section className="mt-hud" aria-live="polite">
        <span>{tab === 'beads' ? t(c0.text, c0.hans) : t('今日功德', '今日功德')}</span>
        <b key={pop} className="mt-count">
          {tab === 'beads' ? `${rec.bead} / ${BEADS_PER_ROUND}` : today.toLocaleString()}
        </b>
        <small>
          {tab === 'beads'
            ? t(
                `已撥 ${rec.rounds} 圈 · 累計功德 ${rec.total.toLocaleString()}`,
                `已拨 ${rec.rounds} 圈 · 累计功德 ${rec.total.toLocaleString()}`,
              )
            : t(`累計 ${rec.total.toLocaleString()}`, `累计 ${rec.total.toLocaleString()}`)}
          {combo >= 5 && tapping && <em className="mt-combo"> · {t(`連擊 ×${combo}`, `连击 ×${combo}`)}</em>}
        </small>
      </section>

      {tapping && (
        <button
          type="button"
          id="merit-tap"
          className="mt-tap"
          onClick={tap}
          aria-label={tab === 'muyu' ? t('敲一下木魚', '敲一下木鱼') : t('撥一顆念珠', '拨一颗念珠')}
        >
          {noGl && tab === 'muyu' && <span className="mt-fallback">{t('篤', '笃')}</span>}
          {plus.map((p) => (
            <span key={p.id} className="mt-plus" style={{ marginLeft: `${p.x}px` }}>
              {t('功德 +1', '功德 +1')}
            </span>
          ))}
          {session === 0 && (
            <span className="mt-cue">
              {tab === 'muyu' ? t('點一下，敲木魚', '点一下，敲木鱼') : t('點一下，撥一顆', '点一下，拨一颗')}
            </span>
          )}
        </button>
      )}
      {toast && (
        <div className="mt-toast" role="status">
          {toast}
        </div>
      )}

      <footer className="mt-bottom">
        {tab === 'beads' && (
          <div className="mt-chips">
            {CHANTS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={chant === c.id}
                className={chant === c.id ? 'on' : ''}
                onClick={() => setChant(c.id)}
              >
                {t(c.text, c.hans)}
              </button>
            ))}
          </div>
        )}
        {tapping && (
          <div className="mt-actions">
            <button type="button" className="mt-ghost" onClick={shareCount} disabled={!rec.total}>
              {t('分享功德圖', '分享功德图')}
            </button>
            {(session >= 10 || round) && <ToTemple t={t} />}
          </div>
        )}
        {note && tapping && (
          <p className="mt-note" role="status">
            {note}
          </p>
        )}
        {tab === 'jiao' && <Jiao t={t} hans={hans} onTouch={firstTouch} />}
        {tab === 'board' && <Board t={t} hans={hans} today={today} onGo={() => choose('muyu')} />}

        <nav className="mt-tabs" aria-label={t('功德台', '功德台')}>
          {TABS.map((x) => (
            <button
              key={x}
              type="button"
              id={`merit-tab-${x}`}
              aria-pressed={tab === x}
              className={tab === x ? 'on' : ''}
              onClick={() => choose(x)}
            >
              <TabIcon tab={x} />
              <span>{NAMES[x]}</span>
            </button>
          ))}
        </nav>
      </footer>
    </article>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const p = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
  };
  if (tab === 'muyu')
    return (
      <svg {...p} aria-hidden="true">
        <path d="M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8c0 3-2.7 5-8 5s-8-2-8-5z" />
        <path d="M6.5 14.5c3 1.6 8 1.6 11 0" />
        <path d="M16 4l4-2" />
      </svg>
    );
  if (tab === 'beads')
    return (
      <svg {...p} aria-hidden="true">
        <circle cx="12" cy="11" r="6.5" strokeDasharray="2.2 1.6" strokeWidth="2.4" />
        <path d="M12 17.5v3.5M10.5 21h3" />
      </svg>
    );
  if (tab === 'jiao')
    return (
      <svg {...p} aria-hidden="true">
        <path d="M3 9c2-2 6-2 8 0-1 4-3 6-4 6S3 13 3 9z" />
        <path d="M13 11c2-2 6-2 8 0-1 4-3 6-4 6s-3-2-4-6z" />
      </svg>
    );
  return (
    <svg {...p} aria-hidden="true">
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4c0 3 1.5 4.5 3 4.5M17 6h3c0 3-1.5 4.5-3 4.5" />
    </svg>
  );
}

/** 心靜了就去求籤：每個玩法結尾的同一個出口。 */
function ToTemple({ t, text }: { t: T; text?: string }) {
  return (
    <a className="mt-cta" href={localizeHref('/market#yuelao')} onClick={() => track('merit_to_temple', {})}>
      {text ?? t('心靜了，去月老殿求一支籤', '心静了，去月老殿求一支签')}
    </a>
  );
}

function Cup({ face, n }: { face: JiaoFace | null; n: number }) {
  // 用月老殿同一套實物圖（DESIGN.md：筊杯一律用真實影像）；還沒擲時兩片都顯示平面
  const src = face === 'round' ? '/ritual/cup-convex.webp' : '/ritual/cup-flat.webp';
  return <img className={`mt-cup ${face ?? 'idle'} c${n}`} src={src} alt="" decoding="async" />;
}

function Jiao({ t, hans, onTouch }: { t: T; hans: boolean; onTouch: () => void }) {
  const [q, setQ] = useState('');
  const [faces, setFaces] = useState<[JiaoFace, JiaoFace] | null>(null);
  const [result, setResult] = useState<JiaoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0);
  const toss = () => {
    if (busy) return;
    onTouch();
    setBusy(true);
    setResult(null);
    setFaces(null);
    vibrate(20);
    setTimeout(() => {
      const r = tossJiao();
      setFaces(r.faces);
      setResult(r.result);
      setStreak((s) => shengStreak(s, r.result));
      setBusy(false);
      woodblock();
      setTimeout(() => woodblock(), 110);
      if (r.result === 'sheng') chime(587);
      vibrate([20, 50, 20]);
      track('merit_jiao', { result: r.result, asked: q.trim() ? 1 : 0 });
    }, 1000);
  };
  const info = result ? JIAO_TEXT[result] : null;
  return (
    <div className="mt-sheet">
      <div className={`mt-cups${busy ? ' tossing' : ''}`}>
        <Cup face={faces?.[0] ?? null} n={0} />
        <Cup face={faces?.[1] ?? null} n={1} />
      </div>
      {info ? (
        <div className={`mt-result ${result}`} role="status">
          <b>{hans ? info.hans : tr(info.name)}</b>
          {streak >= 2 && <span>{t(`連續 ${streak} 個聖筊`, `连续 ${streak} 个圣筊`)}</span>}
          <p>{hans ? info.lineHans : tr(info.line)}</p>
        </div>
      ) : (
        <label className="mt-q">
          <span>
            {t('心裡默念一件事，只問是或不是（不會送出去）', '心里默念一件事，只问是或不是（不会送出去）')}
          </span>
          <input
            id="jiao-question"
            value={q}
            maxLength={60}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('例如：我該主動傳訊息給他嗎？', '例如：我该主动传讯息给他吗？')}
            autoComplete="off"
          />
        </label>
      )}
      <div className="mt-actions">
        <button type="button" id="jiao-toss" className="mt-seal" onClick={toss} disabled={busy}>
          {busy
            ? t('筊杯落地中…', '筊杯落地中…')
            : result
              ? t('再擲一次', '再掷一次')
              : t('雙手合十，擲筊', '双手合十，掷筊')}
        </button>
        {result === 'sheng' && <ToTemple t={t} text={t('帶著這件事去求籤', '带着这件事去求签')} />}
      </div>
      <p className="mt-note small">
        {t('線上擲筊是互動模擬，不代表神明真的同意。', '线上掷筊是互动模拟，不代表神明真的同意。')}{' '}
        <a href={localizeHref('/jiaobei')}>{t('三種筊怎麼看', '三种筊怎么看')}</a>
      </p>
    </div>
  );
}

const RANGES: BoardRange[] = ['day', 'week', 'all'];

/** 功德排行榜：今日／本週／總榜，前 50 名＋自己的名次，可以改法號。 */
function Board({ t, hans, today, onGo }: { t: T; hans: boolean; today: number; onGo: () => void }) {
  const [range, setRange] = useState<BoardRange>('day');
  const [data, setData] = useState<BoardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [nick, setNick] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => setNick(savedNickname(hans)), [hans]);
  useEffect(() => {
    let dead = false;
    setFailed(false);
    // 先把剛敲的送上去，自己的名次才是最新的
    void flush(hans).then(() =>
      fetchBoard(range).then((b) => {
        if (dead) return;
        setData(b);
        setFailed(!b);
      }),
    );
    track('merit_board', { range });
    return () => {
      dead = true;
    };
  }, [range, hans]);

  const saveNick = async () => {
    const n = draft.replace(/\s+/gu, ' ').trim();
    if (!n || [...n].length > 10) {
      setNote(t('法號要 1 到 10 個字。', '法号要 1 到 10 个字。'));
      return;
    }
    const old = nick;
    setNickname(n);
    setNick(n);
    const r = await flush(hans, true);
    if (!r.ok) {
      setNickname(old);
      setNick(old);
      setNote(
        r.error === 'bad_nickname'
          ? t(
              '這個法號不能用：不能放聯絡方式、連結或不雅的字。',
              '这个法号不能用：不能放联系方式、链接或不雅的字。',
            )
          : t('現在連不上，等一下再改。', '现在连不上，等一下再改。'),
      );
      return;
    }
    setEditing(false);
    setNote('');
    track('merit_nickname', {});
    const b = await fetchBoard(range);
    if (b) setData(b);
  };

  const LABEL: Record<BoardRange, string> = {
    day: t('今日', '今日'),
    week: t('本週', '本周'),
    all: t('總榜', '总榜'),
  };
  const me = data?.me;
  const inTop = data?.top.some((r) => r.me);
  return (
    <div className="mt-sheet mt-board">
      <div className="mt-board-head">
        <div className="mt-seg" role="tablist" aria-label={t('排行榜範圍', '排行榜范围')}>
          {RANGES.map((x) => (
            <button
              key={x}
              type="button"
              role="tab"
              aria-selected={range === x}
              className={range === x ? 'on' : ''}
              onClick={() => setRange(x)}
            >
              {LABEL[x]}
            </button>
          ))}
        </div>
        <small>
          {range === 'day'
            ? t('每天 0 點（台灣時間）重新開始', '每天 0 点（台湾时间）重新开始')
            : range === 'week'
              ? t('最近 7 天', '最近 7 天')
              : t('從開榜到現在', '从开榜到现在')}
        </small>
      </div>

      <ol className="mt-ranks" aria-busy={!data && !failed}>
        {failed && (
          <li className="mt-rank-empty">
            {t('排行榜暫時打不開，等一下再看。', '排行榜暂时打不开，等一下再看。')}
          </li>
        )}
        {data && !data.top.length && (
          <li className="mt-rank-empty">
            {t('還沒有人上榜，敲第一下就是第一名。', '还没有人上榜，敲第一下就是第一名。')}
          </li>
        )}
        {data?.top.map((r) => (
          <li
            key={`${r.rank}-${r.nickname}-${r.total}`}
            className={`${r.me ? 'me ' : ''}r${Math.min(r.rank, 4)}`}
          >
            <span className="mt-rank-no">{r.rank <= 3 ? ['', '壹', '貳', '參'][r.rank] : r.rank}</span>
            <span className="mt-rank-name">
              {r.nickname}
              {r.me && <em>{t('（你）', '（你）')}</em>}
            </span>
            <b>{r.total.toLocaleString()}</b>
          </li>
        ))}
      </ol>

      <div className="mt-me">
        {editing ? (
          <form
            className="mt-nick"
            onSubmit={(e) => {
              e.preventDefault();
              void saveNick();
            }}
          >
            <input
              id="merit-nick"
              value={draft}
              maxLength={10}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t('法號', '法号')}
              autoComplete="off"
              // biome-ignore lint/a11y/noAutofocus: the field opens on request.
              autoFocus
            />
            <button type="submit" className="mt-seal">
              {t('存', '存')}
            </button>
          </form>
        ) : (
          <>
            <div className="mt-me-line">
              <span>
                {nick}
                <button
                  type="button"
                  className="mt-link"
                  onClick={() => {
                    setDraft(nick);
                    setEditing(true);
                  }}
                >
                  {t('改法號', '改法号')}
                </button>
              </span>
              <b>
                {me
                  ? inTop
                    ? t(`第 ${me.rank} 名`, `第 ${me.rank} 名`)
                    : t(
                        `第 ${me.rank} 名 · ${me.total.toLocaleString()}`,
                        `第 ${me.rank} 名 · ${me.total.toLocaleString()}`,
                      )
                  : t('還沒上榜', '还没上榜')}
              </b>
            </div>
            <button type="button" id="merit-go" className="mt-seal" onClick={onGo}>
              {range === 'day' && today > 0
                ? t(
                    `今天已敲 ${today.toLocaleString()} 下，再去敲`,
                    `今天已敲 ${today.toLocaleString()} 下，再去敲`,
                  )
                : t('去敲木魚，衝上榜', '去敲木鱼，冲上榜')}
            </button>
          </>
        )}
        {note && (
          <p className="mt-note" role="status">
            {note}
          </p>
        )}
        <p className="mt-note small">
          {t(
            '榜上只顯示法號，不顯示帳號。換手機或清掉瀏覽器資料會從頭算。',
            '榜上只显示法号，不显示账号。换手机或清掉浏览器资料会从头算。',
          )}
        </p>
      </div>
    </div>
  );
}
