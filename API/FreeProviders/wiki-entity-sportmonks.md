---
type: entity
slug: sportmonks
title: Sportmonks Football API
status: candidate-free-limited
tags: [vendor, api, football, free-tier-limited, already-wired]
updated: 2026-07-19
sources: ["https://www.sportmonks.com/football-api/free-plan/", "https://www.sportmonks.com/football-api/plans-pricing/"]
xref: [[free-api-pariscore-field-map]], [[bsd-bzzoiro]]
feeds_fields:
  - fixtures
  - standings
  - stats
  - xg
priority: P3
---

# Sportmonks Football API

**TL;DR:** Déjà prévu dans `server.js` (`SPORTMONKS_API_KEY`). Free = **Danish Superliga + Scottish Premiership uniquement**. Paid from €29/mo (5 ligues). Utile sandbox, pas prod multi-ligues.

## Pricing

| Tier | Prix | Ligues |
|------|------|--------|
| **Free forever** | $0 | 2 (DK + Scotland) |
| Starter | €29/mo | 5 any |
| Growth | €99/mo | 30 |
| Pro | €249/mo | 120 |

## Auth

- `apiKey` — env déjà: `SPORTMONKS_API_KEY`
- 14-day free trial paid plans (CB required)

## Champs PariScore

| Champ | Note |
|-------|------|
| fixtures/stats/xG | Full features sur les 2 ligues free |
| Prod multi-ligue | ❌ Free insuffisant — garder BSD |

## Related

- [[free-api-pariscore-field-map]]
- Code: `server.js` L1913 `SPORTMONKS_API_KEY`
