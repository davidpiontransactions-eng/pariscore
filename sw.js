/* PariScore Service Worker — shell offline + bypass API/SSE.
   Bump CACHE version à chaque release frontend pour invalider. */
// v10 (2026-05-19) : invalide v9 — embarque fix mobile bug page blanche post
// param filtres (commit 18e5616 + radar BSD Live WS 3f3cc41).
// v11 (2026-05-20) : invalide v10 — embarque fix V3 page blanche (race DCL,
// renderLockedPage, apiFetch 403, hub stuck, drawer Plus) commit e679586 +
// affiliates 504 fix 5a62a5f. Force re-install après les commits intermédiaires
// (cc03453 feat live+bsd) qui ont modifié pariscore.html sans bump.
// v12 (2026-05-20) : invalide v11 — embarque fix V4 apiCache fail-soft
// (7d32234), V5 apiFetch 401 clear token (f06ac0f), V6 tennis-abstract stub
// (131ea49), sécurité blacklist server.js (4e02a6a) et V7 o25-slider=0 + CTA
// reset inline (4da9d0c). Force re-install garantie pour purger anciens
// pariscore.html pre-cached chez users coincés sur page vide.
// v13 (2026-05-20) : invalide v12 — embarque V8 page-matchs « barre du haut »
// compactée (6d725fe). status-bar/team-search/league-hub-banner/fc-head cachés
// mobile, ai-scout/matchday-banner/table-header compact → tableau visible
// above fold.
// v14 (2026-05-20) : invalide v13 — embarque V9 mob-toolbar compactage
// (search 28px + sort-row 24px + chips 24px + mob-quick hidden) → ~70px total.
// v15 (2026-05-20) : invalide v14 — embarque V10 viewport=1280 forçage desktop
// sur mobile (user demande vue desktop pure sur son téléphone). Toutes les
// media queries mobile inactives — site rend comme desktop avec zoom out.
const CACHE = 'pariscore-shell-v15';
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
