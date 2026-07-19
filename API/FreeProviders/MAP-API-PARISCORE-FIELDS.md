---
type: map
slug: free-api-pariscore-field-map
title: Map APIs gratuites → champs PariScore
status: active
tags: [map, free-apis, odds, live-scores, football, tennis, f1, graphify]
updated: 2026-07-19
sources:
  - "https://github.com/public-apis/public-apis#sports--fitness"
  - "server.js"
  - ".context/API-STUDY-FOOTBALL-2026.md"
  - "API/Cotes/Etudes/wiki-entity-odds-api.md"
xref:
  - [[therundown]]
  - [[oddsmagnet]]
  - [[sportscore]]
  - [[openligadb]]
  - [[propline]]
  - [[cloudbet]]
  - [[openf1]]
  - [[jolpica-f1]]
  - [[sportmonks]]
  - [[balldontlie]]
  - [[odds-api]]
  - [[bsd-bzzoiro]]
  - [[edge-no-vig]]
---

# Map APIs gratuites → champs PariScore

> Inventaire 2026-07-19. Toutes les APIs listées ont un **free tier vérifié**.
> Graphify : ce fichier + les entités `wiki-entity-*.md` du même dossier.

---

## 1. Stack actuel PariScore (sources déjà branchées)

| Source | Env key | Champs alimentés | Statut |
|--------|---------|------------------|--------|
| **BSD / Bzzoiro** | `BSD_API_KEY` | fixtures, live_score, standings, sr_stats, compare_odds | ✅ Primaire |
| **The Odds API** | `ODDS_API_KEY` | bookmakers[].odds h2h, oddsHistory | ⚠️ Legacy 500 req/mois |
| **API-Football** | `API_FOOTBALL_KEY` | stats, standings, odds (opt-in) | ⚠️ Kill-switch `AF_REMOVED` |
| **TheSportsDB** | `THESPORTSDB_KEY` | logos, metadata équipes | ✅ Free key `3` |
| **OddsPapi** | `ODDSPAPI_V4_KEY` | tennis set odds, sharp anchor | ✅ Partiel |
| **ESPN public** | none | standings fallback | ✅ Zéro quota |
| **Sofascore** | Playwright µsvc | live stats (possession, shots) | ⚠️ Cloudflare |
| **Sportmonks** | `SPORTMONKS_API_KEY` | déjà prévu dans server.js | ⚠️ Free = 2 ligues |

---

## 2. Nouvelles APIs gratuites → champs PariScore

### 2.1 Cotes & bookmakers

| Champ PariScore | Code / UI | API gratuite | Endpoint / usage | Priorité |
|-----------------|-----------|--------------|------------------|----------|
| `bookmakers[].h2h` (1X2) | `fetchOdds()`, MatchCard odds | **[[therundown]]** Free | REST prematch 3 books (DK/FD/BetMGM) | 🔴 P0 |
| `bookmakers[].h2h` multi-EU | idem | **[[cloudbet]]** Feed Affiliate | `/v2/odds/*` | 🟡 P1 |
| `best_odds` / compare | UI "meilleure cote" | **[[therundown]]** + **[[propline]]** | best lines + 13 books | 🔴 P0 |
| `oddsHistory[]` / dropping odds | cron snapshot 2h | **[[oddsmagnet]]** free daily parquet | `data.oddsmagnet.com/history-daily/` | 🔴 P0 |
| CLV / closing lines | admin KPIs, edge | **[[oddsmagnet]]** agrégé | backtest stratégies | 🟡 P1 |
| Player props | PowerScore / Deep Analysis | **[[propline]]** Free 1k/j | `/v1/sports/{sport}/odds?markets=props` | 🟡 P1 |
| +EV / no-vig | `computeWFV1N2`, edge-no-vig | **[[propline]]** Hobby+ | `/ev` Pinnacle anchor | 🟢 P2 (payant $9) |
| Prediction markets | Markets tab | **[[propline]]** Free | Kalshi + Polymarket inclus | 🟡 P1 |
| Tennis set odds | tennis fetchOdds | **[[therundown]]** Free (ATP/WTA) | leagues tennis | 🟡 P1 |

