// Store Manager service worker: keeps the app files fast and lets the app install on the phone.
// Business data is never cached here (it always comes live from the database).
const CACHE = 'store-manager-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // database / API calls go straight to the network

  // Pages: network first (so a new version shows up), cached copy when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match(self.registration.scope)))
    );
    return;
  }

  // Built files (hashed names), icons, fonts: cache first
  if (url.pathname.includes('/_next/static/') || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
