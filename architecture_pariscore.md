# ️ Architecture PariScore — Feuille de Route Technique

**Version** : v12.81  
**Date** : 2026-06-16  
**Auteur** : CTO & Lead Data Scientist  
**Statut** : Document de référence pour le sprint performance

---

## 1. 📁 Arborescence du Projet

### Structure Principale

```
ParisScorebis/
├── server.js                    # Backend monolithique (47k+ lignes) — HTTP, SQLite, data fusion, routes API
├── pariscore.html               # Frontend SPA mono-fichier (30k+ lignes) — Design System V2.0
├── pariscore.js                 # JS frontend extrait (29k+ lignes) — généré depuis pariscore.html
├── admin.html                   # Dashboard admin
├── package.json                 # Dépendances minimales (better-sqlite3, hltv)
├── .env                         # Variables d'environnement (API keys) — JAMAIS commit
├── pariscore.db                 # Base SQLite WAL (production)
── database.db                  # Base SQLite legacy
│
├── services/                    # Microservices verticaux par sport
│   ├── basketballService.js     # NBA vertical (ESPN, Elo+FourFactors)
│   ├── wnbaService.js           # WNBA vertical (miroir NBA)
│   ├── cs2Service.js            # CS2/CSGO BSD addon + HLTV rankings
│   ├── berserkService.js        # Berserk League 1v1 scraper
│   ├── liquipediaService.js     # Liquipedia tier3 CS2 matches
│   ├── mmaService.js            # MMA/UFC pipeline
│   ├── f1Service.js             # F1 vertical (Jolpica-Ergast + ESPN, Plackett-Luce + Monte-Carlo)
│   ├── betexplorerService.js    # BetExplorer dropping odds tennis
│   ├── rotowireService.js       # Rotowire scaffold (injuries/lineups/projections) — WIP
│   ├── mlInferenceService.js    # Inférence CatBoost football
│   ── mlLogistic.js            # Régression logistique ML
│
├── scripts/                     # Scripts cron et utilitaires
│   ├── cron_refresh_match_stats.js  # Refresh quotidien match_stats_history (03:00 UTC)
│   ├── cron-tennis-elo.sh       # Cron recalcul Elo tennis
│   ├── fbref_extract.py         # Extraction stats avancées FBref
│   ├── scrape_advanced_stats.py # Scraping stats avancées
│   ├── notify_telegram_cdm.js   # Notifications Telegram CDM
│   ├── send_mass_email_cdm.js   # Emailing masse CDM
│   ├── sanity-vision-monitor.js # Monitor sanity vision
│   └── vault-*.js               # Scripts Vault (daily summary, incidents, weekly review)
│
├── tools/                       # Outils one-shot et utilitaires
│   ├── cron-rg-prefetch.js      # Prefetch Roland Garros (cron PM2)
│   ├── recompute-tennis-elo.js  # Recalcul massif Elo tennis
│   ├── scrape-tennis-abstract-elo.js  # Scraper Tennis Abstract Elo
│   ├── backfill-tennis-serve-stats.js   # Backfill stats service tennis
│   ├── train-mma-model.py       # Entraînement modèle MMA
│   ├── build_mma_model.js       # Build modèle MMA JS
│   ├── pariscore-eda.py         # EDA Python
│   └── docker/                  # Configs Docker
│
├── workers/                     # Web Workers (off-thread)
│   └── rg_monte_carlo.js        # Monte Carlo Roland Garros (worker_threads)
│
├── models/                      # Modèles ML entraînés
│   ├── catboost_football_1x2_v1.cbm   # CatBoost 1X2 football
│   ├── catboost_football_btts_v1.cbm  # CatBoost BTTS football
│   └── catboost_football_over25_v1.cbm # CatBoost Over 2.5 football
│
├── ml/                          # Pipeline ML Python
│   ├── train_catboost.py        # Entraînement CatBoost
│   ├── infer_catboost.py        # Inférence CatBoost
│   └── requirements-catboost.txt
│
├── data/                        # Données persistantes et historiques
│   ├── database.db              # SQLite legacy
│   ├── historique_bsd_tennis.json   # Historique BSD tennis
│   ├── historique_elofootball.json  # Historique Elo football
│   ├── historique_tennis.json       # Historique tennis
│   ├── historique_wikidata.json     # Historique Wikidata
│   ├── national_elo.json            # Elo équipes nationales
│   ├── nba_elo.json                 # Elo NBA
│   ├── wnba_elo.json                # Elo WNBA
│   ├── hltv_rankings.json           # Rankings HLTV CS2
│   ├── hltv_map_rankings.json       # Map rankings HLTV
│   ├── hltv_team_mapstats.json      # Team mapstats HLTV
│   ├── bo3_map_rounds.json          # Stats rounds BO3
│   ├── f1_assets.json               # Assets F1 (circuits, équipes)
│   ├── tennis-player-photos.json    # Photos joueurs tennis
│   ├── mma_fighter_features.json    # Features fighters MMA
│   ├── mma_fighter_photos.json      # Photos fighters MMA
│   ├── fbref_advanced/              # Stats avancées FBref (cache)
│   └── backup-transfert/            # Backups transfert
│
── docs/                        # Documentation technique
│   ├── specs/                   # Spécifications fonctionnelles
│   │   ├── vault-config-reference.md
│   │   ├── vault-daily-summary.md
│   │   ── ...
│   ├── audit_and_integration_keodinh.md
│   ├── cs2_esportsoracle_audit.md
│   ├── cs2_hltv_deep_audit.md
│   ├── cs2_roadmap_and_design.md
│   ├── ml_models_comparison.md
│   ├── scientific_watch.md
│   └── tennis-elo-enrichment.md
│
├── .context/                    # Contexte session, audits, rapports
│   ├── audits/                  # Rapports d'audit
│   ├── reports/                 # Rapports techniques
│   ├── strategy/                # Documents stratégiques
│   ├── knowledge/               # Base de connaissances
│   ├── ops/                     # Documentation ops
│   ├── wiki/                    # Wiki interne
│   ├── marketing/               # Assets marketing
│   ├── prompts-claude/          # Prompts Claude
│   ├── i18n/                    # Fichiers i18n
│   └── ... (197 fichiers)
│
├── mobile/                      # App mobile Flutter
│   ├── android/                 # Build Android
│   ├── lib/                     # Code Dart
│   ├── test/                    # Tests
│   ├── windows/                 # Build Windows
│   └── pubspec.yaml
│
├── tests/                       # Tests unitaires et intégration
├── exports/                     # Exports données
├── logs/                        # Logs serveur
├── image/                       # Assets images
├── assets/                      # Assets statiques
├── locales/                     # Fichiers i18n
├── shadow/                      # Shadow DOM / expérimental
├── pm-skills-plugins/           # Plugins PM
├── gstack-opencode/             # Config GStack
├── .agents/                     # Config agents IA
├── .beads/                      # Tracker issues Beads
├── .planning/                   # Planification
├── .worktrees/                  # Git worktrees
└── .venv-data/                  # Environnement virtuel Python
```

