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
  applicationName: 'Lumi',
  appleWebApp: { capable: true, title: 'Lumi', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  // Next only emits the generic tag; older iOS needs the Apple one to open full-screen from the home screen.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  // Draw under the iPhone notch/home bar; the shell pads itself with safe-area insets.
  viewportFit: 'cover',
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
