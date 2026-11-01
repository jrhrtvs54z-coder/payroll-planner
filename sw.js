/* Payroll Planner offline support: the app shell is served from cache and refreshed in the background. */
const VERSION = 'pp-1.0.0';
const FONTS = 'pp-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const fetching = fetch(req).then(async (res) => {
      if (res && res.ok) { const cache = await caches.open(VERSION); await cache.put(req, res.clone()); }
      return res;
    });
    event.waitUntil(fetching.then(() => {}, () => {}));
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      if (cached) return cached;
      try { return await fetching; } catch (e) { return new Response('You’re offline and this page isn’t saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })());
  }
});
