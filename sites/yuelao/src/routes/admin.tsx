import { createFileRoute } from '@tanstack/react-router';
import type { AdminStats } from '@yuelao/core/admin-stats';
import { findProduct } from '@yuelao/core/site';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';
import '~/site/admin.css';

// 站長後台：只有 site.adminEmails 裡的帳號看得到數字（伺服器端檢查，見 packages/core/src/admin-stats.ts）。
// 只給站長自己看，文字一律簡體中文，不走多語言。
export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [{ title: '月老 · 后台' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AdminPage,
});

type Stats = AdminStats & { tracking: boolean };
type Load =
  | { state: 'loading' }
  | { state: 'login' }
  | { state: 'forbidden' }
  | { state: 'error' }
  | { state: 'ready'; stats: Stats };

const RANGES = [
  { days: 1, label: '近 24 小时' },
  { days: 7, label: '近 7 天' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' },
];

type SectionId =
  | 'overview'
  | 'funnel'
  | 'paths'
  | 'journeys'
  | 'sales'
  | 'users'
  | 'wishes'
  | 'ops'
  | 'pages'
  | 'traffic'
  | 'partners'
  | 'feedback';
const SECTIONS: { id: SectionId; label: string; icon: string; desc: string }[] = [
  { id: 'overview', label: '概览', icon: '◎', desc: '核心数字与每日趋势，括号里是跟上一个同长区间比。' },
  {
    id: 'funnel',
    label: '转化漏斗',
    icon: '▽',
    desc: '从来访到付款，每一步还剩多少人（按访客、同一浏览器计）。',
  },
  { id: 'paths', label: '用户路径', icon: '⇢', desc: '大家进站后怎么走：从哪进、去哪、在哪离开。' },
  { id: 'journeys', label: '访客旅程', icon: '☰', desc: '最近每一次来访的完整经过，绿底是那次有付款。' },
  { id: 'sales', label: '订单与销售', icon: '¥', desc: '真实付款的订单（不含测试单），收入已扣退款。' },
  {
    id: 'users',
    label: '用户管理',
    icon: '☺',
    desc: '注册用户、各自付了多少。可按邮箱搜索（不受上方时间范围影响）。',
  },
  {
    id: 'wishes',
    label: '许愿池审核',
    icon: '❋',
    desc: '用户写的愿望要你放行才会挂上树；被举报的也在这里处理。',
  },
  { id: 'ops', label: '内容与运营', icon: '✎', desc: '各功能被用了多少次，以及现在等着你处理的事。' },
  { id: 'pages', label: '页面与动作', icon: '▤', desc: '哪些页面看的人多、哪些按钮按的人多。' },
  { id: 'traffic', label: '流量来源', icon: '◉', desc: '访客从哪来、用什么设备、在哪个地区、用哪种语言。' },
  {
    id: 'feedback',
    label: '用户意见',
    icon: '✉',
    desc: '用户在「意见反馈」留的话。只有你看得到；处理完标成「已处理」。',
  },
  {
    id: 'partners',
    label: '分销',
    icon: '⇄',
    desc: '推广人带来的顾客第一单，佣金 =（实收 − Stripe 手续费）× 分成。退款的不算。月底按这里的数字手动结算。',
  },
];

const PAGE_LABELS: Record<string, string> = {
  '/': '首页',
  '/market': '集市',
  '/sign': '签诗总览',
  '/sign/*': '签诗页',
  '/signs': '百签目录',
  '/about': '关于月下',
  '/methodology': '签诗来源及解读方法',
  '/ritual': '旧求签页（已跳转）',
  '/daily': '每日心笺',
  '/tests': '测验列表',
  '/tests/*': '测验',
  '/account': '我的',
  '/account/*': '解读页',
  '/login': '登录页',
  '/billing/*': '付款返回',
  '/chat': '聊天',
  '/privacy': '隐私',
  '/terms': '条款',
  '/refunds': '退款政策',
  '/dmca': 'DMCA',
  '/admin': '后台',
  '@market_enter': '入市',
  '@home_yuelao': '首页直达月老殿',
  '@ritual_start': '开始求签',
  '@quick_question': '选择快捷问题',
  '@lite_mode': '切换轻量模式',
  '@3d_failure': '3D 启动失败',
  '@share_link': '复制签文链接',
  '@room:yuelao': '月老殿',
  '@room:tarot': '塔罗馆',
  '@room:hall': '大殿',
  '@room:sutra': '抄经阁',
  '@hall_offer': '上香',
  '@reading': '看到结果',
  '@unlock': '点解锁',
  '@deep': '看付费解读',
  '@login': '登录成功',
  '@checkout': '点击结账',
  '@offer': '看到付费介绍',
  '@login_gate': '结账要求登录',
  '@stripe_created': '已创建 Stripe 会话',
  '@checkout_error': '结账接口错误',
  '@paid': '付款成功',
  '@exit': '离开',
  '@other': '其他',
};

const EVENT_LABELS: Record<string, string> = {
  checkout_start: '点击结账按钮',
  offer_view: '看到付费介绍',
  checkout_login_required: '支付前需登录',
  checkout_session_created: 'Stripe 会话创建成功',
  checkout_api_failure: '结账请求失败',
  home_quick_entry_click: '首页快捷入口点击',
  reading_done: '看到签文／牌面结果',
  ritual_begin: '开始求签',
  quick_question_click: '选择快捷问题',
  market_boot_ready: '集市完成加载',
  market_3d_failure: '3D 初始化失败',
  market_lite_manual: '使用轻量模式',
  home_yuelao_click: '首页直接求签',
  home_market_enter_click: '首页进入集市',
  home_room_click: '首页选择房间',
  sign_link_copy: '复制签文链接',
  unlock_click: '点「解锁」',
  deep_read: '看付费解读',
  daily_checkin: '每日签到',
  wish_make: '许愿',
  wish_bless: '同愿',
  wish_report: '举报愿望',
  wish_withdraw: '撤下愿望',
  wish_pool_open: '打开许愿池',
  login: '登录成功',
  market_enter: '入市',
  market_room_open: '进店',
  market_hall_offer: '大殿上香',
  market_incense: '选香',
  market_npc_ask: '问月老',
  market_charm_send: '送平安符',
  market_charm_open: '打开平安符',
  market_wardrobe_open: '换装',
  market_locked_look_try: '试穿付费外观',
  market_emote: '做动作',
  market_action: '互动',
  market_shrine_kneel: '跪拜',
  market_view: '切换视角',
  market_sky: '切换天色',
  market_queue: '排队',
  market_tap_walk: '点地走路',
  market_hall_calm_done: '静心完成',
  wish_plate_tap: '看愿望牌',
  test_started: '开始测验',
  test_completed: '完成测验',
};

const FUNNEL_LABELS: Record<string, string> = {
  visit: '来访',
  engage: '逛了首页以外',
  start: '开始求签／抽牌（含历史补全）',
  reading: '看到签文／牌面结果',
  offer: '看到解锁价格（按钮出现在屏幕上）',
  unlock: '点「解锁」',
  checkout: '发起结账',
  paid: '付款',
};

const COUNTRY: Record<string, string> = {
  CN: '中国大陆',
  HK: '香港',
  TW: '台湾',
  MO: '澳门',
  SG: '新加坡',
  MY: '马来西亚',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  TH: '泰国',
  CA: '加拿大',
  GB: '英国',
  AU: '澳大利亚',
};

const ORDER_STATUS: Record<string, string> = {
  paid: '已付款',
  pending: '未付款',
  failed: '失败',
  expired: '已过期',
  refunded: '已退款',
};

const DEVICE: Record<string, string> = { mobile: '手机', tablet: '平板', desktop: '电脑' };
const LOCALE: Record<string, string> = {
  'zh-Hant': '繁体',
  'zh-Hans': '简体',
  en: '英文',
  ja: '日文',
  ko: '韩文',
  th: '泰文',
};

const step = (key: string) => {
  if (PAGE_LABELS[key]) return PAGE_LABELS[key];
  if (key.startsWith('@room:')) return key.slice(6);
  return key;
};
const nf = new Intl.NumberFormat('zh-CN');
const num = (n: number) => nf.format(n);
const money = (cents: number, currency: string) =>
  `${currency === 'USD' ? 'US$' : currency === 'HKD' ? 'HK$' : `${currency} `}${(cents / 100).toLocaleString(
    'zh-CN',
    {
      minimumFractionDigits: cents % 100 ? 2 : 0,
      maximumFractionDigits: 2,
    },
  )}`;
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : '—');
const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const duration = (s: number) =>
  s < 60 ? `${s} 秒` : s < 3600 ? `${Math.round(s / 60)} 分钟` : `${(s / 3600).toFixed(1)} 小时`;

