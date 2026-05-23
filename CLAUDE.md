# 🏟️ PariScore — Poste de Pilotage (v12.65 — bd-driven)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO & Lead Data Scientist (Quant)** de PariScore.
- **Posture** : Expert en modélisation mathématique et en algorithmique prédictive. Tu ne crois qu'aux statistiques dévigées et aux modèles calibrés.
- **Rigueur Scientifique** : Aucun modèle n'est mis en production sans calcul d'Intervalle de Confiance (UQD).
- **Recrutement** : Si l'architecture requiert une expertise en Machine Learning ou en scraping temps réel complexe, déploie un agent dédié.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES

1. **PROTOCOLE DE CLÔTURE (OBLIGATOIRE)** :
   - **Archivage** : Transférer les algorithmes validés et résultats de backtest dans `CHANGELOG.md` (releases) ou `ARCHIVE_PROJECT.md` (épopées multi-version).
   - **Nettoyage** : Purger `CLAUDE.md` régulièrement — ce doc reste un poste de pilotage, pas un journal.
   - **Innovation** : Proposer 3 nouvelles pistes d'optimisation de l'Edge.

2. **Performance Backend** : Calculs bayésiens et itérations Bootstrap ne doivent jamais bloquer le thread principal Node.js (Workers ou complexité temporelle optimisée).

3. **Source de vérité tâches** = **bd (beads)**. Ce fichier expose un miroir lisible ; `bd ready` reste autoritaire.

## 🏗️ ARCHITECTURE & STACK

- **Backend** : Node.js (Vanilla, zero-dep sauf `better-sqlite3`), SQLite3 WAL, SSE
- **Frontend** : SPA `pariscore.html` mono-fichier (30k+ lignes), Design System V2.0 tokens unifiés `--cf-*`
- **Math Engine** : JS natif — Poisson bivarié, Elo dynamique, Shin-Hurley devig, Kelly cap 25%, Bootstrap UQD (à venir)
- **Sources data** : BSD (Bzzoiro Sports Addon $5/mo + WS push), ESPN public, Odds API, openfootball ODbL, Wikidata CC0 (v12.62 wire 56 winners tennis), felipeall/transfermarkt-api sidecar self-host, elofootball community, aiscore.com on-demand throttled (tennis serving fallback v12.65)
- **Sources backlog DG decision** : Tennismylife/TML-Database MIT (substitution Sackmann NC, bd `8uoc`), xvalue.ai (GO ferme 85/100 bd `ffh`), OddsPapi.io free Pinnacle sharp (bd `bjv` POC), RapidAPI odds-api1 (bd `bjv` Phase 1 404 endpoints)
- **Déploiement** : VPS OVH `/home/ubuntu/pariscore` via WinSCP ou `git pull` + `pm2 restart pariscore`
- **Persistance ETL** : `db.archive_matches` alimenté par 8 sources (3 live runtime + 5 ETL bootstrap). Inventaire : `.context/databases_historique_inventory.md` + `.csv`

---

## 📋 ACTIONS OPS USER POST-SESSION v12.65

**Pending DG/ops avant nouveau code (cumul session 22/05 — 30 commits push)**

