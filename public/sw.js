// Service Worker — SetPoint PWA
// Network-first for navigations + API, cache-first for static assets only.
// Offline fallback. + Web Push handler for value-bet alerts (PUSH-1).
//
// HOTFIX 2026-07-20: bump v4 → v5 et navigations passées en network-first.
// Avant, le HTML de navigation était servi cache-first → les nouveaux
// déploiements frontend n'apparaissaient jamais chez les visiteurs ayant
// déjà un SW installé. Désormais les navigations vont toujours au réseau
// en premier (et tombent sur le cache `/` seulement hors-ligne).

const CACHE_VERSION = "v5";
const STATIC_CACHE = `setpoint-static-${CACHE_VERSION}`;
const API_CACHE = `setpoint-api-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests (Next.js static, third-party)
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first (jamais cache-first sur le shell app).
  // On ne met PAS "/" dans STATIC_ASSETS pour éviter qu'il soit pré-caché
  // en cache-first. La stratégie ci-dessous va au réseau en premier et ne
  // sert le cache que si le réseau échoue (offline).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // API requests: network-first, fall back to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && request.type === "basic") {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    })
  );
});

// Allow page to trigger skipWaiting via postMessage
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ─────────────────────────────────────────────────────────────────────────────
// Web Push — value-bet alerts (PUSH-1)
// ─────────────────────────────────────────────────────────────────────────────

// Payload shape (sent by /api/push/test):
// { matchId, playerA, playerB, probA, bookmaker, decimalA, impliedProbA, surface }

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    // Fallback: treat as plain text
    payload = { playerA: event.data ? event.data.text() : "" };
  }

  const player = payload.playerA || "—";
  const modelProb = typeof payload.probA === "number" ? payload.probA : 0;
  const bookmaker = payload.bookmaker || "—";
  const impliedProb =
    typeof payload.impliedProbA === "number" ? payload.impliedProbA : 0;
  const decimal = typeof payload.decimalA === "number" ? payload.decimalA : 0;

  const title = "Value bet détecté";
  const body = `${player} : modèle ${modelProb}% vs ${bookmaker} ${impliedProb}% @ ${decimal}`;

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `value-bet-${payload.matchId ?? "x"}`,
    renotify: true,
    data: {
      matchId: payload.matchId ?? null,
      url: "/",
    },
    actions: [
      { action: "view", title: "Voir le match" },
      { action: "ignore", title: "Ignorer" },
    ],
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // "Ignorer" → just close, do nothing
  if (event.action === "ignore") return;

  // "Voir le match" or body click → focus existing window or open new one to "/"
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Try to focus an already-open window on the same origin
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin)) {
          try {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }
            await client.postMessage?.({
              type: "PUSH_NOTIFICATION_CLICK",
              matchId: event.notification.data?.matchId ?? null,
            });
            return;
          } catch {
            // fall through to openWindow
          }
        }
      }

      // No existing window — open a new one
      try {
        await self.clients.openWindow(targetUrl);
      } catch {
        // ignore
      }
    })()
  );
});
