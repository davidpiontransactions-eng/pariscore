---
type: entity
slug: matchstat
title: MatchStat (Tennis enrichment)
status: active
tags: [vendor, api, tennis, enrichment, h2h, surface, paid]
updated: 2026-05-22
sources: ["server.js", ".context/tennis-matchstat-api-reference.md", ".context/audits/audit-bsd-league-coverage.md"]
xref: [[bsd-bzzoiro]], [[tennis-abstract]], [[modal-insights]], [[elo-dynamique]]
---

# MatchStat (Tennis enrichment)

**TL;DR:** Provider API tennis enrichissement modal Insights tennis. Use cases: H2H lifetime + perf breakdown par surface + rankings + tournaments. Endpoints proxiés via `/api/v1/tennis/matchstat/*`. Status 503 si `MATCHSTAT_API_KEY` non configurée.

## Endpoints utilisés (server.js)

| Route PariScore | MatchStat endpoint | Use |
|---|---|---|
| `/api/v1/tennis/matchstat/status` | `/v2/status` | Health check |
| `/api/v1/tennis/matchstat/fixtures` | `/v2/fixtures` | Programme matchs upcoming |
| `/api/v1/tennis/matchstat/player` | `/v2/player/{id}` | Profile + stats |
| `/api/v1/tennis/matchstat/ranking/singles` | `/v2/ranking/singles` | ATP/WTA rankings |
| `/api/v1/tennis/matchstat/ranking/doubles` | `/v2/ranking/doubles` | Doubles rankings |
| `/api/v1/tennis/matchstat/countries` | `/v2/countries` | Country codes ref |
| `/api/v1/tennis/matchstat/ranking-tiers` | `/v2/ranking-tiers` | GS/1000/500/250 ref |
| `/api/v1/tennis/matchstat/round` | `/v2/round` | Round codes ref |
| `/api/v1/tennis/matchstat/enrich/:matchId` | (composite) | H2H + perf-breakdown |

## Composite enrich

`/api/v1/tennis/matchstat/enrich/:matchId` — multi-fetch concurrent:
1. Resolve matchstat IDs joueurs (p1 + p2) via index resolver
2. Fetch H2H lifetime (array per surface: `{courtId, court, player1wins, player2wins}`)
3. Fetch perf breakdown 12 mois par surface
4. Return composite payload

## Frontend wire

`pariscore.html` `_fetchAndRenderTennisDetail(matchId)`:
1. Fetch `/api/v1/tennis/match/{id}` (BSD primary)
2. Render dashboard
3. Async parallel `fetchTennisMatchstatEnrich(matchId)` → populate `#tennis-matchstat-enrich` placeholder
4. `renderTennisMatchstatEnrich(data)` → H2H block + perf breakdown

## Status codes

- 200 OK
- 206 Partial — resolver index population incomplete (p1 OR p2 manquant)
- 503 — `MATCHSTAT_API_KEY` env manquante → fallback graceful empty section

## Cache

Cache disque JSON 12h via `matchstatFetch(endpoint, ttl)` helper. Réduit hits API + cost.

## Index resolver

Mapping noms PariScore tennis → MatchStat player IDs (numérique). Populated incrémentalement:
- Lookup index `db.matchstat_player_index[<normName>]`
- Si miss → fetch `/v2/player/search?q=<name>` → store mapping
- Cache permanent (player IDs immutables)

## Coûts

Pricing MatchStat — TBD vérifier dashboard provider. Plan utilisé non documenté dans repo.

## Coverage limites

- Tennis ATP/WTA core OK
- Challengers/Futures coverage variable
- Doubles support 50/50 (rankings + few perf data)
- Pas live point-by-point (BSD primary pour ça)

## Bd tickets

Pas de bd ticket dédié actuel. Intégration considérée stable v9.x.

## Related

- [[bsd-bzzoiro]] — Source primary tennis (point-by-point + ML)
- [[tennis-abstract]] — Source complementary research Elo (à créer wave 3)
- [[modal-insights]] — Consommateur enrich (`#tennis-matchstat-enrich` placeholder)
- [[elo-dynamique]] — Cross-validation rankings

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
