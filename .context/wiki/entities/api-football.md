---
type: entity
slug: api-football
title: API-Football
status: active
tags: [vendor, api, paid, pro-plan, standings, xg, live, kill-switch]
updated: 2026-05-22
sources: ["server.js", ".claude/CLAUDE.md", ".context/audits/audit-football-data-vs-bsd.md", ".context/strategy/etude-marche-api-football.md", "https://v3.football.api-sports.io"]
xref: [[bsd-bzzoiro]], [[odds-api]], [[smart-polling]], [[poisson-bivarie]], [[elo-dynamique]]
bd: [9je, zia, 3u9]
---

# API-Football

**TL;DR:** Source data foot $19/mo Pro plan (7500 req/jour). Standings + stats avancées (xG, Cartons, Tirs) + scores live. Smart Polling 60s fenêtre 19h-23h Paris pour live. Migration progressive vers [[bsd-bzzoiro]] en cours (kill-switch v10.77).

## Plan & quota

- Plan: **PRO $19/mois**
- Quota: **7500 req/jour** (était free 500/mois avant upgrade)
- Auth: header `x-apisports-key: ${API_FOOTBALL_KEY}`
- URL base: `https://v3.football.api-sports.io/`

## Endpoints utilisés

| Endpoint | Use | Cache TTL |
|---|---|---|
| `GET /fixtures?next=100&timezone=Europe/Paris` | Discovery match IDs | — |
| `GET /standings?league={id}&season={year}` | Classements par ligue | 12h |
| `GET /fixtures?date={YYYY-MM-DD}&status=FT` | Scores réels backtesting | — |
| `GET /fixtures?live=all` | Scores live (Smart Polling 60s, 19h-23h) | 60s |
| `GET /teams/statistics?team={id}&league={id}&season={year}` | xG, Cartons, Tirs avancés | 24h |

## Saison dynamique

`currentSeason()` server.js: `mois >= 7 ? année : année-1`. Casse en juillet 2026 si pas dynamique (note roadmap).

## Smart Polling stratégie

`fixtures?live=all` fenêtre fixe **19h-23h heure Paris** uniquement. Hors fenêtre = pas de polling live. Cron stratifié T1 (6h ligues majeures) vs T2 (12h ligues secondaires) via `LEAGUE_CRON_MS` server.js:1368.

## Code locations

- `server.js:1368` — `LEAGUE_CRON_MS` mapping
- `server.js:29238` — `computeLiveIntensityFromSofa` consumer
- `server.js` fetchStats / fetchOdds — pipeline principal

## Migration kill-switch v10.77

Bd `3u9` P2 — API-Football retiré du critical path. Migration progressive vers [[bsd-bzzoiro]]. Reste sur stats avancées (xG ligue mineure) + standings backup.

Bd `zia` P2 — Consolidation P3: Migrer odds Odds API → API-Football odds (in_progress).

Bd `9je` P0 — Pipeline ETL Historique Football API-Football PRO. Run bloqué quota épuisé, reset minuit UTC. Run `bash run_etl_2024_2026.sh` VPS.

## Ligues couvertes

Voir `leagues_config.json` + `flags_config.json` (8 ligues principales + Champions League + Europa).

## Coûts

$19/mo = $228/an. Vs BSD addon $5/mo = $60/an. BSD couvre plus large mais API-Football data xG plus mature. Garde les deux en double-source pendant migration.

## Open questions / gaps

- Saison hardcodée 2024 (CLAUDE.md known limit). À rendre dynamique avant juillet 2026.
- Matching noms équipes vs Odds API fuzzy basique. Levenshtein roadmap P2.
- Quota 7500/jour peut être épuisé par ETL historique massif (bd `9je`).

## Related

- [[bsd-bzzoiro]] — Migration target primary
- [[odds-api]] — Cotes complémentaires
- [[smart-polling]] (concept) — Pattern Cron stratifié T1/T2 (sera créé wave 2)
- [[poisson-bivarie]] — Consommateur xG/Cartons API-Football
- [[elo-dynamique]] — Standings input

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse CLAUDE.md + server.js
