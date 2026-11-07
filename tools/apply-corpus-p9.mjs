// P9: apply the traditional 月老靈籤 100首 corpus to the repo.
//   tools/poem-corpus-p9.mjs            — poems + grades + sources (truth)
//   yuelao-verify/rewrites-p9-{a,b}.json — P9 verdict/advice overrides (optional;
//                                          rerun after they land to apply them)
//   yuelao-verify/zh-hans-p9.json        — OpenCC t2s Simplified texts (from
//                                          gen-zh-hans-p9.mjs; 待人審)
// Writes:
//   sites/yuelao/src/ritual/sticks.ts      (poem/grade/level/source + verdict overrides)
//   sites/yuelao/src/ritual/stick-advice.ts (advice overrides + t2s zh-Hans map)
//   supabase/seed.sql                      (same data, + source column)
//   supabase/migrations/20261106000002_stick_source_p9.sql
//   supabase/migrations/20261106000003_stick_locales_zh_hans_p9.sql
// Only Node built-ins. Usage: node tools/apply-corpus-p9.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { STICK_ADVICE } from '../sites/yuelao/src/ritual/stick-advice.ts';
import { STICKS } from '../sites/yuelao/src/ritual/sticks.ts';
import { POEM_CORPUS } from './poem-corpus-p9.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const VERIFY = '/home/hatch/workspace/yuelao-verify/';

function loadJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
const overrides = {
  ...(loadJson(`${VERIFY}rewrites-p9-a.json`)?.overrides ?? {}),
  ...(loadJson(`${VERIFY}rewrites-p9-b.json`)?.overrides ?? {}),
};
const zhHans = loadJson(`${VERIFY}zh-hans-p9.json`);
if (!zhHans) {
  console.error('missing zh-hans-p9.json — run yuelao-verify/gen-zh-hans-p9.mjs first');
  process.exit(1);
}

// Final zh-Hant data: corpus poem/grade/level/source + kept knot + verdict
// (override wins) + advice (override wins).
const final = POEM_CORPUS.map((c) => {
  const old = STICKS.find((s) => s.id === c.id);
  if (!old) throw new Error(`stick #${c.id} missing from sticks.ts`);
  const ov = overrides[String(c.id)] ?? {};
  return {
    id: c.id,
    no: old.no,
    grade: c.grade,
    level: c.level,
    knot: old.knot,
    knotName: old.knotName,
    poem: c.poem,
    source: c.source ?? null,
    verdict: {
      him: ov.verdict?.him ?? old.verdict.him,
      single: ov.verdict?.single ?? old.verdict.single,
      reunion: ov.verdict?.reunion ?? old.verdict.reunion,
    },
    advice: {
      actions: ov.advice?.actions ?? STICK_ADVICE[c.id].actions,
      practice: ov.advice?.practice ?? STICK_ADVICE[c.id].practice,
    },
    adviceHans: zhHans.advice[String(c.id)],
  };
});

const tsq = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const sqlq = (s) => `'${s.replace(/'/g, "''")}'`;

