# 📊 Inventaire Bases de Données — Onglet Historique PariScore

> **Date** : 21 mai 2026
> **Document** : `.context/databases_historique_inventory.md`
> **Source de vérité** : `server.js` + `pariscore.html`
> **Périmètre** : toutes les sources alimentant `#page-historique` (Foot + Tennis)

---

## 🎯 RÉSUMÉ — db.archive_matches (cœur)

L'onglet Historique consomme **une seule structure de données** côté frontend :
- Backend : `db.archive_matches` (array in-memory + persist SQLite kv)
- Route API : `GET /api/v1/history/query` → `runHistoryQuery()` filtre + paginate
- Frontend : `#page-historique` (38 classes `.dh-*` UI)

**`db.archive_matches` est alimenté par 8 sources distinctes** (3 live runtime + 5 ETL bootstrap).

---

## 1. SOURCES LIVE RUNTIME (mises à jour continues)

### 1.1 `archivePastMatches()` — Live → Archive
| Champ | Valeur |
|---|---|
| **Fichier** | `server.js:6693-6800+` |
| **Trigger** | Cron toutes les 4h (`server.js:28676`) + boot init |
| **Source data** | `db.matches` (live matchs) après `commence_time + 3h` |
| **Logic** | Move match `db.matches → db.archive_matches`, fetch real scores (API-Football, BSD) |
| **Volume** | ~100-300 matchs/jour selon couverture |
| **Sport** | Football + Tennis |
| **Status** | ✅ ACTIF prod |

### 1.2 `kvGet('history_matches', [])` — Migration legacy
| Champ | Valeur |
|---|---|
| **Fichier** | `server.js:6221` |
| **Trigger** | `loadHistory()` au boot |
| **Source data** | `history.json` (migrated one-shot vers SQLite kv au premier boot) |
| **Format** | JSON array matchs archivés legacy |
| **Volume** | Toute history avant migration v10.x (variable, ~1k-50k matchs historiques) |
| **Sport** | Football (Tennis ajouté v9.x+) |
| **Status** | ✅ ACTIF (chargé chaque boot) |

### 1.3 `db.history` SQLite kv → `db.archive_matches`
| Champ | Valeur |
|---|---|
| **Fichier** | `server.js:6488` (saveHistory) |
| **Trigger** | Post-archivePastMatches + saveDB |
| **Persistence** | SQLite key 'history_matches' (better-sqlite3) |
| **Volume** | Snapshot complet à chaque save (~10-100MB selon volume) |
| **Sport** | Football + Tennis |
| **Status** | ✅ ACTIF persistance |

---

## 2. SOURCES ETL BOOTSTRAP (loadHistory v12.26+)

Chargées une fois au démarrage du serveur depuis fichiers JSON. Mergées dans `db.archive_matches` avec dédup par ID.

### 2.1 `historique_football.json` — API-Football Pro
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_db.js` + server.js:6228 (load) |
| **Bd** | `ParisScorebis-9je` (P0) |
| **Source** | API-Football PRO `v3.football.api-sports.io/fixtures` |
| **License** | API key paid ($19/mo Pro tier) |
| **Coverage** | 9 ligues T1 (PL, L1, Liga, Bundesliga, Serie A, Eredivisie, Primeira, Brasileirão, UCL) |
| **Saisons** | 2024, 2025, 2026 (configurable via `--season`) |
| **Stats avancées** | Optional `--with-stats` (xG, shots, possession, corners, cartons, passes %) |
| **Volume estimé** | ~95k matchs (9 leagues × 3 saisons × ~380 matchs) |
| **Sport** | Football uniquement |
| **Use** | Commercial OK |
| **Status** | ✅ CODE LIVRÉ, ⏸️ PROD RUN attendu (quota épuisé) |

### 2.2 `historique_tennis.json` — ESPN Public
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_tennis.js` + server.js:6280 (load) |
| **Bd** | `ParisScorebis-rxh` (P0) |
| **Source** | ESPN public `/apis/site/v2/sports/tennis/{atp,wta}/scoreboard?dates=YYYYMMDD` |
| **License** | Public domain |
| **Coverage** | ATP + WTA — Grand Slams + tour majeurs |
| **Saisons** | 2024, 2025, 2026 |
| **Modes** | `--grand-slams-only` (rapide) OR full year scan |
| **Volume estimé** | ~6-10k matchs 3 saisons full / ~1500 GS only |
| **Sport** | Tennis uniquement |
| **Use** | Commercial OK |
| **Status** | ✅ CODE LIVRÉ |

### 2.3 `historique_openfootball.json` — openfootball/football.json ODbL
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_openfootball.js` + server.js:6332 (load) |
| **Bd** | `ParisScorebis-6du6` Phase 1 (P0) |
| **Source** | GitHub raw `openfootball/football.json` master |
| **License** | ODbL (commercial OK avec attribution) |
| **Coverage** | 11 ligues (Big5 + Tier 2 + UCL/UEL) |
| **Saisons** | 2020-21, 2021-22, 2022-23, 2023-24, 2024-25 (5 saisons) |
| **Volume estimé** | ~15-20k matchs |
| **Sport** | Football uniquement |
| **Use** | Commercial OK |
| **Status** | ✅ CODE LIVRÉ |

### 2.4 `historique_fbref.json` — FBref via soccerdata (⚠️ RESEARCH ONLY)
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_fbref.js` + `scripts/fbref_extract.py` + server.js:6388 (load) |
| **Bd** | `ParisScorebis-8lqf` (P2) |
| **Source** | Sports Reference / FBref via soccerdata Python library (MIT wrapper) |
| **License** | ⚠️ Sports Reference ToS interdit commercial display |
| **Coverage** | 10 ligues (Big5 + Tier 2 + UCL/UEL) + stats avancées xG/shots |
| **Saisons** | configurable `--season` ou `--seasons-range 2020-2024` |
| **Volume estimé** | ~3-4k matchs / saison × 10 ligues |
| **Sport** | Football uniquement |
| **Use** | ⚠️ **RESEARCH ONLY** — marker `_research_only=true`, env gate `ETL_FBREF_LOAD=1` requis |
| **Status** | ❌ **OBSOLÈTE 2026-06-11** — Stats Perform/Opta a retiré TOUTES les stats avancées (xG, npxG, SCA/GCA, shooting) de FBref le 20/01/2026 + Cloudflare interactif site-wide bloque soccerdata (v1.9.0 contourne via Selenium = aggravant légal). La donnée visée n'existe plus sur le site. → remplacé par ETL BSD stats (§2.7) |

### 2.6 `historique_footballdata.json` — football-data.co.uk CSV ⭐
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_footballdata.js` + server.js loadHistory (load) |
| **Bd** | `ParisScorebis-sc0o` (P1) |
| **Source** | football-data.co.uk CSV `mmz4281/<saison>/<div>.csv` |
| **License** | Gratuit, usage libre (attribution courtoise) |
| **Coverage** | 22 divisions (E0-EC, SC0-3, D1-2, I1-2, SP1-2, F1-2, N1, B1, P1, T1, G1) |
| **Saisons** | 3 dernières par défaut (`--seasons=N` jusqu'à 25+) |
| **Stats par match** | tirs, tirs cadrés, corners, fautes, cartons J/R, arbitre (E0) |
| **Cotes** | B365 + Pinnacle ouverture/**closing** (PSC*), Max/Avg marché, O/U 2.5, AH |
| **Volume réel** | **23 126 matchs** 3 saisons (21 463 avec stats) — 21,4 MB JSON |
| **Bonus** | `--corners` → backfill `corner_history` SQLite : +13 484 rows (mapping 13 ligues BSD + TEAM_MAP normalisation noms) |
| **Sport** | Football uniquement |
| **Use** | Commercial OK |
| **Status** | ✅ CODE LIVRÉ + run local OK — run VPS au deploy |

### 2.7 SQLite `match_stats_history` + `team_season_stats` — BSD stats avancées ⭐ (bd `rm3d`)
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_bsd_stats.js` (écrit direct SQLite, pas de JSON intermédiaire) |
| **Bd** | `ParisScorebis-rm3d` (P1) |
| **Source** | BSD `/events/?status=finished` (live_stats embarqué, AUCUN appel par match) + `/leagues/{id}/standings/?season=` |
| **License** | BSD $5/mo payé — usage commercial OK |
| **Coverage** | 66 ligues BSD (Big5 + exotiques : Brasileirão, Liga MX, Saudi, CSL, J1, CAF…) |
| **`match_stats_history`** (77 cols) | xG (+ **splits 1re/2e MT**), tirs/cadrés/dans la surface/bloqués, corners (+ splits MT), possession, big chances (+ missed), passes + précision, jaunes, fautes, hors-jeux, touches surface, entrées dernier tiers, montants, goals_prevented GK, **cotes closing 1N2/O-U 1.5-3.5/BTTS** (prospectives), météo (code/temp/vent), arbitre, distance déplacement, derby/terrain neutre, affluence |
| **`team_season_stats`** | standings 5 saisons/ligue : position, W/D/L, GF/GA, pts, forme, xGF/xGA/xGD (saison courante uniquement côté BSD) |
| **⚠️ Coverage stats** | live_stats/xG/splits = **saison 2025-26 uniquement** (probe 6 fenêtres 2026-06-11). Saisons antérieures = score-only + fixtures fantômes (ex. Man Utd-Bolton PL 2023) → défaut 2025-26, flag `--all-seasons` |
| **Volume** | ~12-15k matchs saison 25/26 (380/ligue majeure) + ~5k rows standings |
| **Sport** | Football uniquement |
| **Status** | ✅ CODE LIVRÉ + pilote PL 380/380 stats 0 err — sweep 66 ligues + run VPS au deploy |
| **Refresh** | Re-run idempotent (resume-safe par PK) — cron incrémental à câbler (bd follow-up) |

