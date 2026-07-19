---
type: entity
slug: odds-api
title: The Odds API
status: legacy-migration-in-progress
tags: [vendor, api, odds, bookmakers, free-tier-limited, legacy]
updated: 2026-05-22
sources: ["server.js", ".claude/CLAUDE.md", "https://the-odds-api.com"]
xref: [[edge-no-vig]], [[bsd-bzzoiro]], [[api-football]], [[therundown]], [[propline]], [[oddsmagnet]], [[free-api-pariscore-field-map]]
bd: [zia, bjv]
---

# The Odds API

**TL;DR:** Provider cotes bookmakers historique PariScore (legacy v2). Free tier 500 req/mois, quota strict — cron 12h pour respecter. Migration progressive vers [[bsd-bzzoiro]] `compare_odds` + `best_odds` (bd `zia`).

## API

- **Base URL:** `https://api.the-odds-api.com/v4/`
- **Auth:** query param `?apiKey=${ODDS_API_KEY}`
- **Plan utilisé:** Free tier (500 req/mois)
- **Headers retour clés:** `x-requests-remaining`, `x-requests-used`

## Endpoints utilisés

| Endpoint | Use |
|---|---|
| `GET /v4/sports/?apiKey=` | Liste sports actifs |
| `GET /v4/sports/{sport}/odds/?apiKey=&regions=eu&markets=h2h&oddsFormat=decimal` | Cotes h2h |

## Stratégie quota

- Cron 12h → ~480 req/mois (< 500 limite ✅)
- Fenêtre temporelle `commenceTimeFrom` → `commenceTimeTo` J → J+7 (ne pas demander past matches)
- Bouton "Forcer l'actualisation" frontend = manual refresh (compte vers quota)

## Ligues couvertes (sportKeys)

| Clé Odds API | Nom |
|---|---|
| `soccer_france_ligue1` | Ligue 1 |
| `soccer_epl` | Premier League |
| `soccer_uefa_champs_league` | Champions League |
| `soccer_spain_la_liga` | La Liga |
| `soccer_germany_bundesliga` | Bundesliga |
| `soccer_italy_serie_a` | Serie A |
| `soccer_uefa_europa_league` | Europa League |

Plus ~30 autres sportKeys configured leagues_config.json `odds_key` field.

## Bookmakers (regions=eu)

20+ bookmakers européens: 1xbet, 888sport, bet365, betfair, betway, bwin, pinnacle, unibet, williamhill, etc.

## Migration vers BSD

Bd `zia` P2 in_progress — Consolidation P3 migrer cotes Odds API → API-Football odds OU BSD compare_odds.

**Pourquoi migration:**

- Odds API free 500/mois = quota strict bloquant
- [[bsd-bzzoiro]] `compare_odds` = 14 books + movement + déjà inclus dans $5/mo addon
- Réduit dépendance multi-source

**Alternative en cours évaluation bd `bjv` P1:**

- RapidAPI odds-api1 (Phase 1 confirmé 404 endpoints — abandonné)
- OddsPapi.io free 250 req/mo (Pinnacle sharp anchor — POC pending DG)

## Code locations

- `server.js` `ODDS_API_KEY` env var
- `server.js` `fetchOdds()` cron 12h
- `server.js` `oddsHistory[]` snapshot toutes 2h (cf. [[dropping-odds]] concept à créer)

## Matching équipes vs API-Football

Issue connue: noms d'équipe diffèrent entre Odds API + API-Football. PariScore `normName(name)` (server.js:4920) lowercase + accent strip + non-alnum→space. Matching exact → fuzzy fallback.

⚠️ Limite: faux positifs noms courts ("Inter", "Sporting"). Roadmap Levenshtein.

## Bd tickets

- `zia` P2 in_progress — Migration Odds API → API-Football odds
- `bjv` P1 in_progress — Spike sourcing cotes alternative (RapidAPI 404, OddsPapi POC pending)
- `qkx` P2 — Spike eval odds-api1 RapidAPI candidate (couplé bjv Phase 1 fail)
- `x9s` P1 — Plug oddsapi sur tous champs cotes (BLOCKED par bjv 404)
- `sml` P2 — QA test exhaustif champs cotes apres integration oddsapi

## Status

**Legacy** — maintenu pour rétrocompat mais migration target [[bsd-bzzoiro]]. Possibilité downgrade Free tier ou drop complet quand BSD coverage 100% cotes.

## Related

- [[edge-no-vig]] — Consommateur cotes
- [[bsd-bzzoiro]] — Migration target
- [[api-football]] — Migration target alternative

## Changelog

- 2026-05-22: création initiale wave 3
