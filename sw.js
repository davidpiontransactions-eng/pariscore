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
// v16 (2026-05-20) : invalide v15 — embarque V11 initial-scale=0.3 + pinch
// zoom 0.2→2.0. Desktop 1280px scalé pour rentrer largeur téléphone.
// v17 (2026-05-20) : invalide v16 — embarque V12 éclaircissement tableau foot
// (#vb-body td) : #11161b → #232a33, hover #1a2127 → #2d3540, override dark
// trading linear-gradient #15191d/#0f1216 → #232a33/#1c222b.
// v18 (2026-05-20) : invalide v17 — V12 étendu cartes mobile .mc : background
// var(--bg) → #232a33, alignement cross-vue (mobile natif + viewport=1280).
// v19 (2026-05-20) : invalide v18 — V13 palette tableau encore plus claire :
// #232a33 → #3a4756 (slate moyen), hover #2d3540 → #4a5666, dark trading
// gradient bottom #1c222b → #2f3a47.
// v20 (2026-05-20) : invalide v19 — V14 encore + clair : #3a4756 → #525c6b
// (slate clair lisible), hover #4a5666 → #646e7d, gradient #2f3a47 → #3d4a5a.
// v21 (2026-05-20) : invalide v20 — V15 EDITORIAL_GRAPHITE warm-graphite après
// audit Design Critique + Research concurrentielle (L'Équipe + Flashscore +
// Marca). Pivot slate-froid → warm-graphite : #525c6b → #6b6864 (hue 30°,
// L* 42), hover #646e7d → #7a7771, gradient #3d4a5a → #4a4844. Rouge L'Équipe
// chante au lieu de vibrer.
// v22 (2026-05-20) : invalide v21 — V16 user request « j'aime pas restes en
// blanc c'est tout ». Reset complet light theme : #6b6864 → #ffffff,
// #7a7771 → #f7f7f7, #4a4844 → #e4e4e4. Blocs « Élite Dark Trading »
// neutralisés via media query min-width:99999px (jamais match).
// v23 (2026-05-21) : invalide v22 — bd ParisScorebis-npp fix icon.svg
// invalide. Refonte SVG sans deps fonts externes (Syne, DM Mono), paths
// manuels P/S + PARI label geometric shapes. Manifest purpose any+maskable.
// v24 (2026-05-21) : invalide v23 — Design V2.0 complet (v12.0-v12.4) +
// Phase 4 polish scrollbar + Phase 3 Historique migration + sécurité fix
// BLOCKED_FILES + QA fixes + momentum La Liga + ETL Historique scaffold.
// v25 (2026-05-21) : invalide v24 — bd nwk6 push event handler + notificationclick
// (Phase 1 headerless + Phase 2 payload AES-128-GCM chiffre {title,body,url,icon}).
// v26 (2026-05-23) : invalide v25 — Refonte UI navbar (16 nav-icon-3d SVG
// glassmorphic translucent) + refonte archi Roland Garros (route pure-read
// JSON statique + cron PM2 + worker_threads + bsdTennisFetch hardening) +
// regex _rgRoundOrder format BSD "Round of 128". Force re-install pour
// purger anciens pariscore.html sans <img class="nav-icon-3d"> chez users.
// v27 (2026-05-23) : invalide v26 — Implémentation cascade hybride Smart
// Fallback : CDN Microsoft Fluent Emoji 3D (jsDelivr MIT) -> SVG local
// glassmorphic -> emoji unicode <span>. Bullet-proof contre 404 CDN/local.
// Ajout CSS .nav-icon-emoji pour fallback ultime. Force re-install pour
// purger HTML précédent sans onerror cascade chez users.
// v28 (2026-05-23) : invalide v27 — Ajout badge hero RG custom PariScore
// (assets/icons/rg-badge-hero.svg, 200x200) dans H1 onglet Roland Garros.
// Design custom DIY (PS monogram + clay terracotta ring + gold edge + tennis
// ball accent), zero trademark FFT. Hover rotate -5deg scale 1.05.
// v29 (2026-05-23) : invalide v28 — Fiche détaillée joueur RG slide-over
// (panneau latéral droite desktop + bottom-sheet mobile). Glassmorphism
// backdrop blur 8px + brand palette emerald/clay/gold/cream. Skeleton instant
// depuis embedded bracket data + lazy fetch enrichment L5 clay via nouvelle
// route /api/v1/tennis/rg-player/:id (cache SQLite 6h). Player lines bracket
// clickables (data-rg-player encoded JSON + delegation listener + a11y ESC/
// Enter/Space). Server enrichi payload bracket (short_name, country_name,
// gender, current_ranking propagés depuis BSD raw).
// v30 (2026-05-23) : invalide v29 — Fix fiche détaillée joueur RG : ajout
// click handler aux contender cards (top 16 favoris) et au bracket. Delegation
// listener étendue à #rg-contenders + #rg-bracket. CSS .rg-contender.rg-player-
// clickable hover translateY-2 + shadow brand. data-rg-player encode JSON sur
// chaque card top contender.
// v31 (2026-05-23) : invalide v30 — V2 RG complete : Pilier 1 (fatigue
// universelle round-based dans Monte Carlo Worker + fallback inline),
// Pilier 2 (Value Heatmap odds devig Shin-Hurley + edge tier + filter
// chips bracket), Pilier 3 (Live Momentum DOM patcher + SSE consumer
// + server SSE broadcaster polling BSD /matches/live/ toutes les 30s).
// v32 (2026-05-24) : bd rcmw C5 App Shell strategies refactor. Stale-while-
// revalidate pour HTML (boot <200ms meme offline + refresh background),
// cache-first elargi assets/icons/svg/fonts, network-only API conserve,
// navigation preload active pour TTFB optimal. Shell elargi avec icons.
// Cache layers separes pour granular invalidation : shell + assets + runtime.
// v34 (2026-06-04) : invalide v33 — CRITIQUE post-extraction JS (commit 1967c58
// "extract 23k lines JS from HTML -> pariscore.js"). showPage() + TOUS les
// handlers nav ont quitte le HTML inline pour /pariscore.js. v33 servait le HTML
// et le JS en stale-while-revalidate INDEPENDAMMENT -> les users PWA recevaient
// une paire html<->js DESYNCHRONISEE (HTML redesign sans showPage inline + JS
// stale ou pas encore en cache) -> "showPage is not defined" -> 100% des onglets
// nav morts au clic, alors que le design CSS restait parfait.
// FIX racine : (1) /pariscore.js ajoute au SHELL precache (paire atomique HTML+JS).
//   (2) navigation HTML + /pariscore.js passent en NETWORK-FIRST (avec navigation
//   preload) -> paire coherente fraiche garantie online ; cache = fallback offline
//   seulement. SWR conserve pour manifest / sw.js / autres runtime.
// v35 (2026-06-06) : invalide v34 — bd 4n12 PWA icon gap. Ajout set PNG raster
// (icon-192/512 "any", icon-512-maskable Android adaptive, apple-touch-icon 180
// iOS). manifest icons[] enrichi + apple-touch link PNG. Precache PNGs + bump
// pour purger manifest v34 (1 seul icon.svg) chez users installes.
// v37 (2026-06-25) : invalide v36 — fix syntaxe fatale pariscore.js ligne 24242
// 'PAGE GUIDE / DOCUMENTATION' (manquait // commentaire). Sans ce fix, parser JS
// reject tout le fichier → showPage non défini → navbar liens cassés. Bump cache
// busting pariscore.js?v=250625-1 pour forcer reload navigateurs.
// v38 (2026-06-25) : HOTFIX cards Top Matchs Tennis — restructuration 3 zones
// (header/body/footer) au lieu de grid 2 col sur .tn-t10-card qui écrasait les
// 12+ enfants en zigzag. Bump pariscore.js?v=250625-2.
// v50 (2026-06-25) : Sprint 1 audit MATCHS — 12 bugs HIGH fixes
// v51 (2026-06-26) : Sprint 2 audit MATCHS — 28 bugs MED fixes
// v52 (2026-06-26) : Sprint 3 audit MATCHS — 31 bugs LOW fixes
// v53 (2026-06-26) : NEW filtres MATCHS — Timing (live/1h/2h/4h/6h) + Étoiles (1-4) + masquer terminés
// v54 (2026-06-26) : BUGFIX tourHeader — exclure player/doubles-team du regex + validation frontend
// v55 (2026-06-26) : BUGFIX tourHeader v2 — regex corrigée pour structure HTML réelle (slugs avec / + spans avant texte)
// v56 (2026-06-26) : FIX playerPhoto (suppression SVG cassé → span initiales simple) + densité tableau augmentée
// v57 (2026-06-26) : NEW player photos via Wikipedia REST API + cache SQLite 24h + fallback SVG coloré
// v58 (2026-06-26) : BUGFIX 'BR">' parasite — event delegation pour onerror (plus de quotes inline)
// v59 (2026-06-26) : Photos via ui-avatars.com (pattern existant) + heure locale browser (plus UTC)
// v60 (2026-06-26) : Fiche joueur redesignée — photo plus grande (80px) + barres progression (rank/elo/W-L%) + pills L5
// v61 (2026-06-26) : BUGFIX photos — utilise _lookupTennisElo (table tennis_players_elo) au lieu de tennis_players fantôme
// v62 (2026-06-26) : Route /player-photo?name= proxy binaire (plus de 302 data:URI cassé) + fallback SVG initiales coloré
// v63 (2026-06-26) : BUGFIX photos — exempter /player-photo et /player-profile du gate Pro Tennis (sinon 403 JSON)
// v64 (2026-06-26) : NEW bouton capsule 'Prematch' par ligne + modale prematch enrichie (style card Top 10)
// v65 (2026-06-26) : BUGFIX _localTime global (pas scope local) + retire emoji ⚡ du bouton Prematch
// v66 (2026-06-26) : Prematch = clone de la modale Top 10 (route /match-by-players pour trouver BSD)
// v67 (2026-06-27) : Prematch = card COMPLÈTE style Top 10 avec double routing BSD/TE + P_BETS + serve_dominance + edge
// v68 (2026-06-27) : FIX routing BSD — m.player1 est un objet {name:...} pas une string + fallback __tennisVBWarm() + clone 100% Top 10
const CACHE_VERSION = 'v68';
const CACHE_SHELL = 'pariscore-shell-' + CACHE_VERSION;
const CACHE_ASSETS = 'pariscore-assets-' + CACHE_VERSION;
const CACHE_RUNTIME = 'pariscore-runtime-' + CACHE_VERSION;