### Fichiers Clés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `server.js` | Backend monolithique — HTTP server, SQLite, data fusion, toutes routes API | 47 384 |
| `pariscore.html` | Frontend SPA — Design System V2.0, tous les onglets | ~30 000 |
| `pariscore.js` | JS frontend extrait (généré) | 29 488 |
| `eloCalculator.js` | Calculateur Elo tennis (WElo Kovalchik) | ~200 |
| `glicko2Calculator.js` | Glicko-2 Tennis Skills (serve/return) | ~260 |
| `momentumTennis.js` | K-Flow + SM momentum tracker | ~150 |
| `playerMomentum.js` | OSS Pulse momentum scoring | ~130 |
| `betfairService.js` | Betfair Exchange WOM API | ~400 |
| `oddspapi.js` | OddsPapi.io secondary source | ~300 |
| `odds-rapidapi.js` | RapidAPI odds enrichment | ~250 |
| `odds-apifootball.js` | API-Football odds (opt-in) | ~200 |

---

## 2. 🔄 Flux de Données (Data Pipeline)

### Architecture Générale

```
─────────────────────────────────────────────────────────────────────────────┐
│                          SOURCES DE DONNÉES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  BSD ($5/mo + WS push)  │  ESPN public  │  Odds API  │  openfootball ODbL   │
│  Wikidata CC0           │  felipeall    │  elofootball│  aiscore.com (throttled)│
│  xvalue.ai (GO 85/100)  │  OddsPapi.io  │  Betfair   │  HLTV / Liquipedia   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATEUR (server.js)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Polling HTTP │  │ WebSocket    │  │ Cron Jobs    │  │ Cache Layer  │   │
│  │ (BSD, ESPN,  │  │ (BSD push)   │  │ (PM2 cron)   │  │ (in-memory)  │   │
│  │ Odds API)    │  │              │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                    │                                      │
│  ┌─────────────────────────────────┴──────────────────────────────────┐   │
│  │                    DATA FUSION ENGINE                               │   │
│  │  - Fusion multi-sources (BSD + ESPN + Odds API)                    │   │
│  │  - Calcul probabilités (Poisson, Bayésien, CatBoost)               │   │
│  │  - Enrichissement (Elo, Glicko-2, Momentum, xG)                    │   │
│  │  - Calibration ML (backtest was_winner_correct)                    │   │
│  └─────────────────────────────────┬──────────────────────────────────   │
│                                    │                                      │
│  ┌─────────────────────────────────┴──────────────────────────────────┐   │
│  │                    SQLite WAL (pariscore.db)                        │   │
│  │  - matches, team_stats, player_stats, match_stats_history          │   │
│  │  - archive_matches (9 sources), team_season_stats (5 saisons)      │   │
│  │  - tennis_matches, tennis_player_elo, tennis_momentum              │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────
│                          API REST INTERNE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  GET /api/v1/matches          │  GET /api/v1/tennis/top10                   │
│  GET /api/v1/stats/:id        │  GET /api/v1/tennis/live                    │
│  GET /api/v1/status           │  GET /api/v1/tennis/detail/:id              │
│  GET /api/v1/top-matches      │  GET /api/v1/tennis/momentum                │
│  GET /api/v1/top-strategy     │  GET /api/v1/tennis/glicko2/stats           │
│  GET /api/v1/hot-picks        │  GET /api/v1/tennis/predictions/:id         │
│  GET /api/v1/sure-bets        │  GET /api/v1/tennis/h2h                     │
│  GET /api/v1/arbitrage        │  GET /api/v1/tennis/tex/*                   │
│  GET /api/v1/trends           │  GET /api/v1/tennis-abstract/*              │
│  GET /api/v1/league-hub/:key  │  GET /api/v1/tennis/uqd                     │
│  ...                          │  ...                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND SPA (pariscore.html)                            │
─────────────────────────────────────────────────────────────────────────────┤
│  - Design System V2.0 (tokens --cf-*)                                       │
│  - Onglets : Football, Tennis, CS2, MMA, NBA, WNBA, F1, CDM 2026, RG       │
│  - KPI temps réel, cartes matchs, modals détaillés                          │
│  - SSE (Server-Sent Events) pour updates live                               │
│  - Service Worker (sw.js) pour cache offline                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Tennis — Détail

```
1. POLLING (toutes les 30s)
   └─ pollTennisLive() → ESPN live scoreboard
   └─ handleTennisBSD() → BSD API v2/matches (TTL 30min scheduled / 4h date-specific)
   └─ fetchTennisOddsAPI() → Odds API cotes (TTL 2h)
   └─ fetchBSDTennisPredictions() → BSD ML predictions (TTL 15min)

