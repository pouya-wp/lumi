import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRRule, nextOccurrence, parseRRule } from './recurrence';
import { toJalali } from './jalali';

const sat = new Date(2026, 9, 3, 10, 0); // Saturday

test('daily and weekly intervals', () => {
  assert.equal(nextOccurrence('FREQ=DAILY', sat)!.getDate(), 4);
  assert.equal(nextOccurrence('FREQ=WEEKLY;INTERVAL=2', sat)!.getDate(), 17);
});

test('weekly BYDAY picks the next listed weekday', () => {
  // Sat → next listed after Sat in week is none → first day (MO) of the next week.
  const n = nextOccurrence('FREQ=WEEKLY;BYDAY=MO,WE', sat)!;
  assert.equal(n.getDay(), 1);
  assert.equal(n.getDate(), 5);
  const tue = new Date(2026, 9, 6, 9);
  assert.equal(nextOccurrence('FREQ=WEEKLY;BYDAY=MO,WE', tue)!.getDay(), 3);
  assert.equal(nextOccurrence('FREQ=WEEKLY;BYDAY=MO,WE', tue)!.getHours(), 9);
});

test('monthly clamps and supports last day', () => {
  const jan31 = new Date(2026, 0, 31, 8);
  assert.equal(nextOccurrence('FREQ=MONTHLY', jan31)!.getDate(), 28);
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=-1', new Date(2026, 1, 28))!.getDate(), 31);
});

test('Jalali monthly: last day of Esfand in a common year is 29', () => {
  const bahmanEnd = new Date(2026, 1, 19); // 30 Bahman 1404
  const next = nextOccurrence('FREQ=JMONTHLY;BYMONTHDAY=-1', bahmanEnd)!;
  assert.deepEqual(toJalali(next), { jy: 1404, jm: 12, jd: 29 });
});

test('until ends the series; round-trip format', () => {
  assert.equal(nextOccurrence(`FREQ=DAILY;UNTIL=${new Date(2026, 9, 3, 23).toISOString()}`, sat), null);
  const r = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,MO')!;
  assert.equal(formatRRule(r), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SA'.replace('MO,SA', 'SA,MO'));
});
