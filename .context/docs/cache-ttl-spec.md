# PariScore — TTL Cache Spec (bd 3vn)

> **Source unique TTL : `cache_profiles.json` (racine projet).**
> **Helper d'accès : `getCacheTTL(profileKey, fallbackMs)` dans `server.js`.**
> **Override env : `CACHE_TTL_<PROFILE_UPPERCASE>` (ex : `CACHE_TTL_BSD_INCIDENTS=120000`).**
> **Fallback : si profile absent → renvoie `fallbackMs` (TTL hardcoded historique).**
> **Sécurité : route `/api/v1/admin/cache-profiles` (JWT admin) expose snapshot runtime.**

---

## 1. Pourquoi ?

Avant ce ticket, les TTL apiCacheSet étaient dispersés en >70 sites avec hétérogénéité :
- BSD : 90j (logos) → 7j (standings) → 1h (fixtures) → 60s (incidents) — pas centralisé
- Flashscore : ETL standalone TTLs constants
- Sofa : 24h editorial / 7j venue
- Football-Data / OpenFootball / Understat : 6h / 12h / 6h
- AISCORE / aiscore-throttled : 5min match / 1h index

**Risques mitigés :**
- Cache poisoning historique (pattern `tv-channel-fallback` v3) — TTL ignoré au mauvais layer
- Revue manuelle TTL difficile (cherche+remplace 70 sites)
- Pas d'override ops sans rebuild
- Pas de diag runtime "quelle TTL est effective ?"

---

## 2. Architecture

```
┌──────────────────────────────────┐
│  cache_profiles.json (root)      │  ← Source unique
│  { "bsd_incidents": 60000, ... } │
└──────────────┬───────────────────┘
               │ fs.readFileSync (cache 60s + mtime)
               ▼
┌──────────────────────────────────┐
│  _loadCacheProfiles()            │
│  → Map<key, number>              │
└──────────────┬───────────────────┘
               │
               ▼                       ┌────────────────────────────┐
┌──────────────────────────────────┐   │  process.env               │
│  getCacheTTL(profileKey, fbMs)   │◀──│  CACHE_TTL_<KEY>=<ms>       │ (override prio 1)
│  1. env override                 │   └────────────────────────────┘
│  2. profile lookup               │
│  3. fallback hardcoded           │
│  4. API_CACHE_TTL ultime         │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  apiCacheSet(k, d, src, ttlMs)   │
│  → INSERT INTO api_cache         │
└──────────────────────────────────┘
```

---

## 3. Table TTL par provider × endpoint

