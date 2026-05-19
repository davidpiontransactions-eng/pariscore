/* PariScore Service Worker — shell offline + bypass API/SSE.
   Bump CACHE version à chaque release frontend pour invalider. */
// v10 (2026-05-19) : invalide v9 — embarque fix mobile bug page blanche post
// param filtres (commit 18e5616 + radar BSD Live WS 3f3cc41).
// v11 (2026-05-20) : invalide v10 — embarque fix V3 page blanche (race DCL,
// renderLockedPage, apiFetch 403, hub stuck, drawer Plus) commit e679586 +
// affiliates 504 fix 5a62a5f. Force re-install après les commits intermédiaires
// (cc03453 feat live+bsd) qui ont modifié pariscore.html sans bump.
const CACHE = 'pariscore-shell-v11';
const SHELL = [
  '/',
  '/pariscore.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // API + SSE + flux live : toujours réseau, jamais de cache (données fraîches obligatoires)
  if (url.pathname.startsWith('/api/')) return;

  // Navigation (HTML) : réseau d'abord, fallback shell offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/pariscore.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Assets statiques : cache d'abord, sinon réseau (et on met en cache)
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
