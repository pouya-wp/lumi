'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type fa from '../messages/fa.json';
import { I18nProvider } from '@/lib/i18n-client';
import type { Locale } from '@/lib/i18n';
import { SessionProvider } from '@/lib/session';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/lib/toast';

export function Providers({ locale, dict, children }: { locale: Locale; dict: typeof fa; children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } } }),
  );
  // Installable PWA: register the app-shell service worker in production builds only.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <I18nProvider locale={locale} dict={dict}>
        <ThemeProvider>
          <ToastProvider>
            <SessionProvider>{children}</SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
