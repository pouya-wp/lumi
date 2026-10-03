import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankBetween } from './rank';

test('keys sort between neighbours', () => {
  const first = rankBetween(null, null);
  const after = rankBetween(first, null);
  const before = rankBetween(null, first);
  const mid = rankBetween(first, after);
  assert.ok(before < first && first < mid && mid < after);
});

test('repeated inserts at the same spot stay ordered', () => {
  let lo = rankBetween(null, null);
  const hi = rankBetween(lo, null);
  for (let i = 0; i < 200; i++) {
    const k = rankBetween(lo, hi);
    assert.ok(lo < k && k < hi, `${lo} < ${k} < ${hi}`);
    lo = k;
  }
  let h = hi;
  for (let i = 0; i < 200; i++) {
    const k = rankBetween(null, h);
    assert.ok(k < h && !k.endsWith('0'));
    h = k;
  }
});
