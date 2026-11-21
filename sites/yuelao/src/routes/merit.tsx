import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { contentLocale } from '~/i18n/locale';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { track } from '~/lib/track';
import { dailyStick, todayLabel } from '~/market/engine/daily-draw.js';
import { shareMerit, shareWallpaper } from '~/market/engine/share.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import { bead as beadSound, chime, vibrate, warmAudio, woodblock } from '~/ritual/audio';
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

// 功德台（2026-11-21）：免費引流。敲木魚、撥念珠、擲筊問一件事、今日籤做成手機桌布。
// 不用 AI、不用登入；功德數只記在這台瀏覽器。每一樣玩完都接到月老殿求籤。

export const Route = createFileRoute('/merit')({
  head: () =>
    pageHead(site, {
      title: tr('功德台｜線上敲木魚、念珠、擲筊、招桃花桌布 · 免費'),
      description: tr(
        '手機上的功德台：敲木魚功德 +1、撥 108 顆念珠、擲筊問月老一件事、把今日一籤做成招桃花手機桌布。免費、免登入。',
      ),
      path: localizeHref('/merit', { locale: getLocale() }),
      image: `${site.url}/og/merit.jpg`,
    }),
  component: MeritPage,
});

const TABS = ['muyu', 'beads', 'jiao', 'wallpaper'] as const;
type Tab = (typeof TABS)[number];

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

function MeritPage() {
  const hans = contentLocale() === 'zh-Hans';
  const t = (hant: string, hansText: string) => (hans ? hansText : tr(hant));
  const [tab, setTab] = useState<Tab>('muyu');
  const [rec, setRec] = useState<MeritRecord>(emptyMerit);
  const [day, setDay] = useState('');
  const seen = useRef(new Set<string>());

  useEffect(() => {
    setRec(load());
    setDay(localDayKey(new Date()));
    const read = () => {
      const h = location.hash.slice(1);
      setTab((TABS as readonly string[]).includes(h) ? (h as Tab) : 'muyu');
    };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    if (seen.current.has(tab)) return;
    seen.current.add(tab);
    track('merit_open', { tab });
  }, [tab]);

  const choose = (x: Tab) => {
    setTab(x);
    history.replaceState(null, '', `#${x}`);
  };
  const update = (r: MeritRecord) => {
    setRec(r);
    save(r);
  };
  const today = day ? todayCount(rec, day) : 0;

  const NAMES: Record<Tab, [string, string]> = {
    muyu: [t('敲木魚', '敲木鱼'), t('功德 +1', '功德 +1')],
    beads: [t('撥念珠', '拨念珠'), t('一百零八顆', '一百零八颗')],
    jiao: [t('擲筊', '掷筊'), t('問月老一件事', '问月老一件事')],
    wallpaper: [t('桌布', '桌布'), t('今日籤招桃花', '今日签招桃花')],
  };

  return (
    <article className="merit-page">
      <header className="merit-head">
        <p className="merit-kicker">{t('月下 · 功德台', '月下 · 功德台')}</p>
        <h1>{t('心亂的時候，來敲一下。', '心乱的时候，来敲一下。')}</h1>
        <p className="merit-tally" aria-live="polite">
          {t('今日功德', '今日功德')} <b>{today.toLocaleString()}</b>
          <span>·</span>
          {t('累計', '累计')} <b>{rec.total.toLocaleString()}</b>
        </p>
      </header>

      <nav className="merit-tabs" aria-label={t('功德台', '功德台')}>
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            id={`merit-tab-${x}`}
            aria-pressed={tab === x}
            className={tab === x ? 'on' : ''}
            onClick={() => choose(x)}
          >
            <b>{NAMES[x][0]}</b>
            <small>{NAMES[x][1]}</small>
          </button>
        ))}
      </nav>

      <section className="merit-stage">
        {tab === 'muyu' && <Muyu rec={rec} day={day} update={update} t={t} />}
        {tab === 'beads' && <Beads rec={rec} day={day} update={update} t={t} />}
        {tab === 'jiao' && <Jiao t={t} hans={hans} />}
        {tab === 'wallpaper' && <Wallpaper t={t} hans={hans} />}
      </section>

      <p className="merit-note">
        {t(
          '功德數只記在這台手機的瀏覽器裡，免費、免登入。這裡是線上的心意與儀式感，不代替到廟裡參拜，也不保證任何結果。',
          '功德数只记在这台手机的浏览器里，免费、免登录。这里是线上的心意与仪式感，不代替到庙里参拜，也不保证任何结果。',
        )}
      </p>
    </article>
  );
}

