---
type: entity
slug: espn
title: ESPN Public API
status: active
tags: [vendor, api, free, fallback, scoreboard, tennis, football]
updated: 2026-05-22
sources: ["server.js"]
xref: [[bsd-bzzoiro]], [[api-football]], [[live-intensity]]
---

# ESPN Public API

**TL;DR:** API publique ESPN scoreboard foot+tennis. Gratuit, aucune clé. Use case PariScore = fallback live scores quand BSD/API-Football défaillants + source primary tennis scoreboard.

## Endpoints utilisés

| Sport | URL | Refresh |
|---|---|---|
| Tennis ATP | `https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard` | Smart polling |
| Tennis WTA | `https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard` | idem |
| Football (leagues divers) | `https://site.api.espn.com/apis/site/v2/sports/soccer/<league>/scoreboard` | Smart polling |

Pas d'auth, pas de quota documenté. URL pattern public ESPN.

## Code locations

- `server.js:16058-16059` — tennis ATP+WTA scoreboard fetchers
- (foot) cron live polling via fetchOddsAPI et derivés

## Stratégie

- **Tennis**: ESPN = source primary, BSD pas tjs accessible (addon $5/mo)
- **Football**: ESPN = fallback gratuit après BSD WS / API-Football

## Limites

- Pas de point-by-point tennis (sets/games seulement)
- Pas de stats live détaillées (possession, tirs)
- Coverage tournois mineurs ATP/WTA variable
- Pas de cotes bookmakers

## Related

- [[bsd-bzzoiro]] — Live primary $5/mo
- [[api-football]] — Live primary foot $19/mo
- [[live-intensity]] — Calcul intensity utilise ESPN data quand BSD HS

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki
