import { fromJalali, toJalali } from './jalali';

/**
 * Iran's official holidays fixed in the Solar Hijri calendar. Lunar (Hijri) holidays move every year
 * and are not included; Fridays are weekly holidays.
 */
const SOLAR: { m: number; d: number; fa: string; en: string }[] = [
  { m: 1, d: 1, fa: 'عید نوروز', en: 'Nowruz' },
  { m: 1, d: 2, fa: 'عید نوروز', en: 'Nowruz' },
  { m: 1, d: 3, fa: 'عید نوروز', en: 'Nowruz' },
  { m: 1, d: 4, fa: 'عید نوروز', en: 'Nowruz' },
  { m: 1, d: 12, fa: 'روز جمهوری اسلامی', en: 'Islamic Republic Day' },
  { m: 1, d: 13, fa: 'روز طبیعت', en: 'Nature Day' },
  { m: 3, d: 14, fa: 'رحلت امام خمینی', en: 'Khomeini Memorial' },
  { m: 3, d: 15, fa: 'قیام ۱۵ خرداد', en: '15 Khordad Uprising' },
  { m: 11, d: 22, fa: 'پیروزی انقلاب', en: 'Revolution Day' },
  { m: 12, d: 29, fa: 'ملی شدن صنعت نفت', en: 'Oil Nationalization Day' },
];

export function holidayOn(date: Date, locale: 'fa' | 'en' = 'fa'): string | null {
  const { jm, jd } = toJalali(date);
  const h = SOLAR.find((x) => x.m === jm && x.d === jd);
  return h ? h[locale] : null;
}

export const isWeekend = (date: Date) => date.getDay() === 5;

export function solarHolidays(jy: number) {
  return SOLAR.map((h) => ({ date: fromJalali(jy, h.m, h.d), fa: h.fa, en: h.en }));
}
