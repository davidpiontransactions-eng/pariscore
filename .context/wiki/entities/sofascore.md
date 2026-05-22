---
type: entity
slug: sofascore
title: Sofascore
status: active
tags: [vendor, dataset, apify, secondary, scoring, editorial, profile]
updated: 2026-05-22
sources: [".context/spike-ffh-6sources-eval-final.md", "dataset_sofascore-scraper-pro_2026-05-22_00-07-03-587.json", "tools/import-sofascore-editorial.js", "tools/import-sofascore-tennis-player.js", "tools/import-sofascore-football-venue-referee.js", "https://www.sofascore.com"]
xref: [[bsd-bzzoiro]], [[apify]], [[flashscore]], [[modal-insights]], [[ffh-spike-decision]]
bd: [6jro, ffh]
---

# Sofascore

**TL;DR:** Source data sport riche (foot+tennis), accédée via Apify scrapers one-shot. Use case PariScore = enrichissement profile/historique/editorial/venue/referee (PAS live, qui est BSD). Categorisé NO-GO live (53/100) bd `ffh` mais GO profile data via bd `6jro` (Plans G+H+D livrés).

## Context

Sofascore = Concurrent de Flashscore au niveau scores live + cotes + statistiques détaillées. Pas d'API officielle publique. Accès via:
- **Apify scrapers** (one-shot snapshots) — utilisé actuellement
- **Scraping direct** — refusé (anti-bot fort, ToS strict)
- **Live feed continuous Apify** — bd `6jro` Plan J décision DG pending (conflit bd `ffh`)

## Dataset Apify one-shot disponible

**Fichier:** `dataset_sofascore-scraper-pro_2026-05-22_00-07-03-587.json` (110K, 2 entries)
- Entry 0: `/tennis/player/djokovic-novak/14882` — profile joueur tennis avec teamRankings + teamGrandSlamBestResults + hasSingles/hasDoubles
- Entry 1: `/football/match/atletico-madrid-real-madrid/EgbsLgb` — match detail avec event {venue, referee, homeTeam, awayTeam, startTimestamp} + initialFeaturedArticle + incidents + initialStandingsProperties

## ETL tools (livrés bd 6jro + qm6a Plan D)

| Tool | Cache key pattern | Plan | TTL | Livré |
|---|---|---|---|---|
| `tools/import-sofascore-editorial.js` | `sofa_editorial_<normHome>_<normAway>` | 6jro H | 24h | commit `f8cd143` |
| `tools/import-sofascore-tennis-player.js` | `sofa_tennis_player_<normName>` | 6jro G | 7j | commit `dc7b3ae` |
| `tools/import-sofascore-football-venue-referee.js` | `sofa_venue_referee_<normHome>_<normAway>` | qm6a D | 7j | commit `58119d7` |

## Server endpoints

- `GET /api/v1/tennis/sofa-profile?p1=&p2=` — lookup profile player joueur tennis depuis cache (bd `6jro` Plan G)
- Field `sofascore_editorial` dans `/api/v1/insights/:id` payload (bd `6jro` Plan H)
- Field `sofascore_venue_referee` dans `/api/v1/insights/:id` payload (bd `qm6a` Plan D)

## Schema data clés synthesized

### Player profile (tennis)
```
{
  teamDetails: { id, name, slug, shortName, gender, country },
  teamRankings: { rankings: [{ ranking, points, previousRanking, bestRanking, tournamentsPlayed, type }] },
  teamGrandSlamBestResults: { results: [{ id, name, years: [{ year, round, winner, isLive, isUpcoming }] }] },
  hasSingles, hasDoubles
}
```

### Match detail (football)
```
{
  event: {
    homeTeam, awayTeam, venue: { name, capacity, city, country, venueCoordinates },
    referee: { name, country, games, yellowCards, redCards, yellowRedCards, ... }
  },
  initialFeaturedArticle: [{ id, slug, date, title, excerpt, imageUrl, tags }],
  incidents, initialStandingsProperties, eventMeta
}
```

## Decision matrix (bd ffh spike final)

| Use case | Verdict | Score | Reason |
|---|---|---|---|
| Live scores | NO-GO | 53/100 | Redondant [[bsd-bzzoiro]] WebSocket live <5s |
| Live xG | NO-GO | — | BSD couvre via shotmap |
| Profile player tennis | GO | — | Unique (rankings + GS history) — livré bd 6jro G |
| Editorial article foot | GO | — | Unique (vs BSD) — livré bd 6jro H |
| Venue/referee enriched | GO | — | Alt à bd `82th` BSD Phase 4 — livré bd qm6a D |
| Continuous scraper webhook | DECISION DG | — | bd 6jro Plan J pending |

## Bd tickets

- `6jro` P3 — Apify datasets integration (Plans G+H+I livrés, J pending DG)
- `ffh` P2 closed — Spike 6 sources final eval (Sofascore live NO-GO, profile GO)

## Code locations

- `server.js:25686-25700` — `/api/v1/tennis/sofa-profile` route + lookup
- `server.js` (helpers): `getSofascoreEditorial()`, `getSofascoreTennisPlayer()`, `getSofascoreVenueReferee()`, `loadSofascore*Cache()` (3 Map lazy reload)

## Open questions / gaps

- **Plan J décision DG** — Apify continuous scraper webhook = $ recurring vs one-shot quasi-gratuit. Use case unique = profile feed updates auto (sinon ETL manuel chaque dataset Apify dump).
- ETL one-shot value courte: 1 entry venue/referee pour Real Madrid vs Atletico Madrid = très peu de couverture. Besoin continuous OU batch run régulier.

## Related

- [[bsd-bzzoiro]] — Source live primary (Sofascore NO-GO live car redondant)
- [[apify]] — Plateforme scrapers Sofascore
- [[flashscore]] — Source data similaire (logos + livestream + live stats)
- [[modal-insights]] — Consommateur enrichments Sofascore (sections AVANT-MATCH + STADE & ARBITRE + HISTORIQUE GC)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse spike ffh + 3 ETL tools session 22/05
