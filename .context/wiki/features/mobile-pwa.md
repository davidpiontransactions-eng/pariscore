---
type: feature
slug: mobile-pwa
title: Mobile PariScore (Parieur Nomade) + PWA
status: active-phase5-7-livré-2-restants
tags: [feature, mobile, pwa, push, ux, responsive]
updated: 2026-05-22
sources: ["pariscore.html", "sw.js", "manifest.json", "bd e7l + nwk6"]
xref: [[alertes-telegram]], [[tableau-foot]], [[visuel-mobile-flashscore-equipe]]
bd: [e7l, nwk6]
---

# Mobile PariScore (Parieur Nomade) + PWA

**TL;DR:** Version mobile dédiée — bottom nav + cartes responsive + PWA install + push notifications. Phase 5/7 PWA install + push livrés (v12.19 + v12.21). Phase 1/2 nav + cartes ouvertes. Bd `e7l`.

## Phases roadmap (7 total)

| Phase | Status | Scope |
|---|---|---|
| 1 | ⏳ open | Bottom nav fixed (Matchs/Mes Paris/Insights/Profil) |
| 2 | ⏳ open | Cartes responsive (vs tableau desktop 1400px) |
| 3 | ✅ livré | Filter pills mobile compacts |
| 4 | ✅ livré | Touch optimizations (swipe, tap targets) |
| **5** | ✅ v12.19 | PWA manifest + install banner |
| **6** | ✅ v12.21 | Service worker offline cache |
| **7** | ✅ v12.49 (bd nwk6) | Push Notifications backend VAPID ES256 zero-dep |

## Style visuel mobile (memory user)

cf. `feedback_visuel_mobile.md`:
> UI mobile = **Flashscore × L'Équipe** — typographique, rouge `#E2001A`, variables thème
> **ZÉRO emoji**, pas de data-terminal dark

Distinct du desktop dark theme. Mobile = clean white minimaliste éditorial.

## PWA composants

**manifest.json:**
```json
{
  "name": "PariScore",
  "short_name": "PariScore",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#E2001A",
  "background_color": "#FFFFFF",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**sw.js** service worker:
- Cache stratégie: stale-while-revalidate sur assets statiques
- Network-first sur `/api/v1/*`
- Background sync queue (TODO)

## Push Notifications (Phase 7 bd nwk6)

VAPID ES256 keypair généré crypto natif (zero-dep). 4 routes serveur:
- `POST /api/v1/push/subscribe` — store endpoint + keys user
- `POST /api/v1/push/unsubscribe`
- `POST /api/v1/push/test` — envoi notif test
- Auto-cleanup HTTP 410/404 (subscription invalid → remove DB)

Table `webhook_subscriptions`:
```sql
CREATE TABLE webhook_subscriptions (
  user_id INTEGER,
  endpoint TEXT,
  keys_p256dh TEXT,
  keys_auth TEXT,
  created_at INTEGER,
  PRIMARY KEY (user_id, endpoint)
);
```

## Bug fixes notables session

- **bd `u8w9` ✅ closed** — Mobile page blanche filtres iOS Safari + Chrome Android (presets selectors + apiFetch 401 token clear)

## Code locations

- `pariscore.html` — viewport meta + media queries
- `manifest.json` racine
- `sw.js` racine
- `server.js` push routes + VAPID generation
- `webhook_subscriptions` table

## Restant Phase 1+2 (bd e7l)

Critical UX — sans bottom nav mobile, navigation desktop modal-style cassée petits écrans. À prioriser après MVP Pro launch.

## Related

- [[alertes-telegram]] — Channel alternative push (à créer wave 3)
- [[tableau-foot]] — Adaptation responsive cartes
- visuel-mobile-flashscore-equipe — memory user reference style

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