| # | Action | Type | Commande / Lien | Urgence |
|---|---|---|---|---|
| ~~1~~ ✅ | **Deploy VPS** | ops | ✅ done 2026-05-23 — cumul `fbea217`→`290bfb1` deployed. Validation logs : grep `wikidata\|TennisLive\|safeFixed\|live_momentum_pct` |
| 2 | **🚨 Revoke RapidAPI key** | security | Dashboard RapidAPI → revoke + nouvelle clé → `.env` VPS uniquement (exposée chat 21/05) | 🔴 CRITICAL |
| ~~3~~ ✅ | **Audit DB postbreach** | ops | ✅ done 2026-05-23 — 8 sections audit = 0 lignes. Zéro compromission DB fenêtre breach. bd `c8m` CLOSED. |
| 4 | **ETL Football quota reset** | ops | `bash .context/run_etl_2024_2026.sh` VPS à minuit UTC (bd `9je`) | 🟡 MED |
| ~~5~~ ✅ | **Run flashscore-logos** | ops | ✅ done 2026-05-24 — 20 EPL logos cached `api_cache` source='flashscore' keys logo_* (bd `qm6a` Plan A run prod) |
| 6 | **DG decision Stripe — 4/6 arbitré 2026-05-23** | DG+ops | bd `s77m` — LOCKED: €19/mo, trial 7j, mono-sport OUI, matchday €2.99. PENDING: prix annuel + refund policy. Action user dashboard Stripe (~30min) : créer compte + 5 products + secret key + webhook + append .env VPS + pm2 restart. | 🟡 MED |
| 7 | **Sackmann purge — Phase 1+2 livrées** | code+ops | ✅ DG GO 2026-05-23 (bd `8uoc`). ⚠️ TML-Database découvert CC-NC (non MIT) — substitution invalidée. Replacement choisi = internal Elo from BSD/ESPN (bd `dl49`, 3-5j). Phase 1+2 session courante : backup script + Sackmann sync désactivé (flag `SACKMANN_SYNC_DISABLED=true`). Ops VPS : `node tools/backup-tennis-matches.js` puis deploy server.js patché. Phase 3-7 (ETL interne + refactor consumers + DROP table + LICENSE-DATA.md) = sessions futures bd `dl49`. | 🔴 HIGH legal |
| 8 | **DG decision 6 études bloquées** | DG | bd `j5lb` — GO/NO-GO 6 spikes arbitrage (FBref/RapidAPI/TheSportsDB/Apify/OddsPortal/Marketing) | 🟡 MED |
| 9 | **POC OddsPapi.io** | DG | Signup free 250 req → `ODDSPAPI_KEY` .env → `node .context/_probe_oddspapi_pinnacle.js` (bd `bjv`) | 🟢 LOW |
| 10 | **POC xvalue.ai** | DG | Free trial 1j → eval xG advanced + ML scouting (bd `ffh` GO 85/100) | 🟢 LOW |
| ~~11~~ ✅ | **BSD coverage audit** | code | ✅ livré commit `4e86075` (refresh snapshot `bsd_fr_leagues.json` IDs 27+55 captured) |
| ~~12~~ ✅ | **Mapper BSD 27 World Cup 2026** | code | ✅ livré (mapping config 999 → BSD 27 dans `bsd_config.json` + `leagues_config.json`) |
| ~~13~~ ✅ | **Mapper coupes domestiques BSD HIGH** | code | ✅ livré (BSD 44/41/43/35 mappés config 63/143/81/73 — coverage BSD 71% → 80%) |
| 14 | **DG décision ligues BSD secondary** | DG | 11 ligues BSD restantes non mappées (Africa Cup, Liga F WOMEN, Friendly Games, coupes mineures Japan/Poland/Tunisia/Finland, Nigeria PFL, Liga MX Clausura). GO/NO-GO mapping selon intérêt commercial. $0 incrémental BSD (déjà payé). | 🟡 MED |

**Validation post-deploy attendue:**
- `pm2 logs pariscore --lines 200 --nostream | grep -i "wikidata\|TennisLive\|safeFixed\|live_momentum_pct"`
- Modal Live Dashboard La Liga 60s+ → barres momentum non-flat (bd `8c5`)
- Tableau Foot mode jour → vérifier ligne BS Bouhajla pas teinte rose (bd `k37`)
- Bouton audio toggle 🔇/🔊 → test transitions matchs (bd `rlhf`)

---

## 🔥 TÂCHES EN COURS

Source autoritaire : `bd list --status=in_progress`. Snapshot 22/05/2026.

