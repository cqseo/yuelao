import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (p: string) => readFileSync('sites/yuelao/src/' + p, 'utf8');
const engine = source('market/engine/main.js');
const yuelao = source('market/engine/yuelao.js');
const admin = source('routes/admin.tsx');
const track = source('lib/track.ts');
for (const event of ['offer_view', 'checkout_login_required', 'checkout_session_created']) {
  assert.ok(track.includes("  '" + event + "',"), 'Critical conversion milestone must not be throttled: ' + event);
}
assert.ok(engine.includes('const entryRoom = rooms[requested]'), 'Compile only requested room first');
assert.ok(engine.includes('if (entryRoom) renderer.compile(entryRoom.scene, entryRoom.camera)'));
assert.ok(!engine.includes('for (const s of Object.values(rooms)) renderer.compile'), 'No blocking compilation of all rooms');
assert.ok(engine.includes("'market_boot_ready'"), 'Capture anonymous startup duration');
assert.ok(yuelao.includes('data-a="copy-link"'));
assert.ok(yuelao.includes('new URL(`/sign/${stick.id}`, location.origin).href'));
assert.ok(!yuelao.includes('new URL(`/sign/${draftQ}'), 'Never leak question text through links');
assert.ok(yuelao.includes("ui.emit?.('sign_link_copy', { stickId: stick.id })"));
assert.ok(admin.includes("start: '开始求签／抽牌（含历史补全）'"));
assert.ok(admin.includes("'/signs': '百签目录'"));
console.log('PASS: selective room compile, anonymous startup metric, private-safe share link, admin funnel labeling.');
