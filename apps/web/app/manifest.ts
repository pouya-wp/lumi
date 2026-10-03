import type { MetadataRoute } from 'next';

/** Installable web app (Android "Install app", iOS "Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/fa/app',
    name: 'Lumi — بیاندکس',
    short_name: 'Lumi',
    description: 'مدیریت کار، برنامه‌ریزی و همکاری تیم بیاندکس',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/fa/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F1F2F4',
    theme_color: '#0B0C0F',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'کارهای من', url: '/fa/app/my-tasks', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'گفتگو', url: '/fa/app/chat', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
