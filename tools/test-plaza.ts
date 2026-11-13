// 廣場同遊的訊息處理：限速、位置夾範圍、白名單、外觀只收短小寫字。不連任何服務。
import assert from 'node:assert/strict';
import { type PlazaPeer, plazaMessage } from '../sites/yuelao/src/plaza-room-logic';

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
console.log('ALL PLAZA TESTS PASSED');
