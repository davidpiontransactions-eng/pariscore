# Mapping BSD ↔ V1 ↔ V2 — Input pour B1 (proxy réel)

> **Date** : 2026-07-11 · **Auteur** : Chef de projet
> **Objectif** : documenter comment les 25 endpoints BSD mockés du proxy V2 (`/api/ps`) se mappent vers les routes V1 réelles, pour la tâche **B1** (démoquage).

## Contexte technique

- **V2 proxy** (`src/app/api/ps/route.ts`) appelle `https://pariscore.fr/api/v1/<sub>` puis fallback mock.
- **V1 local** expose **351 routes** `/api/v1/*` dont **25 routes BSD réelles** sous `/api/v1/bsd/*`.
- Problème : les noms de endpoints BSD V2 (handover/docs) ne correspondent pas 1:1 aux routes V1.

## Routes BSD V1 réelles (25)

```
/api/v1/bsd/                      /api/v1/bsd/bookmakers
/api/v1/bsd/broadcasts/           /api/v1/bsd/clip-video/
/api/v1/bsd/clips/                /api/v1/bsd/compos/
/api/v1/bsd/fixtures/             /api/v1/bsd/incidents/
/api/v1/bsd/league/               /api/v1/bsd/lineups/
/api/v1/bsd/manager/              /api/v1/bsd/player-profile/
/api/v1/bsd/player-skill/         /api/v1/bsd/player-skill/search
/api/v1/bsd/polymarket/           /api/v1/bsd/predicted-lineup/
/api/v1/bsd/predictions/          /api/v1/bsd/referee/
/api/v1/bsd/shotmap/              /api/v1/bsd/squad/
/api/v1/bsd/transfers/            /api/v1/bsd/venue/
/api/v1/bsd/ws-status             /api/v1/live/bsd
```

## Routes V1 pertinentes (non-BSD)

```
/api/v1/matches                   /api/v1/top-matches
/api/v1/odds/                     /api/v1/odds-history/
/api/v1/aiscore/fixtures          /api/v1/aiscore/match
/api/v1/aiscore/odds              /api/v1/betmines/best-bets
/api/v1/betmines/fixtures         /api/v1/analytics/clv-by-strategy
/api/v1/forecasts/football        /api/v1/forecasts/football/trending
/api/v1/tennis/top10              /api/v1/tennis/value-bets
/api/v1/tennis/h2h                /api/v1/tennis/live
/api/v1/tennis/elo/rankings       /api/v1/tennis/glicko2/top
/api/v1/accuracy                  /api/v1/accuracy/public
```

## Mapping BSD V2 (mocké) → V1 (réel)

| Endpoint BSD V2 (mocké dans `/api/ps`) | Route V1 candidate | Statut mapping |
|---|---|---|
| `bsd/closing-odds/{matchId}` | `/api/v1/odds-history/{matchId}` ou `/api/v1/odds/{matchId}` | ⚠️ À vérifier (structure cotes de clôture) |
| `bsd/momentum/{matchId}` | `/api/v1/live/bsd` ou `/api/v1/aiscore/match/{matchId}` | ⚠️ À vérifier |
| `bsd/probabilities/{matchId}` | `/api/v1/bsd/predictions/{matchId}` | ✅ Probable match |
| `bsd/team/{teamId}/form` | `/api/v1/bsd/squad/{teamId}` + compute, ou `/api/v1/aiscore/match` | ⚠️ Pas d'équivalent direct (form à déduire) |
| `bsd/h2h/{teamA}/{teamB}` | `/api/v1/tennis/h2h` (tennis) — foot : pas d'équivalent direct | 🔴 Gap (foot H2H absent V1) |
| `bsd/league/{id}/standings` | `/api/v1/bsd/league/{id}` | ⚠️ À vérifier (standings vs league info) |
| `bsd/stats-players/{matchId}` | `/api/v1/bsd/shotmap/{matchId}` ou compos/lineups | ⚠️ Partiel |
| `bsd/odds-movements/{matchId}` | `/api/v1/odds-history/{matchId}` | ✅ Probable match |
| `bsd/league/{id}/topscorers` | `/api/v1/bsd/league/{id}` (à vérifier) | ⚠️ À vérifier |
| `bsd/league/{id}/fixtures` | `/api/v1/bsd/fixtures/` + filtre league | ✅ Probable match |
| `bsd/predictions-ml/{matchId}` | `/api/v1/bsd/predictions/{matchId}` | ✅ Match |
| `bsd/player/{id}/stats` | `/api/v1/bsd/player-profile/{id}` ou `player-skill/{id}` | ✅ Probable match |
| `bsd/player/{id}/injuries` | `/api/v1/bsd/incidents/` + filtre | ⚠️ Partiel |
| `bsd/team/{id}/transfers` | `/api/v1/bsd/transfers/{teamId}` | ✅ Match |
| `bsd/weather/{venue}/{date}` | `/api/v1/bsd/venue/{id}` | ⚠️ Partiel (venue ≠ weather) |
| `bsd/standings/{matchId}` | `/api/v1/bsd/league/{id}` | ⚠️ À vérifier |
| `bsd/stats-teams/{matchId}` | `/api/v1/bsd/compos/` ou `shotmap/` | ⚠️ Partiel |
| `bsd/highlights/{matchId}` | `/api/v1/bsd/clips/{matchId}` ou `clip-video/` | ✅ Probable match |
| `bsd/league/{id}/assists` | `/api/v1/bsd/league/{id}` | ⚠️ À vérifier |
| `bsd/league/{id}/rounds` | `/api/v1/bsd/league/{id}` | ⚠️ À vérifier |
| `bsd/league/{id}/news` | `/api/v1/bsd/broadcasts/` | ⚠️ Partiel |
| `bsd/player/{id}/career` | `/api/v1/bsd/player-profile/{id}` | ✅ Probable match |
| `bsd/manager-by-id/{id}` | `/api/v1/bsd/manager/{id}` | ✅ Match |
| `bsd/bookmaker/{slug}/odds` | `/api/v1/bsd/bookmakers` + `/api/v1/odds/` | ✅ Match |
| `bsd/sentiment/{matchId}` | 🔴 Aucun équivalent V1 | 🔴 Gap (sentiment absent) |

## Synthèse

- ✅ **Match direct/probable** : 8 endpoints (predictions, transfers, manager, bookmaker, highlights, player-profile, fixtures, odds-movements)
- ⚠️ **Partiel / à vérifier** : 15 endpoints (nécessite interrogation des routes V1 avec vraies données)
- 🔴 **Gap** : 2 endpoints (foot H2H, sentiment) — n'existent pas en V1

## Recommandation pour B1

1. **Retargeter le proxy** V2 de `https://pariscore.fr/api/v1` → `http://localhost:3000/api/v1` (V1 local) en mode dev via variable d'env `PARISCORE_API_BASE`.
2. **Adapter les paths** : créer une table de translation `bsd/<v2path>` → `/api/v1/bsd/<v1path>` dans le proxy.
3. **Pour les 8 match directs** : proxy simple, supprimer le mock.
4. **Pour les 15 partiels** : requêter la route V1, adapter la shape de réponse (transform léger).
5. **Pour les 2 gaps** : garder le mock temporairement, créer des beads pour implémentation V1 future.

## Prochaine étape B1

Démarrer V1 local (`node server.js`) et interroger chaque route BSD candidate avec `curl` pour confirmer la shape des données réelles avant d'adapter le proxy.

---

*Document de travail — à raffiner après interrogation des routes V1.*
