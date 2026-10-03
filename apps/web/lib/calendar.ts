import { fromJalali, JALALI_MONTHS, jalaliMonthLength, toJalali } from '@lumi/shared';
import type { Locale } from './i18n';

export interface MonthRef {
  year: number;
  month: number; // 1-based, in the locale's calendar
}

const DAY = 86400000;

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);

/** Locale week start: Saturday in Iran, Sunday otherwise. */
export const weekStartDay = (locale: Locale) => (locale === 'fa' ? 6 : 0);

export function startOfWeek(d: Date, locale: Locale) {
  const diff = (d.getDay() - weekStartDay(locale) + 7) % 7;
  return startOfDay(addDays(d, -diff));
}

export function monthOf(d: Date, locale: Locale): MonthRef {
  if (locale === 'fa') {
    const j = toJalali(d);
    return { year: j.jy, month: j.jm };
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const m = month - 1 + delta;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
}

export function firstOfMonth({ year, month }: MonthRef, locale: Locale) {
  return locale === 'fa' ? fromJalali(year, month, 1) : new Date(year, month - 1, 1);
}

export function monthLength({ year, month }: MonthRef, locale: Locale) {
  return locale === 'fa' ? jalaliMonthLength(year, month) : new Date(year, month, 0).getDate();
}

/** 6×7 grid of days covering the month, starting on the locale's week start. */
export function monthGrid(ref: MonthRef, locale: Locale) {
  const start = startOfWeek(firstOfMonth(ref, locale), locale);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function monthTitle(ref: MonthRef, locale: Locale) {
  if (locale === 'fa') return `${JALALI_MONTHS[ref.month - 1]} ${ref.year}`;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(ref.year, ref.month - 1, 1));
}

/** Day of month number in the locale's calendar. */
export const dayNumber = (d: Date, locale: Locale) => (locale === 'fa' ? toJalali(d).jd : d.getDate());

export function weekdayNames(locale: Locale, style: 'short' | 'narrow' = 'short') {
  const start = startOfWeek(new Date(), locale);
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { weekday: style }).format(addDays(start, i)),
  );
}

/** Minutes → "۲س ۳۰د" / "2h 30m". */
export function formatMinutes(min: number, locale: Locale) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const fa = locale === 'fa';
  const parts = [h ? `${h}${fa ? ' س' : 'h'}` : '', m || !h ? `${m}${fa ? ' د' : 'm'}` : ''].filter(Boolean).join(fa ? '، ' : ' ');
  return fa ? parts.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : parts;
}
