---
type: entity
slug: sportscore
title: SportScore API
status: candidate-free
tags: [vendor, api, live-scores, football, basketball, tennis, free-tier, no-key]
updated: 2026-07-19
sources: ["https://sportscore.com/developers/", "https://sportscore.com/developers/terms/"]
xref: [[free-api-pariscore-field-map]], [[bsd-bzzoiro]]
feeds_fields:
  - live_score
  - live_minute
  - fixtures
  - status
  - standings
  - player_stats
priority: P0
---

# SportScore API

**TL;DR:** Live scores **gratuits sans clé API**. Foot, basket, cricket, tennis. ~10k req/j/IP. Condition: lien attribution "Powered by SportScore" visible. MCP dispo (`npx sportscore-mcp`).

## Pricing

| Tier | Prix | Limite |
|------|------|--------|
| **Free** | $0 forever | ~10k req/24h/IP + attribution |
| Commercial | Sur devis | no badge, SLA, higher limits |

## Auth

- **None** — CORS open, `Access-Control-Allow-Origin: *`
- Base: `https://sportscore.com`
- Cache edge 60s

## Champs PariScore alimentés

| Champ | Usage |
|-------|-------|
| `live_score` | Score live UI + SSE |
| `live_minute` | Minute de jeu |
| `status` | NS / LIVE / FT |
| fixtures | Calendrier MatchesTab |
| standings | Classements multi-sport |
| player_stats / top scorers | Insights |

## Contrainte CGU

> Afficher un lien visible dofollow "Powered by SportScore" → `https://sportscore.com/` sur chaque page qui rend les données.

## Intégration

- Fallback live après BSD
- Alternative Sofascore (évite Cloudflare)
- OpenAPI: sportscore.com/developers/openapi.yaml

## Related

- [[free-api-pariscore-field-map]]
- [[bsd-bzzoiro]] — primaire live
