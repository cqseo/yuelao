// 功德台：功德累計、換日、念珠一圈、擲筊機率與連續聖筊。全離線。
import assert from 'node:assert/strict';
import {
  addMerit,
  BEADS_PER_ROUND,
  emptyMerit,
  nextBead,
  sanitizeMerit,
  shengStreak,
  todayCount,
  tossJiao,
} from '../sites/yuelao/src/site/merit';

let r = emptyMerit();
r = addMerit(r, 1, '2026-11-21');
r = addMerit(r, 1, '2026-11-21');
assert.equal(r.total, 2);
assert.equal(todayCount(r, '2026-11-21'), 2);
r = addMerit(r, 1, '2026-11-22');
assert.equal(r.total, 3, 'total keeps growing');
assert.equal(todayCount(r, '2026-11-22'), 1, 'today restarts on a new day');
assert.equal(todayCount(r, '2026-11-23'), 0, 'a stale day reads as zero');
console.log('PASS: merit adds up and today resets each day');

let b = emptyMerit();
let rounds = 0;
for (let i = 0; i < BEADS_PER_ROUND * 2 + 5; i++) {
  const x = nextBead(b, '2026-11-21');
  b = x.rec;
  if (x.round) rounds++;
}
assert.equal(rounds, 2);
assert.equal(b.rounds, 2);
assert.equal(b.bead, 5);
assert.equal(b.total, BEADS_PER_ROUND * 2 + 5, 'every bead is one merit');
console.log('PASS: 108 beads make a round');

assert.deepEqual(sanitizeMerit({ total: -5, day: 'x', today: 'a', bead: 999, rounds: 1.7 }), {
  total: 0,
  day: '',
  today: 0,
  bead: BEADS_PER_ROUND - 1,
  rounds: 1,
});
assert.deepEqual(sanitizeMerit(null), emptyMerit());
console.log('PASS: stored records are cleaned');

const seq = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length] as number;
};
// 和月老殿同一套：聖筊一平一凸、笑筊兩凸、陰筊兩平；50／30／20
const sh = tossJiao(seq([0.1, 0.9]));
assert.equal(sh.result, 'sheng');
assert.deepEqual([...sh.faces].sort(), ['flat', 'round']);
const xi = tossJiao(seq([0.6, 0.1]));
assert.equal(xi.result, 'xiao');
assert.deepEqual(xi.faces, ['round', 'round'], '笑筊兩凸');
const yi = tossJiao(seq([0.9, 0.1]));
assert.equal(yi.result, 'yin');
assert.deepEqual(yi.faces, ['flat', 'flat'], '陰筊兩平');
const n = 20000;
const count = { sheng: 0, xiao: 0, yin: 0 };
for (let i = 0; i < n; i++) count[tossJiao().result]++;
assert.ok(Math.abs(count.sheng / n - 0.5) < 0.03);
assert.ok(Math.abs(count.xiao / n - 0.3) < 0.03);
assert.ok(Math.abs(count.yin / n - 0.2) < 0.03);
assert.equal(shengStreak(2, 'sheng'), 3);
assert.equal(shengStreak(2, 'yin'), 0);
console.log('PASS: moon blocks match the temple ritual: 50/30/20, xiao two convex, yin two flat');

// 排行榜：送分的輸入檢查、法號過濾、裝置鑰匙只存雜湊
const { parseSubmit, parseNickname, hashDevice } = await import('../packages/core/src/merit-board');
const dev = 'a'.repeat(64);
assert.deepEqual(parseSubmit({ device: dev, delta: 12 }), { device: dev, delta: 12, nickname: null });
assert.equal(parseSubmit({ device: 'xyz', delta: 1 }), 'invalid');
assert.equal(parseSubmit({ device: dev, delta: -1 }), 'invalid');
assert.equal(parseSubmit({ device: dev, delta: 1.5 }), 'invalid');
assert.equal(parseSubmit({ device: dev, delta: 999999 }), 'invalid');
assert.equal(parseSubmit({ device: dev, delta: 1, nickname: '加我line 12345678' }), 'bad_nickname');
assert.equal(parseSubmit({ device: dev, delta: 1, nickname: '一二三四五六七八九十一' }), 'bad_nickname');
assert.equal(parseNickname('  阿明  '), '阿明');
assert.equal(parseNickname('www.x.com'), null);
assert.equal(parseNickname('幹你娘'), null);
const h = await hashDevice(dev);
assert.match(h, /^[0-9a-f]{64}$/);
assert.notEqual(h, dev, 'the key itself is never stored');
assert.equal(h, await hashDevice(dev));
console.log('PASS: leaderboard input is checked and device keys are hashed');

// 後台：每日人數、回來的人、次日回來率
const { computeMeritStats } = await import('../packages/core/src/admin-merit');
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const now = Date.parse('2026-11-23T04:00:00Z'); // 台北 11/23 中午
const st = computeMeritStats(
  [
    { device_hash: A, day: '2026-11-21', count: 100 },
    { device_hash: A, day: '2026-11-22', count: 50 },
    { device_hash: B, day: '2026-11-22', count: 10 },
    { device_hash: A, day: '2026-11-23', count: 5 },
    { device_hash: B, day: '2026-11-23', count: 7 },
    { device_hash: C, day: '2026-11-23', count: 0 },
  ],
  [
    { device_hash: A, nickname: '甲', hidden: false, created_at: '2026-11-21T10:00:00Z' },
    { device_hash: B, nickname: '乙', hidden: true, created_at: '2026-11-22T10:00:00Z' },
    { device_hash: C, nickname: '丙', hidden: false, created_at: '2026-11-23T01:00:00Z' },
  ],
  now,
);
assert.equal(st.today, '2026-11-23');
assert.equal(st.daily.length, 30);
assert.deepEqual(st.daily.at(-1), { day: '2026-11-23', players: 2, taps: 12, fresh: 0, returning: 2 });
assert.deepEqual(st.daily.at(-2), { day: '2026-11-22', players: 2, taps: 60, fresh: 1, returning: 1 });
assert.deepEqual(st.retention, [
  { day: '2026-11-21', base: 1, back: 1 },
  { day: '2026-11-22', base: 1, back: 1 },
]);
assert.equal(st.kpi.allPlayers, 3 - 1, 'someone who never tapped is not a player');
assert.deepEqual(
  st.board.map((b) => [b.nickname, b.today, b.days, b.hidden]),
  [
    ['乙', 7, 2, true],
    ['甲', 5, 3, false],
  ],
);
assert.deepEqual(
  st.hidden.map((h) => h.nickname),
  ['乙'],
);
console.log('PASS: admin merit stats count players, returning visitors and next-day return');
