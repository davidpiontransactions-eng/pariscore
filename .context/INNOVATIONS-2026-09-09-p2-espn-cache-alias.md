# Trace P2 — Cache ESPN DB + alias KR/JP (INNOVATIONS-2026-09-09)

## Fichiers
- `src/app/api/football/matches/[id]/stats/route.ts` : lecture
  `Match.espnEventId` (par `bzzoiroId`) avant `resolveESPNEvent`, `updateMany`
  après résolution (jamais de création partielle). Tout le bloc DB est
  best-effort (try/catch, la route ne casse jamais sur panne DB).
- `src/lib/espn-soccer-fetcher.ts` : `TEAM_ALIASES` (Ulsan, Jeonbuk, Suwon,
  Jeju, Pohang, Seoul, Kashima, Urawa, Yokohama, Kawasaki, Cerezo, Gamba,
  Vissel…) appliqués via `canonical()` dans `sig`/`sigKey`.

## Vérifications
- `bun run typecheck` : OK.
- À valider : 2ᵉ ouverture popup du même match → 0 fetch scoreboard
  (log `[football-stats]` sans `ESPN failed`, réponse depuis cache DB).
