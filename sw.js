/* LightIdea — offline cache (service worker).
   Keeps a copy of the app's own files so it opens with no connection after the first visit.
   Strategy: answer from the cache at once, and refresh the cached copy in the background when online
   ("stale-while-revalidate"). An updated app therefore appears the second time it is opened.
   Only this app's own files are handled; nothing is sent anywhere, and project data is not stored here
   (projects live in the browser's local storage). Bump CACHE to force every file to be fetched again. */
const CACHE = 'lightidea-v2';
const SHELL = ['./', 'index.html', 'LightIdea.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png', 'screenshots/plan.jpg', 'screenshots/room-3d.jpg'];

self.addEventListener('install', event => {
  // Cache each file on its own so that one missing file does not stop the rest.
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;      // leave everything else to the browser
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { event.waitUntil(fresh); return cached; }
    const res = await fresh;
    if (res) return res;
    // offline and not cached: for a page request fall back to the app itself
    if (req.mode === 'navigate') { const app = await cache.match('LightIdea.html'); if (app) return app; }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }));
});