| ID | P | Titre | État |
|---|---|---|---|
| `9je` | P0 | Pipeline ETL Historique Football API-Football PRO | Code livré v12.10 · run bloqué quota épuisé (reset minuit UTC) |
| `6du6` | P0 | DB historique tennis+foot datasets gratuits (openfootball ODbL + Wikidata CC0) | Phase 2 Wikidata wire 56 winners livré v12.63 · deploy VPS attendu |
| `c8m` | P0 | SECURITY — server.js exposé + rotation clés | 11 clés rotées + ufw ban + fix code deployed · reste audit_db postbreach VPS |
| `s77m` | P0 | Stripe Checkout + Webhook + Customer Portal | Code livré v12.43 · attente decisions DG (trial, prix, matchday) |
| `401` | P1 | Crash Test audit onglets Football + Tennis | rapport_qa_foot_tennis.md livré · 28 risk flags |
| `bjv` | P1 | Spike sourcing cotes alternative Odds API | Phase 1 odds-api1 RapidAPI 404 confirmé · Pinnacle research NO-GO direct · POC OddsPapi.io pending DG |
| `5iw` | P1 | Intégration BSD Live WebSocket foot (<5s) CdM 2026 | WS connecté zero-dep validé · reste validation schema payload live VPS |
| `8lqf` | P2 | Spike FBref via soccerdata Python | RESEARCH ONLY scaffold livré v12.30 |

## 🎯 TÂCHES À FAIRE — Queue prioritaire

Source autoritaire : `bd ready`. Snapshot 21/05/2026.

### P0 (priorité absolue) — bloqué ops/DG

Toutes les P0 actuellement in_progress ont leur code livré. Restants = actions VPS/DG hors scope code.

| ID | Titre | Action immédiate |
|---|---|---|
| `9je` | ETL Football post quota reset | `bash .context/run_etl_2024_2026.sh` VPS à minuit UTC |
| `6du6` | Wikidata CC0 wire Phase 2 | Deploy VPS : `git pull` + `pm2 restart pariscore` + verif log `ETL seed merge (wikidata CC0): 56/56` |
| `c8m` | Audit DB postbreach | `bash security_db_audit_postbreach.sh` VPS (rotation + ufw déjà faits) |
| `s77m` | Stripe activation | DG checklist `.context/stripe_dg_checklist.md` — 9 sections (trial, prix mensuel/annuel/mono-sport, matchday pass) |

### P1 (ouvert ou ops pending)

