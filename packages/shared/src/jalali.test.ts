import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromJalali, isJalaliLeapYear, jalaliMonthLength, toJalali } from './jalali';

test('known conversions', () => {
  assert.deepEqual(toJalali(new Date(2026, 9, 3)), { jy: 1405, jm: 7, jd: 11 });
  assert.deepEqual(toJalali(new Date(2025, 2, 21)), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(toJalali(new Date(2024, 2, 20)), { jy: 1403, jm: 1, jd: 1 });
});

test('round-trips every day for several years', () => {
  for (let d = new Date(2020, 0, 1); d < new Date(2030, 0, 1); d.setDate(d.getDate() + 1)) {
    const j = toJalali(d);
    assert.equal(fromJalali(j.jy, j.jm, j.jd).getTime(), new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  }
});

test('leap years and month lengths', () => {
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(isJalaliLeapYear(1404), false);
  assert.equal(jalaliMonthLength(1403, 12), 30);
  assert.equal(jalaliMonthLength(1404, 12), 29);
  assert.equal(jalaliMonthLength(1404, 1), 31);
});
