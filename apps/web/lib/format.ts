import type { Locale } from './i18n';

const DAY = 86400000;

function startOfDay(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Jalali for fa (Intl's persian calendar), Gregorian for en. */
export function formatDate(value: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  const tag = locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US';
  return new Intl.DateTimeFormat(tag, opts).format(new Date(value));
}

export function formatTime(value: string | Date, locale: Locale) {
  return formatDate(value, locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function longToday(locale: Locale) {
  return formatDate(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export type DueTone = 'late' | 'today' | 'soon' | 'later';

/** Relative due label plus a tone used for colouring. */
export function dueInfo(value: string, locale: Locale, t: (k: string, p?: Record<string, number>) => string): { label: string; tone: DueTone } {
  const days = Math.round((startOfDay(new Date(value)).getTime() - startOfDay(new Date()).getTime()) / DAY);
  if (days < -1) return { label: t('common.daysLate', { n: -days }), tone: 'late' };
  if (days === -1) return { label: t('common.yesterday'), tone: 'late' };
  if (days === 0) return { label: t('common.today'), tone: 'today' };
  if (days === 1) return { label: t('common.tomorrow'), tone: 'soon' };
  if (days <= 6) return { label: formatDate(value, locale, { weekday: 'long' }), tone: 'soon' };
  return { label: formatDate(value, locale), tone: 'later' };
}

export function timeAgo(value: string, locale: Locale) {
  const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa' : 'en', { numeric: 'auto' });
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(0, 'minute');
}

/** Converts an ISO string to the value of an <input type="date">. */
export function toDateInput(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromDateInput(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 18, 0, 0).toISOString();
}
