import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEnDigits, toFaDigits } from './digits';

test('toFaDigits', () => {
  assert.equal(toFaDigits(1405), '۱۴۰۵');
});

test('toEnDigits round-trips and handles Arabic-Indic', () => {
  assert.equal(toEnDigits('۱۴۰۵'), '1405');
  assert.equal(toEnDigits('٣٤'), '34');
});