type T = (hant: string, hans: string) => string;

/** 心靜了就去求籤：每個玩法結尾的同一個出口。 */
function ToTemple({ t, text }: { t: T; text?: string }) {
  return (
    <a
      className="merit-cta"
      href={localizeHref('/market#yuelao')}
      onClick={() => track('merit_to_temple', {})}
    >
      {text ?? t('心靜了，去月老殿求一支籤', '心静了，去月老殿求一支签')}
    </a>
  );
}

function usePlus() {
  const [plus, setPlus] = useState<number[]>([]);
  const id = useRef(0);
  const pop = () => {
    const n = ++id.current;
    // 連續點時浮字左右錯開，不疊在一起
    setPlus((p) => [...p.slice(-6), n]);
    setTimeout(() => setPlus((p) => p.filter((x) => x !== n)), 900);
  };
  return { plus, pop };
}

const MILESTONES = new Set([1, 10, 108, 1000]);

function Muyu({
  rec,
  day,
  update,
  t,
}: {
  rec: MeritRecord;
  day: string;
  update: (r: MeritRecord) => void;
  t: T;
}) {
  const [hit, setHit] = useState(0);
  const [session, setSession] = useState(0);
  const [sharing, setSharing] = useState('');
  const { plus, pop } = usePlus();
  const knock = () => {
    warmAudio();
    woodblock();
    vibrate(12);
    const d = day || localDayKey(new Date());
    update(addMerit(rec, 1, d));
    setHit((h) => h + 1);
    pop();
    const n = session + 1;
    setSession(n);
    if (MILESTONES.has(n)) track('merit_knock', { n });
  };
  const share = async () => {
    setSharing(t('正在做圖…', '正在做图…'));
    const r = await shareMerit({ today: todayCount(rec, day), total: rec.total, kind: 'muyu' });
    track('share_image', { kind: 'merit', result: r });
    setSharing(r === 'saved' ? t('存好了，可以放進限時動態。', '存好了，可以放进限时动态。') : '');
  };
  return (
    <div className="merit-muyu">
      <button
        type="button"
        id="muyu-knock"
        className="muyu-hit"
        onClick={knock}
        aria-label={t('敲一下木魚', '敲一下木鱼')}
      >
        <svg key={hit} className="muyu-svg" viewBox="0 0 320 270" aria-hidden="true">
          <defs>
            <radialGradient id="wood" cx="38%" cy="30%" r="80%">
              <stop offset="0" stopColor="#d4974a" />
              <stop offset="0.5" stopColor="#94541f" />
              <stop offset="1" stopColor="#4a2610" />
            </radialGradient>
          </defs>
          {/* 紅墊 */}
          <ellipse cx="160" cy="236" rx="128" ry="24" fill="#7d2219" />
          <ellipse cx="160" cy="230" rx="122" ry="18" fill="#a8291f" />
          {/* 木魚身：圓、底略平 */}
          <path
            d="M58 146C58 86 104 46 160 46S262 86 262 146c0 50-40 80-102 80S58 196 58 146z"
            fill="url(#wood)"
            stroke="#3a1c0a"
            strokeWidth="2"
          />
          {/* 頂上的握把稜與雕紋 */}
          <ellipse cx="160" cy="50" rx="30" ry="9" fill="#6b3816" />
          <path d="M104 78c32-18 80-18 112 0" stroke="#5a2e12" strokeWidth="3" fill="none" />
          <path d="M92 96c40-22 96-22 136 0" stroke="#5a2e12" strokeWidth="3" fill="none" />
          {/* 前面的魚口（開口） */}
          <path d="M74 150c34 22 138 22 172 0-10 22-36 40-86 40s-76-18-86-40z" fill="#1e0d05" />
          <path
            d="M84 104c14-22 36-36 60-40"
            stroke="rgba(255,232,190,.35)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          {/* 木槌 */}
          <g className="muyu-mallet">
            <line x1="214" y1="44" x2="300" y2="4" stroke="#caa06a" strokeWidth="8" strokeLinecap="round" />
            <ellipse cx="206" cy="48" rx="20" ry="15" fill="#e8cf9e" stroke="#a5814e" strokeWidth="2" />
          </g>
        </svg>
        {plus.map((n) => (
          <span key={n} className="merit-plus" style={{ marginLeft: `${((n * 37) % 90) - 45}px` }}>
            {t('功德 +1', '功德 +1')}
          </span>
        ))}
      </button>
      <p className="merit-hint">
        {session
          ? t(`這一回敲了 ${session} 下`, `这一回敲了 ${session} 下`)
          : t('點木魚，敲一下', '点木鱼，敲一下')}
      </p>
      <div className="merit-actions">
        <button type="button" className="merit-ghost" onClick={share} disabled={!rec.total}>
          {t('做成功德圖分享', '做成功德图分享')}
        </button>
        {session >= 10 && <ToTemple t={t} />}
      </div>
      {sharing && (
        <p className="merit-hint" role="status">
          {sharing}
        </p>
      )}
    </div>
  );
}

