---
type: entity
slug: balldontlie
title: balldontlie NBA API
status: candidate-free-limited
tags: [vendor, api, nba, basketball, free-tier-limited]
updated: 2026-07-19
sources: ["https://docs.balldontlie.io/", "https://www.balldontlie.io/"]
xref: [[free-api-pariscore-field-map]]
feeds_fields:
  - nba_games
  - nba_players
  - nba_teams
priority: P2
---

# balldontlie NBA API

**TL;DR:** NBA data 1946→. Free tier **très limité** (5 req/min, teams/players/games only). Stats avancées / odds / props = payant ($9.99+). Pour PariScore basket basique seulement.

## Pricing

| Tier | Prix | Rate | Endpoints |
|------|------|------|-----------|
| **Free** | $0 | 5/min | Teams, Players, Games |
| ALL-STAR | $9.99/mo | 60/min | + stats, injuries |
| GOAT | $39.99/mo | 600/min | + odds, props, advanced |

## Auth

- `apiKey` free signup
- Header `Authorization: Bearer`

## Champs PariScore (éventuel basket)

| Champ | Free? |
|-------|-------|
| nba teams/players/games | ✅ |
| box scores / standings | ❌ paid |
| betting odds / props | ❌ GOAT only |

## Related

- [[free-api-pariscore-field-map]]
- Alternative gratuite live multi-sport: [[sportscore]]