| Provider           | Profile key                | TTL          | Rationale                                              |
|--------------------|----------------------------|--------------|--------------------------------------------------------|
| **BSD live**       | `bsd_incidents`            | 60 s         | Live timeline, refresh ultra-rapide                    |
| BSD live           | `bsd_shotmap`              | 2 min        | Live stats, refresh < 5 min                            |
| BSD live           | `bsd_odds`                 | 5 min        | Cotes movement                                          |
| BSD live           | `bsd_compare_odds`         | 5 min        | 14 books + movement                                     |
| BSD live           | `bsd_best_odds`            | 5 min        | Top-of-book aggregate                                   |
| BSD live           | `bsd_polymarket`           | 5 min        | Prediction market                                       |
| BSD mid            | `bsd_lineups`              | 30 min       | Compos peu changeantes hors match-day                  |
| BSD mid            | `bsd_social`               | 30 min       | Tweets/news/videos buzz                                 |
| BSD mid            | `bsd_fixtures`             | 1 h          | Fixtures team next-N                                    |
| BSD mid            | `bsd_team_fixtures`        | 1 h          | (r0v3 bd) team fixtures variant                         |
| BSD mid            | `bsd_predictions`          | 6 h          | ML CatBoost stable                                      |
| BSD mid            | `bsd_ratings`              | 6 h          | Per-position ratings                                    |
| BSD mid            | `bsd_broadcasts`           | 6 h          | TV channels event                                       |
| BSD long           | `bsd_topscorers`           | 24 h         | Topscorers ligue                                        |
| BSD long           | `bsd_transfers`            | 24 h         | Mercato                                                 |
| BSD long           | `bsd_squad`                | 24 h         | (r0v3 bd) team squad                                    |
| BSD long           | `bsd_player`               | 24 h         | Player detail                                           |
| BSD long           | `bsd_kp`                   | 24 h         | Key player index                                        |
| BSD long           | `bsd_tv_channels`          | 24 h         | TV channels figés                                       |
| BSD long           | `bsd_standings`            | 7 j          | Standings ligue                                         |
| BSD long           | `bsd_team`                 | 7 j          | Team v1                                                 |
| BSD long           | `bsd_team_v2`              | 7 j          | Team v2                                                 |
| BSD long           | `bsd_manager`              | 7 j          | Manager profile                                         |
| BSD long           | `bsd_logos`                | 90 j         | Logos rarement changent                                 |
| BSD tennis         | `bsd_tennis_live`          | 15 min       | Tennis live circuit                                     |
| BSD tennis         | `bsd_tennis_day`           | 6 h          | Tennis daily schedule                                   |
| BSD tennis         | `bsd_tennis_rg`            | 12 h         | Roland-Garros draw                                      |
| **Flashscore**     | `flashscore_live_stats`    | 30 min       | Live stats fallback                                     |
| Flashscore         | `flashscore_livestream`    | 7 j          | Has_live_stream badge                                   |
| Flashscore         | `flashscore_standings`     | 7 j          | Standings ETL                                           |
| Flashscore         | `flashscore_logos`         | 90 j         | Logos backup                                            |
| **Sofascore**      | `sofa_matches`             | 6 h          | Matches list                                            |
| Sofascore          | `sofa_editorial`           | 24 h         | Avant-match articles                                    |
| Sofascore          | `sofa_team`                | 7 j          | Team profile                                            |
| Sofascore          | `sofa_venue_referee`       | 7 j          | Stade + arbitre                                         |
| Sofascore          | `sofa_tennis_player`       | 7 j          | Profile tennis Grand Slam                               |
| **Wikidata**       | `wikidata`                 | 90 j         | CC0 winners tennis/foot                                 |
| **Transfermarkt**  | `transfermarkt`            | 24 h         | Player market value                                     |
| **Understat**      | `understat`                | 6 h          | xG advanced top 5 ligues                                |
| **OpenFootball**   | `openfootball`             | 12 h         | GitHub raw fixtures ODbL                                |
| OpenFootball       | `openfootball_neg`         | 6 h          | NEG cache (404)                                         |
| **Football-Data**  | `football_data`            | 6 h          | matches list (T1 free)                                  |
| Football-Data      | `football_data_detail`     | 24 h         | match detail enrichi                                    |
| Football-Data      | `football_data_neg`        | 1 h          | NEG cache (404)                                         |
| **API-Football**   | `apif_predictions`         | 6 h          | (legacy AF removed → fallback)                          |
| API-Football       | `apif_transfers`           | 24 h         | Mercato                                                 |
| API-Football       | `apif_teams`               | 30 j         | Teams ligue                                             |
| API-Football       | `apif_player`              | 24 h         | Player detail                                           |
| **ESPN**           | `espn_teams`               | 7 j          | Teams index                                             |
| ESPN               | `espn_athlete`             | 30 j         | Athlete profile                                         |
| ESPN               | `espn_topscorers`          | 24 h         | Top scorers                                             |
| ESPN               | `espn_odds`                | 30 min       | Odds events                                             |
| **TheSportsDB**    | `tsdb_player`              | 7 j          | Player enrichi                                          |
| TheSportsDB        | `tsdb_team`                | 7 j          | Team enrichi                                            |
| **Tennis live**    | `tennis_live`              | 30 s         | Score temps réel                                        |
| Tennis live        | `ls_live`                  | 30 s         | Live shared                                             |
| Tennis live        | `ls_match`                 | 30 s         | Match detail live                                       |
| Tennis             | `tennis_vb`                | 4 min        | ValueBet snapshot                                       |
| Tennis             | `tennis_schedule`          | 15 min       | Schedule day                                            |
| Tennis             | `tennis_surf_rank`         | 30 min       | Surface rank (live edits)                               |
| Tennis             | `tennis_tex_matches`       | 30 min       | TennisExplorer matches                                  |
| Tennis             | `tennis_odds`              | 4 h          | Odds tennis                                             |
| Tennis             | `tennis_abstract`          | 6 h          | TennisAbstract cache                                    |
| Tennis             | `tennis_rank`              | 6 h          | Rankings ATP/WTA                                        |
| Tennis             | `tennis_sack_surf`         | 6 h          | Sackmann surface stats (à purger bd 8uoc)               |
| Tennis             | `tennis_tex_match_detail`  | 6 h          | TennisExplorer detail                                   |
| Tennis             | `tennis_fatigue`           | 12 h         | Fatigue index                                           |
| Tennis             | `tennis_pstats`            | 12 h         | Player stats                                            |
| Tennis             | `tennis_enrich`            | 12 h         | Tennis enrich combiné                                   |
| Tennis             | `tennis_odds_discovery`    | 24 h         | Discovery sources tennis                                |
| Tennis             | `tennis_speed`             | 24 h         | Surface speed                                           |
| Tennis             | `tennis_ta`                | 24 h         | TennisAbstract spec                                     |
| Tennis             | `tennis_tex_player`        | 24 h         | TennisExplorer player                                   |
| Tennis             | `tennis_tex_calendar`      | 24 h         | TennisExplorer calendar                                 |
| Tennis             | `tennis_tex_surface_index` | 24 h         | Surface index                                           |
| **AISCORE**        | `aiscore_match`            | 5 min        | Match throttled (anti-poisoning live)                   |
| AISCORE            | `aiscore_index`            | 1 h          | Sitemap discovery                                       |
| **Matchstat**      | `matchstat_tennis`         | 12 h         | Tennis predictions                                      |
| **Misc**           | `ls_day`                   | 5 min        | LS day                                                  |
| Misc               | `reverify`                 | 5 min        | Re-verification                                          |
| Misc               | `betmines`                 | 30 min       | Betmines tips                                            |
| Misc               | `ssr_home`                 | 30 min       | SSR homepage cache (Phase 968x)                          |
| Misc               | `tv_channel_neg`           | 30 min       | TV channel 404 retry                                     |
| Misc               | `ai_al_fc`                 | 30 min       | AI Function Calling cache                                |
| Misc               | `corners`                  | 6 h          | Corners stats                                            |
| Misc               | `value_alert`              | 6 h          | Value alert digest                                      |
| Misc               | `tv_channel`               | 6 h          | TV channel positive                                     |
| Misc               | `h2h`                      | 24 h         | Head-to-head                                             |
| Misc               | `team_fixtures`            | 6 h          | Generic team fixtures                                    |
| Misc               | `fav_win_rate`             | 24 h         | Favorite trap win-rate                                  |

