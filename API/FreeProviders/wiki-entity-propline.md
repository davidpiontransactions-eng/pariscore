---
type: entity
slug: propline
title: PropLine API
status: candidate-free
tags: [vendor, api, odds, player-props, exchanges, kalshi, polymarket, free-tier]
updated: 2026-07-19
sources: ["https://prop-line.com/pricing", "https://prop-line.com/"]
xref: [[free-api-pariscore-field-map]], [[therundown]], [[edge-no-vig]], [[odds-api]]
feeds_fields:
  - player_props
  - bookmakers.h2h
  - prediction_markets
  - best_odds
  - ev_no_vig
priority: P1
---

# PropLine API

**TL;DR:** Player props + cotes multi-books + exchanges (Kalshi, Polymarket). Free **1000 req/jour** (≈60× The Odds API free). Inclut Pinnacle. Drop-in shape proche the-odds-api.

## Pricing

| Tier | Prix | Req/jour |
|------|------|----------|
| **Free** | $0 | 1 000 |
| Hobby | $9/mo | 5k + EV + history + graded props |
| Pro | $19/mo | 25 000 |

## Auth

- `apiKey` gratuit (no card)
- Env: `PROPLINE_API_KEY`
- Header `X-API-Key` ou `?apiKey=`

## Champs PariScore alimentés

| Champ | Usage |
|-------|-------|
| player props | Deep Analysis, PowerScore props |
| `bookmakers[]` | 13 books + 5 exchanges |
| prediction markets | Kalshi / Polymarket tab |
| +EV / no-vig | edge engine (Hobby+) |
| graded prop resolution | settlement props (Hobby+) |

## Intégration

- Fallback cotes après TheRundown
- Props: nouveau module `providers/propline.js`
- Compatible migration depuis the-odds-api (même shape)

## Related

- [[free-api-pariscore-field-map]]
- [[therundown]]
- [[edge-no-vig]]
