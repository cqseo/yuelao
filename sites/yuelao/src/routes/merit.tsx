import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { dailyStick, todayLabel } from '~/market/engine/daily-draw.js';
import { shareMerit, shareWallpaper } from '~/market/engine/share.js';
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
  WALLPAPERS,
  type WallpaperId,
} from '~/site/merit';
import site from '../../site.config';
import './merit.css';

// 功德台（2026-11-21 重做成沉浸式）：殿內供桌的 3D 場景（three.js，懶載）＋手機 App 式的介面。
// 敲木魚、撥念珠、擲筊問事、今日籤桌布。不用 AI、不用登入；功德數只記在這台瀏覽器。
// 每一樣玩完都接到月老殿求籤。

export const Route = createFileRoute('/merit')({
  head: () =>
    pageHead(site, {
      title: tr('功德台｜線上敲木魚、念珠、擲筊、招桃花桌布 · 免費'),
      description: tr(
        '手機上的功德台：在殿前敲木魚功德 +1、撥 108 顆念珠、擲筊問月老一件事、把今日一籤做成招桃花手機桌布。免費、免登入。',
      ),
      path: localizeHref('/merit', { locale: getLocale() }),
      image: `${site.url}/og/merit.jpg`,
    }),
  component: MeritPage,
});

const TABS = ['muyu', 'beads', 'jiao', 'wallpaper'] as const;
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
  const scene = useRef<Scene | null>(null);
  const lastTap = useRef(0);
  const plusId = useRef(0);
  const seen = useRef(new Set<string>());
  const toastTimer = useRef(0);

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
    return () => {
      dead = true;
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
    wallpaper: t('桌布', '壁纸'),
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
          {noGl && <span className="mt-fallback">{tab === 'muyu' ? t('篤', '笃') : '◯'}</span>}
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
        {tab === 'wallpaper' && <Wallpaper t={t} hans={hans} />}

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
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M12 8v6M10 11h4" />
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

function Wallpaper({ t, hans }: { t: T; hans: boolean }) {
  const [theme, setTheme] = useState<WallpaperId>('love');
  const [note, setNote] = useState('');
  const [d, setD] = useState<ReturnType<typeof dailyStick> | null>(null);
  useEffect(() => {
    const x = dailyStick();
    if (x.stick) setD(x);
  }, []);
  const w = WALLPAPERS.find((x) => x.id === theme) ?? WALLPAPERS[0];
  const make = async () => {
    if (!d?.stick) return;
    setNote(t('正在做桌布…', '正在做壁纸…'));
    const r = await shareWallpaper({
      glyph: hans ? w.glyphHans : w.glyph,
      title: hans ? w.hans : w.name,
      wish: hans ? w.wishHans : w.wish,
      color: w.color,
      no: d.stick.no,
      grade: d.stick.grade,
      poem: d.stick.poem,
      date: todayLabel(),
    });
    track('merit_wallpaper', { theme, result: r });
    setNote(
      r === 'saved' || r === 'shared'
        ? t('存好了。到手機的「設定 → 桌布」換上它。', '存好了。到手机的「设置 → 壁纸」换上它。')
        : '',
    );
  };
  return (
    <div className="mt-sheet mt-wall">
      <div className="mt-phone" style={{ '--c': w.color } as React.CSSProperties}>
        <span className="mt-phone-time">09:41</span>
        <span className="mt-phone-glyph">{hans ? w.glyphHans : w.glyph}</span>
        <span className="mt-phone-wish">{hans ? w.wishHans : w.wish}</span>
        {d?.stick && (
          <span className="mt-phone-stick">
            {d.stick.no} · {d.stick.grade}
          </span>
        )}
      </div>
      <div className="mt-wall-side">
        <div className="mt-chips">
          {WALLPAPERS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={theme === x.id}
              className={theme === x.id ? 'on' : ''}
              onClick={() => setTheme(x.id)}
            >
              {hans ? x.hans : tr(x.name)}
            </button>
          ))}
        </div>
        <p className="mt-note">
          {t(
            '用你今天的「今日一籤」做成手機桌布，每天換一支。',
            '用你今天的「今日一签」做成手机壁纸，每天换一支。',
          )}
        </p>
        <button type="button" id="wall-make" className="mt-seal" onClick={make} disabled={!d}>
          {t('存成手機桌布', '存成手机壁纸')}
        </button>
        {note && (
          <p className="mt-note" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