function Beads({
  rec,
  day,
  update,
  t,
}: {
  rec: MeritRecord;
  day: string;
  update: (r: MeritRecord) => void;
  t: T;
}) {
  const [chant, setChant] = useState<(typeof CHANTS)[number]['id']>('amitabha');
  const [round, setRound] = useState(false);
  const { plus, pop } = usePlus();
  const c0 = CHANTS.find((c) => c.id === chant) ?? CHANTS[0];
  const step = () => {
    warmAudio();
    const d = day || localDayKey(new Date());
    const { rec: next, round: done } = nextBead(rec, d);
    update(next);
    pop();
    vibrate(8);
    if (done) {
      chime(523);
      setRound(true);
      track('merit_bead_round', { chant });
    } else beadSound();
  };
  const SHOWN = 18;
  const cur = rec.bead % SHOWN;
  return (
    <div className="merit-beads">
      <div className="chips">
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
      <button
        type="button"
        id="beads-step"
        className="beads-hit"
        onClick={step}
        aria-label={t('撥一顆念珠', '拨一颗念珠')}
      >
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <g
            style={{
              transform: 'none',
              transformOrigin: '150px 150px',
              transition: 'transform .25s ease-out',
            }}
          >
            {Array.from({ length: SHOWN }, (_, i) => {
              const a = (i / SHOWN) * Math.PI * 2 - Math.PI / 2;
              return (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: 珠子位置固定
                  key={i}
                  cx={150 + Math.cos(a) * 118}
                  cy={150 + Math.sin(a) * 118}
                  r={i === cur ? 17 : 14}
                  fill={i === cur ? '#e8c25a' : '#7a3b1c'}
                  stroke="#2b1408"
                  strokeWidth="2"
                />
              );
            })}
          </g>
          <circle cx="150" cy="150" r="104" fill="none" stroke="rgba(220,187,124,.25)" strokeWidth="2" />
        </svg>
        <span className="beads-center">
          <b>{t(c0.text, c0.hans)}</b>
          <small>
            {t(`第 ${rec.bead} / ${BEADS_PER_ROUND} 顆`, `第 ${rec.bead} / ${BEADS_PER_ROUND} 颗`)}
            <br />
            {t(`已撥 ${rec.rounds} 圈`, `已拨 ${rec.rounds} 圈`)}
          </small>
        </span>
        {plus.map((n) => (
          <span key={n} className="merit-plus" style={{ marginLeft: `${((n * 37) % 90) - 45}px` }}>
            {t('功德 +1', '功德 +1')}
          </span>
        ))}
      </button>
      <p className="merit-hint">
        {round
          ? t('撥滿一圈了。心定下來，有想問的事嗎？', '拨满一圈了。心定下来，有想问的事吗？')
          : t('點一下撥一顆，滿 108 顆算一圈', '点一下拨一颗，满 108 颗算一圈')}
      </p>
      {round && <ToTemple t={t} />}
    </div>
  );
}

function Crescent({ face, n }: { face: JiaoFace | null; n: number }) {
  // 用月老殿同一套實物圖（DESIGN.md：筊杯一律用真實影像）；還沒擲時兩片都顯示平面
  const src = face === 'round' ? '/ritual/cup-convex.webp' : '/ritual/cup-flat.webp';
  return (
    <img
      className={`jiao-piece ${face ?? 'idle'} p${n}`}
      src={src}
      alt=""
      width={120}
      height={120}
      decoding="async"
    />
  );
}

function Jiao({ t, hans }: { t: T; hans: boolean }) {
  const [q, setQ] = useState('');
  const [faces, setFaces] = useState<[JiaoFace, JiaoFace] | null>(null);
  const [result, setResult] = useState<JiaoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0);
  const toss = () => {
    if (busy) return;
    warmAudio();
    setBusy(true);
    setResult(null);
    setFaces(null);
    setTimeout(() => {
      const r = tossJiao();
      setFaces(r.faces);
      setResult(r.result);
      setStreak((s) => shengStreak(s, r.result));
      setBusy(false);
      woodblock();
      setTimeout(() => woodblock(), 90);
      if (r.result === 'sheng') chime(587);
      vibrate([20, 40, 20]);
      track('merit_jiao', { result: r.result, asked: q.trim() ? 1 : 0 });
    }, 950);
  };
  const info = result ? JIAO_TEXT[result] : null;
  return (
    <div className="merit-jiao">
      <label className="jiao-q">
        <span>
          {t('心裡默念一件事（只問是或不是，不會送出去）', '心里默念一件事（只问是或不是，不会送出去）')}
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
      <div className={`jiao-floor${busy ? ' tossing' : ''}`}>
        <Crescent face={faces?.[0] ?? null} n={0} />
        <Crescent face={faces?.[1] ?? null} n={1} />
      </div>
      {info && (
        <div className={`jiao-result ${result}`} role="status">
          <b>{hans ? info.hans : tr(info.name)}</b>
          {streak >= 2 && (
            <span className="jiao-streak">{t(`連續 ${streak} 個聖筊`, `连续 ${streak} 个圣筊`)}</span>
          )}
          <p>{hans ? info.lineHans : tr(info.line)}</p>
        </div>
      )}
      <div className="merit-actions">
        <button type="button" id="jiao-toss" className="merit-seal" onClick={toss} disabled={busy}>
          {busy ? t('筊杯落地中…', '筊杯落地中…') : result ? t('再擲一次', '再掷一次') : t('擲筊', '掷筊')}
        </button>
        {result === 'sheng' && <ToTemple t={t} text={t('帶著這件事去求一支籤', '带着这件事去求一支签')} />}
      </div>
      <p className="merit-hint small">
        {t('線上擲筊是互動模擬，不代表神明真的同意。', '线上掷筊是互动模拟，不代表神明真的同意。')}{' '}
        <a href={localizeHref('/jiaobei')}>{t('聖筊、笑筊、陰筊怎麼看', '圣筊、笑筊、阴筊怎么看')}</a>
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
    setNote(t('正在做桌布…', '正在做桌布…'));
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
    <div className="merit-wall">
      <div className="chips">
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
      <div className="wall-phone" style={{ '--c': w.color } as React.CSSProperties}>
        <span className="wall-time">09:41</span>
        <span className="wall-glyph">{hans ? w.glyphHans : w.glyph}</span>
        <span className="wall-wish">{hans ? w.wishHans : w.wish}</span>
        {d?.stick && (
          <span className="wall-stick">
            {d.stick.no} · {d.stick.grade}
          </span>
        )}
        <span className="wall-url">yuexia.app</span>
      </div>
      <p className="merit-hint">
        {t(
          '用你今天的「今日一籤」做成手機桌布，每天換一支。',
          '用你今天的「今日一签」做成手机壁纸，每天换一支。',
        )}
      </p>
      <div className="merit-actions">
        <button type="button" id="wall-make" className="merit-seal" onClick={make} disabled={!d}>
          {t('存成手機桌布', '存成手机壁纸')}
        </button>
        <ToTemple t={t} text={t('想問一件具體的事？去求籤', '想问一件具体的事？去求签')} />
      </div>
      {note && (
        <p className="merit-hint" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