const SHELL = [
  '/',
  '/pariscore.html',
  '/pariscore.js',
  '/manifest.json',
  '/icon.svg'
];

// Pre-cache icons + assets critiques (best-effort, missing files OK)
const ASSETS_PREFETCH = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/assets/icons/3d-football.svg',
  '/assets/icons/3d-tennis.svg',
  '/assets/icons/3d-trophy.svg',
  '/assets/icons/3d-strategy.svg',
  '/assets/icons/3d-fire.svg',
  '/assets/icons/3d-ticket.svg',
  '/assets/icons/3d-book.svg',
  '/assets/icons/3d-shield.svg',
  '/assets/icons/3d-compare.svg',
  '/assets/icons/3d-brain.svg',
  '/assets/icons/3d-chart.svg',
  '/assets/icons/3d-bell.svg',
  '/assets/icons/3d-clock.svg',
  '/assets/icons/3d-home.svg',
  '/assets/icons/3d-crown.svg',
  '/assets/icons/3d-settings.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_SHELL).then((c) => c.addAll(SHELL)).catch(() => {}),
      caches.open(CACHE_ASSETS).then((c) => {
        // addAll fails atomic si UN asset miss — utilise add() best-effort par asset
        return Promise.allSettled(ASSETS_PREFETCH.map((u) => c.add(u).catch(() => {})));
      }).catch(() => {})
    ])
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // Purge old caches
      caches.keys().then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_SHELL && k !== CACHE_ASSETS && k !== CACHE_RUNTIME && k.startsWith('pariscore-'))
            .map((k) => caches.delete(k))
      )),
      // Navigation Preload (TTFB optimization — server response ready avant SW resolve)
      self.registration.navigationPreload && self.registration.navigationPreload.enable()
    ]).then(() => self.clients.claim())
  );
});

