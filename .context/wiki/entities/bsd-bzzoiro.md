---
type: entity
slug: bsd-bzzoiro
title: BSD (Bzzoiro Sports)
status: active
tags: [vendor, api, primary-data-source, paid-addon, websocket, mcp]
updated: 2026-05-22
sources: [.claude/CLAUDE.md, CLAUDE.md, server.js, ".context/audits/audit-bsd-league-coverage.md", ".context/audits/audit-bsd-nouvelles-ligues.md", ".context/eval-bsd-websocket-5iw.md", ".context/bsd-mcp-docs.md", ".context/gemini-bsd-mcp-integration.md", "https://sports.bzzoiro.com"]
xref: [[sofascore]], [[espn]], [[api-football]], [[modal-insights]], [[bsd-addon-5usd]]
bd: [c8m, 5iw, 0hf4, j6pz, ueg0, 82th]
---

# BSD (Bzzoiro Sports)

**TL;DR:** Primary data source PariScore foot+tennis. REST API + MCP server + WebSocket push. $5/mo Sports Addon (exp 2026-06-16). 28+ MCP tools, league coverage variable (29$ one-time à vie par ligue ajoutée).

## Context

Coeur de l'écosystème data PariScore. Remplace progressivement API-Football + Odds API pour live scores, lineups, shotmap, predictions ML CatBoost, polymarket odds, broadcasts TV.

Vendor: **Bzzoiro** (bzzoiro@proton.me). Service hébergé `https://sports.bzzoiro.com`.

## API surfaces

| Surface | Base URL | Auth | Usage |
|---|---|---|---|
| REST v2 | `https://sports.bzzoiro.com/api/v2/` | `Authorization: Token <BSD_API_KEY>` | Endpoints unitaires (events, players, teams, etc) |
| REST legacy | `https://sports.bzzoiro.com/api/` | idem | Predictions, polymarket, broadcasts, odds compare |
| MCP | `https://sports.bzzoiro.com/api/mcp/` (foot), `/tennis/mcp/` (tennis) | idem | Tool-calling pour LLMs |
| WebSocket | (config) | idem | Push live <5s scores+events |

## Endpoints actifs (server.js BSD_ENRICH_PATHS)

Tous routés via `bsdFetch(endpoint)` + `_bsdEnrichFetch(kind, eventId)` + cache TTL par kind.

| kind | endpoint | TTL | use |
|---|---|---|---|
| `lineups` | `/v2/events/{id}/lineups/` | 6h | Compos pré-match |
| `shotmap` | `/v2/events/{id}/stats/` ⚠️ (fix [[j6pz]]) | 2min live | Tirs xG + stats + momentum + xg_per_minute |
| `incidents` | `/v2/events/{id}/incidents/` | 1min live | Timeline buts/cartons |
| `predictions` | `/predictions/?event={id}` | 6h | ML CatBoost stable |
| `polymarket` | `/odds/polymarket/?event={id}` | 5min | Prediction market |
| `broadcasts` | `/broadcasts/?event={id}` | 24h | TV channels figés |
| `compare_odds` | `/odds/compare/?event={id}` | 5min | 14 books + movement |
| `social` | `/v2/social/?event={id}&limit=20` | 30min | Tweets/news/videos (livré [[ueg0]]) |
| `best_odds` | `/v2/odds/best/?event={id}` | 5min | Top-of-book aggregate ([[j6pz]]) |

## Endpoints registry (global, no event_id)

| Endpoint | Cache | Description |
|---|---|---|
| `/v2/bookmakers/` | 24h | 15 books (1xbet, 888sport, bet365, betano, betsson, betway, bwin, etc) |
| `/v2/referees/?limit=` | — | Registry 1344 referees (id, name, country, YC/RC stats per match) |
| `/v2/venues/?limit=` | — | Registry 1311 venues (id, name, capacity, lat/lng, pitch dims) |
| `/v2/leagues/?limit=` | — | 52 leagues (id, name, country, current_season) |
| `/v2/referees/{id}/` | 6h | Detail arbitre (avg_yellow_per_match, matches, etc) |
| `/v2/venues/{id}/` | 12h | Detail stade (coords, capacity) |
| `/v2/leagues/{id}/` | 24h | Detail ligue (current_season) |

