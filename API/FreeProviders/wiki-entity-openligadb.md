---
type: entity
slug: openligadb
title: OpenLigaDB
status: candidate-free
tags: [vendor, api, football, germany, standings, free-tier, no-key, crowdsourced]
updated: 2026-07-19
sources: ["https://openligadb.de/", "https://api.openligadb.de/"]
xref: [[free-api-pariscore-field-map]], [[bsd-bzzoiro]]
feeds_fields:
  - live_score
  - fixtures
  - standings
  - teamStats
priority: P1
---

# OpenLigaDB

**TL;DR:** API foot allemande **100% gratuite, sans auth**. Bundesliga 1/2/3, DFB-Pokal. Community ODbL. Parfait fallback standings/scores DE.

## Pricing

| Tier | Prix |
|------|------|
| **Public API** | **Free forever** — no key |

## Auth

- None
- Base: `https://api.openligadb.de/`
- Ex: `/getmatchdata/bl1/2025/1`

## Champs PariScore alimentés

| Champ | Usage |
|-------|-------|
| `live_score` / résultats | Matchdays Bundesliga |
| fixtures | Calendrier DE |
| `db.teamStats` / standings | Classement BL1/BL2/BL3 |
| archive scores | archivePastMatches DE |

## Intégration

- Activer si `league` ∈ {Bundesliga, 2.BL, 3.Liga, DFB-Pokal}
- Fallback quand BSD standings fail pour ligues DE
- Swagger: https://api.openligadb.de/

## Related

- [[free-api-pariscore-field-map]]