| ID | Titre | État |
|---|---|---|
| `d4rd` | GSC validation post-fix robots.txt — URL Inspection + resubmit sitemap | ops DG |
| `u5x` | SEO fix GSC « Bloquée par robots.txt » (recoupé `d4rd`) | ops DG |
| `x9s` | Plug oddsapi RapidAPI odds-api1 sur TOUS champs cotes | BLOCKED bjv Phase 1 404 |
| `b50` | DB pariscore.db SQLITE_NOTADB runtime — investigate corruption ops | ops VPS |
| ~~`e7l`~~ ✅ | Version mobile PariScore (parieur nomade) — bottom nav + cartes + PWA | Phase 5/7 PWA install + push livrés v12.19+v12.21 · Phase 6/7 ✅ Web Push live momentum/pressure parallèle Telegram · Phase 7/7 ✅ Web Push daily top picks cron 8h Paris : broadcast à tous users avec push_subscription (top pick label + EV%, tag dedup, requireInteraction=true, deep-link `/?topPicks=1`, opt-out via DELETE subscription). PWA mobile complète. |
| `qe5` | Live Dashboard Betting Cockpit Phase 1 — Win Prob + Top3 picks + events markers + verdict | Phase 1 partial v12.62 (Minute promue + cockpit) · Phase 1.5 ✅ events markers SVG momentum : backend fetch BSD incidents parallèle (cache 60s) + normalisation kind=goal/own_goal/card_yellow/card_red/shot_on_target + frontend overlay drawLDMomentumSVG markers `⚽▮○` color-coded position minute×W + tooltip `<title>` minute/type/player/score. Phase 2/3 spec ouvertes (live xG curve enrichi + verdict layer 2) |
| `j5lb` | **[DECISION DG]** GO/NO-GO 6 études bloquées arbitrage | DG decision |
| `p2if` | AI-AL Revue de Presse Foot+Tennis — 5 avis presse panel Gemini | Phase 1+2 livrés `ae6a292` + v12.66 (Phase 2A RSS Foot + Phase 2B cron Telegram top picks) · Phase 3 ✅ Tennis RSS extension : `RSS_FEEDS` ajoute 4 sources tennis (L'Equipe Tennis / BBC Tennis / ESPN Tennis / Tennis World USA), `fetchPressContext` accepte param `sport='tennis'` route feeds, route `/api/v1/ai/tennis-analyze/:matchId` inject `[REVUE DE PRESSE REELLE]` block 5s timeout fallback + prompt PRIORITE ABSOLUE conditionnel |
| ~~`8uoc`~~ ✅ | Tennis Abstract + autres DBs tennis — DG GO purge Sackmann 2026-05-23 | Phase 1+2 livrées commit `dd2bb75`. TML-DB finding CC-NC (non MIT) — replacement = bd `dl49` internal Elo BSD/ESPN |

**✓ FERMÉS session 22/05/2026 v12.65 (8 P1)**

| ID | Livraison |
|---|---|
| `c5i` | Tennis serveur invisible Phase 3 — aiscore on-demand throttled fetch — commit `fbea217` |
| `izsn` | safeFixed() wrapper 51 sites server.js + 2 sites pariscore.html — commits `bce7535`+`16c6a9d` |
| `8c5` | Momentum plat La Liga — split `live_momentum_pct` objet vs array Sofa + follow-up Array.isArray guards consumers — commits `38ffa7b`+`9ba089a` |
| `lyku` | Routage LIGA classement ID 3 — confirmé déjà fixé `server.js:10676-10685` (surgical override events-derived) |
| `k3ex` | Tennis ATP/WTA matchs féminins disparus tournois mixtes — fix livré v12.38 (BSD circuit re-derive depuis gender+tournament name) |
| `u8w9` | Mobile page blanche filtres iOS Safari + Chrome Android — fix livrés (presets selectors + apiFetch 401 token clear) |
| `8lvf` | elofootball.com Elo historique massif — Phase 1-3 livrées v12.31-v12.40 (1902 matchs + 50 rankings) |
| `4cog` | Tennis Consolidation LOT P0 — 5/5 sub-tasks déjà implémentés post-audit |
| `c8zp` | Cron capture tennis finals + cleanup history-edges legacy — Phase 1+2 livrés v12.64 |

### P2 (queue)

| ID | Titre | État |
|---|---|---|
| `kto1` | Research: tennisabstract.com WP interactivity-api — rapport incorporation | open |
| `m5sv` | Research: GitHub n63li/Tennis-API — rapport incorporation | open |
| `1hiv` | Research: sportsdata.io Tennis API — rapport incorporation (pricing+coverage+ROI) | open |
| `wect` | ETL Historique FBref soccerdata — RESEARCH ONLY (doublon `8lqf` à fusionner) | open |
| `5vzv` | Spike footballdatabase.com — audit ETL faisabilité vs ToS+CF | open (CF wall) |
| `qkx` | Spike eval odds-api1 RapidAPI candidate | open (couplé `bjv` Phase 1 fail) |
| `e3mr` | Tennis Consolidation LOT P1+P2 — Backtest Brier + Serve/Return point-level + UQD | open |
| `l9vk` | Marketing Affiliation 5 phases — 1xBet+Twitter+YouTube+Telegram+Stripe | open |
| `ryi3` | Routing schema Phase 2+ — health + Understat + metrics + affiliate CRUD | Phase 2A livré v12.65 commit `117c711` (`/api/v1/sources/health`) · Phases 2B/2C/2D ouvertes |
| `968x` | SEO/AEO Growth strategy — llms.txt + Structured Data + SSR scores + /about E-E-A-T | Phase 1 ✅ `llms.txt` + route GET `/llms.txt` cache 24h · Phase 4 ✅ `/about` E-E-A-T server-rendered (4 piliers méthodo + 8 sources + 6 engagements) + sitemap.xml priority 0.7 · Phase 2 ✅ Structured Data JSON-LD enrichi : BreadcrumbList Accueil>About + Organization avec foundingDate + contactPoint + FAQPage 5 questions (méthodo Poisson, sources, pas bookmaker, backtesting fiabilité, gate 18+). Phase 3 SSR scores crawler reste ouverte |
| ~~`0hf4`~~ ✅ | **BSD coverage Phase 1+1.1+2+3** — TV channels + broadcasts (fetchers + caches + helper attach + on-demand route + modal UI) | Phase 1 v12.65 `d10ab09` · Phase 1.1 cron pre-fetch v12.66 · Phase 2 route `GET /api/v1/broadcasts/match/:matchId` · Phase 3 ✅ tv_channels payload `/api/v1/insights/:id` + section modal "📺 TV DIFFUSEUR · BSD" dedup channel_id, max 12 chips avec flag + lien externe |
| ~~`j6pz`~~ ✅ | **BSD coverage Phase 2** — Shotmap (fix endpoint bug `/v2/events/{id}/stats/`) + best_odds + bookmakers | livré — UI shotmap SVG refactor nouveau schema + 2 nouveaux endpoints |
| ~~`ueg0`~~ ✅ | **BSD coverage Phase 3** — Social items sentiment buzz match (section modal Insights) | livré commit (voir ci-dessous) — section modal Insights lazy fetch + sentiment heuristique |
| ~~`82th`~~ ✅ | **BSD coverage Phase 4** — Referees + Venues + Leagues dynamic | livré backend (3 routes + 3 cache layers + insights payload IDs) — UI optionnelle (Plan D Sofascore couvre venue/referee modal) |

> **BSD MCP coverage roadmap (22/05/2026)** : 17/28 endpoints déjà plugués via `bsdFetch()` REST direct. 11 gaps découpés en 5 phases. Phase 1 TV broadcasters en cours (bg agent, bd ticket créé pendant exec). Phases 2-5 = `j6pz` `ueg0` `82th` `r0v3` (P3). Effort total 12-15h dev. Source: audit MCP `bsd-sports` 28 tools vs grep `bsdFetch()` server.js 22/05.

**✓ FERMÉS session 22/05/2026 v12.65 (6)**

| ID | Livraison |
|---|---|
| `nwk6` | PWA Push Notifications backend — Phase 1 livré v12.49 (VAPID ES256 zero-dep + 4 routes + auto-cleanup 410/404) |
| `ffh` | Spike 6 sources data — commit `1280dfb` livrable `.context/spike-ffh-6sources-eval-final.md` (GO ferme xvalue.ai 85/100) |
| `k37` | Bug UI teinte rose tableau Foot — commit `8b99cb2` (coral leak `tr.match-row-live::before` box-shadow 14→6px + keyframe + remove !important) |
| `c9p4` | Roadmap v4.x backlog tableau principal — closed stale dup (8 items déjà cochés `[x]` commit `5e18185` CLAUDE.md section 15 sync drift) |
| `rlhf` | Module audio alertes trading — commit `fc9c65e` (state tracking transitions + orchestrateur 4 indicateurs + queue 200ms cap 3 sons/burst) |
| `x11y` | Tennis indicateurs jeux dynamiques — closed stale dup (code présent pariscore.html:14813 O7.5/O8.5/O9.5/U12.5) |

### P3 (research)

| ID | Titre |
|---|---|
| `gz7s` | Benchmark Rotowire Soccer — ideas to steal (orphan CLAUDE.md→bd) |
| ~~`r0v3`~~ ✅ | BSD coverage Phase 5 — Squad endpoint + fixtures variant — livré : `GET /api/v1/bsd/squad/:teamId` (wrap `fetchBSDTeamSquad` cache 6h, expose attributs/availability/injury) + `GET /api/v1/bsd/fixtures/:teamId?limit=N&status=...` (helper `fetchBSDTeamFixtures` cache 1h, schema normalisé). |
| `qm6a` | **Flashscore datasets integration** — voir sous-table dédiée ci-dessous (6 plans A-F) |
| `6jro` | **Sofascore Apify datasets integration** — voir sous-table dédiée ci-dessous (4 plans G-J) |

#### Sous-tâches `qm6a` Flashscore datasets — 6 plans ✅ **TOUS LIVRÉS**

Datasets Apify one-shot racine projet : `dataset_flashscore-team-stats_*.json` (20 EPL + 60 NBA hors scope) + `dataset_flashscore-live-matches_*.json` (3 matchs live foot).

| Plan | Tâche | Locus |
|---|---|---|
| A | Logos backup → api_cache TTL 90j (20 EPL) | `tools/import-flashscore-logos.js` commit `3fc4ca7` |
| B | Standings fallback offline configId | `tools/import-flashscore-standings.js` + `getFlashscoreStandings()` |
| C | Cross-ref team naming audit | `tools/audit-flashscore-team-naming.js` (offline+online dual) |
| D | Venue + referee enrichment Sofa | `tools/import-sofascore-football-venue-referee.js` (alt 82th) |
| E | Live stats fallback Flashscore | `tools/import-flashscore-live-stats.js` |
| F | Livestream badge `📡 STREAM` | `tools/import-flashscore-livestream.js` |

**Limite Apify one-shot:** datasets ≠ feed continu. Value durable = scraper continuous OR pivot xvalue.ai (bd `ffh` GO 85/100).

#### Sous-tâches `6jro` Sofascore Apify datasets — 4 plans (G+H+I ✅, J restant)

Dataset Apify one-shot racine `dataset_sofascore-scraper-pro_*.json` (2 entries seed initial).

| Plan | Tâche | Locus |
|---|---|---|
| G | Tennis player profile Grand Slam | `tools/import-sofascore-tennis-player.js` + section modal "🏆 HISTORIQUE GRAND CHELEM" |
| H | Editorial article modal Insights | `tools/import-sofascore-editorial.js` + section "📰 AVANT-MATCH" |
| I | Filtre Format Singles/Doubles | `_tnIsDoublesMatch()` heuristique slash-pair + tournament regex |
| **J** ⏳ | Sofascore continuous scraper webhook | 3-4h MED · conflit bd `ffh` (profile/historique distinct vs live NO-GO) |

> **Sync drift cumul 21-24/05/2026** : Sweep 165 .md → 13 nouveaux bd · 41 commits push session 23-24/05 · Tous innovations backlog livrés ou audit-marked (7 session + 4 audit). Détails par bd notes.

## 🎯 PLANS RESTANTS — Roadmap exécution priorisée

**TOUT LIVRÉ ✅** :
- BSD coverage Phases 1-5 (`0hf4`, `j6pz`, `ueg0`, `82th`, `r0v3`)
- Flashscore qm6a Plans A-F (logos backup, standings fallback, naming audit, venue/referee Sofa, live stats, livestream)
- Sofascore 6jro Plans G-I (tennis player profile, editorial article, format filter Singles/Doubles)
- Innovation backlog (Bootstrap UQD, Reliability tooltip, Bet Signal, Bayesian Radar, Alertes SSE, Helper throttle, Poisson Time-Inhomogène, Context Engine météo+arbitres+km)

**RESTANT (1 plan + sessions futures):**
- `J` 6jro Sofascore continuous scraper webhook (3-4h MED, conflit ffh)
- `dl49` Phases 4.2-7 (DÉFÉRÉE 6 mois — wait cron daily ETL accumulation)
- `l9vk` Marketing 5 phases multi-day (DG signups requis)
- DG decisions (`j5lb`, `d4rd`, `3u9`, Stripe annual+refund+mono-sport, ffh/bjv POC signups)

## 🧠 INNOVATION BACKLOG (Edge mathématique)

- ~~**Bayesian Value Radar** — Data Blending Poisson Bivarié + Elo dynamique + xG Logistic~~ ✅ livré (audit 2026-05-23) : `computeXGLogisticProbs` server.js:6082 (sigmoid xgDiff/xgTotal) + `bayesianBlend(poisson, elo, xg)` server.js:6104 weights 50/25/25 + `calibrateProbs` reliability diagram. Wired `m.blended` + `m.calibrated`.
- ~~**Bootstrap UQD** — 500 itérations IC90 par match~~ ✅ livré (foot `computeBootstrapUQD` server.js:6111 + tennis `computeBootstrapUQDTennis` server.js:19109)
- ~~**Score composite fiabilité /100** — volume data + stabilité xG + calibration~~ ✅ livré `computeReliabilityScore` server.js:6191 (35% volume + 35% stabilité IC over25 + 30% qualité source réel vs sim)
- ~~**Règle BET stricte** — EV>5% ET borne inférieure IC>0~~ ✅ livré `computeBetSignal` server.js:6207 (EV worst-case IC lower, recommande uniquement si pessimiste reste positif)
- ~~**Poisson Time-Inhomogène** — modèle live conditionnel minute par minute~~ ✅ livré bd `cnvg` commit `12b2d95` (helper `computeLivePoissonInhomogeneous`, λ_rem = λ_full × time × adj{trailing/leading}, exposé `/api/v1/insights/:id` payload `live_poisson` markets recompute final = score_so_far + remaining)
- ~~**Context Engine** — météo + arbitres + kilométrage déplacements~~ ✅ livré (météo Open-Meteo bd `cy9h` + arbitres BSD bd `82th` + Sofascore bd `qm6a` Plan D + kilométrage haversine bd `i8gw` commit `8b24d62`). Integration edge math Poisson adjustments deferred.
- ~~**Alertes SSE** — triggers `favorite_trap` + `goal_flood`~~ ✅ livré bd `vl02` commit `5003042` (toast UI top-right type-color, cooldown 5min, sliding 15min window)

**Nouvelles pistes 22/05/2026 v12.65 (règle 1 PROTOCOLE — 3 propositions session):**

- **xvalue.ai ML scouting clustering** (cf. bd `ffh` GO 85/100) — branch xG advanced + clustering 30 ligues dans pipeline `buildMatchRecord`, composante "form-style fingerprint" qui détecte les anomalies tactiques pré-match (changement coach, blessure clé). Sortie : `style_shift_score` 0-100 contribuant à `confidence_badge`.
- **Pinnacle sharp calibration via OddsPapi.io free** (cf. bd `bjv` Plan C 250 req/mo) — utiliser cote Pinnacle dans `computeWFV1N2` comme ancrage low-vig, recalibrer `detectSurebet1N2` avec sharps low-marge, mesurer reduction faux positifs ValueBet (estim. -5 à -10% bias). POC mesurable backtest 50 matchs.
- ~~**Pattern on-demand throttled généralisé** — helper `withOnDemandThrottle()`~~ ✅ livré bd `zckt` commit `1966f8b` (helper module-scope + refactor `fetchAiscoreServingOnDemand`, signature `{candidates, candidateKey, resolver, fetcher, maxPerInvocation, cooldownMs, state, name}`). Use cases extensibles : `fetchAiscoreLineupsOnDemand`, `fetchSofascoreEditorialOnDemand`, `fetchOddsPapiPinnacleOnDemand`, `fetchUnderstatPlayerStatsOnDemand`.

---

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## 💳 MODULE DE MONÉTISATION & SÉCURITÉ : INTÉGRATION STRIPE

### Objectif
Implémenter une infrastructure de paiement résiliente, conforme aux standards PCI-DSS, basée sur l'API Stripe (Abonnements / Accès Premium) pour la plateforme Pariscore.

### Directives de Sécurité Absolue
1. **Zéro Hardcoding :** Aucune clé privée Stripe (`sk_live_...` ou `sk_test_...`) ni secret de webhook (`whsec_...`) ne doit être injecté directement dans le code source ou validé dans Git. Tout doit transiter exclusivement par les variables d'environnement (`.env`).
2. **Vérification des Webhooks :** La route de réception des webhooks Stripe doit impérativement valider la signature brute de l'événement (`stripe.webhooks.constructEvent`) avec le payload brut (`req.body` non parsé par un bodyParser global) pour empêcher les attaques par rejeu ou usurpation d'identité de paiement.
3. **Gestion des Rôles :** L'état d'abonnement de l'utilisateur (ex: `is_premium: true`, `stripe_customer_id`, `subscription_status`) doit être synchronisé de manière atomique en base de données dès réception de l'événement `invoice.paid` ou `customer.subscription.deleted`.


### État livraisons SaaS (Auth + Stripe)

| Composant | État | Locus |
|---|---|---|
| **Schema users SQLite** | ✅ livré | `server.js:3658+` (table `users` + cols `stripe_customer_id` + `stripe_subscription_id` + `premium_until`) |
| **JWT + bcrypt auth** | ✅ livré | `server.js:14120+` (routes `/api/v1/auth/login/register/me` + middleware Premium gate `FOOT_PRO` set) |
| **Stripe Checkout backend** | ✅ livré v12.43 | `stripeRequest()` `server.js:13893+` + route `/api/v1/checkout/matchday` + table `stripe_events` |
| **Stripe Webhook signature verify** | ✅ livré | `/api/v1/webhook/stripe` payload brut + `event_id` dedup |
| **Customer Portal** | ✅ livré v12.43 | bd `s77m` |
| **DG activation** | ⏳ pending | bd `s77m` — checklist `.context/stripe_dg_checklist.md` (9 sections : trial, prix mensuel/annuel/mono-sport, matchday pass) |

**Décisions DG bloquantes** (toutes pré-activation Stripe live):
1. Prix mensuel Pro €19 confirmé ? annuel ? mono-sport (foot only / tennis only) ?
2. Trial gratuit 7j / 14j / aucun ?
3. Matchday pass €X.XX one-time J-1 active ?
4. Currency : € only ou multi-devise launch ?
5. Webhook secret `whsec_...` configuré .env VPS ?
6. Stripe Connect (affiliate) Phase 2 ou jamais ?
7. Refund policy (no-refund SaaS / 14j cooling-off EU) ?
8. Cancellation flow UX (immediate vs end-of-period) ?
9. Pricing page Public — toggle test/live mode ?

> ⚠️ Tant que checklist DG non validée, le code Stripe reste TEST MODE. Pas de `sk_live_*` injecté.

## 🗄️ MISSIONS LIVRÉES (archived — voir CHANGELOG.md / bd notes)

5 missions historiques purgées 22/05/2026 v12.65 (poste pilotage, pas journal — règle 1):

| Mission | bd | Livraison |
|---|---|---|
| Tennis serveur live invisible | `c5i` | Phase 1+2+3 livrés (aiscore cache + parity inference + on-demand throttled) commits `fbea217` |
| Module audio alertes Bloomberg | `rlhf` | state tracking 4 indicateurs + queue 200ms commit `fc9c65e` |
| Indicateurs dynamiques tennis O7.5/O8.5/U12.5 | `x11y` | code présent pariscore.html:14813 (closed stale dup) |
| Bugfix autoplay DOMException | — | `playPromise.catch` silencieux pariscore.html:31652 |
| UI contraste teinte rose tableau Foot | `k37` | coral leak fix commit `8b99cb2` (`tr.match-row-live::before` box-shadow scope) |
| Benchmark Rotowire Soccer | `gz7s` | P3 open — rapport à livrer (voir bd description spec) |
| Tennis balle serveur figée (type coercion + nested flag) | `4c52` | commit `b2d5ee9` — helper `_tnGetServingIdx` + 5 sites patchés (renderTennisLive, _tvbScoreCell, _tnRenderSourceBadge, predictive cell, tnLiveBetsFromScore) |
| Terrain 2D foot ball tracker fallback | `4uk9` | wontfix — audit pipeline OK (server.js:34803 + pariscore.html:20272). BSD livedata frames J1/secondaires ne pushent pas coords ballon. Provider limit. Cosmetic patch skipped DG choice. |

*Dernière mise à jour : v12.66 — 23/05/2026. CLAUDE.md purgé 2 missions ad-hoc texte (4c52 fix + 4uk9 wontfix → bd notes). Sync drift `8uoc` corrigé. Source vérité tâches = `bd ready`.*
