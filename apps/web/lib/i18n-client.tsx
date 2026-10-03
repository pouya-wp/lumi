'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { toFaDigits } from '@lumi/shared';
import type fa from '../messages/fa.json';
import type { Locale } from './i18n';

type Dict = typeof fa;

const I18nContext = createContext<{ locale: Locale; dict: Dict } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

/** Returns `t('section.key', { n: 3 })` with Persian digits applied to numeric params in fa. */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT outside I18nProvider');
  const { locale, dict } = ctx;
  const t = useCallback(
    (key: string, params: Record<string, string | number> = {}) => {
      const value = lookup(dict, key);
      if (typeof value !== 'string') return key;
      return value.replace(/\{(\w+)\}/g, (_, name) => {
        const p = params[name];
        if (p === undefined) return `{${name}}`;
        return typeof p === 'number' ? num(p, locale) : p;
      });
    },
    [dict, locale],
  );
  /** Returns a non-string message value (arrays, objects) as-is. */
  const raw = useCallback(
    <T,>(key: string) => lookup(dict, key) as T,
    [dict],
  );
  return { t, raw, locale, dir: locale === 'fa' ? ('rtl' as const) : ('ltr' as const) };
}

/** Resolves "section.key", where the key itself may contain dots (e.g. "notif.task.assigned"). */
function lookup(dict: Dict, key: string): unknown {
  const [section, ...rest] = key.split('.');
  const node = (dict as Record<string, unknown>)[section] as Record<string, unknown> | undefined;
  if (!node || !rest.length) return node;
  const flat = node[rest.join('.')];
  if (flat !== undefined) return flat;
  return rest.reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], node);
}

export function num(n: number | string, locale: Locale) {
  return locale === 'fa' ? toFaDigits(n) : String(n);
}