---

## 4. Endpoint admin runtime

```
GET /api/v1/admin/cache-profiles
Authorization: Bearer <JWT admin>

Réponse :
{
  "file": "<abs path cache_profiles.json>",
  "loadedAt": <epoch ms>,
  "mtimeMs": <epoch ms>,
  "lastError": null,
  "profileCount": 93,
  "profiles": { "_meta": {...}, "bsd_incidents": 60000, ... },
  "envOverrides": {
    "CACHE_TTL_BSD_INCIDENTS": 120000
  }
}
```

---

## 5. Override via .env

Pour bumper temporairement la TTL d'un endpoint (ex : doubler incidents BSD live) :

```bash
# .env
CACHE_TTL_BSD_INCIDENTS=120000
```

Redémarrage serveur **non requis** pour modif de `cache_profiles.json` (reload 60s + mtime check). En revanche modif `.env` requiert `pm2 restart pariscore`.

---

## 6. Refactor sites livrés (Phase 1, bd 3vn)

| Site               | server.js                                | Action                                            |
|--------------------|------------------------------------------|---------------------------------------------------|
| BSD enrich         | ~28483 `BSD_ENRICH_TTL = new Proxy(...)` | 9 endpoints (incidents, predictions, lineups...) |
| Football-Data      | apiCacheSet `'football_data'` matches    | `getCacheTTL('football_data', FOOTBALL_DATA_TTL_MS)` |
| Football-Data      | apiCacheSet `'football_data'` detail     | `getCacheTTL('football_data_detail', ...)`        |
| OpenFootball       | apiCacheSet `'openfootball'` (data+neg)  | `getCacheTTL('openfootball'/'openfootball_neg')`  |
| Understat          | apiCacheSet `'understat'`                | `getCacheTTL('understat', 6h)`                    |

**Sites non refactorés (Phase 2 backlog) :** ~60 autres call sites apiCacheSet conservent TTL hardcoded — refactor incrémental possible sans risque (fallback préserve comportement actuel).

---

## 7. Tests

```bash
# 1. Lecture profile.json + lookup
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('cache_profiles.json'));
  console.log(p.bsd_incidents); // 60000
"

# 2. Env override
CACHE_TTL_BSD_INCIDENTS=120000 node server.js
# → getCacheTTL('bsd_incidents', X) renvoie 120000

# 3. Admin route (avec JWT admin)
curl -H "Authorization: Bearer <JWT>" http://localhost:3000/api/v1/admin/cache-profiles
```

---

## 8. Backlog (bd 3vn Phase 2)

- Refactor 60 autres sites apiCacheSet (Sofa, Flashscore tools, ESPN, AISCORE, Tennis...)
- Migrer TTL constants top-level (`FOOTBALL_DATA_TTL_MS`, `OPENFOOTBALL_TTL_MS` etc) vers helpers lazy
- Tests unitaires `_loadCacheProfiles()` + `getCacheTTL()` + override env
- Frontend admin UI page "Cache TTL" (dashboard `admin.html`) lisant `/api/v1/admin/cache-profiles`
- Hot-reload signal `kill -USR2 <pid>` → invalidate `_cacheProfilesCache` immédiatement

---

*PariScore — bd 3vn TTL cache homogène — 22 mai 2026 — Phase 1 livrée.*
