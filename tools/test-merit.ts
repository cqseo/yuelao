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
