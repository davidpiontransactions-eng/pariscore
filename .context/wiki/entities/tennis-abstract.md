---
type: entity
slug: tennis-abstract
title: Tennis Abstract (Elo + reports scraping)
status: active-scraping
tags: [vendor, scraping, tennis, elo, reports, public-data, jeff-sackmann]
updated: 2026-05-22
sources: ["server.js (TENNIS_ABSTRACT_EVENTS, TENNIS_ABSTRACT_REPORTS)", "https://tennisabstract.com"]
xref: [[elo-dynamique]], [[sackmann-purge]], [[tennis-mylife]]
bd: [h6a, kto1]
---

# Tennis Abstract (Elo + reports scraping)

**TL;DR:** Site Jeff Sackmann tennisabstract.com — Elo rankings ATP/WTA + tournament forecasts + MCP leaders + Lottery + Birthdays. Scraping légal (data publique). Cache 6h. Endpoints PariScore `/api/v1/tennis-abstract*`.

## Endpoints PariScore

| Route | Use | Cache |
|---|---|---|
| `GET /api/v1/tennis-abstract` | List events disponibles | — |
| `GET /api/v1/tennis-abstract?event=<slug>` | Tournament forecasts (atp-rome-2026, wta-rome-2026, etc) | 6h |
| `GET /api/v1/tennis-abstract/report?slug=<slug>` | Reports (atp-elo, wta-elo, atp-lottery, wta-lottery, mcp-serve-men-52, mcp-return-women-52, birthdays) | — |

`TENNIS_ABSTRACT_EVENTS` + `TENNIS_ABSTRACT_REPORTS` whitelist server.js (security: pas n'importe quel slug accepté).

## Use cases

- **Elo ATP/WTA** — cross-validation [[elo-dynamique]] avec Tennis Abstract reference Elo (calculation method standard industry)
- **Tournament forecasts** — predictions match-by-match Tennis Abstract pour comparaison
- **MCP leaders** — Most Competitive Points (serve + return) leaderboards
- **Lottery** — Probabilité chaque seed pour chaque round (Bayesian)
- **Birthdays** — Player birthdays récents (UI nice-to-have)

## Scraping resilience

Fix V6 ParisScorebis-amc — external Tennis Abstract down/lent ne doit pas produire 500. Fallback:
```js
catch (e) {
  return jsonResponse(res, 200, {
    slug, _stale: true, _error: e.message,
    rounds: [], players: [], upcoming_matches: [], completed_matches: []
  });
}
```

Front affiche empty state propre au lieu de cascade .catch crash.

## Risques

- Site dépend Jeff Sackmann (1-person infra)
- HTML structure peut changer → scraper break (besoin monitoring weekly)
- Pas de licence formelle explicite (data publique = use OK général, attribution best practice)

## Distinct du dataset Sackmann tennis_atp

⚠️ **Important:**
- **Tennis Abstract (tennisabstract.com)** = site web public, scraping OK
- **Sackmann tennis_atp GitHub** = repo dataset CC BY-NC-SA, INCOMPATIBLE commercial ([[sackmann-purge]] en cours bd `8uoc`)

Tennis Abstract HTML scraping = OK. tennis_atp dataset = à purger.

## Bd tickets

- `h6a` P3 — Tennis Abstract Elo scraper weekly drift check
- `kto1` P2 — Research: tennisabstract.com WP interactivity-api — rapport incorporation

## Innovation backlog

- **Daily scraping cron** Elo updates (current 6h cache adhoc)
- **Backtesting cross-validation** PariScore Elo vs Tennis Abstract Elo (Brier score)
- **MCP serve/return leaders** integration colonnes tableau tennis

## Code locations

- `server.js:26754-26794` — `/api/v1/tennis-abstract*` routes
- `server.js` `TENNIS_ABSTRACT_EVENTS` whitelist (atp-rome-2026, wta-rome-2026, etc)
- `server.js` `TENNIS_ABSTRACT_REPORTS` whitelist
- `server.js` `fetchTennisAbstractTournament(slug)` / `fetchTennisAbstractReport(slug)`

## Related

- [[elo-dynamique]] — Cross-validation source Elo
- [[sackmann-purge]] — Distinct! TA scraping OK, Sackmann GitHub dataset NOT
- [[tennis-mylife]] — Substitution complementary historical dataset

## Changelog

- 2026-05-22: création initiale wave 3