**Verdicts recon web 2026-06-11** (4 agents, mission "stats foot/tennis") : soccerstats.com **NO-GO 22/100** (ToS interdit scraping+commercial), FotMob **NO-GO 22/100** (header signé + data Opta non-licenciée), FBref **DROP** (xG retiré du site 01/2026), OddAlerts **scraping NO-GO / API officielle £69.99/mo = étude DG** (pressure algo, Pinnacle dropping, referee stats).

### 2.5 `historique_elofootball.json` — elofootball.com community
| Champ | Valeur |
|---|---|
| **Fichier** | `seed_historique_elofootball.js` + server.js:6437 (load) |
| **Bd** | `ParisScorebis-8lvf` Phase 1 (P1) |
| **Source** | elofootball.com community (scraping HTML regex) |
| **License** | Community zone-grise favorable (no robots, no ToS commercial restrict) |
| **Coverage** | 1M+ matchs depuis 1955, 3708 clubs, 59 pays, 277 competitions |
| **Elo ratings** | ✅ Calculés par expert communauté (atout différenciateur) |
| **Volume estimé** | ~10k matchs Phase 1 (top 100 clubs × 5 saisons) |
| **Sport** | Football uniquement |
| **Use** | Commercial OK avec attribution UI |
| **Status** | ✅ CODE SCAFFOLD livré, URL patterns à calibrer sur HTML réel |

---

## 3. RÉCAP CONSOLIDÉ

### Par sport
| Sport | Sources live | Sources ETL | Volume total estimé |
|---|---|---|---|
| **Football** | archivePastMatches + db.history + history.json | 4 ETL (9je, 6du6, 8lqf, 8lvf) | **~1.15M+ matchs** (elofootball dominant) |
| **Tennis** | archivePastMatches + db.history (subset) | 1 ETL (rxh) | **~6-10k matchs** 3 saisons |

### Par usage commercial
| Usage | Sources |
|---|---|
| ✅ **Commercial direct** | API-Football, ESPN, openfootball ODbL, elofootball (attrib requise), Live runtime |
| ⚠️ **Research only** | FBref soccerdata (env gate) |
| ❌ **Rejetées** | TennisDB, TennisStats (closed b3s), footballdatabase (`b3s`, `5vzv`), Sackmann NC (sauf license commercial obtenue) |

### Par status code
| Status | Sources |
|---|---|
| ✅ **PROD ACTIF** (live runtime) | archivePastMatches, db.history, history.json migration |
| ✅ **CODE LIVRÉ + run prod attendu** | `9je`, `rxh`, `6du6`, `8lqf`, `8lvf` |
| ⏸️ **BLOQUÉ OPS** | `9je` (quota), tous les autres (deploy WinSCP/git pull) |

---

## 4. ROUTES API HISTORIQUE

| Route | Fichier | Usage |
|---|---|---|
| `GET /api/v1/history/query` | `server.js:20531` | Filtres avancés + agrégations + pagination |
| `GET /api/v1/history/export.csv` | `server.js:20562` | Export CSV avec OWASP injection guard |
| `GET /api/v1/accuracy` | (legacy) | Métriques accuracy backtest |

**Filtres supportés** : `sport`, `leagues`, `teams`, `markets`, `strategies`, `surfaces` (tennis), `fromDate`, `toDate`, `minOdds`, `maxOdds`, `minEV`, `minProba`, `confidence`, `outcome`, `venue`, `weekdays`, `weather`, `page`, `pageSize`, `sort`.

---

## 5. FRONTEND `#page-historique`

| Classe CSS | Composant |
|---|---|
| `.dh-card` / `.dh-card-hero` | Cards Bloomberg-style |
| `.dh-kpi-strip` / `.dh-kpi` | KPI tiles grid 6 cols |
| `.dh-chip` / `.dh-fr-chip` | Pilules filtres |
| `.dh-toggle` / `.dh-period` / `.dh-view` | Toggle buttons |
| `.dh-table` | Tableau matchs archivés |
| `.dh-drill-content` | Modal détail match |
| `#dh-filter-rail` | Filter rail sticky |

**Migration V2** : 38 classes `.dh-*` re-routées vers tokens `--cf-*` unifiés (commit v12.2 / `ParisScorebis-21x`).

---

## 6. STATUS GLOBAL ETL

| Source | Volume potentiel | Run prod |
|---|---|---|
| API-Football (9je) | ~95k 3 saisons | ⏸️ Quota |
| ESPN Tennis (rxh) | ~10k 3 saisons | ⏸️ Run attendu |
| openfootball (6du6 Ph1) | ~20k 5 saisons | ⏸️ Run attendu |
| FBref soccerdata (8lqf) | ~20k research | ⏸️ Install Python + opt-in |
| elofootball (8lvf Ph1) | ~10k Phase 1 + 1M long-terme | ⏸️ Calibrate URL + run |

**TOTAL volume théorique accessible** : **~1.15M+ matchs** historiques.

---

*Document généré le 21 mai 2026 par Lead Data Engineer PariScore.*
*Source de vérité : code source server.js + scripts ETL + bd backlog tickets.*
*Mise à jour à chaque ajout/modif source ETL.*