// Helpers : strategies cache
async function networkFirst(req, cache) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type === 'basic') {
      const clone = fresh.clone();
      caches.open(cache).then((c) => c.put(req, clone)).catch(() => {});
    }
    return fresh;
  } catch (_) {
    return (await caches.match(req)) || (await caches.match('/pariscore.html'));
  }
}

async function cacheFirst(req, cache) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type === 'basic') {
      const clone = fresh.clone();
      caches.open(cache).then((c) => c.put(req, clone)).catch(() => {});
    }
    return fresh;
  } catch (_) {
    return cached;
  }
}

async function staleWhileRevalidate(req, cache, preloadResponse) {
  const cached = await caches.match(req);
  const fetchPromise = (preloadResponse ? Promise.resolve(preloadResponse) : fetch(req)).then((fresh) => {
    if (fresh && fresh.status === 200 && fresh.type === 'basic') {
      const clone = fresh.clone();
      caches.open(cache).then((c) => c.put(req, clone)).catch(() => {});
    }
    return fresh;
  }).catch(() => cached);
  // Si cache hit : retourne immediat (boot <200ms) + refresh background
  // Si cache miss : await network response
  return cached || fetchPromise;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // API + SSE : network-only, jamais cache (donnees fraiches obligatoires)
  if (url.pathname.startsWith('/api/')) return;

  // Navigation HTML : NETWORK-FIRST (paire coherente avec /pariscore.js).
  // navigation preload -> TTFB proche du SWR ; cache = fallback offline uniquement.
  // (SWR retire ici : il servait un HTML stale desynchronise du JS, cf. v34.)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const preload = await e.preloadResponse;
        const fresh = preload || await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const clone = fresh.clone();
          caches.open(CACHE_SHELL).then((c) => c.put('/pariscore.html', clone)).catch(() => {});
        }
        return fresh;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('/pariscore.html')) || (await caches.match('/'));
      }
    })());
    return;
  }

  // App JS : NETWORK-FIRST aussi -> jamais servi stale isolement du HTML.
  // (.js n'est pas dans isStaticAsset ; sans cette branche il tombait en SWR.)
  if (url.pathname === '/pariscore.js') {
    e.respondWith(networkFirst(req, CACHE_SHELL));
    return;
  }

  // Assets icons/svg/fonts : cache-first (immutable rarement change)
  const isStaticAsset = /\.(svg|png|jpg|jpeg|webp|ico|woff2?|ttf|eot)$/i.test(url.pathname);
  if (isStaticAsset) {
    e.respondWith(cacheFirst(req, CACHE_ASSETS));
    return;
  }

  // Manifest + sw.js + autres : stale-while-revalidate runtime
  e.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME));
});

// bd nwk6 — Push notification handler. Accepte payload JSON {title, body, url, icon}
// (chiffre AES-128-GCM cote serveur) ou fallback générique si headerless.
self.addEventListener('push', (e) => {
  let payload = { title: 'PariScore', body: 'Nouvelle alerte value bet', url: '/', icon: '/icon.svg' };
  try {
    if (e.data) {
      const txt = e.data.text();
      if (txt) {
        try { Object.assign(payload, JSON.parse(txt)); }
        catch (_) { payload.body = txt; }
      }
    }
  } catch (_) { /* fallback to defaults */ }
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon.svg',
      badge: payload.badge || '/icon.svg',
      tag: payload.tag || 'pariscore-alert',
      data: { url: payload.url || '/' },
      renotify: !!payload.renotify,
      requireInteraction: !!payload.requireInteraction,
    })
  );
});

// bd nwk6 — Clic sur notification → focus tab existant ou ouvre nouvelle
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(target) && 'focus' in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
