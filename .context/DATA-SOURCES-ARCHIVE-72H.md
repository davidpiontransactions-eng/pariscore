# Data Sources — Archive 72h Feature

> PariScore v9.7 — Inventory of all data sources tested for the 72-hour match stats archive.
> Test Date: Juin 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Viable Sources](#viable-sources)
   - [Flashscore.mobi](#1-flashscoremobi--viable-score-55)
   - [SoccerSTATS.com](#2-soccerstatscom--viable-score-45)
   - [API-Football](#3-api-football-api-footballcom--viable-score-55)
   - [TheSportsDB](#4-thesportsdb--viable-score-35)
   - [football-data.org](#5-football-dataorg--viable-score-35)
3. [Non-Viable Sources](#non-viable-sources)
   - [SofaScore API](#6-sofascore-api--blocked-locally-score-55-in-production)
   - [WhoScored](#7-whoscored--blocked-score-05)
   - [Betmines](#8-betmines--blocked-score-05)
   - [1xbet](#9-1xbet--blocked-score-05)
   - [FBref](#10-fbref--blocked-score-15)
   - [ESPN FC](#11-espn-fc--blocked-score-15)
   - [BeSoccer](#12-besoccer--non-viable-score-05)
   - [OddsAlert](#13-oddsalert--non-viable-score-05)
   - [FotMob](#14-fotmob--partial-score-25)
4. [Architecture Recommandée](#architecture-recommandée)
5. [Parser — Flashscore.mobi](#parser--flashscoremobi)
6. [Mapping Stats Flashscore → PariScore](#mapping-stats-flashscore--pariscore)

---

## Overview

| # | Source | Score | Status | Protection |
|---|--------|-------|--------|-----------|
| 1 | Flashscore.mobi | 5/5 | ✅ Viable | Aucune |
| 2 | SoccerSTATS.com | 4/5 | ✅ Viable | Cloudflare CDN (pas de blocage réel) |
| 3 | API-Football | 5/5 | ✅ Viable | Clé API (déjà dans `.env`) |
| 4 | TheSportsDB | 3/5 | ✅ Viable | Aucune |
| 5 | football-data.org | 3/5 | ✅ Viable | Clé API (déjà dans `.env`) |
| 6 | SofaScore API | 5/5* | ❌ Bloqué localement | CDN Fastly (403 local, OK sur Render) |
| 7 | WhoScored | 0/5 | ❌ Bloqué | Cloudflare WAF Hard Block |
| 8 | Betmines | 0/5 | ❌ Bloqué | Cloudflare 301 redirect |
| 9 | 1xbet | 0/5 | ❌ Bloqué | Cloudflare agressif + blocage IP |
| 10 | FBref | 1/5 | ❌ Bloqué | Cloudflare JS challenge (403) |
| 11 | ESPN FC | 1/5 | ❌ Bloqué | AWS WAF JS challenge |
| 12 | BeSoccer | 0/5 | ❌ Non viable | NXDOMAIN / API payante / HTTP 406 |
| 13 | OddsAlert | 0/5 | ❌ Non viable | API payante uniquement |
| 14 | FotMob | 2/5 | ❌ Partiel | API 404, scraping HTML complexe |

\* SofaScore score is 5/5 **en production** (Render VPS), 0 localement.

---

## Viable Sources

### 1. Flashscore.mobi — VIABLE (Score: 5/5)

- **URL**: `https://www.flashscore.mobi/match/{matchId}/?t=stats`
- **Protection**: Aucune (plain HTTP requests work)
- **Format**: HTML avec `window.environment.props.feed` contenant des stats en format compact (délimiteurs `¬` et `÷`)
- **Stats disponibles**: xG, xGOT, Possession, Total shots, Shots on/off target, Blocked shots, Shots inside/outside box, Big chances, Corner kicks, Passes (%, total, made), Expected assists (xA), Fouls, Duels won, Goalkeeper saves, Goals prevented
- **Per-half breakdowns**: Full Match, 1st Half, 2nd Half
- **Match IDs**: Found 200+ match IDs from homepage
- **Exemple match `QBBoaW63`**: xG 1.21 vs 1.05, Possession 54% vs 46%, etc.

| Avantage | Inconvénient |
|----------|-------------|
| Stats très détaillées | Format compact nécessite un parser dédié |
| xG inclus | — |
| Per-half | — |
| Pas de protection anti-bot | — |

---

### 2. SoccerSTATS.com — VIABLE (Score: 4/5)

- **URL**: `https://www.soccerstats.com/pmatch.asp?league=XX&stats=RR-MM-DD-YYYY`
- **Protection**: Cloudflare CDN uniquement (pas de blocage réel, contenu complet servi)
- **Format**: HTML avec stats dans des `<td>` et `<h3>` tags
- **Stats disponibles**: Ball possession, Corners, % time leading, Domination Index, Goal times, Attack/Defence ratings
- **Liens**: 86+ match links sur homepage, résultats par ligue/round

| Avantage | Inconvénient |
|----------|-------------|
| Pas de blocage | Pas de xG |
| HTML facile à parser | Stats moins détaillées que Flashscore |

---

### 3. API-Football (api-football.com) — VIABLE (Score: 5/5)

- **URL**: `https://v3.football.api-sports.io/fixtures/statistics?fixture=XXXXX`
- **Protection**: Clé API requise (déjà dans `.env` comme `API_FOOTBALL_KEY`)
- **Format**: JSON API propre
- **Free tier**: 100 req/jour, actif jusqu'Oct 2026
- **Stats disponibles**: Ball Possession, Total Shots, Shots on/off Goal, Blocked Shots, Shots inside/outside box, Corner Kicks, Fouls, Offsides, Yellow/Red Cards, Goalkeeper Saves, Total Passes, Passes accurate, Passes %
- **Budget**: Ligue 1 ≈ 10 matchs/jour × 3 req/match = ~30 req/jour (dans les limites)

| Avantage | Inconvénient |
|----------|-------------|
| Déjà configuré dans PariScore | 100 req/jour max |
| JSON propre | Pas de xG sur le free tier |
| Stats complètes | — |

---

### 4. TheSportsDB — VIABLE (Score: 3/5)

- **URL**: `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=TeamA_vs_TeamB`
- **Protection**: Aucune (CORS OK)
- **Format**: JSON API
- **Free key**: `3` (fonctionne sans inscription)
- **Stats disponibles**: Scores, events, teams, lineups (pas de stats détaillées comme possession/xG)

| Avantage | Inconvénient |
|----------|-------------|
| Aucune protection | Pas de stats détaillées (possession, shots, etc.) |
| JSON simple | — |

---

### 5. football-data.org — VIABLE (Score: 3/5)

- **URL**: `https://api.football-data.org/v4/`
- **Protection**: Clé API requise (déjà dans `.env`)
- **Format**: JSON API
- **Free tier**: 10 req/min
- **Stats disponibles**: Scores, lineups, standings (pas de stats détaillées match par match sur le free tier)

| Avantage | Inconvénient |
|----------|-------------|
| Déjà configuré | Stats basiques seulement |

---

## Non-Viable Sources

### 6. SofaScore API — BLOQUÉ LOCALEMENT (Score: 5/5 en production)

- **URL**: `https://api.sofascore.com/api/v1/event/{id}/statistics`
- **Protection**: Blocage CDN Fastly (403) depuis IP locale. **FONCTIONNE sur le VPS Render.**
- **Code d'intégration**: Existe déjà dans `server.js` (`enrichMatchWithSofaLiveStats`, `findSofaEventId`)
- **Stats disponibles**: Les plus complètes (possession, xG, shots, corners, passes, fouls, cards, tackles, interceptions, clearances, saves, key passes, etc.)
- **Verdict**: Source PRIMAIRE en production (Render VPS), mais nécessite un fallback pour le dev local

---

### 7. WhoScored — BLOQUÉ (Score: 0/5)

- **Protection**: Cloudflare WAF Hard Block (403 direct, pas de JS challenge)
- **Résultat**: Aucune requête ne passe, même avec headers complets
- **Note**: Inaccessible sans Puppeteer/Playwright + residential proxies

---

### 8. Betmines — BLOQUÉ (Score: 0/5)

- **Protection**: Cloudflare 301 redirect sur toutes les requêtes
- **Résultat**: Aucun contenu accessible

---

### 9. 1xbet — BLOQUÉ (Score: 0/5)

- **Protection**: Cloudflare agressif + blocage IP
- **Résultat**: Inaccessible sans headless browser + residential proxies

---

### 10. FBref — BLOQUÉ (Score: 1/5)

- **Protection**: Cloudflare JS challenge (403)
- **Note**: Stats très détaillées (xG, progressive passes, pressures) mais inaccessible sans Puppeteer

---

### 11. ESPN FC — BLOQUÉ (Score: 1/5)

- **Protection**: AWS WAF JS challenge
- **Résultat**: API `site.api.espn.com` retourne 202/404

---

### 12. BeSoccer — NON VIABLE (Score: 0/5)

- `apiv2.besoccer.com`: NXDOMAIN (n'existe plus)
- API payante (€€€)
- Site principal: HTTP 406

---

### 13. OddsAlert — NON VIABLE (Score: 0/5)

- API payante uniquement

---

### 14. FotMob — PARTIEL (Score: 2/5)

- Homepage accessible (200 OK)
- API endpoints (`/api/matchDetails`, `/api/allMatches`): **404**
- Nécessiterait du scraping HTML complexe

---

## Architecture Recommandée

### Cascade de Sources (Fallback Chain)

```
PRIMAIRE:    SofaScore API (existant, fonctionne sur Render VPS)
  ↓ (si 403/timeout)
SECONDARY:   Flashscore.mobi (scraping HTML, pas de protection)
  ↓ (si Flashscore indisponible)
TERTIAIRE:   API-Football (JSON API, clé existante, 100 req/jour)
  ↓ (si quota dépassé)
QUATERNIAIRE: SoccerSTATS.com (scraping HTML, pas de protection)
```

### Implémentation

1. **SofaScore reste la source primaire** — déjà intégré, fonctionne en production
2. **Flashscore.mobi comme fallback #1** — scraping du `window.environment.props.feed`
3. **API-Football comme fallback #2** — JSON propre, clé existante
4. **SoccerSTATS comme fallback #3** — HTML scraping simple
5. **TTL 72h** — purge automatique des stats archivées

### Format de Stockage (SQLite)

```sql
CREATE TABLE IF NOT EXISTS match_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL UNIQUE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  score_home INTEGER,
  score_away INTEGER,
  source TEXT NOT NULL DEFAULT 'sofascore',
  -- Stats détaillées (JSON)
  stats_json TEXT NOT NULL,
  -- Métadonnées
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL,
  UNIQUE(match_id)
);
CREATE INDEX idx_match_stats_expires ON match_stats(expires_at);
```

---

## Parser — Flashscore.mobi

Le format compact utilise des délimiteurs `¬` et `÷`:

| Delimiter | Signification | Exemple |
|-----------|---------------|---------|
| `SE÷` | Section | `SE÷Match`, `SE÷1st Half`, `SE÷2nd Half` |
| `SF÷` | Catégorie | `SF÷Top stats`, `SF÷Shots`, `SF÷Attack` |
| `SD÷` | Stat ID | `SD÷xG`, `SD÷Possession` |
| `SG÷` | Nom de la stat | `SG÷Expected goals` |
| `SH÷` | Valeur équipe domicile | `SH÷1.21` |
| `SI÷` | Valeur équipe extérieur | `SI÷1.05` |
| `~` | Séparateur d'entrées | Entre chaque bloc de stat |

### Code — Extraction du Feed

```javascript
function extractFlashscoreFeed(html) {
    const match = html.match(/window\.environment\.props\.feed\s*=\s*"([^"]+)"/);
    if (!match) return null;
    const feed = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    return feed;
}
```

### Code — Parsing des Stats

```javascript
function parseFlashscoreStats(feed) {
    const stats = {};
    let currentSection = '';
    let currentCategory = '';

    const entries = feed.split('~');
    for (const entry of entries) {
        const fields = {};
        const parts = entry.split('¬');
        for (const part of parts) {
            if (!part) continue;
            for (const key of ['SE', 'SF', 'SD', 'SG', 'SH', 'SI']) {
                if (part.startsWith(key + '÷')) {
                    fields[key] = part.substring(key.length + 1);
                }
            }
        }

        if (fields.SE) currentSection = fields.SE;
        if (fields.SF) currentCategory = fields.SF;

        if (fields.SD && fields.SH !== undefined && fields.SI !== undefined) {
            if (!stats[currentSection]) stats[currentSection] = {};
            if (!stats[currentSection][currentCategory]) stats[currentSection][currentCategory] = {};
            stats[currentSection][currentCategory][fields.SD] = {
                name: fields.SG || fields.SD,
                home: fields.SH,
                away: fields.SI
            };
        }
    }
    return stats;
}
```

### Code — Conversion au Format PariScore

```javascript
const FLASHSCORE_STAT_MAP = {
    xG: 'xg',
    xGOT: 'xgot',
    'Ball possession': 'possession',
    'Total shots': 'total_shots',
    'Shots on target': 'shots_on_target',
    'Corner kicks': 'corners',
    'Passes accurate': 'passes',
    Fouls: 'fouls',
    xA: 'xa',
    'Duels won': 'duels_won',
    'Goalkeeper saves': 'saves'
};

function flashscoreStatsToPariScore(parsed) {
    const matchStats = parsed['Match'] || parsed['Full Match'] || {};
    const result = {};

    for (const [category, stats] of Object.entries(matchStats)) {
        for (const [key, values] of Object.entries(stats)) {
            const mappedKey = FLASHSCORE_STAT_MAP[key];
            if (!mappedKey) continue;

            if (key === 'Passes accurate') {
                result[mappedKey] = {
                    home: values.home,
                    away: values.away
                };
            } else {
                result[mappedKey] = {
                    home: parseFloat(values.home) || values.home,
                    away: parseFloat(values.away) || values.away
                };
            }
        }
    }

    if (parsed['1st Half']) result.first_half = flashscoreStatsToPariScore({ 'Match': parsed['1st Half'] });
    if (parsed['2nd Half']) result.second_half = flashscoreStatsToPariScore({ 'Match': parsed['2nd Half'] });

    return result;
}
```

---

## Mapping Stats Flashscore → PariScore

| Flashscore Key | PariScore Key | Description |
|---|---|---|
| xG | xg | Expected Goals |
| xGOT | xgot | Expected Goals on Target |
| Ball possession | possession | % possession |
| Total shots | total_shots | Tirs totaux |
| Shots on target | shots_on_target | Tirs cadrés |
| Corner kicks | corners | Corners |
| Passes accurate | passes | Passes (made/total/pct) |
| Fouls | fouls | Fautes |
| xA | xa | Expected Assists |
| Duels won | duels_won | Duels gagnés |
| Goalkeeper saves | saves | Arrêts gardien |