### 2.2 Live scores & match state

| Champ PariScore | Code / UI | API gratuite | Usage | Priorité |
|-----------------|-----------|--------------|-------|----------|
| `live_score` | Live tab, SSE pulse | **[[sportscore]]** | live scores foot/basket/tennis | 🔴 P0 |
| `live_minute` | Live Intensity | **[[sportscore]]** | match clock | 🔴 P0 |
| fixtures / schedule | MatchesTab | **[[sportscore]]** + **[[openligadb]]** | calendrier + résultats | 🟡 P1 |
| `status` (NS/LIVE/FT) | match cards | **[[sportscore]]** | status mapping | 🔴 P0 |
| archivePastMatches scores | archive cron | **[[openligadb]]** (DE) + SportScore | scores finaux | 🟡 P1 |

### 2.3 Standings & forme

| Champ PariScore | Code / UI | API gratuite | Usage | Priorité |
|-----------------|-----------|--------------|-------|----------|
| `db.teamStats` / rank | standings panel | **[[openligadb]]** | Bundesliga 1/2/3 | 🟡 P1 |
| standings multi-sport | Standings UI | **[[sportscore]]** | foot + basket + tennis | 🟡 P1 |
| forme (W-D-L) | match card form badges | dérivé scores SportScore/OpenLigaDB | post-process | 🟢 P2 |

### 2.4 Stratégies & value bets

| Champ PariScore | Code / UI | API gratuite | Usage | Priorité |
|-----------------|-----------|--------------|-------|----------|
| `STRATEGIES` inputs (odds + probs) | engine stratégies | **[[therundown]]** cotes + BSD probs | refresh cotes sans brûler Odds API | 🔴 P0 |
| ValueBet / surebet | detectSurebet1N2 | multi-book TheRundown/PropLine/Cloudbet | cross-book edge | 🔴 P0 |
| backtest historique | admin / strategies QA | **[[oddsmagnet]]** daily parquet | CLV + ROI sim | 🟡 P1 |
| Kelly sizing | bankroll module | cotes free → same pipeline | pas de nouvelle source | — |

### 2.5 Logos & metadata

| Champ PariScore | Code / UI | API gratuite | Usage | Priorité |
|-----------------|-----------|--------------|-------|----------|
| `team_logos` | match cards, badges | **TheSportsDB** (déjà) | garder | ✅ |
| artwork / fanart | optional | TheSportsDB | déjà branché | ✅ |

### 2.6 Sports additionnels

| Champ / feature | Code / UI | API gratuite | Usage | Priorité |
|-----------------|-----------|--------------|-------|----------|
| F1 résultats historiques | futur onglet F1 | **[[jolpica-f1]]** | `api.jolpi.ca/ergast/f1/` | 🟢 P2 |
| F1 live telemetry | futur live F1 | **[[openf1]]** historique free / live payant | openf1.org | 🟢 P2 |
| NBA games/players | éventuel basket | **[[balldontlie]]** Free | teams/players/games basique | 🟢 P2 |
| Sportmonks foot deep | backup BSD | **[[sportmonks]]** Free 2 ligues | sandbox only | 🟢 P3 |

---

## 3. Matrice champ → API (résumé graph)

```
PARISCORE FIELDS                    FREE APIs
─────────────────                   ─────────
bookmakers.h2h          ←────────── TheRundown (P0), Cloudbet (P1), PropLine (P1)
best_odds               ←────────── TheRundown, PropLine
oddsHistory / dropping  ←────────── Oddsmagnet daily (P0)
player_props            ←────────── PropLine (P1)
+EV / no-vig            ←────────── PropLine Hobby (P2 paid)
prediction_markets      ←────────── PropLine Kalshi/Polymarket (P1)
live_score / minute     ←────────── SportScore (P0)
fixtures / status       ←────────── SportScore, OpenLigaDB
standings / teamStats   ←────────── OpenLigaDB (DE), SportScore
STRATEGIES engine       ←────────── TheRundown odds + BSD probs
ValueBet / surebet      ←────────── multi-book free chain
backtest / CLV          ←────────── Oddsmagnet parquet
team_logos              ←────────── TheSportsDB (existant)
F1 history              ←────────── Jolpica-F1 (P2)
F1 live                 ←────────── OpenF1 paid (P2)
NBA basic               ←────────── balldontlie free (P2)
```

