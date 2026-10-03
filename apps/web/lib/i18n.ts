import fa from '../messages/fa.json';
import en from '../messages/en.json';

export const locales = ['fa', 'en'] as const;
export type Locale = (typeof locales)[number];

const dictionaries = { fa, en } satisfies Record<Locale, typeof fa>;

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export const dir = (locale: Locale) => (locale === 'fa' ? 'rtl' : 'ltr');
