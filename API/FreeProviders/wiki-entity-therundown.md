---
type: entity
slug: therundown
title: TheRundown API
status: candidate-free
tags: [vendor, api, odds, bookmakers, free-tier, sports]
updated: 2026-07-19
sources: ["https://therundown.io/pricing/api", "https://docs.therundown.io/"]
xref: [[free-api-pariscore-field-map]], [[odds-api]], [[edge-no-vig]], [[propline]]
feeds_fields:
  - bookmakers.h2h
  - best_odds
  - schedules
  - scores
  - tennis_odds
priority: P0
---

# TheRundown API

**TL;DR:** Meilleure API cotes **gratuite** pour PariScore. Free 20k datapoints/jour, 3 sportsbooks (BetMGM, DraftKings, FanDuel), délai 5 min. Remplace partiellement The Odds API free (500/mois).

## Pricing

| Tier | Prix | Datapoints | Books | Delay |
|------|------|------------|-------|-------|
| **Free** | $0 | 20k/jour | 3 | 5 min |
| Starter | $49/mo | 5M/mo | All | 60s |
| Pro | $149/mo | 25M/mo | All | 30s |

## Auth

- `apiKey` gratuit (signup, no credit card)
- Env: `THERUNDOWN_API_KEY`

## Champs PariScore alimentés

| Champ | Usage |
|-------|-------|
| `bookmakers[].h2h` | Cotes 1X2 prematch |
| `best_odds` | Meilleure ligne cross-book |
| schedules / fixtures | Calendrier événements |
| scores | Résultats |
| tennis ATP/WTA | Cotes tennis (si plan free le couvre) |

## Intégration

- **Point d'entrée:** `fetchOdds()` dans `server.js`
- **Position chaîne:** après BSD, avant The Odds API legacy
- **Docs:** https://docs.therundown.io/quickstart

## Related

- [[free-api-pariscore-field-map]]
- [[odds-api]] — legacy à soulager
- [[edge-no-vig]] — consommateur
