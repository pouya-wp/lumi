'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'lumi.theme';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void } | null>(null);

/** Inline script that applies the stored or system theme before paint. */
export const themeScript = `try{var t=localStorage.getItem('${KEY}');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? 'light');
  }, []);

  const set = useCallback((t: Theme) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition) doc.startViewTransition(() => set(next));
    else set(next);
  }, [theme, set]);

  return <ThemeContext.Provider value={{ theme, toggle, set }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
