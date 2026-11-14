// 集市的日曆（DESIGN.md「節氣與月相」）：農曆初一十五、月相、二十四節氣、和感情有關的節日。
// 全在瀏覽器算，用訪客當地日期：農曆用瀏覽器內建的中國曆（Intl），節氣用壽星公式（±1 天內），
// 月相用農曆日（初一新月、十五前後滿月）。

const LUNAR_FMT = (() => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric' });
  } catch {
    return null;
  }
})();

/** 農曆 { month, day }；瀏覽器不支援時回 null。閏月照該月算。 */
export function lunarDate(d = new Date()) {
  if (!LUNAR_FMT) return null;
  try {
    const parts = LUNAR_FMT.formatToParts(d);
    const month = Number.parseInt(parts.find((p) => p.type === 'month')?.value ?? '', 10);
    const day = Number.parseInt(parts.find((p) => p.type === 'day')?.value ?? '', 10);
    return Number.isFinite(month) && Number.isFinite(day) ? { month, day } : null;
  } catch {
    return null;
  }
}

/** 月亮亮面的比例 0（新月）～ 1（滿月），照農曆日估。 */
export function moonLight(d = new Date()) {
  const l = lunarDate(d);
  if (!l) return 0.6;
  return (1 - Math.cos((2 * Math.PI * (l.day - 1)) / 29.53)) / 2;
}

// 二十四節氣：[名稱, 月份, 21 世紀 C 值]（壽星公式）
const TERMS = [
  ['小寒', 1, 5.4055],
  ['大寒', 1, 20.12],
  ['立春', 2, 3.87],
  ['雨水', 2, 18.73],
  ['驚蟄', 3, 5.63],
  ['春分', 3, 20.646],
  ['清明', 4, 4.81],
  ['穀雨', 4, 20.1],
  ['立夏', 5, 5.52],
  ['小滿', 5, 21.04],
  ['芒種', 6, 5.678],
  ['夏至', 6, 21.37],
  ['小暑', 7, 7.108],
  ['大暑', 7, 22.83],
  ['立秋', 8, 7.5],
  ['處暑', 8, 23.13],
  ['白露', 9, 7.646],
  ['秋分', 9, 23.042],
  ['寒露', 10, 8.318],
  ['霜降', 10, 23.438],
  ['立冬', 11, 7.438],
  ['小雪', 11, 22.36],
  ['大雪', 12, 7.18],
  ['冬至', 12, 21.94],
];

/** 今天的節氣名稱；不是節氣當天回 ''。 */
export function solarTerm(d = new Date()) {
  const y = d.getFullYear() % 100;
  const m = d.getMonth() + 1;
  for (const [name, month, c] of TERMS) {
    if (month !== m) continue;
    const leapFix = month <= 2 ? Math.floor((y - 1) / 4) : Math.floor(y / 4);
    const day = Math.floor(y * 0.2422 + c) - leapFix;
    if (day === d.getDate()) return name;
  }
  return '';
}

const NUM = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十'];
const lunarDayName = (n) =>
  n <= 10
    ? NUM[n]
    : n < 20
      ? `十${'一二三四五六七八九'[n - 11]}`
      : n === 20
        ? '二十'
        : n < 30
          ? `廿${'一二三四五六七八九'[n - 21]}`
          : '三十';

/**
 * 今天的日曆事件，最重要的在前。每個事件：{ key, name, line }。
 * name 放在頂欄的小字；line 是進集市時的一句提示。
 */
export function todayEvents(d = new Date()) {
  const out = [];
  const l = lunarDate(d);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (l) {
    if (l.month === 7 && l.day === 7)
      out.push({ key: 'qixi', name: '七夕', line: '今天七夕，牛郎織女相會的日子。月老殿的紅線今晚特別亮。' });
    if (l.month === 1 && l.day === 15)
      out.push({
        key: 'yuanxiao',
        name: '元宵',
        line: '今天元宵，燈會的晚上。古時候很多良緣是在燈下遇見的。',
      });
    if (l.month === 8 && l.day === 15)
      out.push({
        key: 'midautumn',
        name: '中秋',
        line: '今天中秋，月亮最圓的一夜。許個願，讓月亮替你記著。',
      });
    if (l.month === 1 && l.day === 1)
      out.push({ key: 'newyear', name: '春節', line: '新年好。今年的第一支籤，月老替你留著。' });
  }
  if (m === 2 && day === 14)
    out.push({
      key: 'valentine',
      name: '情人節',
      line: '今天情人節。有人陪就好好陪，一個人也值得被溫柔對待。',
    });
  if (m === 5 && day === 20)
    out.push({ key: '520', name: '520', line: '今天 520，說出口的心意，比放在心裡的有用。' });
  const term = solarTerm(d);
  if (term)
    out.push({ key: `term-${term}`, name: term, line: `今天${term}。換季的日子，心情也跟著換一換。` });
  if (l && (l.day === 1 || l.day === 15)) {
    const full = l.day === 15;
    out.push({
      key: full ? 'fifteen' : 'first',
      name: full ? '十五・滿月' : '初一・新月',
      line: full
        ? '今天十五，月亮正圓。初一十五來上香的人特別多，大殿裡也熱鬧些。'
        : '今天初一，新月的晚上看不到月亮。新的一個月，從一炷香開始。',
    });
  }
  return out;
}

const MONTH = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'];

/** 頂欄小字：今天有節日或節氣就寫它，否則寫農曆日期（例：農曆十月廿六）。 */
export function almanacLabel(d = new Date()) {
  const ev = todayEvents(d)[0];
  if (ev) return ev.name;
  const l = lunarDate(d);
  return l ? `農曆${MONTH[l.month] || ''}月${lunarDayName(l.day)}` : '';
}
