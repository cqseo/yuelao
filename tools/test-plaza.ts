// 廣場同遊的訊息處理：限速、位置夾範圍、白名單、外觀只收短小寫字。不連任何服務。
import assert from 'node:assert/strict';
import {
  nextExpiry,
  type PlazaPeer,
  plazaMessage,
  settleStation,
  stationState,
} from '../sites/yuelao/src/plaza-room-logic';

const peer = (): PlazaPeer => ({
  id: 'abc',
  x: 0,
  z: 23,
  f: 0,
  s: '',
  outfit: 'moon',
  hair: 'bun',
  mAt: 0,
  aAt: 0,
});

let p = peer();
let out = plazaMessage(p, JSON.stringify({ t: 'm', x: 3.456, z: -4, f: 1 }), 1000);
assert.deepEqual(out, { t: 'm', id: 'abc', x: 3.46, z: -4, f: 1 });
assert.equal(plazaMessage(p, JSON.stringify({ t: 'm', x: 5, z: 5, f: 0 }), 1040), null, 'move rate limit');
out = plazaMessage(p, JSON.stringify({ t: 'm', x: 999, z: -999, f: 'x' }), 1200);
assert.deepEqual(out, { t: 'm', id: 'abc', x: 28, z: -26, f: 1 });
console.log('PASS: moves are rate-limited, rounded and clamped to the plaza');

p = peer();
assert.deepEqual(plazaMessage(p, JSON.stringify({ t: 'a', a: 'wave' }), 1000), {
  t: 'a',
  id: 'abc',
  a: 'wave',
});
assert.equal(plazaMessage(p, JSON.stringify({ t: 'a', a: 'bow' }), 1100), null, 'action rate limit');
assert.equal(plazaMessage(p, JSON.stringify({ t: 'a', a: 'dance' }), 3000), null, 'unknown action');
assert.deepEqual(plazaMessage(p, JSON.stringify({ t: 's', s: 'sit' }), 4000), {
  t: 's',
  id: 'abc',
  s: 'sit',
});
assert.equal(p.s, 'sit');
assert.equal(plazaMessage(p, JSON.stringify({ t: 's', s: 'fly' }), 5000), null);
console.log('PASS: actions and poses are whitelisted and rate-limited');

p = peer();
const j = plazaMessage(p, JSON.stringify({ t: 'hi', look: { outfit: '<script>', hair: 'twin' } }), 1000) as {
  p: Record<string, unknown>;
};
assert.equal(j.p.outfit, 'moon');
assert.equal(j.p.hair, 'twin');
assert.ok(!('mAt' in j.p) && !('aAt' in j.p));
assert.equal(plazaMessage(p, 'x'.repeat(300), 9000), null);
assert.equal(plazaMessage(p, '{bad', 9000), null);
assert.equal(plazaMessage(p, 'null', 9000), null);
console.log('PASS: looks are sanitised; oversized and malformed messages are dropped');

// 排隊
{
  const mk = (id: string): PlazaPeer => ({ ...peer(), id });
  const a = mk('a');
  const b = mk('b');
  const c = mk('c');
  const list = [a, b, c];
  assert.deepEqual(plazaMessage(b, JSON.stringify({ t: 'q', st: 'burner' }), 1000), { t: '_q' });
  assert.deepEqual(plazaMessage(a, JSON.stringify({ t: 'q', st: 'burner' }), 1100), { t: '_q' });
  assert.equal(plazaMessage(c, JSON.stringify({ t: 'q', st: 'altar' }), 1100), null, 'unknown station');
  let g = settleStation(list, 'burner', 1200);
  assert.deepEqual(
    g.map((p) => p.id),
    ['b'],
    'first come, first served; burner holds one',
  );
  assert.deepEqual(stationState(list, 'burner'), { t: 'qs', st: 'burner', use: ['b'], queue: ['a'] });
  // b 用完放開，a 接上
  plazaMessage(b, JSON.stringify({ t: 'q', st: '' }), 4000);
  g = settleStation(list, 'burner', 4000);
  assert.deepEqual(
    g.map((p) => p.id),
    ['a'],
  );
  // a 卡住不放：15 秒後自動讓出
  plazaMessage(c, JSON.stringify({ t: 'q', st: 'burner' }), 5000);
  assert.equal(settleStation(list, 'burner', 10_000).length, 0);
  assert.equal(nextExpiry(list), 4000 + 15_000 + 50);
  g = settleStation(list, 'burner', 19_100);
  assert.deepEqual(
    g.map((p) => p.id),
    ['c'],
  );
  assert.equal(a.use, '');
  // 蒲團一次兩人
  const d = mk('d');
  const e = mk('e');
  const f = mk('f');
  const two = [d, e, f];
  for (const [i, p] of two.entries()) plazaMessage(p, JSON.stringify({ t: 'q', st: 'cushion' }), 1000 + i);
  assert.equal(settleStation(two, 'cushion', 2000).length, 2);
  assert.deepEqual(stationState(two, 'cushion').queue, ['f']);
  // 進鋪子（away）就讓位
  plazaMessage(d, JSON.stringify({ t: 's', s: 'away' }), 3000);
  assert.deepEqual(
    settleStation(two, 'cushion', 3000).map((p) => p.id),
    ['f'],
  );
  // 排隊訊息自己限速，不吃動作的額度
  const h = mk('h');
  plazaMessage(h, JSON.stringify({ t: 'a', a: 'wave' }), 1000);
  assert.deepEqual(plazaMessage(h, JSON.stringify({ t: 'q', st: 'burner' }), 1050), { t: '_q' });
  assert.equal(plazaMessage(h, JSON.stringify({ t: 'q', st: '' }), 1100), null);
  console.log('PASS: stations queue first-come-first-served, honour capacity, time out and free on leave');
}
console.log('ALL PLAZA TESTS PASSED');