2. ENRICHISSEMENT (synchrone, cache chaud)
   ─ _buildTennisValueBetsCore() :
      ├─ Fusion BSD + ESPN (fallback si BSD KO)
      ├─ Lookup predictions BSD (predMap)
      ├─ Lookup calibration ML (calib)
      ├─ Lookup rankings (rankIdx)
      ├─ Calcul Elo surface (tennisEloCalculator)
      ├─ Calcul Glicko-2 (tennisGlicko2)
      ├─ Calcul Momentum (tennisMomentumTracker)
      ├─ Calcul Markov chain (set_probs)
      ├─ Calcul Sackmann (TA historical)
      ├─ Enrichissement odds BSD (_fetchBSDTennisOdds, batch)
      ├─ Calcul confidence_badge (calibration accuracy)
      ├─ Calcul predictive bets (PredScore composite)
      ─ Retour { status: 200, body: { matches: [...] } }

3. CACHE (stale-while-revalidate)
   └─ _tennisVBCache (TTL 4min / 60s dégradé ESPN)
   └─ _tnTop10Cache (TTL 60s viewer / 30s bettor) ← À OPTIMISER
   ─ _bsdTennisOddsCache (TTL 3h)
   └─ apiCacheGet/Set (cache générique)

4. ROUTE TOP 10
   └─ GET /api/v1/tennis/top10?mode=viewer|bettor
      ├─ Check cache _tnTop10Cache[mode] (TTL)
      ├─ Si hit → retour instantané
      ├─ Si miss → appel buildTennisValueBets() (cold ~15-20s)
      ├─ Scoring composite 6D (computeScoreTop10Tennis)
      ├─ Filtre diversité (_applyTop10DiversityFilter)
      ├─ Top 10 + cache update
      └─ Retour JSON
