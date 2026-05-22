---
type: feature
slug: comparateur
title: Comparateur Cotes (multi-bookmakers)
status: active
tags: [feature, ui, odds-comparison, multi-bookmaker, affiliate]
updated: 2026-05-22
sources: ["server.js (/api/v1/comparateur)", "pariscore.html"]
xref: [[bsd-bzzoiro]], [[odds-api]], [[edge-no-vig]], [[affiliate-marketing]]
---

# Comparateur Cotes (multi-bookmakers)

**TL;DR:** Modal comparateur cotes 14+ bookmakers par match. Source: [[bsd-bzzoiro]] `compare_odds` + `best_odds`. Highlight meilleure cote par marché (1X2, BTTS, O2.5). CTA affiliate link bouton "Parier" → tracking conversion.

## Sources

| Source | Endpoint | Use |
|---|---|---|
| [[bsd-bzzoiro]] | `/odds/compare/?event={id}` cache 5min | 14 books + movement |
| [[bsd-bzzoiro]] | `/v2/odds/best/?event={id}` cache 5min ([[j6pz]]) | Top-of-book aggregate |
| [[odds-api]] | legacy | Fallback historique |

## UI components

- Header match (home vs away + heure)
- Tableau:
  - Bookmaker (logo + nom)
  - Cote 1 / N / 2
  - Highlight meilleure cote par colonne (badge ★ "Best")
  - Movement arrow (↑ ↓ vs snapshot 2h ago)
- Bouton "Parier" par bookmaker → affiliate link tracked

## Affiliate links

- `buildAffiliateUrl({bookmaker, context, match, market})` server.js helper
- Tracking: `clickKey` stored `api_cache` 90j (server.js:21573)
- Conversion attribution via Gambling-Affiliation seeds (cf. CLAUDE.md)

## Memory user note

cf. `project_comparateur_sourcing.md` mémoire:
> "Odds API only; ne PAS re-scraper/forger l'API Coteur (auth chiffrée)"

⚠️ Source Coteur.com **interdit** scraping/forge (auth chiffrée, ToS strict). Pareil pour Comparateur.com.

PariScore comparateur = data BSD officielle uniquement + affiliate clicks.

## Code locations

- `server.js` `/api/v1/comparateur/:id` GET endpoint
- `server.js` `buildAffiliateUrl(...)` helper
- `server.js` click tracking → `api_cache` source='click'
- `pariscore.html` `psOpenTVModal()` adapté pattern modal (TV badge fait similaire)

## Strip optimization

`_MATCH_LIST_STRIP_FIELDS` exclut `all_bookmakers` (146 KB par match) du payload `/api/v1/matches`. Comparateur fetch séparé `/api/v1/comparateur/:id` lazy on-demand pour économiser bande passante page Matchs.

## Gates

Pas dans FOOT_PRO gate (comparateur = vitrine ouverte, conversion CTA).
Gambling-Affiliation seeds nécessitent `GA_PID` env. Si manquant → fallback liens direct (sans tracking).

## Innovation backlog

- **Polymarket sharp anchor** — bd `bjv` Plan C add [[oddspapi]] Pinnacle row sharp reference
- **Cross-source devig comparison** — show prob_fair par source devig method
- **Historical odds chart** — line chart movement 24h/7j cotes par bookmaker (Chart.js)

## Related

- [[bsd-bzzoiro]] — Source primary compare_odds + best_odds
- [[odds-api]] — Source legacy
- [[edge-no-vig]] — Consumer cotes pour EV
- affiliate-marketing — Tracking + commission structure (skill réf)

## Changelog

- 2026-05-22: création initiale wave 3