// Biome line width is 110, CJK wide chars count 2: long string properties
// break as `key:\n  'value',` — render exactly that so the generated files
// pass `pnpm lint` without a formatter pass.
const WIDE = /[\u3000-\u303F\u3040-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const width = (s) => [...s].reduce((n, ch) => n + (WIDE.test(ch) ? 2 : 1), 0);
const prop = (indent, key, value) => {
  const one = `${indent}${key}: ${tsq(value)},`;
  if (width(one) <= 110) return one;
  return `${indent}${key}:\n${indent}  ${tsq(value)},`;
};

// ---- sticks.ts ----
const sticksPath = `${ROOT}sites/yuelao/src/ritual/sticks.ts`;
let sticksSrc = readFileSync(sticksPath, 'utf8');
const headerOld = sticksSrc.slice(0, sticksSrc.indexOf('export interface Stick'));
const headerNew = `// 籤詩底本（100 支）：傳統月老靈籤 100 首（流傳已久的公版籤集）。
// 詩文逐字照錄台灣好廟網 temples.tw/stick/fs_yuelao；吉凶與典故出處對
// 照玄燈命理 destineai.com/oracle/yuelao（兩站籤號對應一致；分歧以
// temples.tw 為準）。吉凶五檔：上上籤 / 上吉籤 / 中吉籤 / 中平籤 / 下下籤
// （18 / 27 / 20 / 30 / 5）。判詞與三天/七日建議為本站新寫（逐支以新詩
// 意象 + 吉凶寫成），與詩文出處無關。P9 換底本見 tools/poem-corpus-p9.mjs；
// 要改底本請改該檔後重跑 tools/apply-corpus-p9.mjs（它同時重寫
// supabase/seed.sql 與簡體遷移）。source 為籤詩典故出處（無出處者略）。
`;
sticksSrc = sticksSrc.replace(headerOld, headerNew);
sticksSrc = sticksSrc.replace(
  '  poem: string;\n  verdict:',
  '  poem: string;\n  /** 籤詩典故出處（如 詩經·周南·關雎）；無出處者為 undefined。 */\n  source?: string;\n  verdict:',
);
const arrayStart = sticksSrc.indexOf('export const STICKS: Stick[] = [');
const arrayEnd = sticksSrc.indexOf('];', arrayStart);
const sticksArray = final
  .map((s) => {
    const lines = [
      '  {',
      `    id: ${s.id},`,
      `    no: ${tsq(s.no)},`,
      `    grade: ${tsq(s.grade)},`,
      `    level: ${s.level},`,
      `    knot: ${tsq(s.knot)},`,
      `    knotName: ${tsq(s.knotName)},`,
      // Biome keeps poem/source/verdict on one line here (verified: the
      // pre-P9 file passed lint with every property on one line), even for
      // long poems — do NOT break them the way the advice map does.
      `    poem: ${tsq(s.poem)},`,
    ];
    if (s.source) lines.push(`    source: ${tsq(s.source)},`);
    lines.push(
      '    verdict: {',
      `      him: ${tsq(s.verdict.him)},`,
      `      single: ${tsq(s.verdict.single)},`,
      `      reunion: ${tsq(s.verdict.reunion)},`,
      '    },',
      '  },',
    );
    return lines.join('\n');
  })
  .join('\n');
sticksSrc =
  sticksSrc.slice(0, arrayStart) +
  'export const STICKS: Stick[] = [\n' +
  sticksArray +
  '\n' +
  sticksSrc.slice(arrayEnd);
writeFileSync(sticksPath, sticksSrc);

// ---- stick-advice.ts ----
const advicePath = `${ROOT}sites/yuelao/src/ritual/stick-advice.ts`;
let adviceSrc = readFileSync(advicePath, 'utf8');
const renderMap = (map) =>
  Object.entries(map)
    .map(
      ([id, a]) =>
        `  ${id}: {\n${prop('    ', 'actions', a.actions)}\n${prop('    ', 'practice', a.practice)}\n  },`,
    )
    .join('\n');
const hantMap = Object.fromEntries(final.map((s) => [s.id, s.advice]));
const hansMap = Object.fromEntries(final.map((s) => [s.id, s.adviceHans]));
const hantStart = adviceSrc.indexOf('export const STICK_ADVICE:');
const hantEnd = adviceSrc.indexOf('};', hantStart);
adviceSrc =
  adviceSrc.slice(0, hantStart) +
  'export const STICK_ADVICE: Readonly<Record<number, StickAdvice>> = {\n' +
  renderMap(hantMap) +
  '\n' +
  adviceSrc.slice(hantEnd);
const hansStart = adviceSrc.indexOf('export const STICK_ADVICE_ZH_HANS:');
const hansEnd = adviceSrc.indexOf('};', hansStart);
adviceSrc =
  adviceSrc.slice(0, hansStart) +
  'export const STICK_ADVICE_ZH_HANS: Readonly<Record<number, StickAdvice>> = {\n' +
  renderMap(hansMap) +
  '\n' +
  adviceSrc.slice(hansEnd);
writeFileSync(advicePath, adviceSrc);

// ---- seed.sql ----
const seedPath = `${ROOT}supabase/seed.sql`;
let seedSrc = readFileSync(seedPath, 'utf8');
const seedHeader = `-- P9: 傳統月老靈籤 100 首（詩文照錄 temples.tw/stick/fs_yuelao；吉凶與
-- 出處對照 destineai.com/oracle/yuelao；吉凶五檔 上上/上吉/中吉/中平/下下）。
-- GENERATED by tools/apply-corpus-p9.mjs from tools/poem-corpus-p9.mjs —
-- do not hand-edit; edit the corpus and re-run the generator.
-- stick_locales (Simplified) is intentionally empty here: Simplified copy is
-- translated in migration 20261106000003 (OpenCC t2s, 標註「待人審」，未應
-- 用到線上庫）；the app falls back to the Traditional text until then.
-- deep_readings (paid deep readings) is intentionally empty: content debt, see BUILD_PLAN §9 #4.
`;
const seedTuples = final
  .map(
    (s) =>
      `(${s.id}, ${sqlq(s.no)}, ${sqlq(s.grade)}, ${s.level}, ${sqlq(s.knot)}, ${sqlq(s.knotName)}, ${sqlq(s.poem)}, ${s.source ? sqlq(s.source) : 'null'}, ${sqlq(s.verdict.him)}, ${sqlq(s.verdict.single)}, ${sqlq(s.verdict.reunion)})`,
  )
  .join(',\n');
const seedTail = `
on conflict (id) do update set
  no = excluded.no, grade = excluded.grade, level = excluded.level,
  knot = excluded.knot, knot_name = excluded.knot_name, poem = excluded.poem,
  source = excluded.source,
  verdict_him = excluded.verdict_him, verdict_single = excluded.verdict_single,
  verdict_reunion = excluded.verdict_reunion;
`;
seedSrc =
  seedHeader +
  'insert into sticks (id, no, grade, level, knot, knot_name, poem, source, verdict_him, verdict_single, verdict_reunion)\nvalues\n' +
  seedTuples +
  seedTail;
writeFileSync(seedPath, seedSrc);

// ---- migration 20261106000002: source column + comments ----
writeFileSync(
  `${ROOT}supabase/migrations/20261106000002_stick_source_p9.sql`,
  `-- P9: sticks.source 欄（籤詩典故出處）+ 欄位註解更新（吉凶改五檔）。
-- NOT applied to the live database by this change (remote migrations need
-- explicit user confirmation).
alter table sticks add column if not exists source text;
comment on column sticks.grade is '上上籤 / 上吉籤 / 中吉籤 / 中平籤 / 下下籤（P9 傳統月老靈籤 100 首：18 / 27 / 20 / 30 / 5）';
comment on column sticks.poem is '籤文（傳統月老靈籤 100 首，繁體原文；行數不定，1–4 行）';
comment on column sticks.source is '籤詩典故出處（如 詩經·周南·關雎）；無出處者為 null';
`,
);

// ---- migration 20261106000003: zh-Hans rows (supersedes 20261106000001) ----
const hansTuples = final
  .map((s) => {
    const v = zhHans.verdicts[String(s.id)];
    return `(${s.id}, 'zh-Hans', ${sqlq(zhHans.poems[String(s.id)])}, ${sqlq(v.him)}, ${sqlq(v.single)}, ${sqlq(v.reunion)})`;
  })
  .join(',\n');
writeFileSync(
  `${ROOT}supabase/migrations/20261106000003_stick_locales_zh_hans_p9.sql`,
  `-- P9: Simplified (zh-Hans) seed for stick_locales — SUPERSEDES
-- 20261106000001_stick_locales_zh_hans.sql (same 100 rows, old poems and
-- pre-P6 verdicts). GENERATED with OpenCC t2s (machine conversion) from the
-- P9 Traditional corpus (tools/poem-corpus-p9.mjs + P9 rewritten verdicts).
-- DO NOT treat this copy as final: it is explicitly 待人审 (pending human
-- review). Per AGENTS.md §3, machine-converted Simplified copy must not go
-- live unreviewed — the app falls back to the Traditional text when a
-- reviewed translation is missing (see src/ritual/sticks-locale.ts), so
-- these rows are a starting point for the reviewer, not live copy. When the
-- review lands, update the rows in a NEW migration; do not edit this file
-- once applied.
-- NOT applied to the live database by this change (remote migrations need
-- explicit user confirmation).
insert into stick_locales (stick_id, locale, poem, verdict_him, verdict_single, verdict_reunion)
values
${hansTuples}
on conflict (stick_id, locale) do update set
  poem = excluded.poem,
  verdict_him = excluded.verdict_him, verdict_single = excluded.verdict_single,
  verdict_reunion = excluded.verdict_reunion;
`,
);

console.log(`applied corpus to sticks.ts, stick-advice.ts, seed.sql + 2 migrations`);
console.log(`overrides applied: ${Object.keys(overrides).length} sticks`);
const dist = {};
for (const s of final) dist[s.grade] = (dist[s.grade] || 0) + 1;
console.log('grades:', JSON.stringify(dist));
console.log('with source:', final.filter((s) => s.source).length, '/ 100');