```

### Mémoire Partagée

| Variable | Type | Rôle | TTL |
|----------|------|------|-----|
| `db.matches` | Array | Matchs football en mémoire | Session |
| `db.teamStats` | Object | Stats équipes football | Session |
| `_tennisVBCache` | Map | Cache tennis value bets | 4min / 60s |
| `_tnTop10Cache` | Object | Cache TOP 10 tennis | 60s / 30s |
| `_tennisLiveCache` | Object | Cache live tennis ESPN | 30s |
| `_tennisOddsCache` | Object | Cache cotes tennis | 2h |
| `_bsdTennisOddsCache` | Map | Cache odds BSD tennis | 3h |
| `apiCache` | Map | Cache générique API | Variable |
| `tennisEloCalculator` | Instance | Calculateur Elo tennis | Session |
| `tennisGlicko2` | Instance | Calculateur Glicko-2 | Session |
| `tennisMomentumTracker` | Instance | Tracker momentum | Session |
| `playerMomentumScorer` | Instance | Scorer momentum OSS | Session |

### Stockage Base de Données

**SQLite WAL** (`pariscore.db`) :

| Table | Contenu | Taille estimée |
|-------|---------|----------------|
| `matches` | Matchs football (BSD + fusion) | ~10k rows |
| `team_stats` | Stats équipes (home/away splits) | ~500 rows |
| `player_stats` | Stats joueurs | ~2k rows |
| `match_stats_history` | Historique xG + splits MT (66 ligues BSD) | ~50k rows |
| `archive_matches` | Archive 9 sources (football-data.co.uk, etc.) | ~100k rows |
| `team_season_stats` | Standings 5 saisons/ligue | ~5k rows |
| `tennis_matches` | Matchs tennis (BSD + ESPN) | ~5k rows |
| `tennis_player_elo` | Elo surface joueurs tennis | ~3k rows |
| `tennis_momentum` | Momentum joueurs tennis | ~3k rows |
| `users` | Utilisateurs authentifiés | ~100 rows |
| `sessions` | Sessions JWT | ~500 rows |
| `match_timeline_snapshots` | Snapshots minute-par-minute (cron live) | ~20k rows |
| `player_surface_scores` | SPS computed by cron_sps_updater.py | ~3k rows |

---

## 3. 🧮 Cycle d'Analyse — Extraction des 'Top Matchs'

### Algorithme Composite 6 Dimensions (Tennis)

**Route** : `GET /api/v1/tennis/top10?mode=viewer|bettor`  
**Fonction** : `computeScoreTop10Tennis(e, mode)` (server.js:25549)

#### Formule

```
score = W.entropy × D_entropy 
      + W.ev × D_ev 
      + W.elo × D_elo 
      + W.stakes × D_stakes 
      + W.urgency × D_urgency 
      + D.movement × D_movement
