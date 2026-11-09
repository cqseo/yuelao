import assert from 'node:assert/strict';
import { COMPANION_STARTERS, guidedReply } from '../sites/yuelao/src/site/companion';
import {
  checkedInToday,
  checkIn,
  dailyReading,
  emptyDailyRecord,
  localDayKey,
  sanitizeDailyRecord,
} from '../sites/yuelao/src/site/daily';

const empty = emptyDailyRecord();
assert.equal(empty.streak, 0);
const day1 = checkIn(empty, '2026-11-09');
assert.deepEqual(day1, { lastDate: '2026-11-09', streak: 1, checkedDates: ['2026-11-09'] });
assert.equal(checkedInToday(day1, '2026-11-09'), true);
assert.deepEqual(checkIn(day1, '2026-11-09'), day1);
const day2 = checkIn(day1, '2026-11-10');
assert.equal(day2.streak, 2);
assert.equal(checkIn(day2, '2026-11-12').streak, 1);
assert.equal(checkIn(day2, '2026-11-08'), day2);
assert.deepEqual(sanitizeDailyRecord({ lastDate: 'not-a-date', streak: 500 }), empty);
assert.equal(localDayKey(new Date(2026, 10, 9)), '2026-11-09');
console.log(
  'PASS: local-day check-in is idempotent, consecutive, resets after a gap and rejects invalid data',
);

const a = dailyReading('2026-11-09', 'connection', 'zh-Hant');
const b = dailyReading('2026-11-09', 'connection', 'zh-Hant');
assert.deepEqual(a, b);
assert.ok(a.verse.length > 0);
assert.ok(a.action.length > 0);
assert.equal(dailyReading('2026-11-09', 'connection', 'zh-Hans').focus, '缘分');
console.log('PASS: daily readings are stable per date/topic and support Traditional/Simplified scripts');

assert.equal(COMPANION_STARTERS.length, 4);
const breakup = guidedReply('分手了我還想挽回他', 'general', 0, 'zh-Hant');
assert.equal(breakup.theme, 'reunion');
assert.ok(breakup.text.includes('放不下'));
const betrayal = guidedReply('我想知道他是不是出轨了', 'general', 0, 'zh-Hans');
assert.equal(betrayal.theme, 'trust');
assert.ok(betrayal.text.includes('猜测不是证据'));
const safety = guidedReply('我现在想自杀', 'general', 1, 'zh-Hans');
assert.equal(safety.theme, 'safety');
assert.ok(safety.text.includes('紧急'));
assert.equal(safety.followups.length, 0);
const followup = guidedReply('我想先照顧自己的感受', 'reunion', 1, 'zh-Hant');
assert.equal(followup.theme, 'self');
console.log(
  'PASS: guided local conversation responds to relationship categories, remembers context, prioritizes safety',
);
console.log('ALL DAILY RETENTION AND GUIDED CHAT TESTS PASSED');