---

## 4. Chaîne de fallback recommandée (cotes)

Remplace / complète la chaîne actuelle `Odds API → AF odds → BSD → null` :

```
1. BSD compare_odds / best_odds     (déjà payé, primaire)
2. TheRundown Free                  (20k pts/j, 3 books US)
3. PropLine Free                    (1k req/j, 13 books + exchanges)
4. Cloudbet Feed Affiliate          (cotes crypto book, free key)
5. The Odds API                     (legacy, 500/mois — last resort)
6. Oddsmagnet daily                 (historique only, pas live)
→ null
```

## 5. Chaîne de fallback recommandée (live scores)

```
1. BSD live events                  (primaire)
2. SportScore                       (free, no key, attribution)
3. OpenLigaDB                       (Allemagne only)
4. ESPN public                      (déjà en place)
5. Sofascore Playwright µsvc        (dernier recours)
→ mock / stale cache
```

---

## 6. Env keys à ajouter (.env.example)

```bash
# ── Free APIs 2026-07-19 (public-apis Sports & Fitness) ──
THERUNDOWN_API_KEY=          # free: 20k datapoints/day — https://therundown.io
PROPLINE_API_KEY=            # free: 1000 req/day — https://prop-line.com
CLOUDBET_API_KEY=            # free affiliate feed — https://www.cloudbet.com/api/
# Oddsmagnet: no key (data.oddsmagnet.com/history-daily/)
# SportScore: no key (attribution link required)
# OpenLigaDB: no key (api.openligadb.de)
# Jolpica F1: no key (api.jolpi.ca/ergast/f1/)
# OpenF1 history: no key — live requires paid
# SPORTMONKS_API_KEY already in server.js
```

---

## 7. Points d'intégration code (server.js)

| Fonction / zone | Ligne approx | Brancher |
|-----------------|--------------|----------|
| `fetchOdds()` | ~17240 | TheRundown + PropLine fallback |
| `oddsHistory[]` snapshot | cron 2h | Oddsmagnet daily ingest |
| live pulse / SSE | pulse module | SportScore poll |
| `archivePastMatches` | ~8170 | SportScore FT scores |
| standings BSD fail | ~15214 | OpenLigaDB si ligue DE |
| STRATEGIES eval | ~11415 | odds fraîches multi-source |
| `detectSurebet1N2` / edge | edge-no-vig | multi-book free chain |
| tennis odds | Oddspapi path | TheRundown tennis markets |

---

## 8. Contraintes free tier (ne pas oublier)

| API | Hard limit free | Attribution / CGU |
|-----|-----------------|-------------------|
| TheRundown | 20k pts/j, 5 min delay, 3 books | signup key |
| Oddsmagnet | daily aggregate only (pas book-level live) | free parquet |
| SportScore | ~10k req/j/IP | **lien "Powered by SportScore" obligatoire** |
| OpenLigaDB | community, pas de SLA | ODbL |
| PropLine | 1k req/j | signup key |
| Cloudbet | account + affiliate/trading key | deposit pour trading |
| OpenF1 | history free ; **live payant** | — |
| Sportmonks Free | DK Superliga + Scottish Prem only | signup |
| balldontlie Free | 5 req/min, endpoints basiques | signup |
| Jolpica F1 | ~200 req/h | open source, Ko-fi |

---

## 9. Related entities

- [[therundown]] — cotes multi-book free
- [[oddsmagnet]] — historique cotes UK
- [[sportscore]] — live scores free
- [[openligadb]] — foot DE crowdsourced
- [[propline]] — props + exchanges
- [[cloudbet]] — feed bookmaker crypto
- [[openf1]] — F1 live/history
- [[jolpica-f1]] — Ergast successor
- [[sportmonks]] — foot deep (free limité)
- [[balldontlie]] — NBA free limité
- [[odds-api]] — legacy The Odds API
- [[bsd-bzzoiro]] — source primaire payante
- [[edge-no-vig]] — consommateur cotes
