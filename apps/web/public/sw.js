/* Lumi service worker: app-shell caching so the installed PWA opens instantly and survives flaky
   networks. API traffic is never cached here — data freshness is handled by the app itself. */
const VERSION = 'lumi-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Hashed build assets, fonts and icons never change under the same URL: cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network first, then the last good copy, then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE))),
    );
  }
});
