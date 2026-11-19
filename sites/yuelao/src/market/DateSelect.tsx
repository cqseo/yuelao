import { useEffect, useState } from 'react';

// 生日用年、月、日三個下拉（算命攤，2026-11-19）：安卓的日期選擇器預設停在今天，往回翻幾十年很累。
// 三格都選了才回 YYYY-MM-DD，否則回空字串。

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1929 }, (_, i) => THIS_YEAR - i);
const pad = (n: string) => n.padStart(2, '0');

export function DateSelect({
  label,
  value,
  disabled,
  onChange,
  words,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  words: { y: string; m: string; d: string };
}) {
  const split = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? [m[1]!, String(Number(m[2])), String(Number(m[3]))] : ['', '', ''];
  };
  const [parts, setParts] = useState(() => split(value));
  useEffect(() => {
    if (value) setParts(split(value));
  }, [value]);
  const set = (i: number, v: string) => {
    const next = [...parts];
    next[i] = v;
    setParts(next);
    const [y, m, d] = next;
    onChange(y && m && d ? `${y}-${pad(m!)}-${pad(d!)}` : '');
  };
  return (
    <fieldset className="lm__dsel" disabled={disabled}>
      <legend className="lm__label">{label}</legend>
      <select aria-label={`${label}．${words.y}`} value={parts[0]} onChange={(e) => set(0, e.target.value)}>
        <option value="">{words.y}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select aria-label={`${label}．${words.m}`} value={parts[1]} onChange={(e) => set(1, e.target.value)}>
        <option value="">{words.m}</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1}>
            {`${i + 1}${words.m}`}
          </option>
        ))}
      </select>
      <select aria-label={`${label}．${words.d}`} value={parts[2]} onChange={(e) => set(2, e.target.value)}>
        <option value="">{words.d}</option>
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i} value={i + 1}>
            {`${i + 1}${words.d}`}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
