import { fromJalali, jalaliMonthLength, toJalali } from './jalali';

/**
 * Supported subset of RFC 5545 RRULE, plus a Jalali-month variant:
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY|JMONTHLY ; INTERVAL=n ; BYDAY=SA,SU,MO,TU,WE,TH,FR ; BYMONTHDAY=n|-1 ; UNTIL=ISO ; COUNT=n
 * JMONTHLY repeats on a Jalali day of month (BYMONTHDAY=-1 means the last day, e.g. 29/30 Esfand).
 */
export interface Recurrence {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'JMONTHLY';
  interval: number;
  byDay?: number[]; // JS getDay(): 0 = Sunday
  byMonthDay?: number;
  until?: Date;
  count?: number;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function parseRRule(rule: string): Recurrence | null {
  const parts = Object.fromEntries(
    rule
      .replace(/^RRULE:/i, '')
      .split(';')
      .filter(Boolean)
      .map((p) => p.split('=') as [string, string]),
  );
  const freq = parts.FREQ as Recurrence['freq'];
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'JMONTHLY'].includes(freq)) return null;
  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  const byDay = parts.BYDAY ? parts.BYDAY.split(',').map((d) => DAYS.indexOf(d)).filter((d) => d >= 0) : undefined;
  const byMonthDay = parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) : undefined;
  return {
    freq,
    interval,
    byDay: byDay?.length ? byDay : undefined,
    byMonthDay,
    until: parts.UNTIL ? new Date(parts.UNTIL) : undefined,
    count: parts.COUNT ? Number(parts.COUNT) : undefined,
  };
}

export function formatRRule(r: Recurrence): string {
  return [
    `FREQ=${r.freq}`,
    r.interval > 1 ? `INTERVAL=${r.interval}` : '',
    r.byDay?.length ? `BYDAY=${r.byDay.map((d) => DAYS[d]).join(',')}` : '',
    r.byMonthDay ? `BYMONTHDAY=${r.byMonthDay}` : '',
    r.until ? `UNTIL=${r.until.toISOString()}` : '',
    r.count ? `COUNT=${r.count}` : '',
  ]
    .filter(Boolean)
    .join(';');
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function withTime(day: Date, time: Date) {
  const x = new Date(day);
  x.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return x;
}

/** Next occurrence strictly after `from`, keeping the time of day of `from`. Returns null when the rule has ended. */
export function nextOccurrence(rule: Recurrence | string, from: Date): Date | null {
  const r = typeof rule === 'string' ? parseRRule(rule) : rule;
  if (!r) return null;
  let next: Date;

  switch (r.freq) {
    case 'DAILY':
      next = addDays(from, r.interval);
      break;
    case 'WEEKLY': {
      if (!r.byDay?.length) {
        next = addDays(from, 7 * r.interval);
        break;
      }
      // Next listed weekday in this week; otherwise the first listed weekday `interval` weeks later.
      const days = [...r.byDay].sort((a, b) => a - b);
      const later = days.find((d) => d > from.getDay());
      next = later !== undefined ? addDays(from, later - from.getDay()) : addDays(from, 7 * r.interval - from.getDay() + days[0]);
      break;
    }
    case 'MONTHLY': {
      const target = r.byMonthDay ?? from.getDate();
      const y = from.getFullYear();
      const m = from.getMonth() + r.interval;
      const len = new Date(y, m + 1, 0).getDate();
      const day = target === -1 ? len : Math.min(target, len);
      next = withTime(new Date(y, m, day), from);
      break;
    }
    case 'JMONTHLY': {
      const j = toJalali(from);
      let jm = j.jm + r.interval;
      let jy = j.jy;
      while (jm > 12) {
        jm -= 12;
        jy++;
      }
      const len = jalaliMonthLength(jy, jm);
      const target = r.byMonthDay ?? j.jd;
      next = withTime(fromJalali(jy, jm, target === -1 ? len : Math.min(target, len)), from);
      break;
    }
    case 'YEARLY':
      next = new Date(from);
      next.setFullYear(from.getFullYear() + r.interval);
      break;
  }
  if (r.until && next > r.until) return null;
  return next;
}
