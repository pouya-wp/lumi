import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { dir, getDictionary, isLocale, locales } from '@/lib/i18n';
import { themeScript } from '@/lib/theme';
import '../globals.css';

const meem = localFont({
  src: [
    { path: '../fonts/Meem-Light.ttf', weight: '300' },
    { path: '../fonts/Meem-Regular.ttf', weight: '400' },
    { path: '../fonts/Meem-Medium.ttf', weight: '500' },
    { path: '../fonts/Meem-DemiBold.ttf', weight: '600' },
    { path: '../fonts/Meem-Bold.ttf', weight: '700' },
  ],
  variable: '--font-meem',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Lumi — by Beyondex', template: '%s · Lumi' },
  description: 'Team task management, planning and collaboration.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1F2F4' },
    { media: '(prefers-color-scheme: dark)', color: '#07080C' },
  ],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={dir(locale)} className={meem.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="grain min-h-dvh">
        <Providers locale={locale} dict={getDictionary(locale)}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