```

#### Poids par Mode

| Dimension | Viewer | Bettor |
|-----------|--------|--------|
| **D1: Entropy** (équilibre match) | 20% | 20% |
| **D2: EV Quality** (value bet) | 15% | 30% |
| **D3: Elo Competitiveness** | 15% | 20% |
| **D4: Stakes** (tier × round) | 20% | 5% |
| **D5: Urgency** (temps avant match) | 20% | 15% |
| **D6: Line Movement** (cotes) | 10% | 10% |

#### Détails des Dimensions

**D1: Entropy** — Équilibre du match  
```javascript
p1 = predictions.blended.p1 (clamp 0.01-0.99)
p2 = 1 - p1
D_entropy = -(p1 × log2(p1) + p2 × log2(p2))  // max 1.0 à p1=p2=0.5
```

**D2: EV Quality** — Value bet pondérée par confiance  
```javascript
ev = best_edge.edge (edge % vs cote)
confAcc = confidence_badge.accuracy / 100 (calibration ML)
D_ev = ev > 0 ? (ev × confAcc / 15) : 0  // clamp 0-1
```

**D3: Elo Competitiveness** — Compétitivité Elo surface  
```javascript
elo1 = player1.elo_surface (default 1500)
elo2 = player2.elo_surface (default 1500)
eloDelta = |elo1 - elo2|
D_elo = ((elo1 + elo2) / 2 / 2200) × max(0, 1 - eloDelta / 400)
```

**D4: Stakes** — Enjeu du tournoi × round  
```javascript
D_stakes = tierWeight(tour) × roundWeight(round)

tierWeight :
  Grand Slam / Roland Garros / Wimbledon / US Open / Australian Open → 1.0
  Masters 1000 / WTA 1000 → 0.9
  ATP 500 / WTA 500 → 0.75
  WTA → 0.55
  ATP 250 → 0.60
  Challenger → 0.40
  ITF → 0.20

roundWeight :
  Final → 1.0
  Semi → 0.9
  Quarter → 0.8
  R16 → 0.65
  R32 → 0.50
  R64 → 0.40
  Round Robin → 0.60
```

**D5: Urgency** — Temps avant le match  
```javascript
if isLive → 1.0
if start_time <= now → 0.7
if hours <= 1 → 0.9
if hours <= 3 → 0.75
if hours <= 12 → 0.5
else → 0.2
```

**D6: Line Movement** — Mouvement des cotes + profondeur bookmakers  
```javascript
ods = bsd_odds_summary || _live._bsd_odds || _bsd_odds
mvScore = (movement_p1 === 'SHORTENING' ? 0.5 : 0) 
        + (movement_p2 === 'SHORTENING' ? 0.5 : 0)
bkNorm = books_count / 14 (clamp 0-1)
D_movement = mvScore × 0.6 + bkNorm × 0.4
```

#### Bonus Flat

```javascript
// Live drama
if isLive && setsPlayed >= 2 → score += 0.15
if isLive && current_set == 6-6 → score += 0.10

