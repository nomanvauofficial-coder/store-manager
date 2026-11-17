// Store Manager service worker.
// 1) On install it saves ALL app files on the phone, so the app opens and works (scanner, invoice, PDF, Excel) with no internet.
// 2) Business data is never cached here: it comes live from the database, or from the phone's own copy (see offline.ts).
const VERSION = '__BUILD_ID__'; // replaced at build time, so every new version installs fresh
const PRE = `sm-pre-${VERSION}`;
const RUNTIME = 'sm-runtime';

async function precache() {
  const cache = await caches.open(PRE);
  let files = [];
  try {
    const res = await fetch(new URL('precache.json', self.registration.scope), { cache: 'no-cache' });
    files = (await res.json()).files || [];
  } catch { /* no list: the pages visited are still saved as they load */ }
  const urls = [self.registration.scope, ...files.map(f => new URL(f, self.registration.scope).href)];
  await Promise.allSettled(urls.map(u => cache.add(new Request(u, { cache: 'reload' }))));
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== PRE && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(RUNTIME).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // database / API calls go straight to the network

  // Pages: network first (new versions show up at once); if the network is down or very slow, the saved copy
  if (req.mode === 'navigate') {
    event.respondWith(
      new Promise(resolve => {
        const timer = setTimeout(() => {
          caches.match(req, { ignoreSearch: true }).then(r => r && resolve(r));
        }, 4000);
        fetch(req)
          .then(res => { clearTimeout(timer); resolve(put(req, res)); })
          .catch(() => {
            clearTimeout(timer);
            caches.match(req, { ignoreSearch: true })
              .then(r => r || caches.match(self.registration.scope))
              .then(r => resolve(r || Response.error()));
          });
      })
    );
    return;
  }

  // Built files (hashed names), icons, fonts: saved copy first
  if (url.pathname.includes('/_next/static/') || /\.(png|svg|webmanifest|woff2?|json)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => put(req, res)))
    );
  }
});
