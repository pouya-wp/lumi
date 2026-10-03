import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd } from './quick-add';

// Saturday 2026-10-03 09:00 local time.
const now = new Date(2026, 9, 3, 9, 0, 0);

test('parses Persian date, time, label, mention and priority', () => {
  const r = parseQuickAdd('فردا ساعت ۱۰ گزارش فروش @علی #مارکتینگ !فوری', now);
  assert.equal(r.title, 'گزارش فروش');
  assert.deepEqual(r.labels, ['مارکتینگ']);
  assert.deepEqual(r.mentions, ['علی']);
  assert.equal(r.priority, 'URGENT');
  assert.equal(r.dueAt?.getDate(), 4);
  assert.equal(r.dueAt?.getHours(), 10);
});

test('weekday names resolve to the next occurrence, including split سه شنبه', () => {
  assert.equal(parseQuickAdd('جلسه سه شنبه', now).dueAt?.getDay(), 2);
  assert.equal(parseQuickAdd('جلسه سه‌شنبه', now).title, 'جلسه');
  // Same weekday as today means next week.
  assert.equal(parseQuickAdd('review saturday', now).dueAt?.getDate(), 10);
});

test('English input with pm time', () => {
  const r = parseQuickAdd('tomorrow at 3pm ship release !high', now);
  assert.equal(r.title, 'ship release');
  assert.equal(r.priority, 'HIGH');
  assert.equal(r.dueAt?.getHours(), 15);
});

test('date without time defaults to end of day; plain text has no due date', () => {
  assert.equal(parseQuickAdd('امروز تمیزکاری', now).dueAt?.getHours(), 23);
  assert.equal(parseQuickAdd('just a task', now).dueAt, undefined);
});