// Reverse Line Movement (bettor only)
if isBettor && ev > 5 && modelFavorsP1 && marketDriftsP1 → score += 0.15
if isBettor && ev > 5 && modelFavorsP2 && marketDriftsP2 → score += 0.15
```

#### Data Completeness Gate

```javascript
hasOdds = odds.p1 || odds.p2 ? 1 : 0
hasElo = player1.elo_surface != null ? 1 : 0
hasBl = predictions.blended ? 1 : 0
hasEdge = best_edge != null ? 1 : 0
hasConf = confidence_badge != null ? 1 : 0

completeness = (hasOdds + hasElo + hasBl + hasEdge + hasConf) / 5
dataGate = completeness < 0.6 ? 0.3 : 1.0

score_final = score × dataGate
```

#### Filtre de Diversité

```javascript
function _applyTop10DiversityFilter(ranked) {
  const cnt = {};
  return ranked.filter(m => {
    const k = tournament.toLowerCase().slice(0, 40);
    cnt[k] = (cnt[k] || 0) + 1;
    return cnt[k] <= 3;  // max 3 matchs par tournoi
  });
}
```

#### Tags Raison

```javascript
if isLive → 'EN DIRECT'
else if D_ev > 0.55 → 'VALEUR'
else if D_movement > 0.5 → 'VAPEUR'
else if D_stakes > 0.7 → 'CLASSIQUE'
else if D_entropy > 0.88 → 'DRAMA'
else if eloDelta > 200 → 'UPSET'
else → 'ANALYSE'
```

### Coefficients Algorithmiques Corrélés

#### Glicko-2 (Tennis Skills)

**Fichier** : `glicko2Calculator.js`  
**Instance** : `tennisGlicko2` (server.js)

- **Rating** (μ) : interval scale rating (default 1500)
- **Rating Deviation** (RD) : incertitude (default 350)
- **Volatility** (σ) : variabilité forme (default 0.06)

**Compétences séparées** :
- `serveCalc` : Glicko-2 sur % points gagnés au service (SPW)
- `returnCalc` : Glicko-2 sur % points gagnés au retour (RPW)

**Mise à jour** : après chaque match via `updateRating(matchId, result)`

#### Elo Dynamique (WElo Kovalchik)

**Fichier** : `eloCalculator.js`  
**Instance** : `tennisEloCalculator` (server.js)

- **Formule** : WElo (Weighted Elo) avec facteur surface
- **K-factor** : dynamique selon importance match
- **Surface adjustment** : Elo séparé par surface (Hard, Clay, Grass)
- **FiveThirtyEight** : intégration modèle Kovalchik

**Mise à jour** : `updateElo(player1, player2, result, surface, tour)`

#### Momentum (K-Flow + SM)

**Fichier** : `momentumTennis.js`  
**Instance** : `tennisMomentumTracker` (server.js)

- **K-Flow** : momentum basé sur séquence de points (win/loss streaks)
- **SM (Score Momentum)** : momentum basé sur score actuel (sets, games)
- **Fenêtre** : 7, 14, 30 jours pour consistency score

**Mise à jour** : `updateMomentum(matchId, pointResult)`

#### OSS Pulse Momentum

**Fichier** : `playerMomentum.js`  
**Instance** : `playerMomentumScorer` (server.js)

- **Pulse Score** : score momentum 0-100 basé sur forme récente
- **Consistency** : régularité sur fenêtre glissante
- **Trend** : direction (up/down/stable)

**Mise à jour** : `updatePulse(playerId, matchResult)`

### Pipeline de Calcul (Ordre d'Exécution)

```
1. buildTennisValueBets() appelé (cache miss ou stale)
   │
   ├─ 1.1 Fetch BSD matches (handleTennisBSD)
   ├─ 1.2 Fallback ESPN si BSD KO
   ├─ 1.3 Fetch predictions BSD (fetchBSDTennisPredictions)
   ├─ 1.4 Fetch calibration ML (buildBSDTennisCalibration)
   ├─ 1.5 Fetch rankings (rankIdx)
   │
   ├─ 2. Boucle d'enrichissement par match :
   │   ├─ 2.1 Lookup predictions (predMap)
   │   ├─ 2.2 Lookup calibration (calib)
   │   ├─ 2.3 Calcul Elo surface (tennisEloCalculator.getElo)
   │   ├─ 2.4 Calcul Glicko-2 (tennisGlicko2.serveCalc/returnCalc)
   │   ├─ 2.5 Calcul Momentum (tennisMomentumTracker.getMomentum)
   │   ├─ 2.6 Calcul Markov chain (set_probs)
   │   ├─ 2.7 Calcul Sackmann (TA historical)
   │   ├─ 2.8 Enrichissement odds BSD (_fetchBSDTennisOdds)
   │   ├─ 2.9 Calcul confidence_badge (calibration accuracy)
   │   └─ 2.10 Calcul predictive bets (computeTennisPredictiveBets)
   │
   ├─ 3. Retour { status: 200, body: { matches: [...] } }
   │
   ─ 4. Cache update (_tennisVBCache.set)

