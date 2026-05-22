---
type: entity
slug: flashscore
title: Flashscore
status: active
tags: [vendor, dataset, apify, secondary, logos, livestream, live-stats]
updated: 2026-05-22
sources: ["dataset_flashscore-team-stats_2026-05-21_23-54-30-172.json", "dataset_flashscore-live-matches_2026-05-22_00-03-54-224.json", "tools/import-flashscore-logos.js", "tools/import-flashscore-livestream.js", "tools/import-flashscore-live-stats.js", "https://www.flashscore.com"]
xref: [[sofascore]], [[apify]], [[bsd-bzzoiro]], [[ffh-spike-decision]]
bd: [qm6a]
---

# Flashscore

**TL;DR:** Source data sport via Apify scrapers one-shot. Use cases PariScore = logos backup (Plan A) + livestream flag (Plan F) + live stats fallback (Plan E) + venue/referee theoretical (Plan D mais data null). Pas de feed continu — datasets one-shot.

## Context

Flashscore = Concurrent direct de [[sofascore]] niveau couverture scores live mondiaux. Pas d'API publique. Apify scrapers = seul accès propre. Use cases distincts de [[bsd-bzzoiro]] = backup + logos (BSD limité logos) + flag streaming.

## Datasets Apify one-shot disponibles

**1. `dataset_flashscore-team-stats_2026-05-21_23-54-30-172.json`** (48K, 80 entries)
- 20 équipes EPL (foot) + 60 NBA (basket hors scope filtre)
- Champs: source_url, sport_name, country_name, league_name, tournament_id, stage_id, standing_position, team_name, team_id, matches_played, wins, losses, points, draws, goals_for, goals_against, goal_difference, season, team_slug, team_logo_url

**2. `dataset_flashscore-live-matches_2026-05-22_00-03-54-224.json`** (39K, 3 entries live foot)
- Champs riches: match_id, match_url, status, kickoff_time, home_team, away_team, home_team_id, away_team_id, round, **has_live_stream**, league, league_id, league_url, match_minute, match_period, home_score, away_score, home_score_halftime, away_score_halftime, lineups_confirmed, **statistics** (top stats + breakdown), **lineups** (formations + players), events, odds, **referee**, scraped_at, **venue**, venue_capacity, venue_city

## ETL tools livrés bd qm6a

| Tool | Cache key | Plan | TTL | Livré |
|---|---|---|---|---|
| `tools/import-flashscore-logos.js` | `logo_<normName>` | A | 90j | commit `3fc4ca7` |
| `tools/import-flashscore-livestream.js` | `livestream_<normHome>_<normAway>` | F | 7j | commit `ca15c1f` |
| `tools/import-flashscore-live-stats.js` | `flashscore_live_stats_<normHome>_<normAway>` | E | 30min | commit `1121af8` |

## STAT_MAP normalisation (Plan E)

Map stat_name Flashscore EN → champs PariScore conventionnels:
```
'Ball possession' → possession_pct
'Total shots' → total_shots
'Shots on target' → shots_on_target
'Shots off target' → shots_off_target
'Corner kicks' → corner_kicks
'Fouls' → fouls
'Yellow cards' → yellow_cards
'Red cards' → red_cards
'Offsides' → offsides
'Throw-ins' → throw_ins
... (14 mappings total)
```

## Wire frontend

- `data-tv-badge` slot + `streamBadgeInline` pill `📡 STREAM` ambre (Plan F, pariscore.html:21115)
- `m.has_live_stream` flag via `attachFlashscoreLiveStream()` server.js
- `m.flashscore_live_fallback` field dans `/api/v1/matches` quand BSD/ESPN HS (Plan E)
- `flashscore_live_stats` field dans `/api/v1/insights/:id` payload (Plan E)

## Limite fondamentale

Datasets Apify = **one-shot snapshots**. Pas feed continuous. Value durable nécessite:
1. Scraper continuous (Apify subscription) — décision DG
2. OU pivot [[xvalue.ai]] (bd `ffh` GO ferme 85/100)
3. OU batch run régulier Apify (cron user-side)

## Decision matrix bd ffh

Flashscore datasets qm6a = pattern data acquisition légère ad-hoc. Bd `ffh` recommande pivot xvalue.ai pour pipeline continu propre.

## Plans qm6a status (4/6 livrés)

| Plan | Status |
|---|---|
| A logos backup | ✅ commit `3fc4ca7` |
| B standings fallback offline | ⏳ open 1-2h MED |
| C cross-ref naming validation audit | ⏳ open 2h MED |
| D venue + referee enrichment | ✅ commit `58119d7` (via Sofascore dataset car Flashscore venue=null sample) |
| E live stats fallback ESPN-only | ✅ commit `1121af8` |
| F has_live_stream badge UI | ✅ commit `ca15c1f` |

## Bd tickets

- `qm6a` P3 — Flashscore dataset integration (4/6 plans livrés)

## Open questions / gaps

- Sample dataset Flashscore live venue/referee = null pour 3 matchs Brésil. EPL/top leagues = probably riches. Dataset à re-run sur sample top leagues pour valider.
- 60 entries NBA filtrées hors scope — possibilité produit futur si pivot basketball.
- B standings + C audit naming = à fermer pour clore qm6a.

## Related

- [[sofascore]] — Pattern data acquisition similaire Apify
- [[apify]] — Plateforme commune
- [[bsd-bzzoiro]] — Source live primary
- [[xvalue]] — Alternative continuous pipeline (DG bd ffh)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse 3 ETL tools session 22/05 (Plans A/E/F)
