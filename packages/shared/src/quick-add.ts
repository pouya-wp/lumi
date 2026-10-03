import type { Priority } from './enums';
import { toEnDigits } from './digits';

export interface QuickAddResult {
  title: string;
  dueAt?: Date;
  priority?: Priority;
  labels: string[];
  mentions: string[];
}

const PRIORITY_WORDS: Record<string, Priority> = {
  'فوری': 'URGENT',
  'urgent': 'URGENT',
  'بالا': 'HIGH',
  'مهم': 'HIGH',
  'high': 'HIGH',
  'متوسط': 'MEDIUM',
  'medium': 'MEDIUM',
  'کم': 'LOW',
  'low': 'LOW',
};

// JS getDay(): 0 = Sunday.
const WEEKDAYS: Record<string, number> = {
  'یکشنبه': 0, 'یک‌شنبه': 0, 'sunday': 0, 'sun': 0,
  'دوشنبه': 1, 'monday': 1, 'mon': 1,
  'سه‌شنبه': 2, 'سهشنبه': 2, 'tuesday': 2, 'tue': 2,
  'چهارشنبه': 3, 'wednesday': 3, 'wed': 3,
  'پنجشنبه': 4, 'پنج‌شنبه': 4, 'thursday': 4, 'thu': 4,
  'جمعه': 5, 'friday': 5, 'fri': 5,
  'شنبه': 6, 'saturday': 6, 'sat': 6,
};

const RELATIVE_DAYS: Record<string, number> = {
  'امروز': 0, 'today': 0,
  'فردا': 1, 'tomorrow': 1,
  'پس‌فردا': 2, 'پسفردا': 2,
};

const TIME_WORDS = new Set(['ساعت', 'at']);

function parseTime(token: string): { h: number; m: number } | undefined {
  const match = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i.exec(toEnDigits(token));
  if (!match) return undefined;
  let h = Number(match[1]);
  const m = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  if (h > 23 || m > 59) return undefined;
  return { h, m };
}

/**
 * Rule-based parser for quick-add input in Persian or English, e.g.
 * «فردا ساعت ۱۰ گزارش فروش @علی #مارکتینگ !فوری».
 * Runs offline; ambiguous input can be handed to the AI module afterwards.
 */
export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const titleParts: string[] = [];
  const labels: string[] = [];
  const mentions: string[] = [];
  let priority: Priority | undefined;
  let dayOffset: number | undefined;
  let time: { h: number; m: number } | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    const next = tokens[i + 1];

    if (token.startsWith('#') && token.length > 1) {
      labels.push(token.slice(1));
    } else if (token.startsWith('@') && token.length > 1) {
      mentions.push(token.slice(1));
    } else if (token.startsWith('!') && PRIORITY_WORDS[lower.slice(1)]) {
      priority = PRIORITY_WORDS[lower.slice(1)];
    } else if (lower in RELATIVE_DAYS) {
      dayOffset = RELATIVE_DAYS[lower];
    } else if (lower === 'پس' && next === 'فردا') {
      dayOffset = 2;
      i++;
    } else if ((lower === 'سه' || lower === 'پنج' || lower === 'یک') && next === 'شنبه') {
      dayOffset = offsetToWeekday(now, WEEKDAYS[`${lower}‌شنبه`] ?? WEEKDAYS[`${lower}شنبه`]);
      i++;
    } else if (lower in WEEKDAYS) {
      dayOffset = offsetToWeekday(now, WEEKDAYS[lower]);
    } else if (TIME_WORDS.has(lower) && next && parseTime(next)) {
      time = parseTime(next);
      i++;
    } else {
      titleParts.push(token);
    }
  }

  let dueAt: Date | undefined;
  if (dayOffset !== undefined || time) {
    dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + (dayOffset ?? 0));
    if (time) dueAt.setHours(time.h, time.m, 0, 0);
    else dueAt.setHours(23, 59, 0, 0);
  }

  return { title: titleParts.join(' '), dueAt, priority, labels, mentions };
}

function offsetToWeekday(now: Date, weekday: number): number {
  const diff = (weekday - now.getDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}
