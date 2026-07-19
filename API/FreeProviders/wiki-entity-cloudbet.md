---
type: entity
slug: cloudbet
title: Cloudbet Feed API
status: candidate-free
tags: [vendor, api, odds, bookmaker, crypto, free-tier]
updated: 2026-07-19
sources: ["https://www.cloudbet.com/api/", "https://cloudbet.github.io/wiki/en/docs/sports/api/"]
xref: [[free-api-pariscore-field-map]], [[therundown]], [[odds-api]]
feeds_fields:
  - bookmakers.h2h
  - bookmakers.cloudbet
priority: P1
---

# Cloudbet Feed API

**TL;DR:** Feed cotes officiel bookmaker crypto Cloudbet. Clé **Affiliate gratuite** pour consommer les odds (cache ≤1 min). Trading API = placer paris (deposit 10 EUR).

## Pricing

| Accès | Prix |
|-------|------|
| **Affiliate Feed API** | Free (compte affiliate) |
| Trading API | Compte joueur + dépôt ~10 EUR (test funds) |

## Auth

- JWT API Key
- Env: `CLOUDBET_API_KEY`
- Endpoints: `/v2/odds/sports`, `/v2/odds/events`, `/v2/odds/lines`

## Champs PariScore alimentés

| Champ | Usage |
|-------|-------|
| `bookmakers[].cloudbet` | Cote book crypto dans compare |
| best_odds chain | 1 source de plus dans multi-book |

## Intégration

- Ajouter Cloudbet dans la chaîne fallback cotes
- Ne pas utiliser Trading API pour auto-bet sans cadre légal clair

## Related

- [[free-api-pariscore-field-map]]