## Tennis surface

Base distinct: `https://sports.bzzoiro.com/tennis/`. Helper `bsdTennisFetch()`. Sports Addon $5/mo requis (HTTP 402 sinon, code `ADDON_REQUIRED`). Coverage: ATP/WTA ML predictions, point-by-point, serve stats.

## Code locations

- `server.js:1403` — `BSD_BASE_URL = bsdConfig.base_url || 'https://sports.bzzoiro.com/api'`
- `server.js:1468-1469` — `BSD_TENNIS_BASE` + `BSD_TENNIS_MCP_URL`
- `server.js:2531-2560` — `bsdFetch(endpoint, retries)` core helper
- `server.js:2742-3002` — broadcasts + tv_channels enrich
- `server.js:3007-3036` — `bsdTennisFetch()` avec HTTP 402 addon detection
- `server.js:2981-3002` — `attachBSDBroadcasts(match, country)`
- `server.js:26905-26931` — `_bsdEnrichFetch(kind, eventId)` unified
- `server.js:26889-26903` — `_bsdResolveEventId(matchId)` (id frontend → bsd event_id)
- `server.js:26933` — `BSD_ENRICH_PATHS` array

## Coûts & quotas

- Addon Sports: **$5/mois** (renew 2026-06-16, surveiller)
- Ligue non couverte: **$29 one-time à vie par ligue** (frais infra/sourcing, demande via Discord/form Bzzoiro)
- Rate limit: pas documenté précisément; bsdFetch retry sur 500/429 max 2 attempts

## Stratégie cache

| Pattern | Justification |
|---|---|
| TTL court (1-5min) shotmap/incidents/polymarket/best_odds | Live data, refresh fréquent |
| TTL moyen (6h) lineups/predictions/referees | Stable post-publication |
| TTL long (12-24h) venues/leagues/bookmakers/broadcasts | Quasi-statiques |

Cache backend: `apiCacheGet/Set` SQLite `api_cache` table avec `source='bsd_<kind>'`.

## Bugs résolus session 22/05

- **[[j6pz]] shotmap endpoint:** ancien `/v2/events/{id}/shotmap/` retournait 404. Fix: `/v2/events/{id}/stats/` retourne shotmap+stats+momentum+xg_per_minute+avg_positions. Commit `9c073c1`.
- **[[ueg0]] social path:** `/social/?event=` → `/v2/social/?event=` pour consistance.

## Bd tickets actifs/liés

- `c8m` P0 — SECURITY rotation 11 clés post-exposition chat 21/05
- `5iw` P1 — BSD Live WebSocket schema validation VPS pending
- `0hf4` P2 — TV broadcasters Phase 1 livré, Phase 1.1/2/3 ouvertes
- `j6pz` P2 ✅ closed — Phase 2 shotmap fix + best_odds + bookmakers
- `ueg0` P2 ✅ closed — Social items sentiment buzz
- `82th` P2 ✅ closed — Referees + Venues + Leagues dynamic (backend)
- `r0v3` P3 — Phase 5 Squad + fixtures variant

## Open questions / gaps

- Rate limit exact non documenté — observer 429 patterns prod
- Addon renew 2026-06-16 — automatiser reminder?
- WebSocket schema live: validation VPS pending (bd 5iw)
- Coverage par ligue: maintenir liste `bsd_fr_leagues.json` à jour

## Related

- [[sofascore]] — Source alternative live (bd `ffh` Sofascore NO-GO 53/100 vs BSD live)
- [[espn]] — Fallback gratuit
- [[api-football]] — Migration progressive vers BSD
- [[modal-insights]] — Consommateur BSD enrich data
- [[bsd-addon-5usd]] (ADR) — Décision achat addon

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse CLAUDE.md + server.js + audits + sessions