function AdminPage() {
  const [days, setDays] = useState(() => {
    try {
      return Number(localStorage.getItem('yl-admin-days')) || 7;
    } catch {
      return 7;
    }
  });
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [tick, setTick] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick 只用來手動重新整理
  useEffect(() => {
    let alive = true;
    setLoad((l) => (l.state === 'ready' ? l : { state: 'loading' }));
    (async () => {
      const get = () => fetch(`/api/admin/stats?days=${days}`, { credentials: 'same-origin' });
      let res = await get();
      if (res.status === 401) {
        const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (refreshed.ok) res = await get();
      }
      if (!alive) return;
      if (res.status === 401) return setLoad({ state: 'login' });
      if (res.status === 403) return setLoad({ state: 'forbidden' });
      if (!res.ok) return setLoad({ state: 'error' });
      setLoad({ state: 'ready', stats: (await res.json()) as Stats });
    })().catch(() => alive && setLoad({ state: 'error' }));
    try {
      localStorage.setItem('yl-admin-days', String(days));
    } catch {}
    return () => {
      alive = false;
    };
  }, [days, tick]);

  const [section, setSection] = useState<SectionId>('overview');
  useEffect(() => {
    const read = () => {
      const id = location.hash.slice(1);
      setSection(SECTIONS.some((x) => x.id === id) ? (id as SectionId) : 'overview');
    };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  const current = SECTIONS.find((x) => x.id === section) ?? (SECTIONS[0] as (typeof SECTIONS)[number]);

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-brand">
          <strong>月老</strong>
          <span>后台</span>
        </div>
        <nav className="admin-nav" aria-label="后台导航">
          {SECTIONS.map((x) => (
            <a key={x.id} href={`#${x.id}`} aria-current={x.id === section ? 'page' : undefined}>
              <span className="admin-nav-icon" aria-hidden="true">
                {x.icon}
              </span>
              {x.label}
            </a>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href={localizeHref('/')}>← 回网站</a>
          <span>
            按北京时间统计
            <br />
            站长本人的操作不计入
          </span>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div>
            <h1>{current.label}</h1>
            <p className="admin-muted">{current.desc}</p>
          </div>
          <div className="admin-controls">
            <div className="admin-seg" role="tablist" aria-label="时间范围">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  type="button"
                  role="tab"
                  aria-selected={days === r.days}
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button type="button" className="admin-btn" onClick={() => setTick((t) => t + 1)}>
              刷新
            </button>
          </div>
        </header>
        {load.state === 'loading' && <p className="admin-state">正在计算……</p>}
        {load.state === 'login' && (
          <p className="admin-state">
            请先<a href={localizeHref('/login')}>登录</a>站长账号。
          </p>
        )}
        {load.state === 'forbidden' && (
          <p className="admin-state">这个账号没有后台权限。请用站长信箱登录。</p>
        )}
        {load.state === 'error' && <p className="admin-state">数据暂时取不到，稍后点「刷新」再试。</p>}
        {load.state === 'ready' && <Dashboard stats={load.stats} section={section} />}
      </main>
    </div>
  );
}

function Delta({ value, prev, money: isMoney }: { value: number; prev: number; money?: boolean }) {
  if (!prev && !value) return <span className="admin-delta">与上期持平</span>;
  if (!prev) return <span className="admin-delta up">上期为 0</span>;
  const d = (value - prev) / prev;
  const cls = d > 0.005 ? 'up' : d < -0.005 ? 'down' : '';
  const arrow = d > 0.005 ? '↑' : d < -0.005 ? '↓' : '→';
  return (
    <span className={`admin-delta ${cls}`} title={`上期 ${isMoney ? '' : num(prev)}`}>
      {arrow} {Math.abs(d * 100).toFixed(0)}% 较上期
    </span>
  );
}

function Dashboard({ stats, section }: { stats: Stats; section: SectionId }) {
  const { kpis } = stats;
  const cur = kpis.currency;
  const otherCurrencyNote = kpis.otherCurrencies
    .map(
      (x) => `${money(x.revenue, x.currency)}（已退 ${money(x.refunded, x.currency)}，${num(x.orders)} 单）`,
    )
    .join('；');
  const matchedPayers = stats.funnel.find((f) => f.key === 'paid')?.count ?? 0;
  const conv =
    stats.meta.completeWindowTracking && !stats.meta.eventsTruncated
      ? pct(matchedPayers, kpis.visitors.value)
      : '—';
  const [allJourneys, setAllJourneys] = useState(false);
  const journeys = allJourneys ? stats.recent : stats.recent.slice(0, 15);
  const needsTracking = !['sales', 'ops', 'users', 'wishes', 'partners', 'feedback'].includes(section);
  const ops = stats.ops;
  const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : num(v));
  return (
    <>
      {!stats.tracking && needsTracking && (
        <div className="admin-note">
          访问行为表（site_events）还没在数据库建好，所以访客、浏览、路径暂时都是 0；注册和订单不受影响。
        </div>
      )}
      {stats.tracking && stats.meta.eventsTruncated && (
        <div className="admin-note">访问记录太多，只统计了最早的 6 万条。</div>
      )}
      {stats.tracking && !stats.meta.completeWindowTracking && needsTracking && (
        <div className="admin-note">
          本期访客行为数据没有覆盖完整选定区间，付费转化率暂不显示；历史订单可能早于埋点启用。订单与访客不可直接相除。
        </div>
      )}

      {section === 'overview' && (
        <>
          <section className="admin-kpis" aria-label="核心指标">
            <Kpi label="访客" value={num(kpis.visitors.value)} delta={<Delta {...kpis.visitors} />} />
            <Kpi label="浏览量" value={num(kpis.pageViews.value)} delta={<Delta {...kpis.pageViews} />} />
            <Kpi
              label="新注册"
              value={num(kpis.signups.value)}
              delta={<Delta {...kpis.signups} />}
              foot={`累计 ${num(kpis.totalUsers)} 位用户`}
            />
            <Kpi label="付费订单" value={num(kpis.orders.value)} delta={<Delta {...kpis.orders} />} />
            <Kpi
              label="港币收入（扣退款）"
              value={money(kpis.revenue.value, cur)}
              delta={<Delta {...kpis.revenue} money />}
              foot={
                [
                  kpis.refunded ? `港币退款 ${money(kpis.refunded, cur)}` : '',
                  otherCurrencyNote ? `其他币种另计：${otherCurrencyNote}` : '',
                ]
                  .filter(Boolean)
                  .join('；') || undefined
              }
            />
            <Kpi
              label="访客归因付费率（参考）"
              value={conv}
              foot={
                stats.meta.completeWindowTracking
                  ? `${num(matchedPayers)} 个可关联付费访客 / ${num(kpis.visitors.value)} 访客；可能有跨设备漏计`
                  : '本期埋点覆盖不足；不能用付款账户数直接除以访客数'
              }
            />
            <Kpi
              label="登录访客"
              value={num(kpis.loggedIn)}
              foot={`占访客 ${pct(kpis.loggedIn, kpis.visitors.value)}`}
            />
            <Kpi
              label="Stripe 会话支付率"
              value={pct(stats.checkout.paid, stats.checkout.started)}
              foot={`${num(stats.checkout.paid)} 个已付 / ${num(stats.checkout.started)} 个会话，来自 ${num(stats.checkout.uniqueAccounts)} 个账户；包含重复建单`}
            />
          </section>
          {ops?.wishesPending ? (
            <div className="admin-note">
              许愿池有 {num(ops.wishesPending)} 条愿望等你审核，审过才会显示给其他人。
            </div>
          ) : null}
          <section className="admin-card">
            <h2>每日趋势</h2>
            <p className="admin-muted">滑过柱子看当天数字。</p>
            <div className="admin-multiples">
              <MiniBars title="访客" days={stats.daily} pick={(d) => d.visitors} fmt={num} />
              <MiniBars title="新注册" days={stats.daily} pick={(d) => d.signups} fmt={num} />
              <MiniBars title="付费订单" days={stats.daily} pick={(d) => d.orders} fmt={num} />
              <MiniBars
                title="港币收入"
                days={stats.daily}
                pick={(d) => d.revenue}
                fmt={(v) => money(v, cur)}
              />
            </div>
          </section>
        </>
      )}

      {section === 'funnel' && (
        <section className="admin-card">
          <h2>转化漏斗</h2>
          <p className="admin-muted">
            右边是相对上一步的转化率，掉得最多的那一步最值得先改。旧数据缺少「开始求签」事件时，会由已看到结果的访客补全这一步，避免漏斗倒挂。
          </p>
          <Funnel steps={stats.funnel} />
        </section>
      )}

      {section === 'funnel' && stats.plays && (
        <section className="admin-card">
          <h2>各玩法转化（塔罗馆、算命摊）</h2>
          <p className="admin-muted">
            每一栏是不同访客数，付款看订单。「重复购买」是同一个账号在这段时间买了两次以上：有这种人才值得做次数包。「互推进来」是从别的玩法结果页点过来的人。
          </p>
          <Table
            head={['玩法', '看到结果', '看到价格', '点解锁', '付款', '重复购买', '收入', '分享', '互推进来']}
            rows={stats.plays.map((p) => [
              PLAY_LABELS[p.key] ?? p.key,
              num(p.results),
              num(p.offers),
              num(p.unlocks),
              `${num(p.paid)}（${num(p.buyers)} 人）`,
              num(p.repeatBuyers),
              money(p.revenue, 'HKD'),
              num(p.shares),
              p.key === 'tarot' ? '—' : num(p.crossIn),
            ])}
          />
          <p className="admin-muted">
            算命摊：{num(stats.fortuneMulti.visitors)} 人排过盘，其中 {num(stats.fortuneMulti.twoOrMore)} 人看了两种以上、
            {num(stats.fortuneMulti.allThree)} 人三种都看。三种都看的人多，就值得做「算命摊三合一」。
          </p>
        </section>
      )}

      {section === 'paths' && (
        <>
          <section className="admin-card">
            <h2>流向</h2>
            <p className="admin-muted">
              每次造访的前三步：从哪一页进来 → 接着去哪 → 再去哪。线越粗人越多，括号里是到这一步就离开的比例。
            </p>
            <Flow flow={stats.flow} />
          </section>
          <div className="admin-grid">
            <section className="admin-card">
              <h2>常见路径</h2>
              <p className="admin-muted">一次造访依序经过的页面与关键动作（取前 6 步）。</p>
              {stats.paths.length ? (
                <ol className="admin-paths">
                  {stats.paths.map((p) => (
                    <li key={p.steps.join('>')}>
                      <Chips steps={p.steps} />
                      <span className="admin-count">
                        {num(p.count)} 次{p.paid ? <em> · {num(p.paid)} 次付款</em> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="admin-empty">还没有路径数据。</p>
              )}
            </section>
            <section className="admin-card">
              <h2>入口与离开</h2>
              <div className="admin-two">
                <div>
                  <h3>从这里进来</h3>
                  <Bars items={stats.entries.map((e) => ({ label: step(e.label), count: e.count }))} />
                </div>
                <div>
                  <h3>在这里离开</h3>
                  <Bars items={stats.exits.map((e) => ({ label: step(e.label), count: e.count }))} />
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {section === 'journeys' && (
        <section className="admin-card">
          {stats.recent.length ? (
            <div className="admin-scroll">
              <table className="admin-table admin-journeys">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>停留</th>
                    <th>来源 / 设备</th>
                    <th>经过</th>
                  </tr>
                </thead>
                <tbody>
                  {journeys.map((s) => (
                    <tr key={s.start + s.steps.join()} className={s.paid ? 'paid' : undefined}>
                      <td>{timeFmt.format(new Date(s.start))}</td>
                      <td>{duration(s.seconds)}</td>
                      <td>
                        {s.referrer ?? '直接打开'}
                        <br />
                        <span className="admin-muted">
                          {DEVICE[s.device ?? ''] ?? '—'} · {COUNTRY[s.country ?? ''] ?? s.country ?? '—'} ·{' '}
                          {LOCALE[s.locale ?? ''] ?? s.locale ?? '—'}
                          {s.member ? ' · 会员' : ''}
                        </span>
                      </td>
                      <td>
                        <Chips steps={s.steps} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats.recent.length > journeys.length && (
                <button type="button" className="admin-btn admin-more" onClick={() => setAllJourneys(true)}>
                  显示全部 {stats.recent.length} 次
                </button>
              )}
            </div>
          ) : (
            <p className="admin-empty">还没有访问记录。</p>
          )}
        </section>
      )}

      {section === 'sales' && (
        <>
          {otherCurrencyNote && (
            <div className="admin-note">
              本期存在非港币历史订单，未与港币收入相加：{otherCurrencyNote}。请在下方订单明细查看原始币种。
            </div>
          )}
          <section className="admin-kpis" aria-label="销售指标">
            <Kpi label="付费订单" value={num(kpis.orders.value)} delta={<Delta {...kpis.orders} />} />
            <Kpi
              label="港币收入（扣退款）"
              value={money(kpis.revenue.value, cur)}
              delta={<Delta {...kpis.revenue} money />}
            />
            <Kpi label="付费人数" value={num(kpis.payers.value)} delta={<Delta {...kpis.payers} />} />
            <Kpi label="已退款" value={money(kpis.refunded, cur)} />
            <Kpi
              label="Stripe 结账会话"
              value={num(stats.checkout.started)}
              foot={`${num(stats.checkout.uniqueAccounts)} 个账户创建；同一账户可能多次尝试`}
            />
            <Kpi
              label="超时未付款（待核实）"
              value={num(stats.checkout.abandoned)}
              foot={
                stats.checkout.failed
                  ? `另有 ${num(stats.checkout.failed)} 个失败订单；超时不等于 Stripe 已回传过期`
                  : '后台待支付超过 30 分钟；以 Stripe 真实状态为准'
              }
            />
          </section>
          <section className="admin-card">
            <h2>每日订单与港币收入</h2>
            <div className="admin-multiples admin-multiples-2">
              <MiniBars title="付费订单" days={stats.daily} pick={(d) => d.orders} fmt={num} />
              <MiniBars
                title="港币收入"
                days={stats.daily}
                pick={(d) => d.revenue}
                fmt={(v) => money(v, cur)}
              />
            </div>
          </section>
          <section className="admin-card">
            <h2>各商品</h2>
            {stats.products.length ? (
              <Table
                head={['商品', '单数', '港币收入']}
                rows={stats.products.map((p) => [
                  findProduct(site, p.id)?.name ?? p.id,
                  num(p.count),
                  money(p.revenue, cur),
                ])}
              />
            ) : (
              <p className="admin-empty">这段时间还没有付费订单。</p>
            )}
          </section>
          <section className="admin-card">
            <h2>订单明细</h2>
            <p className="admin-muted">
              最近 60 张，含没付款的和测试单。订单号和用户「我的」页里看到的一样，处理退款时用它对。
            </p>
            {stats.orderList.length ? (
              <div className="admin-scroll">
                <Table
                  head={['下单时间', '订单号', '商品', '金额', '状态']}
                  rows={stats.orderList.map((o) => [
                    timeFmt.format(new Date(o.created)),
                    o.no,
                    findProduct(site, o.product)?.name ?? o.product,
                    money(o.amount, o.currency),
                    `${ORDER_STATUS[o.status] ?? o.status}${o.refunded ? `（退 ${money(o.refunded, o.currency)}）` : ''}${o.live ? '' : ' · 测试单'}`,
                  ])}
                />
              </div>
            ) : (
              <p className="admin-empty">这段时间没有订单。</p>
            )}
          </section>
        </>
      )}

      {section === 'users' && <Users />}
      {section === 'wishes' && <Wishes />}
      {section === 'partners' && <Partners />}
      {section === 'feedback' && <Feedback />}

      {section === 'ops' &&
        (ops ? (
          <>
            <section className="admin-kpis" aria-label="待处理">
              <Kpi label="待审核愿望" value={n(ops.wishesPending)} foot="审过才会公开显示（不分时间范围）" />
              <Kpi
                label="解读生成失败"
                value={n(ops.failedReadings)}
                foot="用户付了款但没拿到解读，需要跟进"
              />
            </section>
            <section className="admin-card">
              <h2>各功能使用次数</h2>
              <Table
                head={['功能', '次数', '说明']}
                rows={[
                  ['月老完整解签', n(ops.stickReadings), '付费后生成成功的解读'],
                  ['塔罗完整解读', n(ops.spreadReadings), '付费后生成成功的解读'],
                  ['许愿', n(ops.wishes), '写下的愿望，含待审核'],
                  ['同愿', n(ops.blessings), '替别人的愿望祝福'],
                  ['每日签到', n(ops.checkins), '抄经阁的每日心笺'],
                  ['大殿上香', n(ops.offerings), '登录用户上香'],
                ]}
              />
              <p className="admin-muted">显示「—」表示那张表读不到（可能还没在数据库建好）。</p>
            </section>
          </>
        ) : (
          <p className="admin-empty">内容数据暂时取不到。</p>
        ))}

      {section === 'pages' && (
        <div className="admin-grid">
          <section className="admin-card">
            <h2>热门页面</h2>
            <Table
              head={['页面', '访客', '浏览']}
              rows={stats.pages.map((p) => [step(p.label), num(p.count), num(p.views)])}
            />
          </section>
          <section className="admin-card">
            <h2>关键动作</h2>
            <Bars
              items={stats.events.map((e) => ({ label: EVENT_LABELS[e.label] ?? e.label, count: e.count }))}
            />
          </section>
        </div>
      )}

      {section === 'traffic' && (
        <div className="admin-grid">
          <section className="admin-card">
            <h2>从哪来</h2>
            <Bars
              items={stats.referrers.map((r) => ({
                label: r.label === '(direct)' ? '直接打开' : r.label,
                count: r.count,
              }))}
            />
          </section>
          <section className="admin-card">
            <h2>国家 / 地区</h2>
            <Bars
              items={stats.countries.map((c) => ({ label: COUNTRY[c.label] ?? c.label, count: c.count }))}
            />
          </section>
          <section className="admin-card">
            <h2>设备</h2>
            <Bars items={stats.devices.map((d) => ({ label: DEVICE[d.label] ?? d.label, count: d.count }))} />
          </section>
          <section className="admin-card">
            <h2>界面语言</h2>
            <Bars items={stats.locales.map((l) => ({ label: LOCALE[l.label] ?? l.label, count: l.count }))} />
          </section>
        </div>
      )}
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type AdminUser = {
  id: string;
  email: string | null;
  locale: string;
  createdAt: string;
  admin: boolean;
  paidOrders: number;
  paidAmount: number;
  currency: string;
  paidAmountByCurrency: { currency: string; amount: number }[];
  lastPaidAt: string | null;
};

function Users() {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [data, setData] = useState<{ total: number; users: AdminUser[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetch(`/api/admin/users?q=${encodeURIComponent(asked)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) return setFailed(true);
        setData((await res.json()) as { total: number; users: AdminUser[] });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [asked]);
  const payers = data?.users.filter((u) => u.paidOrders > 0).length ?? 0;
  return (
    <section className="admin-card">
      <form
        className="admin-search"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(q.trim());
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按邮箱搜索"
          aria-label="按邮箱搜索用户"
        />
        <button type="submit" className="admin-btn">
          搜索
        </button>
        {asked && (
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setQ('');
              setAsked('');
            }}
          >
            清除
          </button>
        )}
      </form>
      {failed && <p className="admin-empty">用户数据暂时取不到，稍后再试。</p>}
      {!failed && !data && <p className="admin-empty">正在读取……</p>}
      {!failed && data && (
        <>
          <p className="admin-muted">
            {asked ? `找到 ${num(data.total)} 位` : `共 ${num(data.total)} 位用户`}
            {data.total > data.users.length ? `，显示最近注册的 ${data.users.length} 位` : ''}；其中{' '}
            {num(payers)} 位付过款（不含测试单）。
          </p>
          {data.users.length ? (
            <div className="admin-scroll">
              <Table
                head={['邮箱', '注册时间', '语言', '付款笔数', '付款金额', '最近付款']}
                rows={data.users.map((u) => [
                  `${u.email ?? '访客（未绑定邮箱）'}${u.admin ? '（站长）' : ''}`,
                  dateFmt.format(new Date(u.createdAt)),
                  LOCALE[u.locale] ?? u.locale,
                  num(u.paidOrders),
                  u.paidOrders
                    ? u.paidAmountByCurrency.map((p) => money(p.amount, p.currency)).join(' / ')
                    : '—',
                  u.lastPaidAt ? dateFmt.format(new Date(u.lastPaidAt)) : '—',
                ])}
              />
            </div>
          ) : (
            <p className="admin-empty">没有符合的用户。</p>
          )}
        </>
      )}
    </section>
  );
}

type AdminWish = {
  id: string;
  body: string;
  tag: string;
  status: string;
  decidedBy: string | null;
  blessings: number;
  reports: number;
  createdAt: string;
  email: string | null;
};
const WISH_TAG: Record<string, string> = {
  seek: '求缘',
  keep: '守缘',
  reunion: '复合',
  self: '为自己',
  others: '为别人',
};
const WISH_STATUS: Record<string, string> = {
  pending: '待审核',
  hidden: '被举报收起',
  shown: '已公开',
  removed: '已删除',
};

function Wishes() {
  const [data, setData] = useState<{ waiting: AdminWish[]; recent: AdminWish[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [tick, setTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick 只用來在處理完一則後重新讀取
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/wishes', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) return setFailed(true);
        setFailed(false);
        setData((await res.json()) as { waiting: AdminWish[]; recent: AdminWish[] });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [tick]);
  const review = async (id: string, status: 'shown' | 'hidden' | 'removed') => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/wishes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy('');
    setTick((t) => t + 1);
  };
  const row = (w: AdminWish, actions: [string, 'shown' | 'hidden' | 'removed'][]) => (
    <li key={w.id} className="admin-wish">
      <div>
        <p className="admin-wish-body">{w.body}</p>
        <p className="admin-muted">
          {WISH_TAG[w.tag] ?? w.tag} · {WISH_STATUS[w.status] ?? w.status} ·{' '}
          {dateFmt.format(new Date(w.createdAt))}
          {w.email ? ` · ${w.email}` : ''}
          {w.reports ? ` · 被举报 ${w.reports} 次` : ''}
          {w.blessings ? ` · 同愿 ${w.blessings}` : ''}
        </p>
      </div>
      <div className="admin-wish-actions">
        {actions.map(([label, status]) => (
          <button
            key={status}
            type="button"
            className={`admin-btn${status === 'shown' ? ' primary' : ''}`}
            disabled={busy === w.id}
            onClick={() => void review(w.id, status)}
          >
            {label}
          </button>
        ))}
      </div>
    </li>
  );
  if (failed && !data) return <p className="admin-empty">愿望数据暂时取不到，稍后再试。</p>;
  if (!data) return <p className="admin-empty">正在读取……</p>;
  return (
    <>
      {failed && <div className="admin-note">刚才那一步没成功，列表已重新读取，请再试一次。</div>}
      <section className="admin-card">
        <h2>等你处理（{num(data.waiting.length)}）</h2>
        <p className="admin-muted">放行后所有人都看得到；删除后只有作者自己知道没通过。</p>
        {data.waiting.length ? (
          <ul className="admin-wishes">
            {data.waiting.map((w) =>
              row(w, [
                ['放行', 'shown'],
                ['删除', 'removed'],
              ]),
            )}
          </ul>
        ) : (
          <p className="admin-empty">没有等审核的愿望。</p>
        )}
      </section>
      <section className="admin-card">
        <h2>最近处理过的</h2>
        {data.recent.length ? (
          <ul className="admin-wishes">
            {data.recent.map((w) =>
              row(w, w.status === 'shown' ? [['撤下', 'removed']] : [['恢复公开', 'shown']]),
            )}
          </ul>
        ) : (
          <p className="admin-empty">还没有处理过的愿望。</p>
        )}
      </section>
    </>
  );
}

type FeedbackRow = {
  id: string;
  created_at: string;
  kind: 'idea' | 'problem' | 'other';
  message: string;
  contact: string | null;
  page: string | null;
  locale: string | null;
  device: string | null;
  user_id: string | null;
  status: 'new' | 'read' | 'done';
};
const FEEDBACK_KIND: Record<FeedbackRow['kind'], string> = {
  idea: '想要的功能',
  problem: '遇到问题',
  other: '其他',
};
const FEEDBACK_STATUS: Record<FeedbackRow['status'], string> = { new: '新', read: '已读', done: '已处理' };

function Feedback() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [tick, setTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick 只用來在標記後重新讀取
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/feedback', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) return setFailed(true);
        setFailed(false);
        setRows(((await res.json()) as { feedback: FeedbackRow[] }).feedback);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [tick]);
  const mark = async (id: string, status: FeedbackRow['status']) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy('');
    setTick((t) => t + 1);
  };
  if (failed) return <p className="admin-empty">意见暂时取不到，稍后再试。</p>;
  if (!rows) return <p className="admin-empty">正在读取……</p>;
  const open = rows.filter((r) => r.status !== 'done');
  const shown = showDone ? rows : open;
  return (
    <section className="admin-card">
      <p className="admin-muted">
        未处理 {num(open.length)} 条，共 {num(rows.length)} 条（最近 200 条）。{' '}
        <button type="button" className="admin-btn" onClick={() => setShowDone((v) => !v)}>
          {showDone ? '只看未处理' : '也显示已处理'}
        </button>
      </p>
      {shown.length === 0 ? (
        <p className="admin-empty">没有待处理的意见。</p>
      ) : (
        <ul className="admin-wishes">
          {shown.map((f) => (
            <li key={f.id} className="admin-wish">
              <div>
                <p className="admin-wish-body">{f.message}</p>
                <p className="admin-muted">
                  {FEEDBACK_KIND[f.kind]} · {FEEDBACK_STATUS[f.status]} ·{' '}
                  {timeFmt.format(new Date(f.created_at))}
                  {f.page ? ` · 来自 ${f.page}` : ''}
                  {f.device ? ` · ${f.device}` : ''}
                  {f.locale ? ` · ${f.locale}` : ''}
                  {f.user_id ? ' · 已登录用户' : ''}
                  {f.contact ? ` · 联系方式：${f.contact}` : ''}
                </p>
              </div>
              <div className="admin-wish-actions">
                {f.status === 'new' && (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy === f.id}
                    onClick={() => void mark(f.id, 'read')}
                  >
                    标为已读
                  </button>
                )}
                {f.status !== 'done' ? (
                  <button
                    type="button"
                    className="admin-btn primary"
                    disabled={busy === f.id}
                    onClick={() => void mark(f.id, 'done')}
                  >
                    已处理
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy === f.id}
                    onClick={() => void mark(f.id, 'read')}
                  >
                    重新打开
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type PartnerRow = {
  code: string;
  name: string;
  share: number;
  active: boolean;
  link: string;
  visitors: number;
  orders: {
    date: string;
    product: string;
    amount: number;
    currency: string;
    status: 'counted' | 'refunded' | 'repeat' | 'pending';
    fee: number | null;
    net: number | null;
    commission: number | null;
    feeCurrency: string | null;
  }[];
  months: { month: string; currency: string; orders: number; net: number; commission: number }[];
};
const PARTNER_STATUS: Record<PartnerRow['orders'][number]['status'], string> = {
  counted: '计佣',
  refunded: '已退款，不计',
  repeat: '非首单，不计',
  pending: '手续费待入账',
};

function Partners() {
  const [data, setData] = useState<PartnerRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; link: string; dashboard: string } | null>(null);
  const [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload 只用來在新增後重新讀取
  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetch('/api/admin/partners', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) return setFailed(true);
        setData(((await res.json()) as { partners: PartnerRow[] }).partners);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [reload]);
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setCreated((await res.json()) as { name: string; link: string; dashboard: string });
        setName('');
        setReload((n) => n + 1);
      } else setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="admin-card">
        <h3>新增推广人</h3>
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="推广人名称（只有你看得到）"
            aria-label="推广人名称"
            maxLength={60}
          />
          <button type="submit" className="admin-btn primary" disabled={busy || !name.trim()}>
            新增
          </button>
        </form>
        {created && (
          <div className="admin-partner-new">
            <p>
              已为 <b>{created.name}</b> 建好。两条链接都发给他：
            </p>
            <p>
              推广链接（他拿去发）：<code>{created.link}</code>
            </p>
            <p>
              他的数据页（私密，只给他）：<code>{created.dashboard}</code>
            </p>
            <p className="admin-muted">数据页链接只显示这一次，请现在复制保存。弄丢了就新增一个推广人。</p>
          </div>
        )}
      </section>
      {failed && <p className="admin-empty">分销数据暂时取不到，稍后再试。</p>}
      {!failed && !data && <p className="admin-empty">正在读取……</p>}
      {data && data.length === 0 && <p className="admin-empty">还没有推广人。</p>}
      {data?.map((p) => {
        const counted = p.orders.filter((o) => o.status === 'counted');
        return (
          <section className="admin-card" key={p.code}>
            <h3>
              {p.name}{' '}
              <span className="admin-muted">
                （代号 {p.code}，分成 {Math.round(p.share * 100)}%{p.active ? '' : '，已停用'}）
              </span>
            </h3>
            <p className="admin-muted">
              推广链接 <code>{p.link}</code>；带来 {num(p.visitors)} 位访客，{num(counted.length)}{' '}
              笔首单计佣。
            </p>
            <Table
              head={['月份', '计佣订单', '实收（扣手续费）', '应付佣金']}
              rows={p.months.map((m) => [
                m.month,
                num(m.orders),
                money(m.net, m.currency),
                money(m.commission, m.currency),
              ])}
            />
            {p.orders.length > 0 && (
              <Table
                head={['付款时间', '商品', '金额', '手续费', '佣金', '状态']}
                rows={p.orders.map((o) => [
                  timeFmt.format(new Date(o.date)),
                  o.product,
                  money(o.amount, o.currency),
                  o.fee !== null && o.feeCurrency ? money(o.fee, o.feeCurrency) : '—',
                  o.commission !== null && o.feeCurrency ? money(o.commission, o.feeCurrency) : '—',
                  PARTNER_STATUS[o.status],
                ])}
              />
            )}
          </section>
        );
      })}
    </>
  );
}

function Kpi({
  label,
  value,
  delta,
  foot,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  foot?: string;
}) {
  return (
    <div className="admin-kpi">
      <span className="admin-kpi-label">{label}</span>
      <strong>{value}</strong>
      {delta}
      {foot && <span className="admin-muted">{foot}</span>}
    </div>
  );
}

type Day = Stats['daily'][number];

function MiniBars({
  title,
  days,
  pick,
  fmt,
}: {
  title: string;
  days: Day[];
  pick: (d: Day) => number;
  fmt: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const W = 300;
  const H = 96;
  const gap = days.length > 40 ? 1 : 2;
  const bw = Math.max(1, (W - gap * (days.length - 1)) / days.length);
  const shown = hover !== null ? days[hover] : null;
  return (
    <figure className="admin-mini">
      <figcaption>
        <span>{title}</span>
        <strong>{shown ? fmt(pick(shown)) : fmt(total)}</strong>
        <span className="admin-muted">{shown ? shown.day.slice(5).replace('-', '/') : '合计'}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}每日数字`}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="admin-axis" />
        {values.map((v, i) => {
          const h = v ? Math.max(2, (v / max) * (H - 6)) : 0;
          const x = i * (bw + gap);
          const day = days[i];
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: 滑過看當天數字，數字也在上方文字裡
            <g key={day?.day ?? i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              {h > 0 && (
                <rect
                  x={x}
                  y={H - h}
                  width={bw}
                  height={h}
                  rx={Math.min(2, bw / 2)}
                  className={hover === i ? 'admin-bar on' : 'admin-bar'}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="admin-mini-axis">
        <span>{days[0]?.day.slice(5).replace('-', '/')}</span>
        <span>{days[days.length - 1]?.day.slice(5).replace('-', '/')}</span>
      </div>
    </figure>
  );
}

function Funnel({ steps }: { steps: Stats['funnel'] }) {
  const top = Math.max(1, steps[0]?.count ?? 0);
  return (
    <ol className="admin-funnel">
      {steps.map((s, i) => (
        <li key={s.key}>
          <span className="admin-funnel-label">{FUNNEL_LABELS[s.key] ?? s.key}</span>
          <span className="admin-funnel-track">
            <span
              className="admin-funnel-fill"
              style={{ width: `${Math.max(s.count ? 1.5 : 0, (s.count / top) * 100)}%` }}
            />
          </span>
          <span className="admin-funnel-num">{num(s.count)}</span>
          <span className="admin-funnel-rate">{i === 0 ? '' : pct(s.count, steps[i - 1]?.count ?? 0)}</span>
        </li>
      ))}
    </ol>
  );
}

function Bars({ items }: { items: { label: string; count: number }[] }) {
  if (!items.length) return <p className="admin-empty">暂无数据。</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="admin-bars">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}：${num(i.count)}`}>
          <span className="admin-bars-label">{i.label}</span>
          <span className="admin-bars-track">
            <span className="admin-bars-fill" style={{ width: `${(i.count / max) * 100}%` }} />
          </span>
          <span className="admin-bars-num">{num(i.count)}</span>
        </li>
      ))}
    </ul>
  );
}

const PLAY_LABELS: Record<string, string> = {
  match: '合缘配对 HK$12',
  love: '个人姻缘盘 HK$18',
  bazi: '八字命盘 HK$28',
  tarot: '塔罗完整解读 HK$18',
};

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="admin-empty">暂无数据。</p>;
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.join('|')}>
            {r.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 欄位順序固定
              <td key={i}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Chips({ steps }: { steps: string[] }) {
  return (
    <span className="admin-chips">
      {steps.map((s, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 同一頁可能出現兩次，順序就是身分
          key={i}
          className={`admin-chip ${s.startsWith('@') ? 'act' : ''} ${s === '@paid' ? 'paid' : ''}`}
        >
          {step(s)}
        </span>
      ))}
    </span>
  );
}

const FLOW_COLS = 3;
const FLOW_TOP = 6;

/** 三欄流向圖：每欄是第 N 步的頁面，帶子寬度 = 人次。每欄只留最多的 6 個，其他併成「其他」。 */
function Flow({ flow }: { flow: Stats['flow'] }) {
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => {
    // 每欄節點的人次
    const cols: Map<string, number>[] = Array.from({ length: FLOW_COLS }, () => new Map());
    for (const f of flow) {
      const a = cols[f.stage];
      const b = cols[f.stage + 1];
      if (a && f.stage === 0) a.set(f.from, (a.get(f.from) ?? 0) + f.count);
      if (b && f.to !== '@exit') b.set(f.to, (b.get(f.to) ?? 0) + f.count);
    }
    const keep = cols.map(
      (m) =>
        new Set(
          [...m.entries()]
            .sort((x, y) => y[1] - x[1])
            .slice(0, FLOW_TOP)
            .map(([k]) => k),
        ),
    );
    const fold = (stage: number, key: string) => (key === '@exit' || keep[stage]?.has(key) ? key : '@other');
    const links = new Map<string, number>();
    const nodes: Map<string, number>[] = Array.from({ length: FLOW_COLS }, () => new Map());
    const exits = new Map<string, number>();
    for (const f of flow) {
      const from = fold(f.stage, f.from);
      const to = f.to === '@exit' ? '@exit' : fold(f.stage + 1, f.to);
      if (f.stage === 0) nodes[0]?.set(from, (nodes[0]?.get(from) ?? 0) + f.count);
      if (to === '@exit') exits.set(`${f.stage}|${from}`, (exits.get(`${f.stage}|${from}`) ?? 0) + f.count);
      else {
        nodes[f.stage + 1]?.set(to, (nodes[f.stage + 1]?.get(to) ?? 0) + f.count);
        const k = `${f.stage}|${from}|${to}`;
        links.set(k, (links.get(k) ?? 0) + f.count);
      }
    }
    const total = [...(nodes[0]?.values() ?? [])].reduce((a, b) => a + b, 0);
    return { nodes, links, exits, total };
  }, [flow]);

  if (!layout.total) return <p className="admin-empty">还没有路径数据。</p>;

  const W = 960;
  const colW = 180;
  const pad = 8;
  const H = 360;
  const scale = (H - pad * (FLOW_TOP + 1) - 22 * (FLOW_TOP + 1)) / layout.total;
  const colX = (c: number) => c * ((W - colW) / (FLOW_COLS - 1));
  // 節點位置
  const pos = layout.nodes.map((m) => {
    const out = new Map<string, { y: number; h: number; outY: number; inY: number }>();
    let y = 0;
    const order = [...m.entries()].sort((a, b) =>
      a[0] === '@other' ? 1 : b[0] === '@other' ? -1 : b[1] - a[1],
    );
    for (const [k, v] of order) {
      const h = Math.max(22, v * scale);
      out.set(k, { y, h, outY: y, inY: y });
      y += h + pad;
    }
    return out;
  });
  const ribbons: { d: string; w: number; key: string; from: string; to: string; count: number }[] = [];
  const sorted = [...layout.links.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, count] of sorted) {
    const [stageS, from, to] = k.split('|') as [string, string, string];
    const stage = Number(stageS);
    const a = pos[stage]?.get(from);
    const b = pos[stage + 1]?.get(to);
    if (!a || !b) continue;
    const w = Math.max(1, count * scale);
    const x0 = colX(stage) + colW;
    const x1 = colX(stage + 1);
    const y0 = a.outY + w / 2;
    const y1 = b.inY + w / 2;
    a.outY += w;
    b.inY += w;
    const mx = (x0 + x1) / 2;
    ribbons.push({ d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`, w, key: k, from, to, count });
  }
  const shownH = Math.max(...pos.map((m) => [...m.values()].reduce((s, n) => Math.max(s, n.y + n.h), 0)));

  return (
    <div className="admin-flow">
      <div className="admin-flow-heads">
        <span>第一步</span>
        <span>第二步</span>
        <span>第三步</span>
      </div>
      <svg viewBox={`0 0 ${W} ${shownH + 2}`} role="img" aria-label="用户路径流向图">
        {ribbons.map((r) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: 滑過時高亮，數字也在下方清單
          <path
            key={r.key}
            d={r.d}
            strokeWidth={r.w}
            className={`admin-ribbon ${hover && hover !== r.key ? 'dim' : ''}`}
            onMouseEnter={() => setHover(r.key)}
            onMouseLeave={() => setHover(null)}
          >
            <title>
              {step(r.from)} → {step(r.to)}：{num(r.count)} 次
            </title>
          </path>
        ))}
        {pos.map((m, c) =>
          [...m.entries()].map(([k, n]) => {
            const exit = layout.exits.get(`${c}|${k}`) ?? 0;
            const total = layout.nodes[c]?.get(k) ?? 0;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: c 是欄號（第幾步），不是會變動的順序
              <g key={`${c}|${k}`} transform={`translate(${colX(c)},${n.y})`}>
                <rect
                  width={colW}
                  height={n.h}
                  rx={3}
                  className={`admin-node ${k === '@other' ? 'other' : ''}`}
                />
                <text x={8} y={Math.min(n.h / 2, 14) + 4} className="admin-node-text">
                  {step(k)} · {num(total)}
                  {exit && c < FLOW_COLS - 1 ? `（${pct(exit, total)}离开）` : ''}
                </text>
              </g>
            );
          }),
        )}
      </svg>
      {hover && (
        <p className="admin-flow-tip">
          {(() => {
            const r = ribbons.find((x) => x.key === hover);
            return r ? `${step(r.from)} → ${step(r.to)}：${num(r.count)} 次` : null;
          })()}
        </p>
      )}
    </div>
  );
}
