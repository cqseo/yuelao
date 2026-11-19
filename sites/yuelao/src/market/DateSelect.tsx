import { useEffect, useRef, useState } from 'react';

// 生日用年、月、日三個下拉（算命攤，2026-11-19）：安卓的日期選擇器預設停在今天，往回翻幾十年很累。
// 可切換公曆／農曆（農曆可勾閏月）；農曆在本機換成公曆後才交給上層，並顯示換算結果讓人確認。
// 三格都選了、日期也存在，才回 YYYY-MM-DD（公曆），否則回空字串。

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1929 }, (_, i) => THIS_YEAR - i);
const pad = (n: string) => n.padStart(2, '0');
const LUNAR_MONTHS = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '臘月',
];
const LUNAR_DAYS = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  if (n <= 10) return `初${'一二三四五六七八九十'[n - 1]}`;
  if (n < 20) return `十${'一二三四五六七八九'[n - 11]}`;
  if (n === 20) return '二十';
  if (n < 30) return `廿${'一二三四五六七八九'[n - 21]}`;
  return '三十';
});

export function DateSelect({
  label,
  value,
  disabled,
  onChange,
  hans = false,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  hans?: boolean;
}) {
  const t = (a: string, b: string) => (hans ? b : a);
  const split = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? [m[1]!, String(Number(m[2])), String(Number(m[3]))] : ['', '', ''];
  };
  const [cal, setCal] = useState<'s' | 'l'>('s');
  const [parts, setParts] = useState(() => split(value));
  const [leap, setLeap] = useState(false);
  const [leapMonth, setLeapMonth] = useState(0);
  const [note, setNote] = useState('');
  const [bad, setBad] = useState(false);
  const last = useRef(value);
  useEffect(() => {
    // 上層換了值（還原付款前的資料、記住的生日）：一律以公曆顯示
    if (value && value !== last.current) {
      setCal('s');
      setParts(split(value));
      setNote('');
      setBad(false);
    }
    last.current = value;
  }, [value]);

  async function emit(next: string[], c: 's' | 'l', lp: boolean) {
    const [y, m, d] = next;
    setBad(false);
    if (!(y && m && d)) {
      setNote('');
      last.current = '';
      onChange('');
      return;
    }
    if (c === 's') {
      setNote('');
      const v = `${y}-${pad(m!)}-${pad(d!)}`;
      last.current = v;
      onChange(v);
      return;
    }
    const lib = await import('~/ritual/match');
    setLeapMonth(lib.leapMonthOf(Number(y)));
    const solar = lib.lunarToSolar(Number(y), Number(m), Number(d), lp);
    last.current = solar ?? '';
    if (solar) {
      const [sy, sm, sd] = solar.split('-').map(Number);
      setNote(t(`對應公曆 ${sy} 年 ${sm} 月 ${sd} 日`, `对应公历 ${sy} 年 ${sm} 月 ${sd} 日`));
    } else {
      setBad(true);
      setNote(
        t(
          '這個農曆日期不存在（那個月可能只有 29 天，或那年沒有這個閏月）。',
          '这个农历日期不存在（那个月可能只有 29 天，或那年没有这个闰月）。',
        ),
      );
    }
    onChange(solar ?? '');
  }
  const set = (i: number, v: string) => {
    const next = [...parts];
    next[i] = v;
    setParts(next);
    void emit(next, cal, leap);
  };
  const switchCal = (c: 's' | 'l') => {
    if (c === cal) return;
    setCal(c);
    setLeap(false);
    // 換曆法時數字意思不同：清掉月日，留年
    const next = [parts[0]!, '', ''];
    setParts(next);
    void emit(next, c, false);
  };
  const year = Number(parts[0]);
  useEffect(() => {
    if (cal !== 'l' || !year) return;
    void import('~/ritual/match').then((lib) => setLeapMonth(lib.leapMonthOf(year)));
  }, [cal, year]);

  return (
    <fieldset className="lm__dsel" disabled={disabled}>
      <legend className="lm__label">
        {label}
        <span className="lm__cal" role="radiogroup" aria-label={t('曆法', '历法')}>
          {(['s', 'l'] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cal === c} onClick={() => switchCal(c)}>
              {c === 's' ? t('公曆', '公历') : t('農曆', '农历')}
            </button>
          ))}
        </span>
      </legend>
      <select
        aria-label={`${label}．${t('年', '年')}`}
        value={parts[0]}
        onChange={(e) => set(0, e.target.value)}
      >
        <option value="">{t('年', '年')}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label}．${t('月', '月')}`}
        value={parts[1]}
        onChange={(e) => set(1, e.target.value)}
      >
        <option value="">{t('月', '月')}</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1}>
            {cal === 'l'
              ? t(LUNAR_MONTHS[i]!, LUNAR_MONTHS[i]!.replace('臘', '腊'))
              : `${i + 1}${t('月', '月')}`}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label}．${t('日', '日')}`}
        value={parts[2]}
        onChange={(e) => set(2, e.target.value)}
      >
        <option value="">{t('日', '日')}</option>
        {Array.from({ length: cal === 'l' ? 30 : 31 }, (_, i) => (
          <option key={i} value={i + 1}>
            {cal === 'l' ? LUNAR_DAYS[i] : `${i + 1}${t('日', '日')}`}
          </option>
        ))}
      </select>
      {cal === 'l' && leapMonth > 0 && Number(parts[1]) === leapMonth && (
        <label className="lm__leap">
          <input
            type="checkbox"
            checked={leap}
            onChange={(e) => {
              setLeap(e.target.checked);
              void emit(parts, cal, e.target.checked);
            }}
          />
          <span>
            {t(`閏${LUNAR_MONTHS[leapMonth - 1]}`, `闰${LUNAR_MONTHS[leapMonth - 1]!.replace('臘', '腊')}`)}
          </span>
        </label>
      )}
      {note && <p className={bad ? 'lm__calnote is-warn' : 'lm__calnote'}>{note}</p>}
    </fieldset>
  );
}