5. Route TOP 10 appelée
   │
   ├─ 5.1 Check cache _tnTop10Cache (TTL)
   ├─ 5.2 Si hit → retour instantané
   ├─ 5.3 Si miss → appel buildTennisValueBets()
   ├─ 5.4 Scoring composite 6D (computeScoreTop10Tennis)
   ├─ 5.5 Filtre diversité (_applyTop10DiversityFilter)
   ├─ 5.6 Top 10 + cache update
   └─ 5.7 Retour JSON
```

---

## 4. 🚨 Problème Identifié — Latence TOP 10

### Symptôme

- Clic sur onglet 'TOP' → latence serveur → affichage "Données indisponibles"
- KPI affichent les vraies valeurs (14 Matchs, 12 Paris, 14 Top Matchs) mais le contenu ne charge pas

### Root Cause

1. **Cache TTL trop court** : `_tnTop10Cache` TTL = 60s (viewer) / 30s (bettor)
2. **Cold build bloquant** : `buildTennisValueBets()` = ~15-20s sur 420 matchs
3. **Premier appel sans cache** : retourne `{ loading: true, building: true }` → frontend affiche "Données indisponibles"
4. **Pattern stale-while-revalidate** déjà en place mais insuffisant pour le premier appel

### Solution Proposée

1. **Augmenter TTL cache TOP 10** : 60s → 5min (viewer), 30s → 3min (bettor)
2. **Warmer au boot** : pré-calculer le cache TOP 10 au démarrage du serveur
3. **Fallback gracieux** : servir l'ancien cache en cas d'erreur de rebuild
4. **Background refresh** : cron intervalle 5min pour rafraîchir le cache

---

## 5. 📋 Prochaines Étapes

### Sprint Performance (2026-06-16)

| # | Tâche | Priorité | Estimation |
|---|-------|----------|------------|
| 1 | Augmenter TTL cache TOP 10 (5min/3min) | HIGH | 15min |
| 2 | Implémenter warmer boot TOP 10 | HIGH | 30min |
| 3 | Ajouter fallback gracieux sur ancien cache | HIGH | 20min |
| 4 | Cron background refresh 5min | MEDIUM | 30min |
| 5 | Tests performance (avant/après) | HIGH | 45min |
| 6 | Documentation CHANGELOG.md | LOW | 15min |

### Critères de Validation

- Temps de réponse TOP 10 < 100ms (cache hit)
- Temps de réponse TOP 10 < 5s (cache miss avec fallback)
- Zéro affichage "Données indisponibles" en conditions normales
- Cache rafraîchi toutes les 5min maximum

---

**Document généré le 2026-06-16 par l'agent CTO Pariscore**
