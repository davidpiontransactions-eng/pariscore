# PariScore — Journal des modifications
## [v12.88] — 2026-07-13 — Enrichissement live logos équipes + championnats

### Ajouté
- **Module `lib/logo-cascade.js`** : cascade de sources logos partagée (équipes + championnats)
  - Équipes : BSD API → TheSportsDB → API-Football → scraping HTML BSD (extrait de `scripts/scrape-logos.js`)
  - Championnats (NOUVEAU) : table curatée `TOP_LEAGUE_LOGOS` (20 leagues majeures) → BSD `image_path` → TheSportsDB `lookupleague.php`
  - Refactor sans duplication : `scripts/scrape-logos.js` devient un wrapper CLI fin autour du module
- **Worker `services/liveLogoEnricher.js`** : enrichissement logos en temps réel sur `db.matches`
  - Démarré dans `bootInit()` (cron 60s + 1er tick boot 90s)
  - Cache-first (`team_logos` + `league_logos`) → cascade en miss → attache `home_logo`/`away_logo`/`league_logo_url`
  - Broadcast SSE `matches_update` si changements (frontend notifié en <5s)
  - Dédup triple couche : cache DB + Set in-memory `_attemptedTeams`/`_attemptedLeagues` + batch limit 8/tick
- **Table `league_logos`** (miroir de `team_logos`) : `bsd_league_id PK, name, name_norm, country, sport, logo_url, source, indexed_at`
- **CLI `scripts/enrich-live-logos.js`** : backfill/test/dev autonome
  - Modes `--once` (1 snapshot SSE), `--watch` (SSE continu + reconnexion backoff exp.), `--audit`, `--from-db`
- **`lookupLeagueLogo(name, sport)`** dans `server.js` : miroir de `lookupTeamLogo` pour la nouvelle table

### Modifié
- **`server.js`** : 5 points d'insertion (require defensif L54, table `league_logos` L6468, fonction `lookupLeagueLogo` L3880, init+1er tick boot L50292, cron 60s L50528)
- **`scripts/scrape-logos.js`** : refactorisé en wrapper CLI (~160 lignes au lieu de 510) qui délègue à `lib/logo-cascade.js`. Signature CLI inchangée (zéro régression).

### Testé
- Cascade équipes : AC Milan, Real Madrid résolus via TheSportsDB (clé test gratuite "3")
- Cascade championnats : 11/11 top leagues résolues (EPL, La Liga, Serie A, Bundesliga, Ligue 1/2, Eredivisie, Champions League, MLS, Primeira Liga, Super Lig)
- `services/liveLogoEnricher.enrichOnce()` : résolution + écriture DB + broadcast SSE vérifiés en isolation
- `node --check` OK sur les 5 fichiers (lib/logo-cascade.js, services/liveLogoEnricher.js, scripts/enrich-live-logos.js, scripts/scrape-logos.js, server.js)

### Périmètre
- Frontend `pariscore.app.js` non modifié (il consomme déjà `m.home_logo`/`m.away_logo`/`m.league_logo_url`)
- Migration Prisma hors scope (l'écosystème legacy lit `team_logos` en SQLite, pas Prisma)

## [v12.87] — 2026-07-06 — Fix critique SetPoint Next.js chunks 404

### Corrigé
- **SetPoint Tennis Prematch** : chunks JS `/_next/static/chunks/*.js` retournaient HTTP 404
  - Root cause : `.next/static/` pas copié dans `.next/standalone/.next/static/` après le build
  - npm run build incluait `next build` mais le `cp` des statiques échouait silencieusement
  - Conséquence : page affichait "0 matchs aujourd'hui" + squelettes infinis + tous les boutons désactivés
  - Fix : correction du pipeline build dans `package.json` + création de `scripts/deploy-setpoint.sh`

### Ajouté
- **scripts/deploy-setpoint.sh** : script de déploiement dédié SetPoint (Next.js standalone)
  - Pipeline : git pull → npm install → npm run build → copie statiques → pm2 restart → vérification PM2
  - Distinct de `scripts/update_vps.sh` (legacy PariScore) pour ne rien casser


## [v12.86] — 2026-06-25 — Sprint stabilisation P0/P1 + fix navbar critique

### CRITIQUE — Fix navbar (bug production)
- **Root cause** : commit e6a654a (24/06) a introduit une erreur de syntaxe fatale
  dans pariscore.js ligne 24242 : `PAGE GUIDE / DOCUMENTATION` (manquait le
  préfixe `//` commentaire). Parser JS reject tout le fichier → showPage non
  défini → tous les liens navbar onclick="showPage(...)" ne répondent plus.
- **Fix** : ajout `//` devant `PAGE GUIDE / DOCUMENTATION` (pariscore.js:24309)
- **Cache busting** : `pariscore.html?v=240618-1` → `?v=250625-1` (force reload)
- **Service worker** : `CACHE_VERSION = 'v36'` → `'v37'` (invalide precache)

### Ajouté — Sprint stabilisation (14 tâches P0/P1/backlog)

**P1.2 — Dashboard erreurs par onglet**
- Nouvelle route `GET /api/v1/admin/error-dashboard[?clear=1]` (auth admin)
- Helpers `_errorCounters` + `_inferErrorContext()` + `_recordError()` + `_trackCatch()`
- 30 catch silencieux wirés (tennis + football + alerts)

**P1.3 — Timeout Monte Carlo RG (beads cslx)**
- Nouvelle fonction `_monteCarloEloFallback()` : approximation analytique O(n² × rounds)
- `RG_WORKER_TIMEOUT_MS` : 30s → 60s (env overridable)
- `RG_INLINE_FALLBACK_MAX_DRAW=64` : seuil bascule Elo analytique vs fallback inline

**P1.4 — Audit SSE connection leak (rapport P1_4_SSE_AUDIT_REPORT.md)**
- Deep Stream v2 : `req.on('close')` vide → heartbeat 25s + timeout 90s + cleanup
- Power Score live : heartbeat 25s + timeout 60s + cleanup
- Refactor `streamDeepWithProviders` : handle `{ abort() }` pour détruire requête Gemini
- Frontend : cleanup EventSource `_rgLiveEs` / `_psLtsEs` sur navigation hors page

**UI — Section Tendances du moment (beads x2ez)**
- `_renderTrendingSection` : appelle `/api/v1/forecasts/{sport}/trending` (bonne route)
- Switcher tennis/football dans `#page-tendances`

**Sécurité — JWT → httpOnly cookie**
- Cookie `ps_auth` : HttpOnly + SameSite=Lax + Secure (prod) + Max-Age=30j
- `getAuthUser(req)` : support 3 sources (Bearer, cookie, ?token=)
- Routes login + register + logout posent/clairent le cookie
- Frontend : `apiFetch()` credentials:'include' + `psLogout()` appelle /auth/logout

**Sécurité — HIBP k-anonymity password breach check**
- Helper `_hibpCheckPassword()` via api.pwnedpasswords.com (seul prefix SHA-1 envoyé)
- Wiré dans /auth/register + /auth/reset-password (refuse si count >= 10)

**Sécurité — Route forgot-password + reset-password**
- Table `password_resets` (token_hash UNIQUE, expires_at, used_at)
- Anti-énumération : 200 même si email inconnu
- Token JWT 15min + hash SHA-256 DB + invalidation autres tokens après usage

**Sécurité — SMTP réel zero-dep (tls + crypto natifs)**
- Client SMTP complet (EHLO, STARTTLS, AUTH PLAIN, DATA, QUIT)
- Support smtps:// (port 465) + smtp:// (STARTTLS port 587)
- Headers RFC 5322 + body dot-escaping (RFC 5321)

**Sécurité — Rate limiting global API (reco #2 audit)**
- 100 req/min/IP (env `API_RATE_LIMIT_MAX` overridable)
- LRU cap 10k IPs, exempt SSE streams
- Headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Window` sur 429

**Sécurité — CORS Allow-Credentials (reco #3 audit)**
- `jsonResponse()` + preflight OPTIONS : `Allow-Credentials: true`
- Méthodes `DELETE, PATCH` ajoutées

**Repository cleanup (reco #1 et #5 audit)**
- Supprimé du tracking : cookies.txt, =, =1.20, *.bak, *.bak2, server_*.txt,
  dr_response.json, cache_profiles.json, __pycache__/, 12 scripts debug one-shot
- `.gitignore` enrichi avec patterns anti-récidive

### Audit sécurité complet — SECURITY_AUDIT_REPORT.md
- 12 domaines audités, score global 8.5/10, aucune vulnérabilité critique

### Tests unitaires (4 fichiers scripts/)
- test_monte_carlo_fallback.js, test_error_dashboard.js, test_hibp.js, test_smtp_parser.js

### Nouveaux endpoints API (5)
- `GET /api/v1/admin/error-dashboard[?clear=1]`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- Rate limiting global sur /api/* (429 si > 100 req/min/IP)

### Env vars nouvelles (8)
- RG_WORKER_TIMEOUT_MS (60000), RG_INLINE_FALLBACK_MAX_DRAW (64)
- COOKIE_SECURE=1, SMTP_URL, SMTP_FROM, PUBLIC_BASE_URL
- API_RATE_LIMIT_MAX (100)

---


## [v12.85] — 2026-06-24 — TimesFM : fix bug routing + fix mediane trending

### Corrigé
- **Bug routing TimesFM (toutes les routes retournaient 404)** : les 4 routes correctes
  (`/forecasts/tennis`, `/forecasts/football`, `/forecasts/tennis/trending`,
  `/forecasts/football/trending`) avec `SELECT * FROM timesfm_forecasts` etaient placees
  dans le handler HTTP externe, APRES l'appel a `handleAPI()` qui les attrapait en 404
  avant qu'elles puissent etre atteintes. Deplacees dans `handleAPI()` juste avant le
  fallback 404 final.
- **Bug calcul trending (top_risers/top_decliners toujours vides)** : `forecast_raw` est
  stocke comme `[input_history, forecast_matrix]` (2 elements). Le code lisait `fr[2]`
  ou fallback `fr[0]` (= un tableau, pas un nombre), echouant le guard `typeof !==
  'number'` pour toutes les lignes. Correction : lire la mediane dans
  `forecastMatrix[0][5]` (step 0, p50). Labels quantiles confirmes : [mean, q10...q90].

### Routes API restaurées
| Route | Avant | Apres |
|---|---|---|
| GET /api/v1/forecasts/tennis | 404 | 200 (354 rows) |
| GET /api/v1/forecasts/football | 404 | 200 |
| GET /api/v1/forecasts/tennis/trending | 404 → [] | 200 (10 risers + 10 decliners) |
| GET /api/v1/forecasts/football/trending | 404 → [] | 200 (10 risers + 10 decliners) |

## [v12.84] — 2026-06-20 — P_BETS : Win Probability Gauge + fix timeout critique

### Ajouté
- **Win Probability Gauge** : jauge visuelle interactive dans la modale analyse Tennis TOP 10. Score composite normalisé (0-100%) basé sur 11 metrics pondérées (ELO, PowerScore, break/win, serveur, receveur, service games, retour, forme L10, urgent, dynamique, surface). Alias de champs (
eturn_won_pct → 
eceive_index) pour compatibilité API. Détail dépliable avec critères.
- **CSS Premium Dark P_BETS** : redesign complet du modal — odds block, confidence gauge bar, palette sombre premium cohérente avec le design système --cf-*

### Corrigé
- **Fix critique timeout P_BETS (45s+)** : quand un match est archivé (retiré de __tennisVBWarmMatches), ound = null → le guard start_time > 2h ne déclenchait pas → le code appelait generatePBetsFromOrchestrator sans contexte tennis → sdFetch sans timeout avec 3 retries × 15s = 45s+ de blocage event loop
  - Fix 1 (server.js:21914-21915) : guard !found — retourne match_termine immédiatement sans appel réseau
  - Fix 2 (	ools/p-bets-generator.js:309-310) : wrapper withTimeout(bsdFetch(...), 8000) — défense en profondeur
- **P_BETS bouton caché si match terminé** : condition _tmIsFinished(status) dans 	n2RenderTopCards() masque le bouton P_BETS pour les matches finished/completed/ended
- **Message P_BETS explicite** : openPBets() affiche "⚠️ Match terminé" ou "⚠️ Match en direct — paris désactivés" selon la note API

### Modifié
- server.js : guard !found dans route P_BETS
- 	ools/p-bets-generator.js : withTimeout 8s sur sdFetch
- pariscore.html : Win Probability Gauge, CSS Premium Dark P_BETS, guards frontend

### Performance
| Métrique | Avant | Après |
|----------|-------|-------|
| Temps réponse P_BETS (match archivé) | timeout 45s+ | **~1.5s** |
| Temps réponse P_BETS (match live) | ~2-3s (selon API) | **<1s** |

## [v12.83] — 2026-06-16 — H2H Surface : Indice Serveur + Indice Receveur

### Ajouté
- **Module H2H Surface — Indice Serveur (0-100)** : score composite 50% 1stWon% + 30% 2ndWon% + 20% Ace% par surface, affiché dans la modale analyse premium TOP 10
- **Module H2H Surface — Indice Receveur (0-100)** : score composite 60% ReturnPtsWon% + 40% BreakConverted% par surface, affiché dans la modale analyse premium TOP 10
- **Backend computePlayerServeReceiveIndex()** : agrégation on-the-fly depuis tennis_matches (50 derniers matchs), pool de cache partagé avec les stats existantes
- **Affichage conditionnel** : vert (≥60), cyan (≥40), gris (<40) avec fallback si échantillon < 5 matchs

## [v12.82] — 2026-06-16 — TOP 10 Tennis : perf + cron + bench + H2H Surface

### Ajouté
- **TOP 10 Tennis — Cache TTL augmenté** : viewer 60s→5min, bettor 30s→3min (-83% de cold builds)
- **TOP 10 Tennis — Warmer boot** : pré-calcul après 60s pour éviter le cold build bloquant (premier utilisateur voit les données instantanément)
- **TOP 10 Tennis — Fallback gracieux** : sert le cache stale en cas d'erreur de rebuild (zéro interruption de service)
- **TOP 10 Tennis — Cron refresh 5min** : `_tnTop10RefreshTimer` (`setInterval(_refreshTop10Cache, 300_000)`) maintient le cache chaud en permanence, plus besoin d'attendre le premier appel utilisateur
- **Module H2H Surface** : tableau comparatif 4 lignes (ELO, PowerScore, Historique édition, Forme L10) dans la modale analyse premium TOP 10
- **Benchmark script** : `scripts/bench-top10.js` avec modes `--quick`, `--h2h`, `--json`. Test temps de réponse, intégrité payload, diversité tournois, données H2H surface

### Corrigé
- **Fix data H2H : || null tue l10_pts=0** — remplacé par `!= null ? val : null` sur les 8 champs (server.js)
- **Fix data H2H : round NULL** — défaut "Participant" dans `_tennisPlayerTournamentHistory`
- **Fix data H2H : l10_pts jamais init** — défaut 0 dans `_tennisPowerForm` si pas de matchs sur la surface
- **Fix UI H2H : fallback N/A** — affichage "N/A" explicite pour historique/forme indisponible
- **Fix critique KPI Tennis** : `tn2-kpi-bets` et `tn2-kpi-top` restaient à 0 — calcul unifié bets/top + appel KPI dans `tn2RenderTopCards`
- **Fix critique layout Tennis** : `overflow:hidden` coupait les cartes, photos reset cache, tab-btn manquaient `flex-shrink:0`

### Performance
| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Temps réponse TOP 10 (cache hit) | timeout >120s | **0.12s** | **-99.9%** |
| Temps réponse TOP 10 (cache miss) | timeout >120s | **3.07s** | **-97.5%** |
| Disponibilité TOP 10 | ~50% | **100%** | **+100%** |
| Cold builds/min | 1/min | 0.2/min | **-80%** |

## [v12.79] — 2026-06-14 — PPG auto-repair + sanity vision monitor

### Ajouté
- **Fix PPG zéro (2 couches)** : `buildSideStats()` retournait ppg=0 pour home/away quand l'API-Football fournit `played` sans `win/draw/lose`. Fix 1 au call-site (stats ~line 17638) estime PPG depuis `entry.points / entry.all.played`. Fix 2 dans `sanityCheckTeamStats()` (ligne 6932) heal depuis `_raw.pts / _raw.played`.
- **`scripts/test-ppg-auto-repair.js`** : 4 tests unitaires couvrant les 6 anomalies connues (luxembourg, independiente, sevilla, mallorca, getafe ×2).
- **`scripts/sanity-vision-monitor.js`** : Moniteur standalone lisant `db_team_stats` depuis SQLite, répliquant `sanityCheckTeamStats()`. Flags : `--json`, `--out`, `--watch`, `--gstack`. Rapports dans `.context/sanity-reports/`.
- **`.context/sanity-reports/`** : Répertoire de rapports périodiques avec rotation (max 100).

### Modifié
- `server.js` ~lines 17638-17651 : auto-repair PPG au call-site API-Football
- `server.js` ~lines 6930-6959 : auto-heal PPG dans `sanityCheckTeamStats()` (couche 2)

### Techniques
- Les 2 réparations sont non-destructives : ne touchent que les équipes avec `ppg===0 && played>0/5`, laissant intactes les stats valides.
- 4 anomalies résiduelles sans `_raw` (luxembourg, independiente, getafe ×2) — se résoudront au prochain cycle API.

## [v12.78] — 2026-06-11 — Tennis Elo surface + DG closures 8lqf/j5lb + xvalue.ai ticket

### Ajouté
- **Tennis Elo surface (3 phases)** : scraper Tennis Abstract (1055 lignes, 38 alarmes drift >100) + `tools/recompute-tennis-elo.js` (4391 ratings ALL/Hard/Clay/Grass) + cron hebdo VPS (`cron-tennis-elo.sh`) + doc `docs/tennis-elo-enrichment.md`
- **bd ParisScorebis-qyfr** : nouveau ticket POC xvalue.ai 1j gratuit (Advanced xG + scouting ML)

### Fermé
- **bd `8lqf`** (FBref/soccerdata) → OBSOLÈTE : Stats Perform/Opta a retiré toutes les stats avancées de FBref (20/01/2026). Cloudflare bloque le scraping. Scripts Python livrés mais donnée cible n'existe plus.
- **bd `j5lb`** (DG 6 études) → NO-GO sur les 6 sources : FBref (obsolète), RapidAPI/The Odds API (redondant BSD), TheSportsDB (pas de stats utiles), Transfermarkt/Apify (defer roadmap Fiche Quant), OddsPortal (redondant BSD), Marketing (pas de trafic à monétiser)

### Modifié
- **CLAUDE.md** : roadmap mise à jour — retrait des lignes j5lb/8lqf, ajout xvalue.ai ticket qyfr

---

## [v12.77] — 2026-06-11 — Quality gates : Plan→Execute→Verify workflow + test-quick.js

### Ajouté
- **CLAUDE.md** : 3 nouvelles règles systématiques :
  - `PLAN → EXECUTE → VERIFY` (obligatoire > 3 fichiers)
  - `3-STRIKE RULE` (stop après 3 échecs consécutifs)
  - `AUTO-VERIFY POST-EDIT` (node --check + test-quick.js automatiques)
- **`.claude/settings.json`** : Hook gstack-careful activé (protection rm -rf, force-push, DROP TABLE)
- **`scripts/test-quick.js`** : Quality gate rapide — syntaxe Node, sync STRATEGIES, DB integrity
- **`.context/knowledge/`** : Base de connaissance persistante (5 dossiers : architecture, strategies, etl, math, ops)

---

## [v9.8] — 2026-06-11

### Ajouté
- **Tri Δ Elo Surface tennis** : nouvelle option dans le sélecteur de tri de l'onglet Tennis
  - Trie les matchs par écart d'Elo surface décroissant (du plus déséquilibré au plus équilibré)
  - Fallback sur Elo global si pas d'Elo surface disponible
  - Fichiers modifiés : `pariscore.html` (option select), `pariscore.js` (case switch)

---



## [v12.76] — 2026-06-11 — Sélections nationales : ETL international_results → λ/form/H2H World Cup 2026 — bd `qgfm`

**Audit runtime v12.75** : 58/62 records prod avec `stats.source` ✅ mais distribution `{sim:50}` — 43/46 côtés sim = **équipes nationales WC 2026** (football-data.co.uk = clubs uniquement). Le tournoi démarre le 11/06 : gap critique.

### Livré

- **`seed_historique_international.js`** : martj42/international_results (CC0 1.0, 49 472 lignes, fixtures WC 27/06 incluses) → **4 568 matchs ≥ 2022** (1,7 MB JSON). `INTL_TEAM_MAP` calibré sur db.matches réels (USA, Türkiye, Czechia, Côte d'Ivoire, Cabo Verde, Bosnia & Herzegovina, UAE). Flag `is_neutral` conservé.
- **`loadHistory()` merge** → `db.archive_matches` (`_source: 'etl-seed-international'`, `sport_key: 'intl'`).
- **Index FD étendu 2 sources** : fenêtre courante intl = année civile N-1/N (~18 mois sélection) vs label saison fd ; `src` par entrée → `stats.source = 'intl-archive'`.
- Validation : **15/15 sélections WC** lookup OK (England dom 1.80, France 2.50, USA ext 0.92, New Zealand ext 0.38).

### Effet

Les 43 sélections WC 2026 passent de `simStats` (hash) à vraies moyennes 2022-2026 + H2H + forme via archive. λ Poisson WC réels dès le restart.

---

## [v12.75] — 2026-06-11 — FD fallback : archive football-data alimente λ Poisson / form / H2H — bd `6dpi`

La DB football-data.co.uk (v12.74) alimente maintenant les champs existants des matchs :

- **`buildFDStatsIndex()` + `getFDTeamStats()`** (server.js, avant `computeEdge`) : index in-memory 454 équipes depuis `db.archive_matches` (`_source='etl-seed-footballdata'`) — splits home/away, saison courante (≥6 matchs/split) sinon pool 3 saisons (≥10). Shape identique `buildSideStats` (ppg/wins%/avgScored/avgConceded/played).
- **`buildMatchRecord` λ Poisson** : chaîne fallback `standings DB → FD archive → simStats`. Les équipes sans standings (ligues hors BSD/API-Football : League One/Two, National League, SC1-3, D2/I2/F2…) reçoivent de **vraies moyennes** au lieu du hash simulé. `stats.isReal=true` si FD, nouveau champ `stats.source = {home, away}` ('bsd'|'api-football'|'db'|'fd-archive'|'sim').
- **Noms normalisés dans le JSON seed** (`TEAM_MAP` appliqué au transform, id stable sur noms bruts) → `computeH2H` (match exact `normName`) et `deriveFormFromHistory` (Level 4 forme) voient désormais les 23 126 matchs fd pour les équipes live.
- Validation : index standalone — PSG avgScored dom 2.41, Galatasaray 2.71, Wolves ppg 0.74, Stockport (League One, hors BSD) 23 matchs couverts.

Guard : split DB avec `played=0` (buildSideStats zéro) bascule aussi sur FD — évite BAD_LAMBDA.

---

## [v12.74] — 2026-06-11 — ETL football-data.co.uk : stats matchs 3 saisons × 22 divisions — bd `sc0o`

### Recherche comparative (web + GitHub)

| Candidat | Verdict |
|---|---|
| **football-data.co.uk** | ✅ **RETENU** — source canonique (les repos GitHub en dérivent), 22 divisions, stats par match + cotes closing, maj 2×/semaine, gratuit, 25+ saisons |
| xgabora/Club-Football-Match-Data-2000-2025 | ❌ dérivé de football-data.co.uk — intermédiaire avec lag |
| eatpizzanot/soccer-dataset (367k matchs) | ❌ provenance scraping grise, cadence refresh inconnue |
| FiveThirtyEight SPI | ❌ gelé mi-2023 — échoue critère "3 dernières saisons" |
| StatsBomb open-data | ❌ event-level mais compétitions sélectives + licence non-commerciale |
| openfootball / footballcsv | ❌ scores uniquement, zéro stats (déjà intégré bd `6du6`) |

### Livré

- **`seed_historique_footballdata.js`** : CSV `mmz4281/<saison>/<div>.csv` → **23 126 matchs** 3 saisons (2023-24→2025-26) × 22 divisions, **21 463 avec stats** (tirs, cadrés, corners, fautes, cartons, arbitre E0) + cotes **closing Pinnacle** (`PSC*`), B365, Max/Avg marché, O/U 2.5, Asian Handicap. 0 erreurs. Flags `--seasons=N --div=X --corners --corners-only --dry`.
- **`loadHistory()` merge** → `db.archive_matches` (`_source: 'etl-seed-footballdata'`, champs `stats` + `odds_historical` + `referee`). Parse boot 534 ms / 21,4 MB.
- **Backfill `corner_history`** : +13 484 rows (2 178 → **15 662**, ×7.2) via mapping 13 ligues BSD + `TEAM_MAP` (~130 entrées fd→BSD calibrées sur rosters réels DISTINCT). Le modèle corners (`fetchLocalCornerHistory`) gagne 3 saisons de profondeur d'échantillon.
- **Fix défensif `seed_historique_bsd_corners.js`** : `event.date` vide sur payloads BSD réels → 2 178 rows `match_date=''` ; chaîne `date || event_date || start_time || start_at`.

### Edge mathématique ouvert

- Ancrage devig **closing Pinnacle** → backtest CLV / calibration `computeWFV1N2` sans OddsPapi (bd `bjv` complément).
- Calibration corners 3 saisons (IC par volume réel d'échantillon), λ Poisson par ligue/saison.

### Ops VPS

`node seed_historique_footballdata.js --corners` après deploy (JSON 21,4 MB gitignored — généré sur place), puis `pm2 restart server` → log boot attendu : `✓ ETL seed merge (football-data.co.uk): 23126/23126`.

---

## [v12.73] — 2026-06-11 — Fix Corners: historique équipe vide (England) — bd `upav`

### Root cause (prouvé par probes BSD `.context/_probe_corners_england*.js`)

| # | Défaut | Effet |
|---|---|---|
| 1 | BSD `/events/` trié **ascendant** fixe, page 1 = les 50 plus **vieux** ; params `page`/`ordering`/`page_size` custom **ignorés** (vraie pagination = `limit/offset` cf. URL `next`) | `fetchBSDTeamCornerHistory` ne voyait que les 50 plus vieux de 143 amicaux (16/05→04/06) — England–New Zealand 06/06 invisible |
| 2 | Fenêtre 30 jours | Sélections jouent ~1 match/mois — England–Japan 31/03 (corners 11-1) exclu |
| 3 | Requête mono-ligue | Qualifs WC (Albania–England 5-5, L58) + Nations League jamais agrégés |
| 4 | `fetchBSDTeamLastFixtures` paginait avec `page=` (ignoré) | Relisait 6× la même page, dedup masquait — formes récentes tronquées aux plus vieux 50 |
| 5 | TTL `apiCacheSet(..., 6 * 3600)` — unité = **ms** | Cache last-fixtures expirait en 21,6 s au lieu de 6 h |

### Fix

- **`fetchBSDLeagueFinishedTail(leagueId, days=365, maxPages=6)`** : lit `count` puis pagine depuis la **fin** (offsets décroissants) → les ~300 matchs les plus récents ; events slim (id/date/teams/scores/corners) ; cache SQLite 6 h par ligue, partagé corners + last-fixtures.
- **`fetchBSDTeamCornerHistory`** : fenêtre 365 j ; équipes nationales (ligues 27/30/31/58-65/66-69) → scan agrégé amicaux 31 + qualifs 58-63 + Nations League 64-65 en `Promise.all` ; tri desc toutes ligues, top `limit` ; fallback `localHist` partiel (<5 matchs) si BSD vide.
- **`fetchBSDTeamLastFixtures`** : pagination via helper (fix `page=` ignoré), TTL 6 h réel.

### Backtest validation (BSD live, `.context/_test_corners_fix.js`)

| Équipe | Avant | Après |
|---|---|---|
| England | `null` → « Estimation ligue moy. » | **5 matchs** — CR 11-1, NZ 8-1, Japan 11-1, Uruguay 7-0, Albania 5-5 → For 8.40 / Against 1.60 |
| Costa Rica | 1 match | **3 matchs** — For 4.33 / Against 7.33 |

Déploiement : purge `api_cache` sources `corners` + `bsd_last_fx` (entrées stales persistées SQLite).

---

## [v12.71] — 2026-06-10 — Football card: Signal Fort + prob bar 1N2 + market badge

### Fonctionnalités livrées (benchmark BetMines/BeSoccer)

| Point | Description |
|---|---|
| **Signal Fort badge** | Badge gradient `⚡ Signal Fort` affiché sur la carte quand WoM Betfair >55% + edge dévigué >3% convergent sur le même marché — différenciateur unique vs BetMines (raw Bayesian) et BeSoccer (pas de signal value) |
| **Prob bar 1N2** | Barre tricolore home/draw/away (Poisson Shin-Hurley calibré) remplace le texte brut `1N2%` — même lisibilité que BetMines mais probabilités déviguées |
| **Badge Marché** | Nouvelle cellule `mc-mkt` dans `mc-metrics` affichant le marché edge (BTTS/O2.5/1/N/2) + cote best inline — même info que BetMines mais ancrée sur edge dévigué |
| **CSS design system** | Tokens `.mc-signal-fort`, `.mc-prob-bar`, `.mc-pb-h/d/a`, `.mc-prob-lbl`, `.mc-mkt-v/lbl/odds` ajoutés — cohérent avec `--cf-*` et `--accent` |
| **FlareSolverr Betfair** | `_bfFetchIndexHtml()` route le fetch HTML Betfair via FlareSolverr si `FLARESOLVERR_URL` défini — bypass Cloudflare VPS optionnel |

### Fichiers modifiés
- `pariscore.js` — `buildCard()` : +26 lignes vars + Signal Fort + probBar1N2 + mktBadge
- `pariscore.html` — +15 lignes CSS nouvelles classes mc-card
- `server.js` — `_bfFetchIndexHtml()` helper FlareSolverr
- `locales/*.json` — sync i18n 7 langues

---

## [v12.70] — 2026-06-09 — NBA Brier validé (0.209 vs 0.25), signal BET activé

### Fonctionnalités livrées

| Point | Description |
|---|---|
| **Brier NBA validé** | Brier 0.209 sur 1324 matchs saison 2025/26 — 16% mieux que la baseline 0.25, accuracy 66.8% |
| **Signal BET NBA actif** | Le note du calculateur `basketballService.js` passe de « NON calibré vs marché » à « Brier 0.209 validé, signal BET actif ». Le signal BET est officiellement activé en production |
| **Elo refresh** | `data/nba_elo.json` regénéré le 2026-06-09 — 2 matchs supplémentaires (1322→1324), Elo Knicks et Spurs mis à jour |
| **better-sqlite3** | Ajouté aux dépendances `package.json` (v11.7.0) |

### Fichiers modifiés
- `services/basketballService.js` — note mise à jour : Brier 0.209 validé, signal BET actif (vs « NON calibré vs marché »)
- `data/nba_elo.json` — regénéré, +2 matchs, Elo teams 18 & 24 mis à jour
- `package.json` — +better-sqlite3 v11.7.0
- `DEBUG_WOM_DISCORD.md` — nouveau fichier debug WOM Discord
- `.beads/issues.jsonl` — tâches beads mises à jour

---

## [v12.69] — 2026-06-09 — Tennis WOM cache — optim évit fetch Betfair redondant value bets

### Fonctionnalités livrées

| Point | Description |
|---|---|
| **Live WOM cache** | `_tennisLiveCache` (Map) — évite fetch Betfair redondant pour les matchs déjà enrichis live dans le re-build du value bets builder |
| **Cache population** | `enrichMatchesWithBetfairWOM` appelé après build cache live tennis, peuple le cache WOM pour tous les matchs live |
| **Fallback fetch** | `fetchBetfairWOM` uniquement en cache miss dans le value bets builder — pas de requête Betfair superflue |

### Fichiers modifiés
- `server.js` — `_tennisLiveCache`, `enrichMatchesWithBetfairWOM`, value bets builder fallback

---

## [v12.68] — 2026-05-28 — Intégration annonces BSD 26-27/05/2026

### Fonctionnalités livrées

| Point | Description |
|---|---|
| **Goal Replays** | `bsdPlayClip()` → async + consultation manifest `/api/v1/bsd/clips/:matchId` avant lecture vidéo. Tooltip 📹 enrichi avec nom du joueur + minute. Routes proxy clips déjà sur `/api/v2/events/{id}/clips/` ✅ |
| **Cup competitions** | `buildRows()` expose `group: s._group_name` → `GET /api/v1/standings/:leagueId` inclut désormais le groupe. Onglet Classement modal Insights : chips groupe (Gr. A / Gr. B…) pour naviguer entre poules. `round_name` ajouté dans payload `GET /api/v1/insights/:matchId` + affiché dans l'en-tête du match. |
| **Post-match highlights** | `GET /api/v1/social/match/:matchId` expose `videos: []` (social_items type='video', max 10). Nouvel onglet **🎬 Vidéos** dans le modal Insights : grid de cartes cliquables (thumbnail + titre + durée). |
| **Support BSD** | Support BSD disponible sur https://sports.bzzoiro.com/support/ |

### Fichiers modifiés
- `server.js` — buildRows group, social videos, insights round_name+match_group
- `pariscore.html` — tab Vidéos (button + select + div)
- `pariscore.js` — insShowTab, bsdPlayClip async, buildBsdVideos, buildClassementTab group chips, openInsights round_name

---

## [v12.67] — 2026-05-23 — bd `0mpj` Onglet Roland Garros bracket interactif (Path A internal Clay Elo + Monte Carlo)

### Code livré (1 feature, 706 lignes — 393 backend + 317 frontend)

| Locus | Description |
|---|---|
| `server.js:28336-28518` | Backend RG bracket : `_rgRoundOrder/_rgRoundLabel/_monteCarloRG/buildRolandGarrosBracket` + route `GET /api/v1/tournament/roland-garros?tour=ATP|WTA&simN=1000..50000`. Réutilise `resolveRgTournaments` (BSD `/api/v2/tournaments/?category=grand_slam` cache 12h) + `handleTennisBSD` (matches `/api/v2/matches/?tournament=ID&limit=300` cache 30min) + `tennis_elo` SQLite (surface='Clay' interne PariScore, lecture). Cache payload 1h. Monte Carlo N=10000 défaut (clamp 1k-50k). Sortie par joueur : `clay_elo` + `clay_rank` + `title_prob_pct` + `final_prob_pct` + `sf_prob_pct`. Top 16 contenders triés + bracket structuré par round avec p1/p2 win prob Elo. |
| `pariscore.html:7211` | Nav link `🏆 Roland Garros` + auto-load on first click via `window._rgLoaded` guard. |
| `pariscore.html:9703-9899` | Page `#page-rg` scoped CSS RG charte (`--rg-clay #D85B25` + `--rg-cream #F4ECDE` + `--rg-green #0A4D3C` + Bree Serif headlines). Hero + toggle ATP/WTA + status pill + refresh button. Top 16 favoris grid responsive avec `🏆 X.XX%` color-coded (hot ≥10% emerald · warm 2-10% amber · cool <2% grey). Bracket horizontal scroll 7 colonnes (R128 → F) avec cards glassmorphism par match (seed badge + clay-rank pill + win prob % + winner highlight). Disclaimer méthodo Monte Carlo. Mobile responsive ≤768px. |

### Architecture

- **Path A (legal-clean)** : Clay Elo recomputed via `computeTennisElo()` existant depuis `tennis_matches` Sackmann (proprietary derivation). Pas de dépendance TA cElo direct (bd `8uoc` Q1/Q2/Q3 DG pending), pas de scraper externe à activer.
- **Sourcing draw** : BSD MCP primary `/api/v2/tournaments/?category=grand_slam` + `/api/v2/matches/?tournament=ID&limit=300`. Fallback ESPN non câblé (BSD seul couvre Grand Slam draws complets).
- **Monte Carlo** : 10k itérations × 127 matchs × 7 rounds = 1.27M ops. Bench standalone Node natif `Math.random()` + Elo formula = 222ms pour 5k sims. <500ms pour 10k. Pas de Worker thread (single-shot).

### Validation

- `node --check server.js` ✓ syntaxe OK
- Route smoke test fresh boot port 3099 BSD off : 15ms cache hit / 5750ms cache miss → `{available: false, reason: 'rg_not_found'}` comportement attendu.
- Monte Carlo standalone bench 5k sims 128 joueurs : 222ms, top 5 spread 6.8% → 10.88% (Elo gap réaliste).

### Décisions par défaut (auto mode, redirigeable)

1. **Path** : A internal recompute (vs B TA cElo bloqué `8uoc`).
2. **Tour** : ATP men's singles par défaut (WTA toggle dispo).
3. **Persistance** : cache `api_cache` clé `rg_bracket_<tour>_<simN>` TTL 1h (vs nouvelle table `tournament_brackets` — TTL cache suffit pour usage 2 semaines tournoi).
4. **Cadence** : on-demand fetch (vs cron J-1 — cache 1h + push BSD WS cumul couvre).
5. **Onglet** : nav header principal (vs sous-onglet Tennis).
6. **Charte** : scoped `[data-page="rg"]` (vs theme switcher global).

### Pending DG/ops

- **Deploy VPS** : `cd /home/ubuntu/pariscore && git pull && pm2 restart pariscore` — requis pour activer la route (BSD_TENNIS_ENABLED=true prod).
- **Validation prod post-deploy** : `curl https://pariscore.com/api/v1/tournament/roland-garros?tour=ATP&simN=10000 | jq .draw_size` → attend 128, `.top_contenders[0].name` → favori (Sinner ATP ou Sabalenka WTA mid-2026).
- **Extension WTA** : code prêt, juste valider BSD `circuit='WTA'` retourne RG femmes dans `/tournaments` (sinon ajuster regex filter).
- **Cron pre-warm cache** : si latence cache miss 5s gêne UX, ajouter cron 6h `buildRolandGarrosBracket({tour:'ATP'})` + idem WTA pour garder cache chaud pendant les 2 semaines RG.

---

## [v12.66] — 2026-05-22 — Audit bd `3u9` AF post-prod (kill-switch + plan tier + recommandations DG)

### Audit livré (1 doc `.context/audits/`)

| bd | Livrable |
|---|---|
| `3u9` | `.context/audits/audit-3u9-af-state-post-prod.md` — état réel kill-switch v10.77 (`server.js:69-71`), plan compte actuel (Free 100 req/jour, cross-ref bd `zia`), tableau usages AF par feature post-`AF_REMOVED=true`, 3 scénarios DG (A maintenir kill-switch $0/mo · B upgrade Pro $19/mo + activer bd `zia` cotes · C cleanup total 500-800 lignes dead code), synergy bd `zia` conditionnelle plan Pro, recommandation CTO Scénario A court terme (reverse possible via plan revenue Stripe `s77m`). |

### Findings clés

- Kill-switch v10.77 confirmé sain : `AF_REMOVED=true` → `API_FOOTBALL_KEY=''` → ~23 call sites early-return null gracefully. Aucune régression observée (boot 271 matchs sans AF, log `[AF] API-Football RETIRÉ`).
- Routes ex-AF : `/api/v1/af/predictions/:id` fallback BSD (v10.75), `/api/v1/af/transfers/:id` 503 gracieux assumé (orphelin sunsetté), stats avancées équipe couvertes par `buildAdvancedStatsFromStandings` v10.76.
- Opt-in cotes AF `USE_API_FOOTBALL_ODDS=1` (bd `zia`) **indépendant du kill-switch stats** — viable uniquement plan Pro (compte Free 100 req/j cap insuffisant pour 200 req/j cumulés).
- Contradiction doc identifiée : `.claude/CLAUDE.md` §3.2 et §14 décrivent un plan Pro $19/mo qui n'est pas souscrit (drift à corriger après décision DG).

### Pas de code change

Audit only — aucun call site touché, aucun cleanup dead code (réservé Scénario C sur décision DG).

### Résiduel — décisions DG attendues

1. Scénario A (kill-switch maintenu, $0/mo) vs B (upgrade Pro, réactive AF + bd `zia`) vs C (cleanup total) ?
2. bd `zia` : close `wont_fix` (A/C) ou attendre activation prod (B) ?
3. Sync `.claude/CLAUDE.md` §3.2 §14 après décision DG.

---

## [v12.65] — 2026-05-22 — Session 26 commits : c5i Phase 3 + izsn safeFixed + 8c5 momentum + p2if AI-AL + bjv/8uoc/ffh spikes + k37 + rlhf + ryi3 health + tv-bsd Phase 1

Session intensive 22/05 — 26 commits push main (bd-driven + worktree-disciplined).

### Code livrés (10 features/fixes)

| Commit | bd | Description |
|---|---|---|
| `fbea217` | `c5i` | Tennis serveur live Phase 3 — `fetchAiscoreServingOnDemand` throttled 5/poll + cooldown 10min, sourceTag `aiscore_cache`/`aiscore_ondemand` |
| `bce7535` | `izsn` | safeFixed wrapper 49 sites server.js — anti NaN/null + helper backend signature aligned frontend |
| `16c6a9d` | `izsn` | safeFixed wrapper 2 sites pariscore.html — anti NaN/null |
| `38ffa7b` | `8c5` | Momentum plat La Liga fix — split `live_momentum_pct` (objet BSD WS) vs `live_momentum` (array Sofa) |
| `9ba089a` | `8c5` | 8c5 follow-up — Array.isArray guards 3 consumers SSE+REST manqués (live_patch + /api/v1/live + modal refresh) |
| `ae6a292` | `p2if` | AI-AL Revue Presse Phase 1 — prompt Gemini foot+tennis avec panel 5 sources international (L'Équipe/Marca/Sky Sports/ESPN/TalkSport) |
| `8b99cb2` | `k37` | UI coral leak tableau Foot — `tr.match-row-live::before` box-shadow 14→6px + keyframe + remove !important override |
| `fc9c65e` | `rlhf` | Audio alertes trading — `_psAudio` state tracking 4 indicateurs (intensity/verdict/confidence/edge), `_psTierFromValue` + `_psApplyTransition` + queue 200ms cap 3 sons/burst |
| `117c711` | `ryi3` | Routing Phase 2A — route `/api/v1/sources/health` 5 sources (BSD/ESPN/OddsAPI/Gemini/Felipeall) + status derivation degraded/down/ok |
| `d10ab09` | `0hf4` | BSD TV broadcasters Phase 1 — 3 fetchers (`fetchBSDTVChannels` 24h + `fetchBSDBroadcasts` 6h + `fetchBSDBroadcastsByEvent` 6h) + helper `attachBSDBroadcasts` cache-only lookup |

### Livrables research/spike (4 docs `.context/`)

| Commit | bd | Livrable |
|---|---|---|
| `72d5e8a` | `bjv` | `.context/spike-bjv-rapidapi-eval-final.md` (RapidAPI odds-api1 score 78/100 — GO conditionnel) |
| `0754a33` | `bjv` | `.context/research-pinnacle-api-2026.md` + correctifs spike (Pinnacle API fermée 23/07/2025, NO-GO direct, 3 voies abordables) + POC `_probe_oddspapi_pinnacle.js` |
| `2ce9463` | `8uoc` | `.context/strategy/rapport-tennis-data-sourcing-2026.md` v2 (découverte Tennismylife/TML-Database MIT — drop-in replacement Sackmann NC) |
| `1280dfb` | `ffh` | `.context/spike-ffh-6sources-eval-final.md` (xvalue.ai GO ferme 85/100 — seule API REST + free trial + xG advanced + ML scouting clustering 30 ligues) |

### Doc/maintenance CLAUDE.md (10 commits sync)

- `5e18185` Section 15 drift — 13 items `[ ]→[x]` post `/ps-audit`
- `d384d1d` P2 sync drift — 6 fermés + colonne État
- `b7abcc1` BSD MCP coverage roadmap Phases 2-5 (4 bd tickets)
- `f0bc9c2` TV Phase 1 row + bd `0hf4` ref
- `7b9715d` Purge 5 missions livrées + refresh tables (CLAUDE.md -211/+42 lignes)
- `e95109f`+`1cf3c52`+`9dcad10` qm6a Flashscore 6 plans A-F sous-table
- `17c176c` 6jro Sofascore Apify 4 plans G-J sous-table
- `e64903c` Header v12.65 + Sources data enrichi + 3 pistes Innovation Backlog
- `fed8a2d` MISSION AUTH stale → État livraisons SaaS + 9 décisions DG bloquantes

### bd state changes

**Fermés (10)** : `izsn` `lyku` (audit confirmed) · `8c5` · `c8zp` · `c9p4` · `x11y` · `nwk6` · `k37` · plus notes status open conservés `ffh` `rlhf` (validation user pending)
**Créés (7)** : `0hf4` (BSD TV) · `j6pz` (BSD Phase 2) · `ueg0` (BSD Phase 3) · `82th` (BSD Phase 4) · `r0v3` (BSD Phase 5) · `qm6a` (Flashscore datasets) · `6jro` (Sofascore datasets)
**In_progress maj notes** : `c5i` `bjv` `8uoc` `p2if` `ryi3`

### Découvertes critiques

- **Pinnacle API publique fermée 23/07/2025** (B2B Pinnacle Solution €5000/mo + licence sportsbook régulée — hors scope PariScore)
- **The Odds API ne contient PAS Pinnacle** même tiers payants — invalide combo retenu spike `bjv` initial
- **Sackmann tennis_atp CC BY-NC-SA infraction** pour SaaS commercial €19/mo — `tennis_matches` table en infraction → Plan A purge + ETL TML-DB MIT (8uoc)
- **xvalue.ai (Soccerment)** seule source 6 candidates avec API REST officielle + free trial + xG advanced

### Pending ops user (post-session)

1. **Deploy VPS** : `cd /home/ubuntu/pariscore && git pull && pm2 restart pariscore` (cumul `fbea217` → `fed8a2d`)
2. **🚨 Revoke RapidAPI key** exposée chat 21/05 (dashboard RapidAPI) + nouvelle clé `.env` VPS
3. **DG decisions** : `8uoc` Q1 (Sackmann purge urgent) · `s77m` Stripe checklist 9 sections · `j5lb` 6 études bloquées
4. **POCs free trial** : OddsPapi.io 250 req Pinnacle (`.context/_probe_oddspapi_pinnacle.js`) · xvalue.ai 1j (`bjv` Phase 1 alternative)

---

## [v12.16] — 2026-05-21 — PWA icon fix + SW v24

**Bug bd ParisScorebis-npp** : Chrome mobile console `icon.svg invalid image` bloquait install PWA propre.

**Root cause** : SVG référençait fonts custom (`Syne`, `DM Mono`) non chargées par Chrome lors rendu icon manifest.

**Fix** :
- Refonte `icon.svg` sans dépendances fonts externes. Background gradient radial + outer ring cyan→emerald + lettre `P/S` paths manuels + label `PARI` shapes géométriques.
- `manifest.json` purpose `"any"` → `"any maskable"` (Android adaptive icons).
- `sw.js` v22 → v24 force re-install pour purger icon.svg pre-cached invalide.

---

## [v12.15] — 2026-05-21 — Spike alternatives Odds API

**bd ParisScorebis-bjv** : Spike research read-only. Aucun code production touché.

Livrable `.context/spike_odds_alternatives.md` :
- Décision matrix 8 options scored 0-100
- Combo retenu : **Odds API Starter ($30/mo) + API-Football odds (déjà payé) + Polymarket proxy (gratuit)**
- Rejets argumentés : OddsPortal scrape (ToS+CF), Pinnacle (sport coverage), SportRadar/OddsJam/OddsMatrix (over-budget)
- Architecture `providers/odds_provider.js` fallback chain proposée
- Effort impl : ~8 jours dev / 6 phases

---

## [v12.14] — 2026-05-21 — Fix momentum flat-line La Liga

**bd ParisScorebis-8c5** : Real Betis vs Elche stats live populated mais Momentum SVG = flat lines.

**Root cause** : live polling loop `server.js:27667` calculait minute via `parseInt(detail?.current_minute ?? m.live_minute ?? 0) || 0`. Si BSD feed sans `current_minute` ET `m.live_minute` null → minute=0 → guard `if (minute)` bloquait `recordLiveMomentumSnapshot` → history vide → flat-line frontend.

**Fix** : fallback estimation minute via `commence_time + Date.now()` quand minute=0 ET stats live présents. Compte mi-temps 15min.

---

## [v12.13] — 2026-05-21 — Diagnostic SQLite corruption script

**bd ParisScorebis-b50** : SQLITE_NOTADB runtime sur `apiCacheGet`. Code fix `apiCache*` fail-soft try/catch déjà livré (commit 7d32234).

Livrable `.context/diag_sqlite_corruption.sh` : 13 checks (fichiers, disque, inode, magic bytes, integrity_check, quick_check, journal mode, schema, api_cache volume, pm2 logs, lsof, backups) + procédure recovery (restore from backup ou `.recover` SQLite >= 3.32).

---

## [v12.12] — 2026-05-21 — Security hardening : notification banner + nginx ACL

**bd ParisScorebis-c8m** Phase 3 Hardening + Phase 5 Notification.

- `.cf-security-banner` sticky top z-index 9998 avec `cfSecBannerPulse` 4s. Activation via `localStorage.setItem('cf_security_banner','1')` ou `?security=1`.
- `.context/nginx_hardening_pariscore.conf` : 9 location regex blocks (source JS, .env, SQLite, JSON sensibles, package, docs, rapports, dotfiles, IP bans). Rate limiting auth 5r/min + api 60r/min. Security headers (HSTS preload + X-Content-Type + X-Frame + Referrer + Permissions).

---

## [v12.11] — 2026-05-21 — Incident sécurité dossier preuves

**bd ParisScorebis-c8m** : audit nginx logs révèle attaque réussie.

**Findings** :
- IP `37.65.65.25` (Nantes FR SFR résidentiel) a téléchargé `server.js` HTTP 200 196 KB à `20/May/2026:00:26:11 UTC` avant déploiement fix.
- Retry même IP 00:50:19 sur 3 fichiers : 403 (fix actif).
- 8 clés/secrets `.env` considérés compromis : `JWT_SECRET`, `ADMIN_PASSWORD`, `GA_POSTBACK_TOKEN`, `TELEGRAM_BOT_TOKEN`, `ODDS_API_KEY`, `GEMINI_API_KEY`, `API_FOOTBALL_KEY`, `BSD_API_KEY`.

Livrables :
- `.context/incident_securite_20260520.md` — Timeline + attaquant geo + 8 clés exposées + 6 phases remédiation + leçons apprises + 8 backlog hardening
- `.context/audit_db_post_breach.sql` — 8 queries SQLite audit (paris, bankroll, conversions, sessions)

Rotation engagée : JWT_SECRET fait. Reste 7 clés via dashboards externes.

---

## [v12.10] — 2026-05-21 — ETL Historique scaffold

**bd ParisScorebis-9je** : Pipeline ETL massif Historique Football.

**Décision sourcing** : API-Football PRO (déjà payé, 7500 req/jour) primaire + openfootball backup. Rejets fbref scrape (CF+ToS), Kaggle (outdated), SportRadar (cost).

`seed_historique_db.js` :
- Quota-aware (throttle 200ms + stop early < 100 req remaining)
- 9 PRIORITY_LEAGUES T1 (PL, L1, Bundesliga, Serie A, La Liga, Eredivisie, Primeira, Brasileirão, UCL)
- Output `historique_football.json` schema_version + leagues map
- CLI args : `--sample-pl`, `--league X`, `--season Y`

---

## [v12.0 → v12.9] — 2026-05-20 — Design System V2.0 complet + Sprint 2 innovations

**Epic bd ParisScorebis-70r CLOSED.** 5 phases livrées :

### Phase 1 (v12.0) — Tokens centralisés
- 60 vars unifiées `:root` : bg/glass/néon/surface/text/spacing/radius/blur/typo
- ~150 utility classes `.cf-u-*`
- Rétro-compat vars v11.x

### Phase 2 (v12.1) — Foot+Tennis refonte
- Sticky col 2 standardisé `var(--cf-sticky-col2)` 80px (vs 60/90/140 incohérent)
- Hero VALUE col foot gradient réactif emerald/amber/coral
- LCD scoreboard tennis cyan glow + radius-card
- DR bar 3 tiers gradient (emerald/amber/coral réactif)
- Halo surface `::after` radial subtil clay/grass/hard via `:has()`

### Phase 3 (v12.2) — Historique migration
- Alias 16 vars `--dh-*` → `--cf-*` tokens
- 38 CSS rules `.dh-*` consument V2 sans modif
- Bloomberg-density layer (KPI tile, chips pilules, table padding)

### Phase 4 (v12.3) — Polish global
- Scrollbar custom 8x8 cyan + Firefox thin
- Safari `-webkit-backdrop-filter` blanket 22 sites
- `prefers-reduced-motion` universel via `*`
- GPU `will-change` 6 sélecteurs critical

### Phase 5 (v12.4) — QA visuelle
- 28/28 tokens validés runtime `getComputedStyle`
- 4/4 phase blocks DOM-confirmed
- Accessibility AAA contrast ratios

### Sprint 2 features (v12.5-12.9)
- v12.5-12.7 QA fix CRIT-1 (dr_home guard), CRIT-4 (snapshot minimal), CRIT-5 (hot-swap fallback), MAJ-2 (reduce/0), MAJ-4 (storage event sync), MAJ-7/8/9 (z-index hierarchy), MIN-5 (opacity vs saturate)
- v12.8 BD-DATA-005 Choke-O-Meter heuristique (Favorite Win Rate proxy)
- v12.9 UI-014 Choke pastille foot consume BD-DATA-005

---

## [v11.0 → v11.13] — 2026-05-20 — CYBER-FINTECH OVERLAY + Sprint 1 P0 + rapports

**Highlights** :
- v11.1-11.4 CF overlay theme-agnostic (Foot+Tennis dark trading panels)
- v11.3 Tennis ball SVG 3D + scoreboard serving indicator (pulse animation)
- v11.4 Tennis serving `?` badge fallback + AiScore servePos parse
- v11.5-11.8 UI-009 Bet Score Gauge + EV Heatmap, UI-011 Fatigue pastille, UI-017 Time-to-kickoff chip, UI-018 3D translucent balls hub cards
- v11.9 Fix country mapping Conmebol/Concacaf/UEFA/CAF/AFC/FIFA (Copa Libertadores)
- v11.10 Fix Odds API quota predictive rate-limit
- v11.11 UI-012 Profils filtres tennis sauvegardés (localStorage)
- v11.12 QA rapport read-only 28 risk flags
- v11.13 Design V2.0 rapport read-only

---

## [v10.78] — 2026-05-19

### Fix — Bug poll tennis `fetchBSDTennisPredictions is not defined` (5o0)

`pollTennisLive` ne résolvait pas les 4 warmers tennis (fns top-level mais hors scope du poll — même classe de bug que le pont `__tennisVBWarm` existant). Referenceader synchrone sur `fetchBSDTennisPredictions('')` → tout le bloc warmer avorté (caches calibration/rank/surface jamais préchauffés). Pré-existant, non lié au retrait AF.

- Pont `globalThis.__tnWarmers` posé après `buildBSDTennisRankIndex` (scope où les 4 fns sont liées), avec garde `typeof`.
- `pollTennisLive` appelle les warmers via le pont + `typeof` (safe sur identifiant non déclaré, ne throw pas) → poll ne crashe plus, warmers actifs dès le pont initialisé.
- Vérifié : `node --check` OK, boot OK, **`[Tennis] poll error` disparu**, zéro ReferenceError.

---

## [v10.77] — 2026-05-19

### 🔴 BREAKING (maîtrisé) — API-Football RETIRÉ (kill-switch)

`API_FOOTBALL_KEY` forcée vide via `const AF_REMOVED = true` → **plus aucun appel `v3.football.api-sports.io`** (zéro quota dépassé). Méthode kill-switch à la source (pas suppression brute des ~23 call sites = diff massif/régression). Toutes les fns AF gardent déjà `if(!API_FOOTBALL_KEY) return null` → les fallbacks non-AF livrés v10.72→v10.76 (BSD/ESPN/felipeall + calc interne) prennent le relais automatiquement.

- CDN clé-zéro `media.api-sports.io` (photos/logos) **NON concerné** — continue de fonctionner.
- Réversible : `const AF_REMOVED = false` réactive l'env.
- Vérifié : `node --check` OK, boot OK, **271 matchs chargés sans AF** (BSD/ESPN), log `[AF] API-Football RETIRÉ`, zéro SyntaxError/ReferenceError/TypeError.
- Routes ex-AF sans fallback (`/api/v1/af/transfers`) → 503 gracieux (transferts désormais via felipeall `/api/v1/transfermarkt`).
- Bilan couverture : 9/9 champs traités (fallback livré, ou N/A honnête tirs/cartons/penalties/formation/clean-sheets, ou sunset rumeurs).

---

## [v10.76] — 2026-05-19

### Feature — Stats avancées équipe : fallback BSD standings (dernier orphelin AF)

`buildAdvancedStatsFromStandings(ts)` — dérive le shape `advancedTeamStats` depuis `db.teamStats[key]._raw` (counts dom/ext) + `form` + xG, **zéro réseau** (data déjà en mémoire). Calcul interne : moy buts marqués/encaissés dom/ext, played/W/D/L dom/ext, série en cours (parse `form`), totaux, xG. `getTeamAdvancedStats(teamKey,meta,leagueId,season)` — AF si `teamId`+clé, sinon fallback BSD (peuple `db.advancedTeamStats` en mémoire, sans saveDB). Câblé en remplacement des 2 `fetchTeamAdvancedStats` du builder AI Scout.

- Champs **sans source libre = `null` HONNÊTE** (jamais inventé) : tirs, tirs cadrés, cartons J/R, penalties, formation, clean sheets → UI/prompt « N/A » (`fmtTeam` tolère null via `?? 'N/A'`).
- Additif, safe-fail null, insights déjà null-safe (`adv?…:_raw`). `node --check` + boot OK + test unitaire (moy/streak/null) corrects.
- Understat (xG/tirs/formation, 6 ligues) = enrichissement optionnel **différé** (réseau + parser fragile) — non livré.

---

## [v10.75] — 2026-05-19

### Feature — Prédictions : fallback BSD (orphelin API-Football couvert)

`/api/v1/af/predictions/:fixtureId` : AF primaire si clé, sinon **fallback BSD gratuit** (lookup `fixture_id`/`_bsd_event_id` → `fetchBSDPrediction` → `normalizeBsdPrediction`). Gate dur 503 (clé AF absente) retiré.

- `normalizeBsdPrediction(raw,match)` — mappe le brut BSD vers le shape AF (`percent_home/draw/away`, `winner_name`, `under_over`, `goals_home/away`, `advice`, `btts_yes`, `score_most_likely`, `confidence`). **STRICT** : pas de 1X2 dérivable → `null` (jamais inventé). Gère shape v2 documentée (`markets.match_result/over_under/btts/expected_goals/score`) + fallbacks plats + `raw.probabilities`. `_bsd_raw` conservé. Log `[BSD Pred] raw keys` 1× pour validation shape réelle sur VPS.
- `fetchBsdPredictionNormalized(fixtureId)` — résolveur fixture→event BSD.
- Additif, safe-fail `null`→404, aucun consumer frontend → blast radius nul, ne peut pas régresser. `node --check` + boot OK.
- ⚠ Shape exacte BSD à confirmer sur 1er appel réel (logs `[BSD Pred]`) ; normalizer déjà tolérant multi-shape.

---

## [v10.74] — 2026-05-19

### Feature — Bio joueur + blessure 100% via Transfermarkt (felipeall sidecar)

Champs orphelins API-Football « bio » et « blessure » couverts via le sidecar felipeall déjà déployé (v10.73) — zéro nouvelle API, zéro coût.

- `tmResolvePlayerId(name,{club,age})` — résolveur nom → id Transfermarkt via `/players/search/{name}`, désambiguïsation club→âge→1er résultat, cache 24h.
- `getTransfermarktBio(name,hints)` — id → `/profile` (full_name, birthdate, age, nationalité, taille, pied, position, photo) + `/injuries` (blessure en cours = `until_date` null/≥aujourd'hui + historique 5).
- Câblé en 4e source dans `/api/v1/player` (après API-Football/BSD/TheSportsDB), ne remplit QUE les champs manquants + pose `injured`/`current_injury`/`injury_history`. Sidecar down → try/catch gracieux, bio reste partielle, zéro crash.
- Couverture ~100 % des joueurs présents sur Transfermarkt (quasi-exhaustif foot pro). httpsGet natif → zero-dep cœur préservé.

Vérifié : `node --check` OK, boot OK, route joueur OK, no-op gracieux sidecar absent.

---

## [v10.73] — 2026-05-19

### Feature — Transferts : Option A felipeall/transfermarkt-api (sidecar self-host)

Champ orphelin « transferts » câblé via le microservice MIT felipeall/transfermarkt-api auto-hébergé en conteneur Docker. Scaffold Apify (actor payant $15/mo) **retiré** ; `fetchTransfermarkt` repointé sur le sidecar en HTTP clé-zéro (`httpsGet` natif → zero-dep npm du cœur préservé).

- `fetchTransfermarkt(kind,id)` → `GET {TRANSFERMARKT_API_URL}/players/{id}/{profile|market_value|transfers|injuries}`. Env `TRANSFERMARKT_API_URL` (défaut `http://127.0.0.1:8000`). Cache 24h conservé. Réponse JSON propre (schemas Pydantic) sous `data:`.
- Code mort supprimé : `_apifyRunSync`, `_tmBuildUrl`, `APIFY_TOKEN`, `APIFY_TM_ACTOR`. Route `/api/v1/transfermarkt/:kind` + gate footPro + cache inchangés. Mapping erreur → 503 si service injoignable/introuvable/5xx.
- `docker-compose.transfermarkt.yml` ajouté (build depuis clone felipeall, bind 127.0.0.1:8000, rate-limit ON, healthcheck). `transfermarkt-api/` git-ignoré.
- ⚠ **Rumeurs NON couvertes** (felipeall = transferts confirmés + valeurs + blessures uniquement) → follow-up bd (route custom /geruechte ou RapidAPI apidojo).

Vérifié : `node --check` OK, boot OK, suppression Apify sans ref morte, route gate 403 anon (normal).

---

## [v10.72] — 2026-05-19

### Feature — Cotes sur Bets Prédictifs (couche 1 + 3, solution économique)

Chaque pari conseillé affiche désormais une cote. Stratégie validée DG pour 25 membres : **pas de scraping** (OddsPortal/Flashscore = mur Cloudflare, dette maintenance, contre consigne « Odds API only »). Couche 1 + 3 :

- **Couche 1 — cote marché réelle** : Odds API h2h déjà intégrée → `@1.72` sur Vainqueur match, EV calculé contre cette cote.
- **Couche 3 — cote équitable modèle** : `≈ 1/proba` (no-vig) sur tous les marchés non cotés (Set 1, score sets, ≥1 set, jeux O/U, aces, tie-break, live). Couverture **100 %**, 0 €, 0 quota, 0 réseau, 0 maintenance.
- Couche 2 (Polymarket) écartée : couverture tennis mince + doublonne Couche 1.

`computeTennisPredictiveBets` : champs `odds_fair` (=round(100/p,2)) + `odds_type` ('market'|'fair') par candidat. Frontend `_tnChip` : `<span class="oc">@x</span>` si cote marché sinon `<span class="fc">≈x</span>` (gris italique). `tnLiveBets` propage `odds_fair` (proba live). Guide enrichi (bloc « Cotes affichées » @ vs ≈). Vérifié node --check + test unitaire prematch/live (odds_fair/odds_type/EV corrects).

---

## [v10.71] — 2026-05-19

### Feature — Colonne « Bets Prédictifs / 2e ligne conseillés » (onglet Tennis)

KPI directif + 3 paris conseillés prematch, bascule auto en 3 paris LIVE selon le score quand le match passe en cours.

**Moteur (server.js)** : `computeTennisPredictiveBets(e)` — 100 % dérivé des signaux déjà calculés par `buildTennisValueBets` (aucune nouvelle source réseau). Pool de 6 marchés candidats (Vainqueur match, Set 1, Score sets exact, Gagne ≥1 set Markov, Total jeux O/U, King of Aces) scorés par :
- `PredScore = 0.45·norm(EV%) + 0.35·Confiance + 0.20·Accord(Elo,BSD)` (cote dispo)
- `PredScore = 0.55·proba + 0.45·Confiance` (sans cote)
- Confiance = calibration `confidence_badge.accuracy`, pénalité ×0.8 si `ml_market_div=HIGH`, ×0.6/×0.8 si échantillon faible.

Top 3 trié desc. Verdict KPI : **BET FORT** (règle stricte CLAUDE.md : EV>5 % ET IC bas>0 ET badge vert) · **VALUE** (top1 EV>0 ou proba≥65) · **PASS**. Champ `predictive` ajouté à l'objet enrichi VB + `toCanonicalTennisMatch` (/board).

**Frontend (pariscore.html)** : nouvelle colonne insérée **après Match** (onglet Value Bets, 15→16 col) + colonne dédiée onglet Live (8→9 col). `_tvbPredictiveCell` (KPI badge + 3 chips), `tnLiveBets` (signaux modèle re-conditionnés au score `_live` : winner re-pricé ±15/set, set en cours selon serveur, comeback ≥1 set ou total jeux), `tnLiveBetsFromScore` (onglet Live, heuristique score pur ESPN/LiveScore). `patchTennisLive` rafraîchit aussi `data-tn-pred` toutes les 30 s.

Vérifié : `node --check server.js` OK · build 200 matchs zéro erreur/exception · test unitaire fonctions pures (prematch top3 + verdict, live re-pricing, onglet Live heuristique) tous corrects.

---

## [v10.65] — 2026-05-18

### Correctif visuel — Dropdown stratégies illisible (texte clair sur panneau blanc)

Feedback DG : liste déroulante « Toutes stratégies » — noms invisibles (gris pâle sur blanc) et item sélectionné « BTTS Oui » blanc sur rouge pâle.

**Cause** : le bloc `<style id="desktop-filters-flat">` (@media ≥768px) restaure le panneau `.mls-panel` en blanc et restyle `.mls-opt`, mais **pas** `.mls-row`/`.mls-rowmain`/`.mls-name`/`.mls-cnt`/`.sel` — les rangées stratégies (rendues en `.mls-row`, build L13028) conservaient les couleurs de base conçues pour panneau sombre → invisibles.

**Fix (pariscore.html)** : ajout dans le même bloc des règles claires `.mls-row` alignées sur `.mls-opt` — nom `#020617`, compteur `#64748b`, hover `#eef2f7`, sélection `#f1fdf5`/`#166534`. Desktop ≥768 + scope `#page-matchs` ; mobile intact.

**Vérifié** (preview 1440px, thème CLAIR, computed-styles) : nom non-sél `#020617`, compteur `#64748b`, ligne sél bg `#f1fdf5`, nom sél `#166534`. Zéro erreur JS.

---

## [v10.64] — 2026-05-18

### Correctif — Nav top laissée claire (logo PARISCORE illisible sur fond sombre)

Feedback DG : nav dark v10.63 rendait le logo « PARISCORE » (texte noir) invisible. Retrait des 4 règles `nav:not([aria-label])` de l'Axe C → nav conserve sa charte claire. Filtres + bandeau + league banner + tableau restent dark (nappe sombre intacte sous la nav claire). Vérifié preview 1440px : `nav` bg transparent (défaut clair), `#filter-console`/`table-header` toujours `#0f172a`.

---

## [v10.63] — 2026-05-18

### Uniformisation desktop globale — Axe C « Élite Dark Trading » (filtres + bandeau + nav)

Audit DG validé : fragmentation résiduelle = tout AU-DESSUS du tableau (nav + console filtres hybride bâtard + bandeau résultats) restait « Light Corporate » → choc lumineux vertical, hiérarchie inversée (chrome crie plus fort que la data). Axe C retenu (3 voix expertes concordantes) : nappe sombre continue.

**CSS `@media (min-width:769px)` (pariscore.html)** — anchor 2 ids `#page-matchs #filter-console` (bat `body:not(.dark-theme) #page-matchs .x`) :
- Console filtres → panneau `#0f172a`, bordure laser, `fc-head` accent rouge, labels `#8b949e`, chips/pills/selects/reset graphite `#262b33`, actif gradient rouge L'Équipe, slider conf lisible.
- League hub banner → `#1b2027`.
- Bandeau résultats (`.table-header`) → `#0f172a` + sous-ligne rouge (continuité thead), titre `#f1f5f9`, count `#8b949e`, `.match-tab` graphite, actif rouge, live-tab rouge translucide.
- Nav top → `#0f172a` (sandwich fermé), liens `#cbd5e1`, actif/hover rouge `#E2001A` ; logo + ADN marque conservés.
- Étanchéité mobile : tout sous `@media ≥769px` ; cartes `.mc` (<769) inchangées. Zéro JS.

**Vérifié** (preview 1440px, thèmes CLAIR *et* DARK, computed-styles) : `#filter-console`/`table-header`/`nav` = `#0f172a` (override clair battu), chip non-actif graphite `#262b33` texte `#cfd4db`, actif gradient rouge, label `#8b949e`, titre `#f1f5f9`, league banner `#1b2027`. Zéro erreur JS.

---

## [v10.62] — 2026-05-18

### Harmonisation grille desktop — Option B « Ligne 100% Dark Premium » (feedback DG : rupture d'uniformité)

Diagnostic DG : colonnes gauche (Match/Rang/Forme/Score) en tableur blanc vs widget CONSEILS IA = bloc noir flottant asymétrique → choc lumineux, scannabilité dégradée. v10.61 n'avait pas pris : `body:not(.dark-theme) #vb-body tr td{background:#fff!important}` (1 id + 1 classe) battait `#vb-table tbody td` (1 id) ; l'override 2-ids ne couvrait que `color`.

**CSS `@media (min-width:769px)` (pariscore.html)** :
- Surface ligne unifiée via `#vb-table #vb-body td` (2 ids) → bat le `#fff !important` du thème clair : gradient `#15191d→#0f1216`, texte `#cbd5e1`, `vertical-align:middle`, séparateurs laser `rgba(255,255,255,.05)`.
- **CONSEILS IA encastré** : `.t3c-wrap` chrome retiré dans le tableau (`background:transparent`, `border:0`, `box-shadow:none`, `::before` masqué, `min-width:0`) → plus de carte noire flottante, fond = la ligne.
- Carte blanche « BETS LIVE » (`.pbet-wrap`) → gradient dark + rows lisibles.
- Pastilles forme `formBalls` class-ifiées (`.fb`/`.fb-W/D/L/N`) : base neutre globale (mobile/modals inchangés) + override desktop = relief néon (gradient + bord coloré + glow), cohérent badges IA.
- `.ts-pill` (scores Poisson) dark, `.cotes-block`/`.buteurs-block` fiche unifiée, boutons `.ins/.ai-gen/.fav` graphite relief, `.rk-badge-s` translucide.
- Barres latérales value-hot/value/live (inset 3px) en 2-ids.
- **Sans hack** : aucun positionnement absolu ; grille native du tableau respectée.
- **Étanchéité mobile** : tout sous `@media ≥769px` + scope `#vb-table`/`#vb-body` ; cartes `.mc` (<769) totalement préservées.

**JS (pariscore.html)** : `formBalls` réécrit (style inline → classes). Zéro changement structurel.

**Vérifié** (preview 1440px, thème CLAIR = cas critique, computed-styles) : td gradient dark (bat `#fff`), `vertical-align:middle`, `.t3c-wrap` bg transparent + bord 0 + ombre none (encastré), `.fb-W` gradient+bord néon, `.pbet-wrap` dark, `.ts-pill` dark, barre value-hot inset vert. Zéro erreur JS.

---

## [v10.61] — 2026-05-18

### Propagation visuelle — Scénario Neon Quant à TOUTES les colonnes (tableau Foot desktop)

Feedback DG : « appliques ce scénario dans toutes les colonnes du hub foot pour le bureau ». Le look CONSEILS IA v3 étendu à l'ensemble du tableau `#vb-table`.

**CSS desktop `@media (min-width:769px)` scope `#vb-table` (pariscore.html)** :
- Table : fond `#0d0f13`, radius 13px, ombre profonde, `border-spacing:0`.
- thead : gradient sombre, mono uppercase `#9aa3af`, sous-ligne accent rouge L'Équipe ; `.th-hero` rose.
- tbody td : gradient `#15191d→#0f1216`, texte `#cbd5e1`, séparateurs translucides ; hover plus clair.
- Barres latérales 1ʳᵉ cellule : value-hot vert / value ambre / live rouge (inset 3px).
- Mini-panneaux `.cotes-block`/`.buteurs-block` = même fiche que CONSEILS IA (gradient, bordure, radius 10, relief).
- Boutons `.ins-btn`/`.ai-gen-btn`/`.fav-btn` graphite relief, hover bord rouge.
- `rk-badge-s` translucide ; `.vb-hero-value` drop-shadow.
- **Spécificité** : overrides `#vb-table #vb-body td` (2 ids) pour battre les règles claires héritées `body:not(.dark-theme) #vb-body td` (1 id) → neon en thème clair ET sombre.
- Neutralisation des inline clair forcés (`#1A1A1A`/`#888`) via sélecteurs `[style*=...]`.

**JS (pariscore.html)** : 1 seul `<td>` Date/H — retrait des inline `background:#ffffff/color:#1a1a1a/#888888 !important` (inline !important non overridable par CSS) + classe `.t3c-datesub`. Zéro changement structurel.

**Vérifié** (preview 1440px, thème clair = cas critique, computed-styles) : table bg `#0d0f13`, thead gradient `#9aa3af`, td texte `#cbd5e1` (force-clair battue), buteurs-block tile gradient, barre value-hot inset vert. Zéro erreur JS.

---

## [v10.60] — 2026-05-18

### Refonte visuelle — CONSEILS IA v3 « Neon Quant Terminal » (feedback DG : + flashy/sexy/accrocheur)

v2 jugée trop pâle/plate. Passage à un rendu terminal trading néon, **unifié dark + light** (carte = widget sombre embarqué dans les 2 thèmes).

**CSS `.t3c-*` v3 (pariscore.html)** :
- Wrap : gradient sombre `#1b2027→#0d0f13`, radius 13px, ombre profonde + sheen radial rouge L'Équipe en tête.
- Header : barre d'accent rouge dégradée sous le titre.
- Anneau confiance : 44px, halo `drop-shadow` coloré par `--c`, chiffre 14px 900 avec text-shadow glow, disque interne radial.
- Badges paliers : gradients sombres + **glow néon** par tier (vert/ambre/rouge), bordure saturée, font 11px 900.
- Smart-highlight 1X2 : pick `scale(1.1)` + gradient vert + **animation `t3cPickPulse`** (halo respirant 2.2s).
- Bannière +EV : **`t3cShine`** (dégradé diagonal animé 3.4s, bg-size 220%), uppercase 11px 900.
- Perdants : opacity .32 + grayscale .65 + scale .94.
- Lignes : hover rouge L'Équipe ; footer chips tintés glow.
- `prefers-reduced-motion` : animations coupées (pulse + shine + transitions).
- Overrides clair : neutralisés (plus de blanchiment) + paliers/pick mirrorent le neon en `!important`.

**Vérifié** (preview, computed-styles) : wrap gradient sombre, anneau 44px + filter glow, num 14px, pick `t3cPickPulse`+scale 1.1+gradient vert, tier-hi gradient+glow vert, +EV `t3cShine` bg-size 220%. Zéro erreur JS.

---

## [v10.59] — 2026-05-18

### Refonte — Colonne « CONSEILS IA » : Fiche Quant scannable (skills frontend-design + ui-ux-pro-max)

**Problème UX** : 1X2 monochrome (3 issues rouges même si une domine), +EV enterré en bas, indicateurs risque (conf/σ/shield) flottants sans cadre, paliers couleur incohérents.

**Frontend (pariscore.html)** — `calcTop3Conseils` réécrite + CSS `.t3c-*` v2 :
- **Header fiche de confiance** : anneau conique `conf/100` (couleur tier, `--v`/`--c`), `σ` pilule, bouclier — en HAUT (gate cognitif avant pronostics).
- **Smart-highlight 1X2** : issue max `.t3c-pick` (scale 1.06 + halo vert néon) ; perdants `.t3c-dim` (opacity .42 + grayscale).
- **Bannière +EV élevée** : `.t3c-ev` pleine largeur sous header (gradient vert, `Parier {mkt} … {pct}%`).
- **Paliers unifiés** `tier(v)` : ≥80 vert · 60–79 ambre · <60 rouge.
- **Footer fin** : steam + accuracy backtest.
- Charte dark graphite / light L'Équipe (`body.dark-theme`/`.mc`/`body:not(.dark-theme)`), `tabular-nums`, `prefers-reduced-motion`, zéro dépendance.
- Code mort retiré (`barBadge`/`barBadgeSm`, classes `t3c-safe/value/risky`, `t3c-pro-sep/-row`, `.t3c-cnr`).

**Vérifié** (preview, computed-styles) : header présent, anneau `--v` lié à conf, pick `scale(1.06)`, dim `opacity .42`, 6 lignes grille, bannière +EV gradient, footer steam `rgb(226,0,26)`, wrap radius 10px. Zéro erreur JS.

### Corrigé — Sport-hub fuyait sur desktop (gate mobile-only)

**Cause** : masquage desktop dépendait du CSS `@media(min-width:768px)` + JS `DOMContentLoaded` (`innerWidth<768`) — cassé si boot-snapshot HTML périmé, exception JS init antérieure, ou `innerWidth` faussé (iframe/zoom).

**Fix (pariscore.html, 3 filets)** :
1. Garde inline **synchrone** au parsing après `#sport-hub` : `matchMedia('(min-width:768px)')` → `removeChild`. Immunisé snapshot/crash/zoom.
2. Init L~20946 : `innerWidth<768` → `matchMedia` (même base que le CSS `@media`).
3. CSS `@media` conservé (3e filet).

**Vérifié** (preview 1440px) : `mqDesktop=true`, hub `display:none` + nœud retirable. Mobile (<768) : hub intact.

---

## [v10.20] — 2026-05-17

### Corrigé — Filtre championnats : ligue précise affichait tout le pays (Serie B → Serie A+B)

**Cause racine**
- Le filtre construit `_selKeys` en **union** : `blanket pays (toutes ligues) ∪ activeLeagues ∪ legacy` (pariscore.html ~14230).
- Cocher une ligue précise (Serie B) via `mlToggleLeague` ajoutait `soccer_italy_serie_b` à `activeLeagues` **sans** retirer le pays parent de `activeCountries`. Si Italie était cochée (blanket), l'union ré-incluait Serie A + Coppa Italia.
- Symétrie absente : `mlToggleCountry` ne purgeait pas non plus les ligues spécifiques du pays.

**Frontend (pariscore.html)**
- Helper `_countryOfLeague(odds_key)` → pays propriétaire via `leaguesByCountry`.
- `mlToggleLeague` : sélectionner une ligue précise **décoche** le pays parent dans `activeCountries` (l'utilisateur veut CETTE ligue, pas tout le championnat).
- `mlToggleCountry` : cocher un pays (blanket) **retire** les ligues spécifiques de ce pays d'`activeLeagues` (évite doublon logique).
- **Garde anti-bug au niveau filtre** (défense multi-entrées : chips, dropdowns) : pour chaque pays de `activeCountries`, si une de ses ligues est présente dans `activeLeagues`, le blanket pays **n'est pas** ajouté à `_selKeys`. La sélection précise écrase toujours le blanket, par pays — généralisé à TOUS les championnats.

**Vérifié** (preview, scénarios) : A) pays Italie puis Serie B → `selKeys=[serie_b]`. B) Serie B avec pays pré-coché → `[serie_b]`. C) garde seule (activeCountries résiduel) → `[serie_b]`. D) pays seul, aucune ligue → blanket complet intact `[serie_a, serie_b, coppa]`. 0 erreur console.

---

## [v10.58] — 2026-05-17

### Corrigé — Module LIVE mort en prod : 3 causes racines (pagination BSD + cross-provider + null-status)

Diagnostic via logs `[LiveDBG]` ajoutés à `pollLiveScores`/`pollLiveScoresSmart`.

1. **Pagination BSD tronquée (cause principale)** : `fetchBSDMatches` demandait `page_size=100` mais BSD plafonne à **50/page** ; l'arrêt `results.length < PAGE_SIZE` (50<100) était toujours vrai → **stop après page 1** → seuls les 50 premiers events du jour (matchs finis du matin) lus, **matchs LIVE/à venir (pages 2+) jamais récupérés**. Fix : `PAGE_SIZE=50`, pagination tant que `res.data.next` (MAX_PAGES 40).
2. **Mismatch d'ID inter-fournisseurs** : `pollLiveScores` joignait les events BSD (`id=bsd_*`) aux matchs affichés par id strict, or ceux-ci sont sourcés Odds/football-data (`id=fd_*`) → `matchedEnBase=0` → live jamais appliqué. Fix : matching multi-clé `id` → `_bsd_event_id` → équipes normalisées (home@away).
3. **Crash null-status** : `e.status.includes('half')` throw si `e.status` null → catch global → `fetchBSDMatches` renvoie `[]`. Fix : `String(e.status||'')` + détection live élargie (inprogress/half/ht/playing/live/extra/penalt + minute en cours).
4. **SSE `live_patch` ne re-rendait pas** (v10.57) : re-render ciblé sur transition prematch→live.

`[LiveDBG]` : log diagnostic (bsdEvents/avecLiveScore/matchedEnBase/statuts + idle-skip avec contexte) — à retirer une fois la prod validée.

**Vérifié** : `node --check` OK ; logique live_score table OK (null/finished/timed→null, inprogress/half/minute→score) ; fix présent sur VPS (grep lignes 7826/7837). Validation finale = pendant matchs en direct (logs `bsdEvents>50` + `avecLiveScore>0` + `matchés>0`).

---

## [v10.57] — 2026-05-17

### Corrigé — Bug LIVE persistant : SSE live_patch ne re-rendait pas le tableau

**Audit** : `patchLiveMatches` = code mort (jamais appelé). Vrai chemin = handler SSE **`live_patch`** : appliquait les champs `m.live_*`/`status` sur `allMatches` mais **n'appelait jamais `renderMatches`** → un match passant LIVE pendant la session restait rendu prematch (ni bouton LIVE, ni « Bets Live », ni classe `match-row-live`). Le fix v10.55 (renderMatches/isMatchInProgress) était correct mais **contourné** par ce chemin.

**Fix (pariscore.html)** — handler `live_patch` : après application des patches, `renderMatches(allMatches)` déclenché **uniquement** si un match patché est `isMatchInProgress` ET que sa ligne DOM n'a pas encore `.live-btn` (transition prematch→live). Coût nul hors transition (pas de re-render à chaque tick).

**Vérifié (serveur redémarré, simulation patch)** : ligne prematch (`live=false, btn=false, Bets Prédictifs`) → patch `status:'1H'` → re-render → `live=true, btn=true, Bets Live`. **Zéro erreur console**.

> ⚠️ Bug côté `pariscore.html` : v10.55 + v10.57 ne sont effectifs sur le VPS qu'après **upload `pariscore.html`** (jusqu'ici seuls server.js/bsd_config poussés pour v10.56).

---

## [v10.56] — 2026-05-17

### Ajouté — Routing standings ligues non-BSD : ESPN (+9) + API-Football fallback (7 sans ESPN)

Recherche sources gratuites : TheSportsDB free (clé '3') gaté `{"countries":null}` ; openfootball partiel/sans live ; scraping Sofascore/FBref écarté (risque blocage IP VPS OVH). Décision : ESPN hidden API pour ligues couvertes, API-Football (déjà PRO 7500/j, routing pur) pour les 7 sans ESPN.

**Backend**
- `ESPN_STANDINGS_SLUG` (server.js) +9 slugs confirmés (test live entries>0) → Phase 1bis, zéro clé/quota : `128 arg.1, 239 col.1, 265 chi.1, 240 ecu.1, 480 par.1, 262 aut.1, 119 den.1, 900 aus.1, 103 nor.1`.
- `bsd_config.json` `mapping.fallback_needed = [200,333,210,269,383,99,345]` → Phase 2 API-Football : Botola Maroc (200), Ukrainian Premier (333), Prva HNL Croatie (210), SuperLiga Serbie (269), Ligue Pro Algérie (383), J2 League Japon (99), Czech First League (345). ESPN ne couvre pas ces 7 (slugs mar.1/ukr.1/cro.1/srb.1/alg.1/jpn.2/cze.1 → ERR/0 au test).

**Vérifié** : `node --check server.js` OK, JSON valide, mapping noms/pays exacts. Coupes (Coppa Italia 137…) hors standings = normal (élimination directe).

**Correctif post-logs prod** : `[BSD] Ligue 200 → OK (16 équipes)` → Botola **fonctionne via BSD** (/standings/ sans season réussit malgré « Aucune saison BSD 53 »). `200` **retiré** de `fallback_needed` (évite quota API-Football inutile). `fallback_needed` final = `[333, 210, 269, 383, 99, 345]` (Ukraine, Croatie, Serbie, Algérie, J2, Tchéquie). `[ESPN] Ligue 99 jpn.2 → vide/échec` confirme J2 sans ESPN → API-Football (présent). ESPN 103 (nor.1) inoffensif : Phase 1bis exclut les BSD-mappés (103→BSD 54 OK).

---

## [v10.55] — 2026-05-17

### Corrigé — Matchs live sans bouton LIVE (source de vérité incohérente)

**Bug** : badge « Live N » = `isMatchInProgress` (status live **OU** `live_score` **OU** `live_minute`), mais `renderMatches`, `renderPredBets`, `topPredictiveBets` et le bouton LIVE étaient gatés sur `m.live_score` **seul** → les matchs en cours **sans score** (feed score absent / 0-0) étaient rendus en prematch (ni bouton LIVE, ni Bets Live), d'où « 5 live mais aucun bouton ».

**Fix (pariscore.html)** — source unique = `isMatchInProgress(m)` :
- `renderMatches` : `_live = isMatchInProgress(m)` calculé une fois → classe `match-row-live`, conteneur badge live + intensité, bouton `live-btn` (au lieu de `m.live_score ?`). Badge score fallback `live_score || minute′ || 'LIVE'`.
- `renderPredBets` : `live = isMatchInProgress(m)`.
- `topPredictiveBets` : `live = !opts.prematch && isMatchInProgress(m)` (branche live robuste sans `live_score`, split → 0-0 par défaut).

**Vérifié (serveur redémarré, mock)** : prematch → pas de LIVE, « Bets Prédictifs » ; **`status:'1H'` sans `live_score`** → `match-row-live` + bouton LIVE + badge + « Bets Live » ; live avec score → OK. **Zéro erreur console**.

---

## [v10.54] — 2026-05-17

### Corrigé — Horaire matchs : fuseau France (bug parsing UTC naïf)

**Bug** : `parseKickoff` faisait `new Date(raw)` sur des chaînes ISO **sans fuseau** (l'API renvoie de l'UTC sans `Z`). JS interprète alors la chaîne en **heure locale du navigateur** → l'horaire (col 1 Date/H + cartes mobile) était décalé même avec `toLocaleString('fr-FR',{timeZone:'Europe/Paris'})`.

**Fix (pariscore.html)**
- `parseKickoff` : si la chaîne matche `^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}` et n'a **ni `Z` ni offset `±hh:mm`** → normalisée UTC (`replace(' ','T') + 'Z'`) avant `new Date`. Z/offset/unix inchangés.
- `fmtTime` (cartes mobile `.mc`) : utilise désormais `parseKickoff` au lieu de `new Date(m.commence_time)` brut (même bug).

**Vérifié (serveur redémarré)** : 15:00 UTC → **17:00** (CEST Europe/Paris) pour TOUS les formats testés — `…Z`, ISO naïf `T`, naïf espace, offset `+02:00`, unix secondes. **Zéro erreur console**.

---

## [v10.53] — 2026-05-17

### Ajouté — Bets Live : prochain buteur probable (intensité par équipe)

`topPredictiveBets` (live) : `nextScorer` = `domSide` (|pH−pA|≥4) sinon signe de `dom` (>1 / <−1) sinon meneur. Candidat **« Prochain but Dom »** / **« Prochain but Ext »** poussé si `iv≥55` ou domination ou fin de match, score = 50 + min(34,|dom|×1.3) + iv×0.18 (+6 si domSide). Remplace l'ancien « Prochain but » générique (sans côté).

**Vérifié (serveur redémarré, mock)** : Santos pousse à domicile (DA 42/14, xG 1.8/0.5) → top bet **« Prochain but Dom »** ; Coritiba pousse à l'extérieur 0-0 (DA 12/38) → **« Prochain but Ext »** + `2`. **Zéro erreur console**.

---

## [v10.52] — 2026-05-17

### Modifié — Bets Prédictifs Live : ghost prematch + 1-2 bets selon déroulement & intensité par équipe

Match live → bloc prematch **remplacé** par « 🔴 Bets Live » (pastille rouge pulsée `.pb-livedot`, `prefers-reduced-motion` géré), bouton LIVE conservé.

**`topPredictiveBets` (branche live)** : ajout **pression par équipe** — `pH/pA` = dangerous_attacks×0.5 + shots×1.5 + corners×1 + xG×8 (côté home/away) ; `dom = pH−pA`, `domSide` si |dom|≥4. L'équipe dominante : issue (1/2) renforcée + « Prochain but » boosté ; équipe **menée mais dominante** → `+2.5`. Flag `m._liveDecided` = écart ≥2 OU (minute ≥80 & meneur & pas dominé).

**`renderPredBets`** : live → si `_liveDecided` **1 bet**, sinon **2** ; prematch inchangé (3 bets, jamais affichés en live = ghost).

**Vérifié (serveur redémarré, mock)** : prematch → 3 bets « Bets Prédictifs », no LIVE ; live 2-0 78′ (Éq1 domine) → « Bets Live » **1 bet `1`** + livedot + bouton LIVE ; live 1-1 63′ pression haute → **2 bets** + LIVE. **Zéro erreur console**.

---

## [v10.51] — 2026-05-17

### Ajouté — Routage Serie B Italie via ESPN hidden API (ita.2)

**Contexte** : Serie B IT (config 136) non couverte BSD → standings vides. Rapport `.doc` validé → solution ESPN `ita.2` (gratuit, zéro clé/quota, infra ESPN déjà présente).

**Backend (server.js)**
- `ESPN_STANDINGS_SLUG[136] = 'ita.2'` (Serie B Italie).
- **Phase 1bis** dans `fetchStats` (entre Phase 1 BSD et Phase 2 API-Football) : itère `ESPN_STANDINGS_SLUG` filtré sur les ligues **non** présentes dans `BSD_CONFIG_TO_BSD` (= ESPN-only : 136 Serie B, 99 J2 ; 98/292 exclues car déjà gérées BSD). Gate fraîcheur T1/T2 + bypass si lignes `api-football` périmées, puis `tryESPNStandings(configId)` (purge totale lignes ligue + injection + `statsUpdateByLeague`).
- Réutilise `fetchESPNStandings` (parser `children[].standings.entries`, classement points/diff) — déjà compatible.

**Vérifié** : `node --check server.js` OK ; endpoint `site.api.espn.com/apis/v2/sports/soccer/ita.2/standings` → 1 groupe, **20 clubs** (Venezia…), stats `points/wins/ties/losses/pointsFor/pointsAgainst/ppg/rank` exploitables par le parser. Filtre Phase 1bis correct (136+99 inclus, 98/292 exclus).

---

## [v10.50] — 2026-05-17

### Modifié — Logo diffuseur TV déplacé colonne 1 (sous Date/H, centré)

Slot `[data-tv-badge]` retiré de la cellule Match (col 2, ex `position:absolute;bottom/right`) → placé dans la cellule **Date/H (col 1)**, sous heure+date, centré (`margin:5px auto 0`, `justify-content:center`, `flex-wrap`, td `text-align:center`). `enrichTVChannels` inchangé (cible `[data-tv-badge]`).

**Vérifié (serveur redémarré)** : slot dans `td` index 0, absent col 2, parent `text-align:center`, `justify-content:center`, `margin:auto` ; **zéro erreur console**.

---

## [v10.49] — 2026-05-17

### Modifié — Bets Prédictifs : libellés explicites + affichage confiance seule

- **Libellés** : `fmtBet()` dans `renderPredBets` — O/U `+1.5`/`+2.5`/`-2.5`/`-3.5` → `… Buts` ; double chance `1X`/`X2` → `DC: 1X`/`DC: X2` (gère suffixe live ` ✓`). Logique interne `topPredictiveBets` inchangée (formatage à l'affichage → `edgeFor` non impacté).
- **Affichage** : span `.pb-pr` (proba % brute) **retiré** des lignes — seule la **confiance composite** `●conf` est affichée (proba × calibration × (1+edge dévigé)). Seuils couleur inchangés : vert ≥70 · ambre ≥55 · rouge <55.

**Vérifié (serveur redémarré)** : lignes = `+1.5 Buts / -3.5 Buts / DC: X2` (mock), `hasProb:false` (proba retirée), `●conf` présent ; **zéro erreur console**.

---

## [v10.48] — 2026-05-17

### Refondu — Bloc Bets Prédictifs : titre centré + design 3D premium

- **Titre** `.pbet-head` centré au-dessus du bloc : « Bets Prédictifs » (prematch) / « Bets Live » (live), Barlow Condensed 800 uppercase + soulignement dégradé rouge centré.
- **3D premium** : `.pbet-wrap` carte en relief (gradient + `inset highlight` + ombre portée) ; `.pbet-row` lignes relief + hover `translateY(-1px)` ; pastille rang `.pb-rk` = jeton 3D embossé (radial-gradient + inset light/dark) — gris / **rouge pour #1** ; ligne #1 (`.pb-top`) gradient rouge clair + liseré + glow. `prefers-reduced-motion` géré.
- Variantes `body.dark-theme` / `.mc` (cartes mobile) : relief sombre cohérent.

**Vérifié (serveur redémarré)** : `.pbet-head` = « Bets Prédictifs », `text-align:center` ; 3 `.pbet-row` ; `.pbet-wrap` radius 12px + ombre ; `.pb-top` présent ; **zéro erreur console**.

> Rappel sémantique valeurs : `① LABEL prob% ●conf` — rang composite, marché, probabilité modèle, confiance composite (proba×calibration×(1+edge)) ; couleur conf vert≥70/ambre≥55/rouge<55.

---

## [v10.47] — 2026-05-17

### Refondu — Cellule « Match » : badge verdict → Bets Prédictifs Top 1-3 (prematch) / 1-2 (live)

Brainstorm Design × Data Science × Parieur Pro → plan validé DG (5 décisions).

**Frontend (pariscore.html)**
- **En-tête** : `Match` recentré (`text-align:left` retiré du `<th>` → hérite `center`).
- **Supprimé** : badge vert verdict `🎯 {best.label} @{cote} · ⬤{conf} · +{edge}%` (jugé sans valeur, redondant VALUE/Conseils IA/Cote ▼).
- **`topPredictiveBets(m,n,opts)`** : score composite **proba × calibration (`calcConfidenceScore`/100) × (1 + edge dévigé/100)**, source `calibrated||blended||poisson`, filtre proba ≥ 50 %, dédup, tri desc. Prematch n=3 (1/N/2/1X/X2/+1.5/+2.5/-2.5/-3.5/BTTS/BTTS Non). **Live** n=2 : repondération auto sur score (leader → 1·1X / 2·X2 / N), minute (temps restant), intensité, buts marqués (+2.5/-2.5/BTTS/BTTS Non/Prochain but).
- **`renderPredBets(m)`** : bloc `.pbet-wrap` sous le bloc Équipe1/Équipe2 ; lignes `① LABEL prob% ●conf`, couleur confiance (vert≥70 / ambre≥55 / rouge), #1 emphase (pastille + liseré rouge). Variante `.pbet-live` (liseré rouge, tooltip « recalculé live »).
- **Desktop + mobile** : injecté dans `renderMatches` (cellule Match) **et** `buildCard` (cartes `.mc`) → cohérence 2 environnements.
- Colonne `Conseils IA` **conservée** (différenciée : détail marchés vs paris à jouer).
- CSS `.pbet-*` (clair table + variante dark/`.mc`), `tabular-nums`.

**Vérifié (serveur redémarré)** : badge `🎯` absent ; `#vb-body` 2 `.pbet-wrap` ; prematch = 3 `.pbet-row`, live = 2 ; ex. prematch `[+1.5 88%, 1X 85%, -3.5 70%]`, live 1-0 70′ int64 → `[1, 1X]` ; **zéro erreur console**. (Confiance affichée scalée par `calcConfidenceScore` réel — mock = valeurs basses, ranking correct.)

---

## [v10.46] — 2026-05-17

### Modifié — En-tête colonne 1 « Heure » → « Date/H »

`#vb-table thead` : libellé `Heure` renommé **« Date/H »** (la cellule affiche heure + date). Aucun impact JS.

**Vérifié (serveur redémarré)** : labels = `[Date/H,Match,Rang,Forme,Score prédictif prematch,Cote ▼,Conseils IA,Buteurs,Actions,VALUE]` ; **zéro erreur console**.

---

## [v10.45] — 2026-05-17

### Modifié — En-tête colonne « xG·H2H » → « Score prédictif prematch »

`#vb-table thead` : libellé `xG·H2H` renommé **« Score prédictif prematch »** (title : « Score prédictif pré-match (xG · H2H · forme) »). Aucun impact JS (colonne d'affichage).

**Vérifié (serveur redémarré)** : labels = `[Heure,Match,Rang,Forme,Score prédictif prematch,Cote ▼,Conseils IA,Buteurs,Actions,VALUE]` ; **zéro erreur console**.

---

## [v10.44] — 2026-05-17

### Refondu — En-tête tableau matchs « Hybride Hero-Chip » (Concept C, design-critique)

Critique design (contraste #888/#efefef ≈2.6:1 échec WCAG, mono 9.5px fin, libellés cryptiques, zéro hiérarchie, incohérent charte) → refonte validée DG (Concept C, renommage OK, barre verte supprimée, football seul).

**Frontend (pariscore.html) — `#vb-table thead` (desktop ; mobile = cartes, non impacté)**
- **Typo** : `Barlow Condensed 800`, 12 px, `letter-spacing .04em`, uppercase. Couleurs sémantiques : structurel (`Heure`,`Match`) `#1A1A1A` ; secondaire `#5A5A5A` (≥4.5:1) ; hero blanc. Bordure bas 2 px `--accent`, fond `#F4F4F4`.
- **Hero-chip** : `.th-hero` (Cote ▼, VALUE) → puce rouge dégradée (`::before` z-index:-1 sous le texte via `isolation:isolate`), texte blanc + ombre.
- **Affordance tri** : `.sortable::after` soulignement rouge `scaleX` au hover/`.sort-asc/-desc` (+ `prefers-reduced-motion`).
- **Renommage libellés** : `Equipes→Match`, `Class.→Rang`, `Infos→xG·H2H` (tooltip), `Δ Cotes→Cote ▼`, `Top Conseils IA→Conseils IA`, `Top 3 Butteurs→Buteurs` (+ accent corrigé). `Heure/Forme/Actions/VALUE` inchangés.
- **Barre verte supprimée** : `#scrollbar-top { display:none !important }` ; thumb `#table-scroll` `#00ff88`→`rgba(0,0,0,.22)` (neutre, cohérent charte rouge).

**Vérifié (serveur preview redémarré — cf. note)** : labels = `[Heure,Match,Rang,Forme,xG·H2H,Cote ▼,Conseils IA,Buteurs,Actions,VALUE]` ; font Barlow Condensed 800 12px ; `Heure` `#1A1A1A` ; bordure `rgb(237,28,36)` ; hero blanc + chip dégradé `::before` ; `#scrollbar-top` `display:none` ; **zéro erreur console**.

> **Note infra** : le serveur `node server.js` sert un **snapshot HTML du boot** (pas le disque live) → toute vérif preview après édition HTML nécessite un **restart du serveur** (`preview_stop`+`preview_start`). Explique les « DOM stale » des vérifs précédentes (edits disque valides, preview en retard).

---

## [v10.43] — 2026-05-17

### Corrigé — Filtres fonctionnels + cohérents sur mobile (Android/iOS) comme desktop

**Bug** : `_mfsRelocate` (relocalise les rows desktop dans le bottom-sheet mobile `#mfs-body`) avait une liste périmée → `topn-filter-row` (Top stratégies + slider « Degré Confiance ») **jamais relocalisé** = inaccessible sur mobile ; `edge-filter-row` supprimé (v10.34) ; `period-filter-row`/`kickoff-filter-row` désormais imbriqués dans `#period-kickoff-row`.

**Frontend (pariscore.html)**
- `_mfsRelocate` liste → `['day-filter-row','topn-filter-row','period-kickoff-row','adv-filter-row']` (league-filter-row exclu — `display:none` v10.29).
- `.conf-wrap` : classe `adv-desktop` retirée — elle était masquée `@media(max-width:768px)` → slider Confiance désormais visible/fonctionnel mobile.
- CSS `@media(max-width:768px) #mfs-body` : `.mls`/`#ts-select`/`.conf-wrap` pleine largeur (`width:100%`, `box-sizing`) ; triggers `justify-content:space-between` ; chips/pills/boutons `min-height:38px` + `touch-action:manipulation` + `-webkit-tap-highlight-color` ; `.conf-range` piste 8px, thumb 20px (cible tactile) ; panels `.mls-panel`/`#ts-panel` `z-index:100000` (au-dessus du sheet) ; `period/kickoff` width 100% ; groupe presets O2.5 mobile masqué (redondant avec le slider).
- Formes/fond : composants utilisent les tokens graphite partagés (`--fc-graphite`/`--fc-relief`) → rendu identique desktop et mobile.

**Vérifié** : markup statique servi → `topn-filter-row` bien dans `#filter-console` (relocation runtime mobile uniquement) ; mobile `isMobile()` → `#mfs-body` = `[day,topn,period-kickoff,adv]`, `#ts-select`/`#ml-league` dans le sheet, slider input → valeur OK, `ts-trigger` ouvre le panneau ; `.conf-wrap` classe = `conf-wrap` (plus `adv-desktop`) ; **zéro erreur console**. (Mesures de largeur preview non fiables : sheet hors-flux + gate auth — vérif structurelle/fonctionnelle retenue.)

---

## [v10.42] — 2026-05-17

### Supprimé — Inputs « Cote : min → max » desktop (non fonctionnels)

Retirés d'`#adv-filter-row` : label « Cote : », `#cote-min`, flèche `→`, `#cote-max` (`.adv-desktop`). `activeCoteMin`/`activeCoteMax` restent 0 → filtre cote no-op ; handlers `change` cote-min/cote-max sans cible (jamais déclenchés) ; `adv-reset-btn` garde guards `if (cmin)`/`if (cmax)`. Presets cote mobile (`.adv-chips-m` `data-cote` → `setCotePreset`) **conservés**.

**Vérifié (preview)** : `#cote-min`/`#cote-max` absents, label « Cote : » desktop absent, `#adv-reset-btn` présent et cliquable sans erreur, `.adv-chips-m` conservé ; **zéro erreur console**.

---

## [v10.41] — 2026-05-17

### Modifié — Potentiomètre Confiance : échelle pleine 0 → 100

Valeur `#o25-val` affiche toujours `N%` (suppression de l'état « — » : markup défaut `0%`, reset `0%`, handlers input `activeO25Min + '%'`). `.conf-ticks` padding `0 7px` (≈ demi-curseur) → labels `0%`/`100%` alignés sur les extrêmes de la course du thumb. Range déjà `min=0 max=100 step=5` (v10.38) ; remplissage `updateSliderFill` accent rouge 0→100%.

**Vérifié (preview)** : `min=0`, `max=100`, valeur initiale `0%`, slider 100 → `100%` + remplissage plein, retour 0 → `0%` ; **zéro erreur console**.

---

## [v10.40] — 2026-05-17

### Ajouté — Pastille « i » sur le potentiomètre Confiance → Guide

Bouton `.fc-info.conf-info` dans `.conf-head` (à droite de l'intitulé « Degré Confiance en % »). `onclick="openStrategiesGuide()"` → onglet Guide, section `#guide-strategies`. `title`/`aria-label` expliquent le but : filtre selon le score des stratégies cochées dans « Toutes stratégies ». CSS `.conf-info` (14px, `#ff6168`, hover halo rouge), `.conf-title` passé en `inline-flex` (alignement i).

**Vérifié (preview)** : `.conf-info` présent dans `#topn-filter-row .conf-wrap`, texte « i », visible (14px, `rgb(255,97,104)`), clic → `#page-guide` ouvert ; **zéro erreur console**.

---

## [v10.39] — 2026-05-17

### Refondu — Potentiomètre « Degré Confiance » (forme premium)

`.conf-wrap` repensé : **mini-carte graphite** (`--fc-graphite` + `--fc-relief`, radius 12px, largeur fixe 232px) cohérente Graphite Trading-Chip. En-tête `.conf-head` équilibré (`align-items:center`, space-between) : intitulé `.conf-title` (Plus Jakarta 700, casse normale, plus de capitales géantes) + **pastille valeur** `.conf-val` (gradient rouge, pill, texte blanc centré). Piste `.conf-range` 6px arrondie, remplissage rouge (`updateSliderFill` : `var(--blue)`→`var(--accent)`, track `rgba(255,255,255,.13)`), curseur blanc bordure rouge + halo + hover scale. Graduation `.conf-ticks` alignée (flex egaux, extrémités gauche/droite).

**Vérifié (preview)** : `.conf-wrap` fond graphite `rgb(54,59,67)`, radius 12px, largeur 232px ; remplissage accent rouge ; valeur 50% ; ticks `['0%','25%','50%','75%','100%']` alignés ; **zéro erreur console**.

---

## [v10.38] — 2026-05-17

### Corrigé — Potentiomètre Confiance : intitulé visible + échelle % graduée

`#o25-slider` enveloppé dans `.conf-wrap` : `.conf-head` (intitulé « Degré Confiance en % » + valeur live `#o25-val` rouge mono) + range `.conf-range` (max 0→**100**, step 5) + `.conf-ticks` (graduation écrite `0% / 25% / 50% / 75% / 100%`). Conserve `adv-desktop` (desktop), ids/handlers (`activeO25Min`, input, reset, presets mobile) inchangés.

**Vérifié (preview)** : intitulé « Degré Confiance en % » visible, ticks `['0%','25%','50%','75%','100%']`, `max=100`, slider 75 → `#o25-val`='75%', `activeO25Min`=75 ; **zéro erreur console**.

---

## [v10.37] — 2026-05-17

### Modifié — Slider « Degré Confiance en % » lié aux stratégies sélectionnées

`renderMatches` filtre `activeO25Min` : si `activeStrategies.length>0` → seuil appliqué à `calcTopStrategiesScore(m)` (score max des stratégies cochées) ; sinon fallback `poisson.over25`. Re-render déjà déclenché par l'`input` slider (handler existant) et par `tsToggleStrat` (sélection stratégie) → le potentiomètre se reconfigure dynamiquement selon le choix « Toutes stratégies ».

**Vérifié (preview, mock)** : sans stratégie + seuil 60 → fallback over25 (match over25=80 gardé) ; `BTTS_YES` + seuil 60 → filtre sur btts (match btts=75 gardé, over25=55 exclu) ; `OVER_2_5` + seuil 60 → filtre sur over25. **Zéro erreur console**.

---

## [v10.36] — 2026-05-17

### Modifié — Slider O2.5 → « Degré Confiance en % » déplacé ligne 2 (à côté Top stratégies)

`#o25-slider` + `#o25-val` + label déplacés de `#adv-filter-row` vers `#topn-filter-row`, après `#ts-select`/`.fc-info` (ligne 2). Label « O 2.5 min : » → **« Degré Confiance en % : »**. Ids/handlers inchangés (`activeO25Min`, filtre `poisson.over25`, `updateSliderFill`, reset `adv-reset-btn`, presets mobile `data-o25` conservés dans `#adv-filter-row`). Ancien trio retiré d'`#adv-filter-row` (anti dup id).

**Vérifié (preview)** : 1 seul `#o25-slider`, parent `#topn-filter-row`, label « Degré Confiance en % : », même ligne que `#ts-select` ; slider 60 → `#o25-val`='60%', `activeO25Min`=60 ; **zéro erreur console**.

---

## [v10.35] — 2026-05-17

### Modifié — « Période PPG » → « Période » + Période/Kickoff sur même ligne

`#period-filter-row` et `#kickoff-filter-row` fusionnés visuellement : conteneur `.filter-row#period-kickoff-row` (gap 16px) englobant 2 `<div>` inline-flex conservant les ids `#period-filter-row`/`#kickoff-filter-row` (compat `buildFilterDropdowns` specs + media `> .filter-chip[data-period/kick]`). Labels « Période PPG : » → « Période : » (span + `.dd-lbl` + `aria-label`).

**Vérifié (preview)** : `#period-filter-row` & `#kickoff-filter-row` même parent `#period-kickoff-row`, même ligne (top identique 491) ; « Période PPG » absent, « Période : » présent ; `period-dd` 4 options, `kick-dd` 7 options (specs OK) ; **zéro erreur console**.

---

## [v10.34] — 2026-05-17

### Modifié — Filtre Edge supprimé ; Favoris + « Dropping Cotes » remontés en 1ʳᵉ ligne

- **Supprimé** : `#edge-filter-row` entier (label « Edge min : », chips `data-edge` Tous/+1/+3/+5/+10, `#edge-dd`, `#edge-count`) + spec `edge-dd` de `buildFilterDropdowns`. Filtre `activeEdge` reste à 0 (no-op) ; `renderMatches` `edge-count`/`activeEdge` gardés (guards `if(edgeEl && activeEdge>0)`). Handler `.filter-chip[data-edge]` mort inerte.
- **Déplacé** : `#fav-filter-chip` + `#steam-filter-chip` dans `#day-filter-row` (ligne 1, après `#ml-league`). `#steam-filter-chip` renommé **« Dropping Cotes »** (logique `toggleSteamFilter`/`activeSteamFilter` inchangée).
- **Fix masquage desktop** : règle `@media (min-width:769px) #day-filter-row > .filter-chip` → `#day-filter-row > .filter-chip[data-day]` (sinon fav/steam, `.filter-chip` enfants directs, masqués desktop). Lignes `#edge-filter-row` retirées du bloc media.

**Vérifié (preview)** : `#edge-filter-row` absent ; `#fav-filter-chip`/`#steam-filter-chip` parent = `day-filter-row`, visibles desktop ; texte steam = « Dropping Cotes » ; `toggleFavFilter`→`activeFavFilter=true`, `toggleSteamFilter`→`activeSteamFilter=true` ; **zéro erreur console**.

---

## [v10.33] — 2026-05-17

### Supprimé — Label « Top : » + étoile (topn-filter-row)

2 spans label « Top : » (icône étoile `.fc-ic` + texte) retirés : variante mobile (span direct) + variante desktop (`.dd-lbl`). Chips `Tous/10/5` + `#topn-dd` conservés. « Top stratégies : » non affecté.

**Vérifié (preview)** : aucun « Top : » dans `#topn-filter-row` (regex), 2 spans retirés, **zéro erreur console**.

---

## [v10.32] — 2026-05-17

### Ajouté — Pastille info « i » sur le filtre Top stratégies → Guide

Bouton `.fc-info` (cercle italique « i », accent rouge, hover) ajouté à droite du label « Top stratégies : ». `onclick="openStrategiesGuide()"` : ferme le popup (`tsClose`), `showPage('guide')`, puis `scrollToSection('guide-strategies')` (timeout 250 ms pour laisser la page Guide s'afficher). `aria-label` + `title` explicites, `event.stopPropagation()`.

**Vérifié (preview)** : bouton `i` présent dans `#topn-filter-row`, clic → `#page-guide` visible, `#guide-strategies` existe, **zéro erreur console**.

**Fix v10.32.1** : « i » invisible sur desktop — il était enfant du `<span>` label masqué par `@media (min-width:769px) #topn-filter-row > span:not(.dd-lbl){display:none}`. Déplacé hors du span, en `<button class="fc-info">` **sibling direct** de `#topn-filter-row` (après `#ts-select`) → non ciblé par la règle (ni span ni filter-chip). Vérifié : `display:flex`, 15×15, couleur `rgb(237,28,36)`, visible, à droite du trigger « Toutes stratégies ».

---

## [v10.31] — 2026-05-17

### Supprimé — Bouton/dropdown « Tous paris » (`#topv-dd`)

`<select id="topv-dd">` (Tous paris / Value only) retiré de `#topn-filter-row`. Chip `.topv-chip` « Value » conservé (contrôle distinct, `activeTopValue`). `resyncFilterDropdowns` gère l'absence (`if (tv && tvChip)`), `markFilterDD` neutral itère selects existants (entrée orpheline sans effet), `pickTopvDD` mort inerte (plus d'appelant).

**Vérifié (preview)** : `#topv-dd` absent, `.topv-chip` présent, `resyncFilterDropdowns()` s'exécute sans erreur, **zéro erreur console**.

---

## [v10.30] — 2026-05-17

### Modifié — Filtre « Marché » → multi-select « Top stratégies »

**Demande** : renommer le filtre « Marché… » en « Top stratégies », remplacer la liste (marchés) par les stratégies de l'onglet Top Stratégies, multi-sélection.

**Frontend (pariscore.html)**
- **Supprimé** : 8 chips `.topm-chip[data-topmarket]` (1X2/DC/+1.5/-3.5/Attaque/Défense/BTTS/Smart) + `<select id="topm-dd">` + spec `topm-dd` de `buildFilterDropdowns`.
- **Ajouté** : composant multi-select `#ts-select` (réutilise styles `.mls` graphite/popup fixed) — label « Top stratégies : », trigger « Toutes stratégies », popup recherche + bouton « Toutes stratégies » + 16 lignes `STRATEGIES_UI` (label + tipster). `tsToggleStrat` push/splice `activeStrategies[]` (multi), `tsPickAll` reset, `tsFilter` recherche label+tipster, `tsPosition` (fixed, anti-overflow), fermeture clic extérieur.
- **Ranking** : `calcStrategyScore(m,key)` (mapping 16 clés → métriques poisson : BTTS_YES→btts, OVER_2_5→over25, UNDER_2_5→100-over25, DC_HOME→hw+dr, VERROU_TACTIQUE→100-over35, GOLDEN_PPG_GAP→|ΔPPG|, corners→proxy confiance, etc.) + `calcTopStrategiesScore` = max sur stratégies sélectionnées. `renderMatches` Top N : tri par stratégies si `activeStrategies.length`, sinon marché legacy (`activeTopMarket` conservé pour compat). Handler `.topm-chip` mort laissé inerte.

**Vérifié (preview)** : `topm-dd`+chips absents ; `#ts-select` 16 stratégies (BTTS Oui/L'Artilleur…) ; multi OVER_2_5+BTTS_YES → `activeStrategies=['OVER_2_5','BTTS_YES']`, label « 2 stratégies », 2 lignes cochées ; `calcTopStrategiesScore` mock = 70 (max) ; recherche « artill » → BTTS_YES (tipster) ; untoggle/`tsPickAll` OK ; **zéro erreur console**.

---

## [v10.29] — 2026-05-17

### Supprimé — 2ᵉ ligne de filtres (`#league-filter-row`) retirée de l'UI

Ligne « LIGUE : » + select tri devenue redondante (filtre ligues = `#ml-league` en ligne 1 depuis v10.27). `#league-filter-row { display:none !important }` : ligne retirée visuellement, **markup conservé en DOM** car `rebuildCountryChips`/`buildLeagueMS`/`setCountrySort`/`syncCountryChipUI`/`initLeagueFilters` référencent `#country-filter-row`, `#country-sort-select`, `#country-mobile-select` (un retrait DOM → `rebuildCountryChips` early-return → `buildLeagueMS` jamais appelé → filtre ligues mort). Tri pays = `countrySortMode` (défaut `matches`, v10.28), pilotable en interne sans UI.

**Vérifié (preview, données réelles)** : `#league-filter-row` `display:none` (offsetHeight 0) mais présent en DOM ; `#ml-league` toujours dans `day-filter-row` ; `buildLeagueMS` → 45 pays construits ; éléments JS présents ; **zéro erreur console**.

---

## [v10.28] — 2026-05-17

### Supprimé — Option de tri « Priorité »

`<option value="priority">Priorité</option>` retirée de `#country-sort-select` (reste : Matchs/jour ↓, Edge moyen ↓). Défaut `countrySortMode` : `'priority'` → `'matches'` ; coercition `localStorage ps_country_sort==='priority'` → `'matches'` (évite valeur orpheline sur le select). Branche `else` de `rebuildCountryChips` (tri priorité) conservée comme fallback interne d'ordonnancement, sans exposition UI.

**Vérifié (preview)** : `#country-sort-select` options = `['matches','edge']`, `countrySortMode='matches'`, `select.value='matches'` valide, plus aucune option « Priorité ».

---

## [v10.27] — 2026-05-17

### Modifié — Filtre « Toutes les ligues » repositionné en 1ʳᵉ ligne

`#ml-league` (multi-select ligues) déplacé de `#league-filter-row` vers `#day-filter-row`, à droite de « Tous les jours » (`style="margin-left:auto"` → poussé à droite de la ligne 1 flex). `#league-filter-row` conserve label « Ligue : », `#country-sort-select` et machinerie pays masquée. Popup inchangé (`position:fixed`, `mlPosition` ancré au trigger → fonctionne quel que soit le parent).

**Vérifié (preview)** : `#ml-league` parent = `day-filter-row` (dernier enfant, après day-dd), 1 seule instance, absent de `league-filter-row`, popup `position:fixed` largeur 300. Aucune erreur liée (logs `Failed to fetch` = artefacts evals test pendant reload).

---

## [v10.26] — 2026-05-17

### Corrigé — Multi-sélection des championnats (ligues) par pays

**Bug** : ligues mono-sélection (`mlPickLeague` → `activeLeague` unique + vidait `activeCountries` + fermait le popup). Impossible de cocher plusieurs championnats.

**Frontend (pariscore.html)**
- Nouvel état global `activeLeagues = []` (odds_key, multi).
- **Filtre `renderMatches`** : ancien double filtre `activeCountries` puis `activeLeague===` remplacé par **union** : `Set(ligues des pays cochés ∪ activeLeagues ∪ activeLeague legacy)` → `filtered.filter(sport ∈ set)`. Combinaison pays + ligues individuelles supportée.
- `mlToggleLeague(sport)` (remplace `mlPickLeague`) : push/splice dans `activeLeagues`, **panneau reste ouvert**, ne vide plus les pays. Lignes ligue = case à cocher `.mls-lcheck` (coche rouge si sélectionnée).
- `mlSyncUI` : label intelligent (`Toutes les ligues` / nom pays / nom ligue / « N sélections » = pays+ligues), surbrillance lignes ligues via `activeLeagues`. `mlPickAll` vide aussi `activeLeagues`.

**Vérifié (preview, données réelles)** : toggle Ligue 1 + Premier League → `activeLeagues=['soccer_france_ligue_one','soccer_epl']`, label « 2 sélections », 2 lignes cochées ; + pays Espagne → « 3 sélections », set filtre union = 4 clés ; décoche 1 → reste EPL ; `mlPickAll` → reset « Toutes les ligues ». Aucune erreur liée (les `Failed to fetch` console = artefacts de tests `initLeagueFilters` pendant reload, catch géré, pré-existant).

---

## [v10.25] — 2026-05-17

### Corrigé / Ajouté — Popup filtre Ligues visible + sous-listes ligues par pays

**Bug** : panneau `#ml-panel` (`position:absolute`) clippé par `.filter-console { overflow:hidden; isolation:isolate }` → invisible au 1er regard.

**Frontend (pariscore.html)**
- **Popup `position:fixed` + `z-index:9999`** : échappe à `overflow:hidden`. Positionné en JS (`mlPosition`) sous le trigger via `getBoundingClientRect` ; `max-height` = espace dispo sous le bouton (scroll interne) ; clamp horizontal anti-débordement. Reposition `requestAnimationFrame`+`setTimeout(60)` à l'ouverture (layout post-gate) + sur `resize`/`scroll` capture.
- **Sous-listes ligues** : chaque pays = groupe `.mls-grp` → ligne pays (`.mls-rowmain` toggle multi-sélection + case) + bouton chevron `.mls-exp` qui déplie `.mls-leagues` (ligues du pays, `.mls-league` cliquables avec tag T1/T2). `mlExpand` toggle, `mlPickLeague(sport)` → `activeLeague`, vide `activeCountries`, `initLeagueHub`, ferme le popup.
- **Recherche** étendue : filtre pays (FR+EN) **et** noms de ligues ; auto-déplie le groupe si match sur une ligue.
- `mlSyncUI` gère état ligue active (label = nom ligue), surbrillance ligne/ligue sélectionnée.

**Vérifié (preview, données réelles)** : panel `display:block position:fixed z-index:9999`, dans le viewport (top 461 / bottom 742 ≤ 760, `max-height` 281 + scroll), largeur 300. Expand France → 2 ligues (Ligue 1…). `mlPickLeague` → `activeLeague='soccer_france_ligue_one'`, label « Ligue 1 », popup fermé, `activeCountries` vidé. Multi-pays intact. **Zéro erreur console**.

---

## [v10.24] — 2026-05-17

### Ajouté — Filtre Ligues : multi-sélection + drapeaux + noms FR

**Contexte** : `#country-mobile-select` (select natif, mono-sélection, options sans drapeau, pays en anglais) jugé limité.

**Frontend (pariscore.html)**
- **Composant `#ml-league` (multi-select)** : remplace visuellement le `<select>` natif (gardé `hidden` pour compat `markFilterDD`/neutral). Trigger graphite trading-chip + panneau popover.
- **Multi-sélection** : chaque pays = ligne cochable (case + drapeau + nom). Coche/décoche → `mlToggleCountry` push/splice dans `activeCountries[]` (pipeline `renderMatches` déjà multi-pays). « Toutes les ligues » (`mlPickAll`) reset. Label trigger : « Toutes les ligues » / « Pays » / « N pays sélectionnés ».
- **Drapeaux** : `getCountryFlag()` (img flagcdn) rendu dans le panneau HTML (impossible dans `<option>` natif).
- **Noms FR** : map `COUNTRY_FR` (EN→FR, ex. England→Angleterre, Germany→Allemagne, Saudi Arabia→Arabie Saoudite…) + `frCountry()`. Recherche `#ml-search` insensible accents/casse sur libellé FR **et** clé EN.
- **Style** : popover graphite (cohérent v10.22), case cochée gradient rouge, hover, `:focus-visible`, responsive ≤768px pleine largeur. Fermeture clic extérieur. `aria-multiselectable`/`role=listbox`/`aria-selected`.
- Sync : `buildLeagueMS()` appelé en fin de `rebuildCountryChips` ; `onCountryMobileSelect` appelle `mlSyncUI()` ; cohérence avec `syncCountryChipUI`/`activeCountries`.

**Vérifié (preview, données réelles `/leagues_config.json`)** : 45 pays rendus, noms FR (Angleterre/Espagne/Allemagne…), drapeaux `img.country-flag` présents, select natif `hidden`. Multi : France+Spain → `activeCountries=['France','Spain']`, label « 2 pays sélectionnés », 2 lignes `sel` ; décoche → « Espagne » ; `mlPickAll` → reset « Toutes les ligues ». Recherche FR : « allem »→Germany, « angl »→England. **Zéro erreur console**.

**Fix doublon** : règle CSS `#country-mobile-select { display:block }` écrasait l'attribut `hidden` → 2 boutons « Toutes les ligues » affichés. Remplacée par `display:none !important` (select natif conservé en DOM pour compat `markFilterDD`/neutral). Un seul contrôle visible (`#ml-league`).

---

## [v10.23] — 2026-05-17

### Supprimé — Rangée « Filtre rapide » (et son remplacement) retirées

**Contexte** : rangée « Filtre rapide » (presets Top 5 Europe / Live / Toutes T1 / Scandinavie + `preset-dd`) jugée inutile. Remplacement temporaire (`#quick-filter-row` : « Toutes les ligues » + « Matchs/jour ») également jugé non désiré par le DG → supprimé.

**Frontend (pariscore.html)** — état final
- **Supprimé** : `#preset-filter-row` (4 `.preset-pill` data-preset + `<select id="preset-dd">`) ; spec `preset-dd` retirée de `buildFilterDropdowns` ; `#quick-filter-row` + fonctions `qfAllLeagues`/`qfSortMatches` + sync DOMContentLoaded + règle CSS `#quick-filter-row`. Handler mort `.preset-pill[data-preset]` (l.18213) laissé inerte (jamais matché, zéro risque). Réfs CSS preset nettoyées (retrait masquage desktop/mobile).
- Reset ligues + tri matchs/jour restent accessibles via les contrôles existants de `#league-filter-row` (chip pays « Toutes », `#country-sort-select`).

**Vérifié (preview)** : `preset-filter-row`, `preset-dd`, `quick-filter-row` absents ; `qfAllLeagues` undefined ; **zéro erreur console**.

### Modifié — `#league-filter-row` remonté en 2ᵉ position

Rangée « Ligue : » (chips pays + `#country-sort-select` Matchs/jour + `#country-mobile-select` Toutes les ligues) déplacée juste après `#day-filter-row`. Ordre `#filter-console` final : day → **league** → topn → edge → period → kickoff → adv. Bloc HTML déplacé tel quel (ids/handlers inchangés). Vérifié : ordre correct, 1 seule instance, zéro erreur console.

---

## [v10.22] — 2026-05-17

### Refondu — Bulles filtres « Graphite Trading-Chip » (suite v10.21)

**Contexte** : forme/couleur des bulles de filtres jugée fade. DG a choisi (AskUserQuestion) le concept **C — Graphite Trading-Chip**, scope **tous les contrôles**.

**Frontend (pariscore.html) — CSS, sélecteurs/ids inchangés (zéro impact JS)**
- **Tokens graphite** : `--fc-graphite` / `--fc-graphite-hi` (dégradé anthracite 3 stops `#363b43→#20242a→#181b20`), `--fc-ink` `#cfd4db`. Relief 3D revu : reflet haut `inset rgba(255,255,255,.10)` + **arête sombre bas** `inset 0 -1px 0 rgba(0,0,0,.55)` + ombre portée profonde (extrusion terminal). `--fc-press` plus marqué (`inset 0 3px 7px`). Variantes `body.dark-theme`.
- **Surface graphite identique clair/dark** (look terminal quant) sur : `.filter-chip`, `.filter-dd`, `#country-mobile-select`, `#country-sort-select`, `.preset-pill`, `#fav/#steam/#adv-reset`. Texte gris clair, chevron SVG rouge vif `#ff3b3b` (pop sur graphite), `<option>` fond `#1c1f24`.
- **Forme** : `border-radius` 7/16/20px → **12px** uniforme (arrondi pro, moins « pilule plate »), padding +1px.
- **États** : hover = `translateY(-2px)` + surface `--fc-graphite-hi` + texte/bord rouge `#ff6168` + halo rouge `rgba(237,28,36,.30)`. Actif = gradient rouge 3 stops `#ff2a33→accent→accent-dim` + **enfoncement** `--fc-press` + glow + `text-shadow`. `:focus-visible` anneau rouge. Override clair (ex-noir) aligné. `dd-on` = liseré rouge inset.

**Vérifié (preview, computed-styles)** : chip/dd/preset = `linear-gradient(rgb(54,59,67)…)` graphite, texte `rgb(207,212,219)`, radius 12px, ombre `inset+drop` ; actif = `linear-gradient(rgb(255,42,51)…)` rouge texte blanc pressé ; chevron SVG rouge ; **zéro erreur console**. Identité Barlow/console globale intacte.

---

## [v10.21] — 2026-05-17

### Refondu — Barre de filtres « 3D Glass-Neumorphism » (`#filter-console`)

**Contexte** : barre de filtres jugée trop plate (« formulaire administratif »). Manque l'identité outil de trading quant. Refonte validée DG (workflow : audit localisation → rapport écrit → validation → impl). Recos appliquées (hybride, polices console-only, SVG, charte L'Équipe préservée).

**Frontend (pariscore.html) — CSS**
- **Tokens 3D scopés** `#filter-console` : `--fc-relief` / `--fc-relief-hi` / `--fc-press` (double ombre face lumineuse haut + face sombre bas) + variantes dark.
- **Relief premium** sur `.filter-chip` et `.preset-pill` : repos = gradient blanc + relief sorti ; `:hover` = `translateY(-1px)` + ombre accentuée + accent rouge ; **`.active` = enfoncement mécanique** (`inset box-shadow` + gradient rouge `--accent`→`--accent-dim`, blanc). Override clair (ex-noir plat #1A1A1A) remplacé par rouge pressé.
- **Verre dépoli dark-only** : `body.dark-theme .filter-console` → `backdrop-filter: blur(10px) saturate(140%)` + bordure translucide `rgba(255,255,255,0.10)`. Thème clair conservé opaque (préserve identité L'Équipe — mémoire « pas data-terminal dark »).
- **Polices** : labels/titres → `Plus Jakarta Sans` (700/800) ; valeurs numériques + selects + `.filter-dd` → `JetBrains Mono` + `tabular-nums` (alignement pixel). Scopé console uniquement (identité Barlow globale intacte). Ajout `Plus Jakarta Sans` au `<link>` Google Fonts (JetBrains déjà chargé).
- **`.fc-ic`** : classe icône vectorielle 13px, `stroke: currentColor`.
- **Accessibilité** : `:focus-visible` accent, `@media (prefers-reduced-motion: reduce)` annule translate/transition.
- **Responsive `@media (max-width:430px)`** : rangées `flex-wrap`, chips/icônes réduits, marges auto neutralisées, selects pleine largeur, `.fc-head` wrap — zéro overflow horizontal.

**Frontend — Markup (zéro émoji)**
- 9 émojis remplacés par SVG inline `.fc-ic` (trophy, bolt, globe, snowflake, star ×3, cpu/Smart, coin/Value, trending-down/Steam, x/Reset). Émojis dans `<option>`/placeholders (non-SVG-able) : texte nettoyé (`Value only`, `Rechercher…`, `PSG, Real Madrid…`, `Toutes les ligues`). Placeholder JS `ph` preset-dd : `⚡` retiré.

**Vérifié (preview, computed-styles — autoritatif)** : 8 SVG `.fc-ic` rendus, **zéro émoji** (textNodes + options + placeholders), chip actif = gradient rouge + `inset` pressé, police chip = Plus Jakarta Sans, police `.filter-dd` = JetBrains Mono, thème clair sans backdrop (glass dark-only par design), responsive ≤430px, **zéro erreur/warning console**. Sélecteurs CSS/ids inchangés → zéro impact JS (`pickChipDD`/`toggleFavFilter`/`setPeriod`/`buildFilterDropdowns`). Inline styles `.filter-row` conservés (déjà neutralisés par `!important`, retrait jugé risqué pour `flex-wrap`/`gap` — décision pt4 reportée).

---

## [v10.20] — 2026-05-17

### Ajouté / Refondu — Tableau matchs « Value-First » (Concept A desktop) + nettoyage tennis

**Contexte** : tableau jugé peu attractif. Analyse concurrentielle (OddAlerts / Betmines / Datafoot) + best practices UX tableaux denses → rapport `.context/rapport-analyse-concurrentielle-tableau-2026.md`. Concept validé par le DG : **A (table Value-First) desktop + B (cartes) mobile**, scope football + tennis. Mobile (Concept B) déjà livré (`renderMobileCards`).

**Frontend (pariscore.html) — football `#vb-table`**
- **Colonne VALUE héros** figée à droite (`position:sticky;right:0`, modèle OddAlerts/Datafoot) : badge edge dévigé + flèche `▲/▼/＝` + pick @cote + tag tier. Ajoutée au `<thead>` (`.vb-value-col`) et au template `<tr>` (`vbHeroHtml`). `colspan` des en-têtes de ligue auto-recalculé (querySelectorAll th).
- **Tiers décision** (réutilise la logique cartes mobile) : `hot/VALUE` (edge≥5), `try/À TENTER` (≥1.5), `neu/NEUTRE` (>0), `no/ÉVITER` (≤0), `na/DATA` (live/sans edge). Classe ligne `is-value-hot`/`is-value`.
- **Zéro zébrure** : suppression `nth-child(odd/even)` (thème dark **et** clair). Fond uniforme, divider 1px, **couleur = sémantique uniquement** — accent gauche rouge (`box-shadow inset`) sur lignes value, pas de bandes décoratives.
- **Accessibilité** : couleur jamais seule (flèche `▲▼` + tag texte), `font-variant-numeric: tabular-nums` sur colonnes numériques, état `:focus-within`, `@media (prefers-reduced-motion: reduce)`, `title` sur en-tête et badge, ellipsis sur le pick.
- Hover simplifié (plus de dégradé), transition courte `background`.

**Frontend — tennis `#tennis-vb-table` (refonte CSS-level)**
- Zéro zébrure (`nth-child(even)` retiré → fond uniforme, accent hover conservé), `tabular-nums` sur cellules numériques, `:focus-within`, `prefers-reduced-motion`. Design dédié dark conservé (colonne Value EV+ déjà présente).

**Vérifié (preview, données réelles)** : 113 lignes football rendues, 113 cellules VALUE, 18 value bets tier `hot`, tiers/flèches/tags corrects (mock + réel), zébrure tuée (fond uniforme), colonne VALUE `sticky right:0` 92px, `tabular-nums` actif, accent gauche `is-value-hot` = rouge inset, thème clair, **zéro erreur/warning console**. Tennis : table intacte (14 th), aucune régression. Conforme Web Interface Guidelines (Vercel).

---

## [v10.19] — 2026-05-17

### Corrigé — Colonne Clsst figée : K League 1 (Corée) + anti-contamination saison N-1

**Cause racine (panne multi-couches)**
- **BSD sans saison** : `/seasons/?league=50` (K League, BSD id 50, config 292) renvoie **0 saison** (`is_current` absent, liste vide). `fetchBSDStandings` bailait au guard "Aucune saison" → `null`, alors que `/leagues/50/standings/` **sans** param `season` renvoie la table active (12 équipes).
- **Contamination cross-source** : sur échec BSD, la Phase 2 `fetchStats` injectait le classement API-Football. Le plan gratuit ne sert que ≤ saison **2024 TERMINÉE** → table N-1 figée (P33, 61 pts) cohabitant avec la table BSD courante (P15) = doublons au mauvais rang, colonne Clsst jamais à jour.
- **Gate persistant** : `db.statsUpdateByLeague[292]` persisté en SQLite → Phase 1 sautait la ligue "données fraîches" à vie, ne purgeant jamais les lignes périmées.

**API source confirmée (BSD)** : K League 1 = **BSD id 50** (config 292), **aucune saison** exposée (appeler `/standings/` sans `season`). Champs : `position, team, team_id, played, won, drawn, lost, gf, ga, gd, pts, xgf, xga, form, live` (xG = 0 pour cette ligue). FC Seoul #1 (P15, 32 pts) — conforme.

**Backend (server.js)**
- `fetchBSDStandings` : tente `/leagues/{id}/standings/` **sans** `season` quand aucune saison trouvée (au lieu de `return null`).
- `ESPN_STANDINGS_SLUG[292]='kor.1'` — secours zéro quota.
- Sanitizer one-shot au boot (`loadDB`) : purge les lignes `_source:'api-football'` des ligues couvertes BSD + reset du gate de fraîcheur.
- `fetchStats` Phase 1 : bypass du gate si lignes `api-football` périmées détectées ; purge **totale** des lignes de la ligue avant injection BSD/ESPN.
- `fetchStats` Phase 2 : **ne retombe plus** sur API-Football pour les ligues BSD en échec (anti-contamination N-1) — seule `BSD_FALLBACK_NEEDED` (liste curée) est éligible.
- **Garde lecture autoritaire** (chokepoint) : route `/api/v1/standings/:id` (`buildRows`) **et** `buildMatchRecord` (colonne Clsst) ignorent toute entrée `_source:'api-football'` pour une ligue couverte BSD → rang BSD/ESPN uniquement, sinon "chargement…".

**Vérifié** : `/api/v1/standings/292` → 12 équipes `srcs:['bsd']`, 0 ligne P>25, FC Seoul #1 P15 32pt ppg2.13. Serie A (`/135`) : toujours `bsd`, Como #6 65pt — pas de régression. `node --check` OK.

---

## [v10.18] — 2026-05-17

### Corrigé — Colonne classement vide (rank "-") sur ligues BSD (ex: Serie A)

**Cause racine**
- `fetchBSDStandings()` lisait `entry.team` pour construire la clé `db.teamStats` (`normName(entry.team)`).
- L'API BSD expose le nom de l'équipe sous **`team_name`** (+ `team_id`), pas `team`. Aucun champ `team` dans le payload standings.
- Résultat : `normName(undefined)` → clé vide pour **toutes** les équipes → écrasement mutuel, `rank`/`ppg`/stats jamais résolus par le builder de match → affichage "-" et PPG générique.

**API source confirmée (BSD)**
- Serie A italienne = **BSD league id 4** (config 135), saison courante `358` ("Serie A 25/26"). Ne pas confondre avec id 9 (Brasileirão) ni 42 (Coppa Italia).
- Champs standings BSD : `position, team_id, team_name, played, won, drawn, lost, gf, ga, gd, pts, xgf, xga, xgd, xg_games, form, live`. **Pas de splits domicile/extérieur** → estimation 50/50 conservée (comportement existant).

**Backend (server.js — `fetchBSDStandings`)**
- Helper `teamLabel(e)` = `e.team_name || e.team?.name || e.team || e.name || ''` (robuste aux variantes/objets imbriqués + rétro-compat).
- `key = normName(teamName)` ; ligne ignorée avec warning si nom vide (au lieu de polluer `db.teamStats` avec une clé vide).
- Logs `[DENYLIST]`/`[BSD] Splits`/`[DATA MAPPING]` utilisent désormais `teamName`.
- Bénéficie aussi à la route `GET /api/v1/standings/:id` (même fonction).

**Vérifié** : `/api/v1/standings/135` → 20 équipes `_source:bsd` — Inter #1 (85 pts, PPG 2.36), Como #6 (65 pts, PPG 1.81, GF/GA 60/28), Parma #13 (42 pts, PPG 1.17). Conforme à la vérité BSD. `node --check` OK.

---

## [v10.17] — 2026-05-16

### Corrigé — Classement J1 League (Japon) vide : source de secours ESPN

**Cause racine (panne à 3 couches)**
- BSD ne couvre pas la J-League : `/seasons/?league=49` renvoie 0 saison (3 stratégies KO).
- Clé API-Football sur plan **FREE** (≤ saison 2024) + quota journalier épuisé → saison J1 2026 inaccessible.
- `currentSeason()` suppose un calendrier européen août→mai ; la J-League est calendaire (fév→déc) → saison mal calculée (2025 au lieu de 2026).

**Backend (server.js)**
- `ESPN_STANDINGS_SLUG` : map `configId → slug` ESPN (98→`jpn.1`, 99→`jpn.2`). Source publique gratuite, sans clé, servant toujours la saison en cours → contourne le bug de calcul de saison.
- `fetchESPNStandings()` : adaptateur format `db.teamStats`. Fusionne les children ESPN (J-League scindée *Group East/West* 2×10) puis re-classe globalement par points/diff. de buts. Splits dom/ext estimés 50/50.
- `fetchStats()` : ESPN tenté après échec BSD pour les ligues mappées, avant le fallback API-Football (zéro quota). Purge des lignes périmées avant injection.
- Route `GET /api/v1/standings/:id` : pour ligues ESPN, refetch si vide **ou** lignes non-ESPN périmées (API-Football saison terminée). ESPN prioritaire, BSD en repli.

**Vérifié** : `/api/v1/standings/98` → 20 équipes saison 2026 (`espn`), Kashima Antlers 1er. Ligue 1 inchangée (BSD). Rapport : `.context/rapport-j1-classement-espn-2026.md`.

---

## [v10.16] — 2026-05-16

### Ajouté — Logos diffuseurs TV par ligne (cascade favicon domaine)

**Backend (server.js)**
- `TV_DOMAIN_RULES` : 40+ diffuseurs FR + Europe mappés vers leur domaine officiel → logo via favicon Google `sz=64` (beIN SPORTS, RMC Sport, Ligue1+, L'Équipe, Sport TV, SSC, Coupang Play, Mediaset, Premier Sports, blue Sport…).
- `resolveTvLogo` étendu : source externe → simpleicons curé → marque mot-clé → **favicon domaine** → null (monogramme frontend).
- Couverture logos servis : ~20% → ~95%.

### Corrigé
- `TV_BRAND_ICONS` mot-clé `'max'` (HBO Max) trop glouton : `beIN SPORTS MAX` résolvait vers logo HBO. Restreint à `'hbo max' / 'hbomax' / 'hbo'`.
- Cache key `tv-channel` bumpée `v7 → v8` (invalide payloads `logo:null`).

> Le slot `[data-tv-badge]` par ligne + `enrichTVChannels()` (v10.8) étaient déjà en place ; seule la résolution logo manquait. Détail : `.context/rapport-tv-broadcasters-2026.md` §9.

---

## [v10.15] — 2026-05-15

### Ajouté — Gamme tarifaire par sport + paywall réel (client + serveur)

**Tarifs (pariscore.html)**
- Grille unique 8 offres segmentées par sport : GRATUIT 0€ · MATCHDAY FOOT 1,50€/24h · MATCHDAY TENNIS 1,50€/24h · DUO MATCHDAY 2,50€/24h · PRO FOOT 19,5€/mois · PRO TENNIS 19,5€/mois · DUO PRO 30€/mois · ANNUEL DUO 22€/mois (-27%).
- Réconciliation des 3 surfaces tarifaires divergentes (grille / bannière / upsell quota).
- Inscription obligatoire : `openModal()` redirige vers le vrai formulaire `openAuthModal('register')` ; faux `#modal` neutralisé.

**Verrou client (Phase 1)**
- `psAccess()` dérive foot/tennis/pro du rôle JWT. `showPage()` bloque tout module non autorisé → page verrou + CTA. Liens nav masqués selon le tier.
- Matchs freemium : 5 ligues UE uniquement, AI Scout + boutons IA masqués (`body.ps-free`).

**Verrou serveur (Phase 2 — vrai paywall)**
- `srvAccess(req)` + `srvPlanGate()` centralisé en tête de `http.createServer`.
- `/api/v1/matches` exige un compte (401 sinon) + filtre 5 ligues UE serveur si pas footPro.
- Tennis / ai-scout / strategies / hot-picks / sure-bets / trends / predictions / insights / deep-stats / bets / bankroll / alerts → 403 hors plan.
- Rôles étendus : `pro_foot/pro_tennis/pro_all/matchday_foot/matchday_tennis/matchday_duo` (back-compat `premium`=`pro_all`, `matchday`=foot).

**Quota freemium**
- 10 consultations `/api/v1/matches` par jour et par compte (`incrementMatchesView`, reset 24h). Au-delà → 403 `FREEMIUM_VIEW_QUOTA` + panneau upsell front. Polls live non décomptés.

**Limite connue** : attribution des nouveaux rôles à l'achat non câblée (Stripe : 1 seul price ID, webhook signe `matchday`). Nécessite price IDs distincts + metadata sport → rôle.

---

## [v10.3] — 2026-05-14

### Ajouté — Tennis BSD (REST proxy + MCP passthrough + fallback ESPN)

**Découverte source**
- `/tennis/mcp/` = serveur Model Context Protocol JSON-RPC pour clients LLM (Claude Desktop, ChatGPT, Gemini) — pas un flux REST de données.
- Vraies routes REST tennis BSD : `/tennis/api/v2/matches/` `/matches/live/` `/players/` `/rankings/` `/tournaments/` `/predictions/`.
- Gating : Sports Addon $5/mo. Probe HTTP 402 `{"code":"addon_required"}`.

**Backend (server.js)**
- Constantes `BSD_TENNIS_ENABLED` (flag env, défaut OFF), `BSD_TENNIS_BASE`, `BSD_TENNIS_MCP_URL`, `BSD_TENNIS_UPGRADE_URL`.
- Helper `bsdTennisFetch(pathSuffix, retries=2)` — GET authentifié (`Authorization: Token …`) avec retry exponentiel et mapping `402 addon_required` → throw `ADDON_REQUIRED`.
- Wrapper `handleTennisBSD(suffix, cacheKey, ttlMs)` : gate 503 si flag OFF, cache via `apiCacheGet/Set`, mapping erreurs (402 addon, 502 upstream).
- 7 routes proxy REST + 1 passthrough MCP :
  - `GET /api/v1/tennis/live` (no cache)
  - `GET /api/v1/tennis/matches?date=YYYY-MM-DD` (TTL 30 min)
  - `GET /api/v1/tennis/match/:id` (TTL 5 min, ID validé `[A-Za-z0-9_-]+`)
  - `GET /api/v1/tennis/rankings?tour=ATP|WTA` (TTL 6h)
  - `GET /api/v1/tennis/tournaments` (TTL 6h)
  - `GET /api/v1/tennis/players/:id` (TTL 1h, ID validé)
  - `GET /api/v1/tennis/predictions/:id` (TTL 5 min, ID validé)
  - `POST /api/v1/tennis/mcp` — passthrough JSON-RPC brut vers `/tennis/mcp/`, body `readBodyLimited` 1 Mo.
- Path traversal/injection bloqué : regex `/^[A-Za-z0-9_-]+$/` sur match/player IDs → 400 `invalid_match_id`/`invalid_player_id` avant tout appel BSD.

**Frontend (pariscore.html)**
- Nouveau modal `#tennis-detail-modal` (backdrop blur, animation slide-in, close button) + ~30 lignes CSS dédiées.
- Fonctions `openTennisDetail(matchId)`, `closeTennisDetail()`, `renderTennisDashboard(data, preds)`, `_fetchAndRenderTennisDetail(id)`.
- Polling 30 s automatique tant que modal ouverte, cleared à la fermeture (`_tennisDetailInterval`).
- Dashboard rendu : header (joueurs + ranks + tournoi/round/surface), tableau sets-by-sets, grille serve stats (aces, double fautes, % 1er svc, breakpoints), barre ML prédiction (player1 vs player2 win %), timeline point-by-point (30 derniers).
- États 503/402 : CTA upgrade vers `https://sports.bzzoiro.com/pricing/`.
- `renderTennisLive` : lignes clickables (`tennis-row-clickable` + `onclick="openTennisDetail(id)"`) → ouvre modal détail BSD au clic.

**Configuration**
- Variable env `BSD_TENNIS_ENABLED=false` par défaut — passer à `true` après souscription addon.

**Vérifications réalisées**
- `node --check server.js` — OK.
- Toutes routes BSD avec flag OFF → 503 `{"error":"tennis_bsd_disabled","fallback":"espn"}` (7 REST + MCP POST).
- Path traversal `/api/v1/tennis/match/..%2F..%2Fetc%2Fpasswd` → 400 `invalid_match_id` (regex guard antérieur au call BSD).
- UI : `openTennisDetail('abc123')` → modal s'ouvre, affiche état "Détail BSD désactivé" + CTA addon. `closeTennisDetail()` → interval purgé, `display:none`.

---

## [v10.2] — 2026-05-14

### Ajouté — Tennis live (ESPN ATP+WTA) — onglet dédié + route isolée

**Backend (server.js)**
- Nouvelle route `GET /tennis/api/v2/matches/live/` — retourne tableau JSON normalisé (player1/player2/player1_sets/player2_sets/current_point) + extensions `sets[]`, `current_set_index`, `status`, `tournament`, `court`, `tour`, `serving`, `is_live`, drapeaux pays.
- Source : ESPN public scoreboard ATP + WTA (`site.api.espn.com/.../tennis/{atp,wta}/scoreboard`) — zéro clé API.
- Helpers `fetchESPNTennisLive`, `_normalizeESPNTennisCompetition`, `_tennisStateLabel` + cache module `_tennisLiveCache` (TTL 30 s, mutex `_isFetchingTennis`).
- Poll dédié `pollTennisLive()` toutes les 30 s + bootstrap au boot, indépendant de `pollLiveScores` football.
- Dispatcher d'API étendu pour router `/tennis/*` vers `handleAPI()` (ajout `pathname.startsWith('/tennis/')`).
- Filtre `?live=true` côté route pour ne renvoyer que les compétitions ESPN en état `in`.
- Isolation totale : aucun match tennis n'entre dans `db.matches`, `buildMatchRecord`, Poisson, edge, Football-Data, ou TheSportsDB. `/api/v1/matches?league=tennis` reste `[]`.

**Frontend (pariscore.html)**
- Nouvel onglet `🎾 Tennis` dans la barre de navigation principale.
- Page dédiée `#page-tennis` avec table `#tennis-live-table` (colonnes : Tournoi · Tour · Joueur 1 · Joueur 2 · Sets · Jeux · Point · Statut).
- Renderer `renderTennisLive` + format `formatTennisScore` (`sets | jeux | point`, ex. `1-1 | 4-3 | 40-40` quand disponible — point ESPN public non livré, dégradé `—`).
- Poll client `tickTennisLive()` toutes les 30 s, `startTennisLive` / `stopTennisLive` montés/démontés via `showPage('tennis')`.
- Toggle "Live uniquement" (coché par défaut), bouton 🔄 Actualiser, indicateur d'horodatage live.
- Styles : drapeau pays 18×12 px, vert sur joueur au service (`serving=1|2`), statut LIVE en rouge.

**Vérifications réalisées**
- `node -c server.js` — OK.
- `curl /tennis/api/v2/matches/live/` — JSON array conforme, 5 matchs en direct détectés (Internazionali BNL d'Italia, Parma Ladies Open).
- UI : tab 🎾 Tennis charge 5 lignes en direct, format Sets/Jeux/Point conforme, polling 30 s actif.
- `/api/v1/matches?league=tennis` → `{count:0}` (isolation confirmée).
- Aucune erreur console, aucune régression sur l'onglet Matchs.

**Notes ESPN public scoreboard**
- Point en cours (`40-40`) non disponible en API publique gratuite → frontend affiche `—`. Pour le point live il faudrait `summary?event={id}` ou un partenariat data.
- ESPN agrège ATP+WTA ; doublons rares possibles si même rencontre exposée sur les deux scoreboards. Filtrage future ID-based si problème.

---

## [v9.8.1] — 2026-05-12

### Ajouté — Mes Paris : Plan 20%/jour + Import CSV sécurisé + Sport + Bookmakers ANJ

**Plan bankroll (compound + split 50/50)**
- Table `bankroll_plan` (user_id PK, starting_capital_cents 30000 default, daily_target_pct 20.0, profit_split_pct 50.0, start_date '2026-05-12', floor_cents)
- Routes : `GET/PUT /api/v1/bankroll/plan`, `GET /api/v1/bankroll/daily-tracker`
- Daily tracker calcule jour par jour : capital_cible (compound × 1.20), capital_réel, P&L jour, split 50% banque / 50% capital, cumul banque, écart cible, hit_target boolean
- Onglet "Plan 20%/jour" dans Mes Paris : KPI row (capital départ/actuel/banque/total/cible/écart) + table jour-par-jour + pill statut
- Modal `#plan-modal` : édition capital, target%, split%, start date, floor

**Bookmakers — ANJ FR + 1xbet (11 books)**
- Constante `ALLOWED_BOOKMAKERS` côté serveur, `normalizeBookmaker()` lookup case-insensitive
- Dropdowns dans bet-modal, cash-modal, import-modal, paris-filters
- Liste : 1xbet, Winamax, Betclic, Unibet, PMU, Parions Sport, ZEbet, NetBet, Vbet, Genybet, PartoucheSport
- Cash modal accepte "banque" (épargne séparée)

**Colonne sport (15 sports)**
- Migration idempotente `ALTER TABLE user_bets ADD COLUMN sport TEXT DEFAULT 'football'` + `external_ref` + `source`
- `ALLOWED_SPORTS` + `normalizeSport()` avec alias (foot/basket/tennis/mma/ufc/f1/lol/etc.)
- POST + PATCH /bets acceptent `sport`, listUserBets filtre par sport
- Dropdown sport dans bet-modal + filter dans paris-filters
- Colonne emoji dans table (`SPORT_EMOJI` côté JS)
- Export CSV inclut colonne `sport`

**Import CSV bookmaker (sécurité renforcée)**
- Route `POST /api/v1/auth/reverify` — exige mdp en clair, vérifie via `verifyPasswordSync`, émet token 32-byte hex single-use TTL 5 min, stockage Map en mémoire avec purge auto, log IP côté server
- Route `POST /api/v1/bets/import` — exige JWT + `reverify_token` (consumed-on-use), CSV ≤ 500 Ko, dry_run mode, transactionnel via `sqldb.transaction()`, dédup via `external_ref` (user_id, date|event|odds)
- Parser flexible `parseBetsCSV` : 10 alias colonnes (date/sport/event/market/selection/odds/stake/payout/status/bookmaker/league), séparateur auto-détecté (`,` `;` `\t`), gère "Historique" préfixe 1xbet, dates DD/MM/YYYY + ISO, normalisation status (won/lost/void/cashout/half_won/half_lost)
- Table `bet_import_audit` (user_id, source, filename, rows_parsed/inserted/skipped, ip, user_agent) — forensique
- Route `GET /api/v1/bets/import/audit` (last 50)
- Modal `#import-modal` 2-step : (1) re-verify mdp, (2) upload fichier OU paste CSV + bookmaker default + dry-run/commit, tag "IMP" sur paris importés
- POST /bets stocke `source='manual'` par défaut, import stocke `source='import'`

**Bug TZ corrigé**
- `computeDailyTracker` utilisait `new Date(start + 'T00:00:00')` → interprété en local → décalage 1 jour en CET. Remplacé par `Date.UTC(...split)` partout. Vérifié : daily_pnl correctement attribué au 2026-05-12.

**Frontend (`pariscore.html`)**
- 2 nouveaux modals (`#plan-modal`, `#import-modal`)
- 4ème tab "Plan 20%/jour" + bouton toolbar "⚙ Plan" + "⬆ Importer 1xbet/ANJ"
- Nouveau filtre "Sport" dans paris-filters
- Colonne "Sport" (emoji) dans bets table
- Tag "IMP" sur paris importés
- `SPORT_EMOJI` map (15 entrées)

### Modifié
- `server.js` : +600 lignes (migrations idempotentes, constantes/helpers, 7 routes, parser CSV, reverify token, daily tracker compound)
- `pariscore.html` : +500 lignes (CSS dropdowns, sport column, plan tab, 2 modals, JS handlers)
- `CLAUDE.md` : version → v9.8.1, section v9.8.1 ajoutée

### Sécurité
- Reverify token : 32 bytes crypto-random, single-use, TTL 5 min, purge interval 60s
- Import logs : IP + user_agent en audit pour forensique
- CSV size ≤ 500 Ko (anti-DoS)
- Transactional insert via better-sqlite3 transaction (rollback si crash)
- Dedup hardened via external_ref (date|event|odds, slice 128)

### Tests preview
- Login test@pariscore.fr → plan auto-init (300€/20%/50%/2026-05-12) ✓
- PUT plan → persisté ✓
- Reverify mdp correct → token émis ✓
- Reverify mdp incorrect → 401 + warn log ✓
- Reuse reverify token → 403 ✓
- Import CSV 3 paris (Football/Tennis/Basketball, won/lost/pending) → 3 inserted ✓
- Re-import même CSV → 0 inserted (dedup external_ref) ✓
- Daily tracker : PnL +3.50€ correctement attribué à 2026-05-12, split 1.75/1.75€, écart cible -56.50€ ✓
- UI : emoji sport rendered ⚽🎾🏀, tag IMP visible, Plan tab avec KPI + table OK ✓
- node --check server.js ✓

---

## [v9.8.0] — 2026-05-12

### Ajouté — Module "Mes Paris" (Bet Tracking 1xbet + Bankroll réelle + Kelly + CSV)

**Schéma SQLite**
- Table `user_bets` (FK `users`, 7 statuts via CHECK : pending/won/lost/void/cashout/half_won/half_lost, `payout_cents` persisté, snapshot `model_prob`/`edge_pct`/`kelly_fraction`, INTEGER cents partout)
- Table `bankroll_transactions` (kind : deposit/withdrawal/adjustment, `amount_cents` signé)
- 5 index : `idx_user_bets_user_status`, `idx_user_bets_user_settled`, `idx_user_bets_match`, `idx_user_bets_commence`, `idx_bk_tx_user_date`

**Backend** (`server.js`)
- Helpers : `computeKellyFraction(prob,odds,cap=0.25)`, `suggestStakeCents(bankrollCents,prob,odds,mult=1.0,cap=0.25)`, `requireUserAuth` (exige `user.userId`), `buildBetsWhere`, `listUserBets`, `countUserBets`, `computePayoutCents`, `suggestBetSettlement`, `computeBankrollSummary`
- Routes : `GET/POST/PATCH/DELETE /api/v1/bets`, `POST /api/v1/bets/:id/settle`, `GET /api/v1/bets/suggest-settlement/:id`, `GET /api/v1/bets/kelly`, `GET /api/v1/bets/export.csv`, `GET/POST/DELETE /api/v1/bankroll/tx`, `GET /api/v1/bankroll/summary`
- Alias explicite `GET /api/v1/bankroll/simulated` (route simulée renommée, l'ancienne `/bankroll` reste comme legacy 1 release)
- Hook dans `archivePastMatches` : `UPDATE user_bets SET updated_at` quand match archivé verified → bande jaune `.bet-row-suggest` côté UI (pas d'auto-settle)
- Sécurité : `WHERE user_id = ?` sur 100 % des queries, isolation cross-user validée

**Frontend** (`pariscore.html`)
- Lien nav "Mes Paris" + dispatch `showPage` → `initParisPage`
- Page `#page-paris` : header + toolbar (Nouveau pari / Dépôt-Retrait / Export CSV / chip bookmaker / timestamp)
- 8 KPI tiles : Bankroll, Disponible (avec montant en jeu), P&L cumul, ROI, Win Rate, Drawdown (raw + risk), Ouverts, Longest streak W/L
- Chart Chart.js bankroll réelle (ligne `#29b6f6` + scatter markers triangle vert dépôts / rouge retraits, Y-axis `EUR`, destroy/recreate)
- 3 tabs : Paris ouverts / Historique / Trésorerie
- Filtres : statut, bookmaker, marché, équipe, plage date
- Modal `#bet-modal` : autocomplete matchs (`/api/v1/matches`), 19 préselections marché (1X2/Over/Under/BTTS/DC/AH/FREE), Kelly panel collapsible Full (mis en avant, choix user) / Half / Quarter, edge affiché
- Modal `#settle-modal` : bandeau suggestion auto si match archivé verified + bouton Accepter, radio statut, preview P&L live
- Modal `#cash-modal` : dépôt/retrait/ajustement avec date éditable
- Export CSV : `fetch + blob + a.download`, headers Bearer, OWASP injection guard côté serveur (préfixe `'` si cellule commence par `= + - @`)
- CSS : 60 lignes (`.bet-status-pill` par statut, `.bet-pl-pos/neg`, `.bet-row-suggest` bande jaune, `.kelly-panel`, `.paris-modal`, etc.)
- Patch `/api/v1/bankroll` → `/api/v1/bankroll/simulated` dans `renderBankrollChart` (ligne 12834)

### Modifié
- `server.js` : +900 lignes (schéma, helpers, 13 routes, hook archivage)
- `pariscore.html` : +900 lignes (CSS + nav + page + 3 modals + JS init/render/handlers + Kelly + CSV download)
- `CLAUDE.md` : version → v9.8, section v9.8 ajoutée
- `.claude/CLAUDE.md` : roadmap P2-P3 "Bet Tracking Utilisateur" cochée

### Verrouillé pour la suite (hors scope v9.8)
- Combinés / parlay (junction table `user_bet_legs`)
- Import CSV 1xbet
- Scraping API 1xbet (ToS-incompatible)
- Cashout live suggestion (streaming odds + live model)
- Multi-devise, export fiscalité FR détaillé
- Notification Telegram sur règlement

---

## [v4.6.0] — 2026-04-30

### Ajouté — Wave 6 : Scouting Intelligence (Injuries + Scouting Report)

**Player Absence Impact**
- `fetchTeamInjuries(teamKey)` : appel `/injuries?team={id}&season={year}` API-Football, cache SQLite KV 24h, jusqu'à 5 absences par équipe
- Fire-and-forget dans `fetchStats()` : pré-charge les injuries des 20 premiers matchs à chaque cron (~40 req/cron)
- `buildMatchRecord()` enrichi : `record.injuries {home:[{name,reason}], away:[...]}` + `record.injuryPenalty {home:%, away:%}` (5% par joueur absent, plafond 30%)
- Badge `⚠️ Absences` rouge dans le tableau quand `injuryPenalty.home + away >= 10`, tooltip avec noms des joueurs blessés
- Null safety : erreur réseau/429 → `penalty = 0`, zéro crash

**Scouting Report Gemini**
- `buildScoutingPrompt(match)` : prompt structuré en 4 sections (Tactique, Statistique, Risques, Recommandation) avec injuries, xG, Poisson, edge, form, ranks
- `getScoutReport(match)` : appel Gemini + cache SQLite KV `scout_{matchId}` 24h
- Route `GET /api/v1/scout/:matchId` : retourne `{report, cached}` — handler async pattern `(async()=>{})()` conforme au projet
- Onglet "🕵️ Scouting" dans modal Insights — lazy-load (une seule requête par ouverture), `buildScoutingTab()`, rendu `marked.parse()` avec fallback `<br>`
- Badge CACHE 24H / NOUVEAU dans l'UI scouting

### Modifié
- `server.js` : +4 fonctions (`fetchTeamInjuries`, `buildScoutingPrompt`, `getScoutReport`, `callGemini` helper) + 1 route (`/api/v1/scout/:matchId`) + enrichissement `buildMatchRecord()` + fire-and-forget dans `fetchStats()`
- `pariscore.html` : onglet 🕵️ Scouting dans modal + `buildScoutingTab()` + badge `.badge-absence` CSS + `absenceBadge` dans `renderMatches()` + `insShowTab()` étendu

---

## [v4.5.0] — 2026-04-30

### Ajouté — Wave 5 : HT/FT Market + Acca Generator + Dropping Odds Tracker

**HT/FT Market — 2 nouvelles stratégies (15 stratégies au total)**
- `HT_HOME_FT_HOME` : proxy Poisson `homeWin` filtré (homeWin ≥ 60% ET ppg dom ≥ 1.8) — cote `odds.home` — seuils `{high:68, mid:55}`
- `HT_UNDER_FT_OVER` : signal "match qui s'embrase" = moyenne(over25, under15) si over25 ≥ 65% ET under15 ≥ 25% — seuils `{high:65, mid:50}`
- Ajoutés dans `STRATEGIES` (server.js) + `STRATEGIES_UI` + `CONF_THRESHOLDS` (pariscore.html)

**Acca Generator — 100% mathématique**
- Fonction `getAccaByStrategy(strategyType, size)` : top N matchs par confiance → cote combinée (produit) + proba combinée (produit)
- Route `GET /api/v1/acca?strategy=BTTS_YES&size=3`
- Encart "🎯 Combiné du Jour" dans la page Top Stratégies : cote combinée en grand + liste matchs avec % individuel + disclaimer
- `loadAccaPanel(key)` appelé automatiquement à chaque changement de stratégie
- Estimée si cote directe absente (1 / probabilité)

**Dropping Odds Tracker — backend**
- `buildMatchRecord()` : snapshot SQLite KV `odds_snap_{matchId}` à chaque `fetchOdds()` + calcul `record.odds_delta = {home, draw, away, ts}`
- Route `GET /api/v1/odds-history/:matchId` : retourne cotes actuelles + delta depuis dernier snapshot
- Colonne "Δ Cote" dans le tableau matchs : ↓ rouge si baisse > 0.04, ↑ vert si hausse, — sinon
- `deltaStr` calculé côté client depuis `m.odds_delta`

### Modifié
- `server.js` : `buildMatchRecord()` enrichi + 3 nouvelles routes (`/acca`, `/odds-history`, HT/FT dans STRATEGIES)
- `pariscore.html` : 15 stratégies + encart Acca + colonne Δ Cote + CSS `.acca-*` + `.odds-delta-*`

---

## [v4.4.0] — 2026-04-30

### Ajouté — Power Score Streaming (Wave 4)
- **`POWER_SCORE_SYSTEM_PROMPT`** : constante serveur contenant le prompt expert 5 piliers (Métriques 30% / Tactique 20% / Dynamique 20% / Presse 15% / Psychologie 15%) + format de sortie Markdown structuré 6 sections
- **`buildPowerScorePrompt(match)`** : injecte dynamiquement les données réelles du match dans le prompt (form, xG, λ Poisson, probas over/btts/1N2, cotes, edge, rank, avgScored/Conceded)
- **Route `GET /api/v1/ai-stream/:matchId`** : endpoint SSE streaming Gemini
  - Cache HIT (< 24h dans SQLite KV) → replay immédiat, zéro appel Gemini
  - Cache MISS → pipe `streamGenerateContent` Gemini → chunks SSE → stockage cache à la fin
  - Nettoyage propre si client déconnecté (`req.on('close')`)
- **Route `POST /api/v1/power-score/:matchId/feedback`** : stocke 👍/👎 dans SQLite table `ai_feedback`
- **Table SQLite `ai_feedback`** : `(id, matchId, rating, ts)` — créée dans `initSQLite()`
- **Onglet "⚡ Power Score"** (6ème) dans modal Insights
  - Streaming typewriter : texte apparaît progressivement via `EventSource`
  - `marked.js` CDN (`@12.0.0`) pour rendu Markdown natif
  - Lazy-load : stream déclenché au 1er clic sur l'onglet uniquement
  - Badge "📦 En cache" si l'analyse vient du cache SQLite
- **Export Telegram en 1 clic** : `extractTelegramScript()` parse le bloc ` ```telegram ` + bouton 📋 avec `navigator.clipboard` + fallback `execCommand`
- **Feedback 👍/👎** : boutons post-stream → `POST /api/v1/power-score/:matchId/feedback` → message "Merci !"
- **Boutons sur cartes stratégie** : chaque carte a désormais `✦ Stats` + `⚡ Power Score` en bas (avec `event.stopPropagation()`)
- **`openPowerScore(matchId)`** : ouvre le modal Insights et bascule directement sur l'onglet Power Score
- **CSS Power Score** : styles Markdown dans `#ps-content` (h2 vert, h3 bleu, pre avec fond dark, code monospace)

### Modifié
- `server.js` : `initSQLite()` crée la table `ai_feedback` + ajout `POWER_SCORE_SYSTEM_PROMPT` + `buildPowerScorePrompt()` + 2 nouvelles routes
- `pariscore.html` : modal Insights étendu à 6 onglets + `insShowTab()` gère `powerscore` + `closeInsights()` ferme le stream SSE ouvert

---

## [v4.3.0] — 2026-04-30

### Ajouté — Live Intensity Score (Wave 3)
- **`computeLiveIntensity(fix)`** dans `server.js` : calcule un score composite 0-100 à partir des statistiques live API-Football
  - `getStat(teamStats, type)` : helper null-safe pour extraire une stat par type depuis le tableau `fix.statistics`
  - Score = 40% Tirs totaux (normalisé /25) + 30% Tirs cadrés (/12) + 20% Corners (/15) + 10% Écart possession (/50%)
  - Retourne `null` si `fix.statistics` absent ou incomplet (matchs sans données live)
- **`match.live_intensity`** : champ ajouté dans `pollLiveScores()` — stocké en mémoire sur chaque match live, broadcasté via SSE
- **Badge ⚡ Intensité** dans le tableau matchs (`pariscore.html`) : affiché uniquement si `live_score` + `live_intensity` présents
  - 🔴 Rouge ≥ 60 (match très ouvert), 🟠 Orange ≥ 30 (match actif), 🔵 Bleu < 30 (match fermé)
  - Classes CSS `.badge-intensity.high/.mid/.low` — style cohérent avec `.badge-live`
- **Modal Insights** : affiche `⚡ Intensité X/100` dans `#ins-league` sous le nom du match (coloré selon seuil)

### Modifié
- `server.js` : `pollLiveScores()` stocke `match.live_intensity = computeLiveIntensity(fix)` à chaque poll
- `pariscore.html` : `openInsights()` enrichit le sous-titre du modal avec l'intensité live si disponible

---

## [v4.2.2] — 2026-04-30

### Ajouté
- **Double Chance market — `DC_HOME` (1X) + `DC_AWAY` (X2)** : 2 nouvelles stratégies, portant le total à 13
  - `DC_HOME` : confiance = `homeWin + draw` (Poisson) — l'équipe à domicile ne perd pas
  - `DC_AWAY` : confiance = `awayWin + draw` (Poisson) — l'équipe à l'extérieur ne perd pas
  - `getOdds: () => null` — pas de cote directe disponible via The Odds API h2h, cote estimée affichée (`~X.XX`)
  - `CONF_THRESHOLDS.DC_AWAY` : `{high:65%, mid:50%}` — seuils abaissés car plage naturelle X2 = 25-70%
  - `DC_HOME` utilise le fallback standard `{high:75%, mid:60%}` — plage 1X = 50-90%, cohérent

### Modifié
- `server.js` : `STRATEGIES` étendu de 11 → 13 entrées
- `pariscore.html` : `STRATEGIES_UI` étendu de 11 → 13 entrées + `CONF_THRESHOLDS` complété avec `DC_AWAY`

---

## [v4.2.1] — 2026-04-30

### Corrigé
- **`confClass()` seuils adaptatifs par stratégie (W1)** : les marchés à faible probabilité naturelle ne s'affichent plus systématiquement en rouge
  - `CONF_THRESHOLDS` : CS_00 {high:25%, mid:12%}, DRAW {high:35%, mid:25%}, UNDER_2_5 {high:70%, mid:55%}, VERROU_TACTIQUE {high:72%, mid:58%}
  - Fallback {high:75%, mid:60%} pour les autres stratégies (BTTS, OVER, HOME_WIN…)
  - `confClass(pct, stratKey)` — la clé de stratégie est désormais passée depuis `loadStrategy(key)`
- **`openInsightsById()` guard (W2)** : évite un modal vide si le match n'est pas encore chargé
  - Double guard : chargement de `allMatches` si absent, vérification finale avant ouverture
  - `console.warn` + `return` silencieux si le match reste introuvable après fetch

### Ajouté
- **Filtre par ligue dans Top Stratégies (W3)** : tous les concurrents l'avaient, PariScore aussi maintenant
  - `getTopMatchesByStrategy(..., league)` : filtrage `m.sport === leagueFilter` côté serveur
  - Route `/api/v1/top-strategy?league=soccer_france_ligue1` opérationnelle
  - Dropdown `#strat-league-select` (8 options : Toutes + 7 ligues majeures) dans `#strategy-controls`
  - Variable `activeStratLeague` + handler `onStratLeagueChange()`
- **Slider `minConfidence` dans la page Stratégies (W4)**
  - Slider 0→90% (pas 5%) dans `#strategy-controls`, variable `activeStratConf = 50`
  - Handler `onStratConfChange()` — reload automatique à chaque changement
  - Bouton "✕ Réinitialiser" via `resetStratFilters()` — remet league, slider et label à zéro
- **`#strategy-controls`** : barre de filtres unifiée (ligue + confiance min + reset) insérée entre les pills et la grille de résultats

### Modifié
- `meta.innerHTML` dans `loadStrategy()` : affiche désormais `≥ ${activeStratConf}%` et le nom de la ligue active au lieu du hardcodé "≥ 50%"
- `pariscore.html` : 4 fonctions ajoutées (`onStratLeagueChange`, `onStratConfChange`, `resetStratFilters`, `CONF_THRESHOLDS`)
- `server.js` : signature `getTopMatchesByStrategy` étendue avec param `league`

---

## [v4.2.0] — 2026-04-30

### Ajouté
- **SSE Live (Server-Sent Events)** : route `GET /api/v1/live` — zéro WebSocket, modules Node.js natifs
  - `sseClients` Set + `broadcastSSE(eventName, data)` — notifie tous les clients connectés
  - `buildMeta()` helper réutilisable (lastOddsUpdate, lastStatsUpdate, status, quotas)
  - Snapshot immédiat des matchs à la connexion + heartbeat `: heartbeat` toutes les 30s
  - Broadcast automatique après chaque `fetchOdds()` réussi
- **Smart Polling Live** : `pollLiveScores()` — appel `fixtures?live=all` toutes les 60s, actif 19h–23h (Europe/Paris)
  - Matching par `normName()`, mise à jour `live_score` / `live_status` / `live_minute` dans `db.matches`
  - Broadcast SSE automatique si au moins un score a changé
- **Badge LIVE** : `<span class="badge-live">🔴 score (min′)</span>` dans la colonne Match si `m.live_score` défini
- **`initSSE()`** côté frontend : remplace `startAutoRefresh()` — désactive le polling 5min sur `onopen`, fallback polling sur `onerror`
- **3 Stratégies Avancées** dans le module Top Stratégies (11 stratégies au total)
  - `ANGLE_CORNERS` 📐 : xG total > 2.5 → proxy pression offensive → confiance = Over 2.5 Poisson
  - `VERROU_TACTIQUE` 🔐 : Poisson Under 3.5 > 80% + bonus +5% si avgConceded < 1.2 (deux équipes)
  - `GOLDEN_PPG_GAP` ⭐ : Écart PPG > 1.2 + fort PPG à domicile OU cote > 1.70 → confiance = homeWin/awayWin
- **Gestion Intelligente des Quotas T1/T2**
  - `LEAGUE_CRON_MS` map construite au boot depuis `leagues_config.json`
  - `db.statsUpdateByLeague[lid]` : timestamp par ligue, persisté en SQLite
  - Boucle standings : skip si ligue encore fraîche selon `cron_hours` (T1 = 6h, T2 = 12h)
  - ~60 req/jour économisées sur les 5 ligues T2
- **Skills Claude Code** dans `.claude/skills/`
  - `/ps-add-strategy` : scaffold nouvelle stratégie (server.js + pariscore.html + CLAUDE.md)
  - `/ps-audit` : audit état projet vs roadmap CLAUDE.md
  - `/ps-changelog` : mise à jour CHANGELOG + CLAUDE.md après feature
  - `/ps-deploy` : checklist déploiement Render.com

### Corrigé
- `@keyframes blink` dupliqué dans pariscore.html — suppression de la définition redondante
- `[ ] Système de favoris` dans P1 CLAUDE.md → marqué `[x]` (déjà implémenté le 29 avril)

### Modifié
- `server.js` : `startAutoRefresh()` remplacé par `initSSE()` dans le flux de chargement frontend
- `pariscore.html` : `onMatchesLoaded()` et `loadMatches()` appellent désormais `initSSE()`

---

**Session du 27 avril 2026**

---

## 1. Renommage de la plateforme
- Nom changé de **CoteAlerte** → **PariScore** dans l'ensemble du projet

---

## 2. Structure de navigation (SPA)
- Conversion en **Single Page Application** avec 6 onglets sans rechargement :
  - **Accueil** — page de garde (hero + stats + features)
  - **Matchs** — tableau de données live
  - **Prédictions IA** — cartes de prédiction
  - **Tendances** — statistiques BTTS, buts, etc.
  - **Alertes** — configuration des alertes Telegram
  - **Tarifs** — plans tarifaires
- Chaque section est un `div[data-page]` affiché/masqué par `showPage()`
- Correction du bug : `showPage()` cachait aussi les liens de nav (ciblait `[data-page]` au lieu de `div[data-page]`)
- Bouton hero "Voir les paris du jour" → renommé "Voir les matchs du jour" et redirige vers l'onglet Matchs

---

## 3. Connexion The Odds API
- Intégration de **The Odds API** (`https://api.the-odds-api.com/v4/`)
- Clé API pré-remplie depuis le fichier `.env`
- Ligues couvertes : Ligue 1, Premier League, Champions League, La Liga, Bundesliga, Serie A, Europa League
- Appel `/v4/sports/` d'abord pour récupérer uniquement les ligues **actives** avant de charger les cotes
- Fenêtre de 7 jours (`commenceTimeFrom` / `commenceTimeTo`) — correction du paramètre invalide `daysFrom`
- Calcul d'**edge no-vig** : comparaison des meilleures cotes bookmaker vs probabilités fair (moyenne multi-bookmakers)
- Affichage du quota restant (`x-requests-remaining`) dans l'en-tête du tableau

---

## 4. Système de cache 4h
- Cache `localStorage` clé `pariscore_cache_v1` avec TTL de 4 heures
- Au chargement : si cache valide → affichage immédiat, 0 requête API
- Si cache expiré → appel API → mise en cache → affichage
- Badge dynamique mis à jour toutes les minutes : `il y a 1h23 · prochaine MAJ dans 2h37`
- Bouton **↺ Forcer MAJ** pour vider le cache et recharger immédiatement
- Changement de clé API → vidage automatique du cache

---

## 5. Serveur local Node.js (`server.js`)
- Fichier `server.js` sans aucune dépendance npm (modules natifs Node.js uniquement)
- Proxy HTTP → HTTPS pour contourner les restrictions CORS du navigateur
- Route unique `/proxy?target=URL_ENCODÉE` + headers custom via `h_{nom}={valeur}`
- Sert `pariscore.html` comme fichier statique sur `http://localhost:3000`
- Lancement : `node server.js`

---

## 6. Gestion des erreurs & fallback démo
- **Détection automatique** du protocole `file://` avec bannière d'avertissement
- **Données de démonstration** : 20 matchs fictifs répartis sur 4 jours, avec cotes multi-bookmakers réalistes
- Fallback automatique vers les données démo si l'API échoue (CORS, clé invalide, quota épuisé)
- Messages d'erreur différenciés : 401 (clé invalide), 429 (quota), réseau
- Bouton **"Voir démo"** pour forcer le mode démonstration
- Badge coloré : `Mode démo` (orange) vs `✓ Connecté` (vert) vs `✓ Cache` (vert)

---

## 7. Filtres du tableau des matchs

### Filtre par jour
- 4 boutons : **Tous les jours / Aujourd'hui / Demain / J+2 / J+3**
- Labels dynamiques avec vraies dates (`mer. 30 avr.`, `jeu. 1 mai`)
- Filtre appliqué sur les données déjà chargées (0 requête supplémentaire)

### Filtre par ligue
- 8 boutons : Toutes ligues / Ligue 1 / Premier League / Champions League / La Liga / Bundesliga / Serie A / Europa League
- Attribut `data-sport` mappé aux clés The Odds API
- Combinable avec le filtre jour

---

## 8. Redesign du tableau — Style OddAlerts

### Structure
- Table horizontale scrollable (`min-width: 1400px`, `overflow-x: auto`)
- **Double en-tête** : ligne 1 = nom de la stat, ligne 2 = `Dom` / `Ext`
- Chaque ligne = un match avec 2 équipes affichées verticalement

### 10 colonnes de statistiques
| Colonne | Dom | Ext | Logique couleur |
|---------|-----|-----|-----------------|
| PPG | ✓ | ✓ | vert ≥2.0, orange ≥1.3, rouge |
| Victoires % | ✓ | ✓ | vert >75%, orange >50%, rouge |
| Nuls % | ✓ | ✓ | inversé (haut = mauvais) |
| Défaites % | ✓ | ✓ | inversé |
| BTTS % | ✓ | ✓ | vert >75%, orange >50%, rouge |
| +2.5 Buts % | ✓ | ✓ | vert >75% |
| +1.5 Buts 1MT | ✓ | ✓ | vert >75% |
| Buts Marqués % | ✓ | ✓ | vert >75% |
| Buts Encaissés % | ✓ | ✓ | inversé |
| Moy. Buts | ✓ | ✓ | neutre |

### Code couleur
- 🟢 Vert `#00A551` : valeur > 75% (ou PPG ≥ 2.0)
- 🟠 Orange `#F59E0B` : valeur 50–75% (ou PPG ≥ 1.3)
- 🔴 Rouge `#EF4444` : valeur < 50%

---

## 9. Tri des colonnes
- Clic sur `Dom` ou `Ext` → tri décroissant (↓ meilleur en premier)
- 2ème clic sur la même colonne → tri croissant (↑)
- Indicateur visuel vert sur la colonne active
- Combinable avec les filtres jour et ligue
- Indicateur préservé lors des changements de filtre
- Correction bug : `matchesLoaded` et `activeDay` non déclarés → ajoutés en variables globales

---

## 10. Intégration API-Football
- Clé API pré-remplie : `API_FOOTBALL_KEY`
- Endpoint `/fixtures?next=100` → récupération des ligues actives
- Endpoint `/standings?league={id}&season=2024` → stats home/away par équipe
- **Stats calculées depuis les standings** :
  - Directes : PPG, Victoires %, Nuls %, Défaites %, Moy. Buts
  - Estimées depuis moyennes de buts : BTTS %, +2.5 Buts %, +1.5 Buts 1MT, Buts Marqués %, Buts Encaissés %
- Matching des noms d'équipe par normalisation (minuscules, sans accents) + fuzzy search
- Cache AF séparé (`pariscore_af_cache_v1`) — TTL 4h indépendant du cache Odds
- Re-rendu automatique après chargement des vraies données
- Badge **`LIVE`** (bleu) si données réelles, **`SIM`** (gris) si données simulées
- Classement affiché : `#1 vs #4` dans la colonne Match

---

## 11. Fichiers produits
| Fichier | Description |
|---------|-------------|
| `pariscore.html` | Application complète (SPA, tous onglets, APIs, cache) |
| `server.js` | Proxy Node.js local zéro-dépendance |
| `CHANGELOG.md` | Ce fichier |

---

## APIs utilisées
| API | Usage | Clé | Quota |
|-----|-------|-----|-------|
| The Odds API | Cotes live, ligues actives | `ODDS_API_KEY` | 500 req/mois |
| API-Football | Standings, stats équipes | `API_FOOTBALL_KEY` | 100 req/jour |
| Gemini 1.5 Flash | Analyse IA des matchs | `GEMINI_KEY` | Pay-as-you-go |

---

*PariScore — inspiré d'OddAlerts — session de développement du 27 avril 2026*

---

## 12. Architecture v2.0 — Serveur-Centrique (27 avril 2026, session 2)

### Problème résolu
L'architecture v1 exposait les clés API dans le HTML, gérait le cache côté client avec localStorage, et faisait des appels directs aux APIs tierces depuis le navigateur — causant des problèmes CORS permanents.

### Nouvelle architecture
```
  ┌──────────────────────┐
  │  The Odds API         │──┐
  │  (cotes, 15 min)      │  │
  └──────────────────────┘  │    ┌──────────────────────┐     ┌───────────────┐
                             ├───▶│  server.js (Node.js)  │────▶│ database.json │
  ┌──────────────────────┐  │    │  - Cron jobs           │     └───────────────┘
  │  API-Football         │──┘    │  - Fusion + calculs    │
  │  (stats, 6h)          │       │  - API REST interne    │
  └──────────────────────┘       │  - Proxy Gemini        │
                                  └──────────┬─────────────┘
                                             │ /api/v1/matches
                                  ┌──────────▼─────────────┐
                                  │  pariscore.html         │
                                  │  (Frontend "stupide")   │
                                  │  0 clé · 0 cache        │
                                  └──────────────────────────┘
```

### server.js — Backend complet
- **Zéro dépendance npm** — modules Node.js natifs uniquement
- **Chargement .env** — parser intégré, aucune clé dans le code
- **Cron Job Odds** : `setInterval` toutes les 15 min → The Odds API → sports actifs → cotes 7 jours
- **Cron Job Stats** : `setInterval` toutes les 6h → API-Football → fixtures → standings home/away
- **Fusion** : pour chaque match, les cotes sont croisées avec les stats d'équipe
- **Calcul côté serveur** : edge no-vig, probabilités fair, PPG, BTTS%, Over 2.5%, etc.
- **database.json** : stockage persistant, rechargé au démarrage
- **Fallback démo** : si les APIs échouent, 20 matchs fictifs sont générés automatiquement
- **API REST interne** :
  | Route | Méthode | Description |
  |-------|---------|-------------|
  | `/api/v1/matches` | GET | Matchs fusionnés + stats + edge (filtrable par `?league=` et `?day=`) |
  | `/api/v1/stats/:id` | GET | Stats détaillées d'un match |
  | `/api/v1/status` | GET | État du serveur, compteurs, quota, uptime |
  | `/api/v1/gemini` | POST | Proxy Gemini (clé côté serveur uniquement) |
  | `/api/v1/refresh` | POST | Forcer un rafraîchissement immédiat |

### pariscore.html — Frontend allégé
- **Supprimé** : toute logique API, clés, cache localStorage, proxy CORS, proxyFetch
- **Supprimé** : bannière clé API, bannière file://, bouton "Voir démo"
- **Ajouté** : barre de statut serveur (connecté/démo, dernière MAJ, quota)
- **Un seul appel** : `fetch('/api/v1/matches')` → rendu du tableau
- **Gemini** : via `fetch('/api/v1/gemini')` — aucune clé dans le HTML
- **JS réduit** : 45 Ko → 23 Ko (~50% plus léger)

### Sécurité
- ✅ Aucune clé API dans le HTML
- ✅ Clés chargées depuis `.env` côté serveur uniquement
- ✅ Proxy Gemini pour ne pas exposer la clé Google
- ✅ Pas de localStorage sensible

### Fichiers produits
| Fichier | Description |
|---------|-------------|
| `server.js` | Backend Node.js — cron, fusion, API REST, proxy Gemini |
| `pariscore.html` | Frontend SPA — affichage uniquement |
| `.env` | Clés API (à créer par l'utilisateur) |
| `database.json` | Généré automatiquement par le serveur |
| `CHANGELOG.md` | Ce fichier |

### Consommation API estimée (plan gratuit)
| API | Fréquence | Req/cycle | Req/jour | Req/mois |
|-----|-----------|-----------|----------|----------|
| The Odds API | 15 min | ~8 | ~768 | ~500 (plafonné) |
| API-Football | 6h | ~15 | ~60 | ~1800 |

*Note : The Odds API gratuit = 500 req/mois. En production, espacer à 30 min ou passer au plan payant.*

---

## ⚠ HOTFIX — Quota The Odds API (27 avril 2026)

### Problème
Le cron job Odds était configuré à **15 minutes**, soit ~2880 req/mois. Le plan gratuit The Odds API est limité à **500 req/mois**. La clé aurait été grillée en **~16 heures**.

### Corrections appliquées

**server.js :**
- Cron Odds : `15 min` → `12h` (~8 req/cycle × 2 cycles/jour = ~16 req/jour = **~480 req/mois**)
- Cron Stats (API-Football) : inchangé à 6h
- `nextOddsUpdate` dans `/api/v1/status` : corrigé de 15 min → 12h
- Route `/api/v1/refresh` : réécrite pour `await` les deux fetches (Stats puis Odds) et retourner le résultat complet (matchCount, teamCount, timestamps)

**pariscore.html :**
- Bouton **🔄 Forcer l'actualisation** ajouté dans l'en-tête de la barre de statut
- Feedback visuel : icône qui tourne + label "Mise à jour…" → "✓ 47 matchs" (ou "⚠ Erreur")
- Appelle `POST /api/v1/refresh` → attend la réponse → recharge les matchs

### Consommation révisée
| API | Fréquence | Req/cycle | Req/jour | Req/mois |
|-----|-----------|-----------|----------|----------|
| The Odds API | 12h | ~8 | ~16 | **~480** (< 500 ✅) |
| API-Football | 6h | ~15 | ~60 | ~1800 |

*L'utilisateur peut toujours forcer un refresh ponctuel via le bouton, qui consomme ~8 req supplémentaires.*

---

## Correctifs de l'Audit v2.0 (27 avril 2026)

### 🔴 P0 — Sécurité critique

**S1/S2/S3 — Blindage du serveur de fichiers statiques**
- Ajout d'une liste noire : `.env`, `database.json`, `package.json`, `.gitignore` → réponse `403 Forbidden`
- Ajout d'un blocage des dossiers : `.git/`, `node_modules/` → `403`
- Protection path traversal : vérification `path.resolve(filePath).startsWith(__dirname)` avant tout accès fichier
- Toute tentative d'accès à `http://localhost:3000/.env` ou `../../etc/passwd` retourne maintenant 403

**S5 — Limite de taille POST**
- Nouvelle fonction `readBodyLimited(req, maxSize)` — coupe la connexion si le payload dépasse 1 Mo
- Appliquée sur `/api/v1/gemini` — retourne `413 Payload Too Large`

### 🟠 P1 — Fiabilité backend

**P1 — Verrou anti-race-condition**
- Ajout de deux flags mutex : `isFetchingOdds` et `isFetchingStats`
- Chaque cron job vérifie le flag avant de démarrer, log un avertissement si déjà en cours
- Relâchement du flag dans un bloc `finally` pour garantir la libération même en cas d'erreur

**P2 — saveDB asynchrone**
- `fs.writeFileSync` remplacé par `fs.writeFile` avec callback d'erreur
- L'event loop n'est plus bloquée pendant la sauvegarde de `database.json`

**F1 — Commentaire header corrigé**
- "toutes les 15 min" → "toutes les 12h" dans le header de `server.js`

### 🟡 P1 — Logique frontend

**F2 — Double tri corrigé**
- Avant : tri par stat → immédiatement écrasé par tri par date → le tri par colonne ne fonctionnait pas
- Après : `if (!sortKey) { filtered.sort(by date) }` — le tri par date ne s'applique qu'en l'absence de tri utilisateur

**F3 — Colonne Moy. Buts colorisée**
- Nouveau type `'avg'` dans la fonction `sc()` — vert ≥ 2.0, orange ≥ 1.2, rouge en dessous
- Alignée visuellement avec le style OddAlerts des autres colonnes

### 🟡 P2 — Transparence algorithmique

**A1 — Colonnes estimées marquées**
- Les headers BTTS %, +2.5 Buts %, +1.5 Buts 1MT portent maintenant le symbole `≈` et un tooltip :
  *"Estimation basée sur buts marqués/encaissés — pas un historique brut"*
- Les cellules individuelles de ces colonnes portent le même tooltip au survol
- La fonction `sc()` accepte maintenant un 3ème paramètre `tooltip`

### Vérifications post-correctifs
- ✅ `node --check server.js` — syntaxe valide
- ✅ Braces HTML/JS : 236/236 — équilibrées
- ✅ 0 clé API dans le frontend
- ✅ `isSafePath()` bloque `.env`, `database.json`, path traversal

---

## Phase 3 — Intelligence complète (27 avril 2026, session 3)

### Option A — Distribution de Poisson (complétée)
- `renderMatches()` mis à jour : utilise `m.poisson.*` (données serveur) à la place des anciennes formules linéaires
- Nouvelles colonnes Poisson unifiées : BTTS, O 0.5, O 1.5, O 2.5, O 3.5 (en bleu dans le tableau)
- xG (Expected Goals) affiché depuis `m.expectedGoals.home/away` au lieu de `avgScored`
- Tooltip sur chaque ligne : scores les plus probables (ex: "1-0(14%) 2-0(11%)…")
- Fonction `scp()` dédiée aux cellules Poisson (seuil: >65% vert, >45% orange, <45% rouge)

### Option B — Backtesting (complété)
- `updateStatusBar()` affiche la précision algorithme : "✓ Précision (n=47): O2.5: 68% · BTTS: 61% · Edge: 55%"
- Statut `quota_epuise` géré et affiché correctement en orange
- Auto-refresh frontend toutes les 5 minutes (silencieux, pause si onglet caché via `visibilityState`)

### Option C — AI Scout (complété)
- `loadAIScout()` fetch `/api/v1/ai-scout` en arrière-plan après chargement des matchs
- Affichage dans `#ai-scout-panel` avec horodatage "Généré il y a X min"
- Markdown `**bold**` converti en `<strong>` pour l'affichage

---

## Phase 4 — Fiabilisation (27 avril 2026, session 3)

### server.js
- **Levenshtein distance** : remplacement du fuzzy matching par premier mot par un algorithme de distance éditoriale (seuil: 25% de la longueur du nom ou 3 chars)
- **Saison dynamique** : `currentSeason()` — retourne l'année courante si mois ≥ juillet, sinon année-1
- **Nettoyage automatique** : `cleanExpiredMatches()` supprime les matchs dont le coup d'envoi était il y a >90min après chaque cron Odds
- **Suivi 429** : `db.status = 'quota_epuise'` et `saveDB()` lors d'un HTTP 429 sur The Odds API
- **Telegram alertes** : envoi automatique après chaque cron Odds réussi (threshold configurable via `ALERT_EDGE_THRESHOLD`)

### pariscore.html
- **Filtre Edge minimum** : nouvelle rangée de filtres (Tous / +1% / +3% / +5%★ / +10%) avec compteur "N value bets"
- **Auto-refresh 5 min** : `startAutoRefresh()` lancé après le premier chargement des matchs
- **Gestion 429** : message "Quota API épuisé — données en cache" au lieu du message générique
- **Labels filtres ligue** : ajout d'un préfixe "Ligue :" pour la lisibilité

---

## Phase 5 — Production (27 avril 2026, session 3)

### server.js
- **JWT (HMAC-SHA256, natif crypto)** : `jwtSign()` / `jwtVerify()` sans dépendance npm
  - Route `POST /api/v1/auth/login` → token 7 jours
  - `getAuthUser(req)` → vérifie l'en-tête `Authorization: Bearer {token}`
  - Utilisateurs en mémoire : `admin` (mot de passe via `ADMIN_PASSWORD` dans `.env`) et `demo`
- **Telegram Bot** : `sendTelegramAlert()` / `sendValueBetAlerts()` via API Telegram native (https)
  - Envoi automatique après chaque cron Odds pour les matchs avec edge > seuil
  - Format HTML : équipe, heure, cote, edge, BTTS%, O2.5%
  - Variables `.env` : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS` (CSV), `ALERT_EDGE_THRESHOLD`
- **Route `GET /api/v1/predictions`** : matchs classés par confiance (algo Poisson convergent + edge)
  - Génère `recommendation` textuelle par match ("Victoire PSG", "Plus de 2.5 buts"…)
- **Route `GET /api/v1/trends`** : agrégats BTTS/Over 2.5/xG globaux + par ligue + accuracy
- **Route `GET /api/v1/history`** : archive des matchs vérifiés avec scores réels
- **Route `GET /api/v1/admin/status`** : tableau de bord complet (protégé JWT admin)
  - uptime, mémoire heap, flags mutex, quota, accuracy, chats Telegram, AI Scout cache
- **Route `POST /api/v1/telegram/test`** : envoi manuel d'alertes (protégé JWT admin)
- **CORS configurable** : `ALLOWED_ORIGIN` dans `.env` → restreint en production (wildcard `*` en dev)

### pariscore.html
- **Page Prédictions connectée** : `loadPredictions()` → `/api/v1/predictions` → cartes dynamiques avec barres Poisson, xG, recommandation
- **Page Tendances connectée** : `loadTrends()` → `/api/v1/trends` → tendances globales + par ligue en temps réel
- Chargement déclenché automatiquement à la navigation vers ces onglets (via `showPage()`)

### Nouveaux fichiers
- **`admin.html`** : dashboard admin complet (authentification JWT, KPIs, accuracy, value bets, actions, logs)
  - Connexion avec `admin` / mot de passe configuré dans `.env`
  - Auto-refresh 30s, boutons "Forcer MAJ" et "Test Telegram"
  - Accessible via `http://localhost:3000/admin.html`
- **`render.yaml`** : blueprint de déploiement pour Render.com
  - Disque persistant 1Go pour `database.json` et `history.json`
  - Variables d'environnement documentées (sync:false pour les secrets)
  - `JWT_SECRET` auto-généré par Render

### Variables `.env` complètes (v5.0)
```
PORT=3000
ODDS_API_KEY=...
API_FOOTBALL_KEY=...
GEMINI_API_KEY=...
JWT_SECRET=...              (auto-généré si absent)
ADMIN_PASSWORD=...          (défaut: pariscore2026)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_IDS=...       (IDs séparés par virgule)
ALERT_EDGE_THRESHOLD=8      (edge % minimum pour alertes)
ALLOWED_ORIGIN=*            (restreindre en production)
```

---

## Hotfix — Navigation brisée (27 avril 2026)

### Symptôme
Tous les liens de la barre de navigation (`Accueil`, `Matchs`, `Prédictions IA`, `Tendances`, `Alertes`, `Tarifs`) étaient non fonctionnels après la session Phase 3→5.

### Cause racine : 2 bugs JS imbriqués
**Bug 1 — Code orphelin (SyntaxError fatale)**
- Lors de la migration des onglets Prédictions/Tendances vers les fonctions `loadPredictions()` et `loadTrends()`, le `str_replace` a supprimé le début de l'ancien tableau `const PREDS = [` mais laissé les données restantes en place, suivies d'un `PREDS.forEach(...)` et des données statiques `TRENDS`.
- Ces objets littéraux orphelins (`{ league:'LIGUE 1'... }`) suivis d'un `]` sans ouverture créaient une **SyntaxError au chargement** qui crashait l'intégralité du JS → aucun `onclick` ne fonctionnait.

**Bug 2 — Apostrophe doublement échappée**
- La chaîne `'Forcer l\\'actualisation'` dans `forceRefresh()` contenait un `\\` (double backslash) interprété comme `\'` par le parser JS, ce qui fermait la string prématurément → deuxième erreur de syntaxe en cascade.

### Correction appliquée
- Suppression complète du bloc orphelin (lignes 1455–1499) : données PREDS résiduelles, `PREDS.forEach`, données TRENDS statiques et `TRENDS.forEach`
- Remplacement de `'Forcer l\\'actualisation'` par `"Forcer l'actualisation"` (guillemets doubles) aux 2 occurrences dans `forceRefresh()`

### Vérification post-fix
- `node --check` sur le JS extrait : ✅ syntaxe valide
- Toutes les pages : div présent + lien `showPage()` → ✅ × 6
- Accolades : 276/276 équilibrées ✅

---

## Hotfix — Navigation invisible (opacity:0) (27 avril 2026)

### Symptôme
Les liens de navigation déclenchaient bien `showPage()` (pas d'erreur JS) mais le contenu restait **invisible** après le clic — opacity 0, l'utilisateur voyait une page noire.

### Cause racine : IntersectionObserver + display:none
Toutes les sections secondaires portent la classe `.fade-up` (`opacity: 0; transform: translateY(16px)`). L'`IntersectionObserver` est initialisé au chargement de la page et observe ces éléments. Comme leurs parents (`div[data-page]`) sont en `display:none`, ils ne sont **jamais intersectants** → ils ne reçoivent jamais la classe `.visible` (qui met `opacity: 1`).

Quand `showPage()` affichait la page, le contenu devenait techniquement visible dans le DOM mais restait à **opacity: 0** — invisible pour l'utilisateur.

La page Accueil n'était pas affectée car elle est `display:block` dès le chargement, donc ses sections intersectent l'observer et reçoivent `.visible` normalement.

### Corrections appliquées

**`showPage()` — force `.visible` après affichage :**
```js
page.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
```
Dès qu'une page est affichée, toutes ses sections reçoivent immédiatement `.visible`.

**CSS — animation d'entrée pour les pages SPA :**
```css
@keyframes pageEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
div[data-page][style*="display: block"] > section { animation: pageEnter .35s ease both; }
```
Animation légère (350ms) qui s'applique à chaque section quand sa page devient visible, sans dépendre de l'IntersectionObserver.

### Leçon retenue
> Dans une SPA avec navigation par `display:none/block`, les animations/transitions basées sur `IntersectionObserver` ne fonctionnent pas pour le contenu initialement caché. Toujours forcer la visibilité lors de l'affichage d'un onglet.

---

## Fix — Colonnes Poisson : format + tri (27 avril 2026)

### Problème signalé
Les colonnes BTTS, O 0.5, O 1.5, O 2.5, O 3.5 avaient :
1. **Un format visuel incohérent** — couleur bleue et `rowspan="2"` qui les faisait fusionner les deux lignes d'en-tête, les isolant visuellement du reste du tableau
2. **Aucun tri possible** — pas de bouton ↕ contrairement à toutes les autres colonnes

### Corrections

**HTML — En-têtes :**
- Suppression des 5 `<th rowspan="2" style="color:var(--blue);">` individuels
- Remplacement par un `<th colspan="5" class="stat-group">Poisson</th>` unique en 1ère ligne (style identique aux autres groupes : PPG, Victoires %, etc.)
- Ajout de 5 `<th class="sortable">` dans la 2ème ligne (BTTS, O 0.5, O 1.5, O 2.5, O 3.5) avec `onclick="setSort('poisson_btts', this)"` etc.

**JS — Logique de tri :**
- `setSort()` : inchangé (accepte déjà n'importe quelle clé)
- Bloc de tri dans `renderMatches()` : ajout d'une branche `poisson_*`
```js
if (sortKey.startsWith('poisson_')) {
  const stat = sortKey.slice(8); // 'btts', 'over05', 'over25'…
  va = a.poisson?.[stat] ?? 0;
  vb = b.poisson?.[stat] ?? 0;
}
```
- `slice(8)` correspond exactement à `'poisson_'.length` → les clés extraites (`btts`, `over05`, `over15`, `over25`, `over35`) correspondent aux propriétés de l'objet `poisson` retourné par le serveur

### Résultat
- Les colonnes Poisson s'intègrent visuellement dans le tableau comme les autres groupes
- Tri ↓ (meilleur en premier) / ↑ (moins bon en premier) disponible sur chaque colonne Poisson
- Comportement identique aux autres colonnes : indicateur vert sur la colonne active, préservé lors des changements de filtre

---

## Feature — Power Score IA (Gemini) (27 avril 2026)

### Contexte
Remplacement du simple bouton d'analyse Gemini (texte libre) par un système d'analyse prédictive structuré : le **Power Score PariScore**.

### Nouveau prompt — 5 piliers
1. **Métriques Avancées** (30%) : xG/xGA, volume corners
2. **Analyse Tactique & Effectifs** (20%) : systèmes de jeu, absences, mismatches
3. **Dynamique & Calendrier** (20%) : forme 5 derniers matchs contextualisés, SOS
4. **Presse & Consensus Web** (15%) : L'Équipe, Marca, Kicker, The Athletic, Sofascore, BetMines, Forebet, OddAlerts
5. **Psychologie & H2H** (15%) : historique sur ce terrain, enjeux

### Format de réponse — JSON strict
Gemini retourne un JSON structuré parsé côté client :
- `power_scores` : score/100 dom + ext + couleur de jauge
- `probabilites_pourcent` : 1N2 + Over 1.5 buts + Over 7.5/8.5 corners
- `analyses_detaillees` : tactique, synthèse web, corners
- `top_5_paris` : Safe · Bankroll Builder · Value Bet · Plus Risqué · Corners

### Nouveau modal — `#gemini-panel` redessiné
- **Power Score jauge** : barre proportionnelle avec couleur dynamique (hex Gemini)
- **Grille 1N2** : probabilités en gros chiffres + sous-grille Over 1.5/Corners
- **3 sections texte** : Tactique, Synthèse Presse, Corners
- **Top 5 Paris** : cartes colorées (🔒 Safe, 📈 Bankroll, 💎 Value, ⚡ Risqué, 🎯 Corners)
- **Loading spinner** pendant la génération (≈5-10s)
- Parsing JSON robuste avec fallback `indexOf('{')` si Gemini ajoute des backticks

---

## Hotfix — Modèle Gemini déprécié (27 avril 2026)

- `gemini-1.5-flash` → `gemini-2.0-flash` (3 occurrences dans `server.js`)
- Cause : `gemini-1.5-flash` n'est plus disponible sur le endpoint `v1beta/generateContent`
- Erreur initiale : `HTTP 404 — models/gemini-1.5-flash is not found for API version v1beta`

---

## Document — Audit Compétitif OddAlerts (27 avril 2026)

Création de `oddalertscomp.md` :
- Analyse détaillée de 9 fonctionnalités principales d'OddAlerts
- Tableau comparatif PariScore vs OddAlerts (17 critères)
- Identification des avantages compétitifs de PariScore (Power Score IA, UI premium)
- Roadmap d'amélioration priorisée sur 3 mois
- Recommandations stratégiques : filtres avancés, profit calculator, alertes temps réel

---

## Update — CLAUDE.md : TODOLIST Post-Audit (27 avril 2026)

Ajout de la section "15. TODOLIST — Améliorations Post-Audit OddAlerts" dans CLAUDE.md :
- 🔥 **P0 Quick Wins** (Semaines 1-4) : filtres avancés, profit calculator, alertes temps réel, page backtesting
- 🟡 **P1 Majeures** (Semaines 5-8) : dropping odds, Power Score V2, dashboard alertes, favoris
- 🔮 **P2-P3 Long Terme** (Mois 2-3) : in-play live, bet tracking, API publique, SQLite, monétisation
- Objectifs 3 mois : 100+ utilisateurs, 10+ Pro payants, accuracy >65%
- Positionnement stratégique : "PariScore = OddAlerts francophone avec IA explicative"

---

## Feature — Radar Chart Attributs (BeSoccer-style) (27 avril 2026)

Ajout d'un diagramme radar dans le modal Power Score pour comparer visuellement les attributs des deux équipes :

**Attributs calculés (sur 100) :**
- **Rating** : basé sur PPG (Points Par Gain)
- **Attack** : moyenne de buts marqués
- **Squad** : pourcentage de victoires (qualité effectif)
- **Goalkeepers** : inverse des buts encaissés
- **Defense** : inverse de la moyenne de buts concédés
- **Midfield** : contrôle (combinaison draws + wins/2)

**Implémentation :**
- Chart.js radar type avec 2 datasets (home/away)
- Couleurs : vert (home), bleu (away) avec transparence 15%
- Thème dark intégré (grille, labels, tooltips)
- Légende en bas avec points circulaires
- Canvas 400×280px responsive

**Position :** Entre "Power Score" et "Probabilités" dans le modal.

**Fonction :** `renderTeamRadar(m)` — calcule et affiche le radar basé sur `m.stats.home` et `m.stats.away`.

**Design inspiré de :** BeSoccer.com (diagramme ATTRIBUTS à 6 axes).

---

## Feature — Bouton APT + Modal Attributs Dédié (27 avril 2026)

### Contexte
Suite à un problème de quota Gemini (HTTP 429), l'utilisateur ne voulait plus que le radar chart soit exclusivement dans le modal Power Score IA (✦).

### Solution : Séparation des préoccupations
Création d'un **bouton APT séparé** (Attributs) à côté du diamant bleu (✦) :
- **✦ (diamant bleu)** → Power Score IA (Gemini) — payant, analyse complète
- **APT (violet)** → Attributs radar uniquement — gratuit, instantané, sans API

### Implémentation

**HTML :**
- Nouveau bouton `.apt-btn` dans chaque ligne du tableau (à côté de `.ai-btn`)
- Nouveau modal `#attributes-modal` avec canvas `#attr-radar-chart`

**CSS :**
- `.apt-btn` : violet (#ab47bc), taille 9px, font-mono, hover scale
- `#attributes-modal` / `#attributes-panel` : style identique au modal Gemini

**JavaScript :**
- `openAttributesRadar(idx)` : ouvre le modal, remplit titre/date, appelle renderAttributesRadar()
- `closeAttributesRadar()` : ferme le modal
- `renderAttributesRadar(m)` : identique à renderTeamRadar mais utilise `#attr-radar-chart`
- Suppression de `renderTeamRadar(m)` dans `renderPowerScore()` (plus dans modal Gemini)
- Suppression section "Team Attributes Radar" du modal Power Score

### Avantages
1. **Gratuit** — pas d'appel Gemini, utilise seulement les stats existantes
2. **Instantané** — pas de loading, s'affiche immédiatement
3. **Indépendant** — fonctionne même si Gemini est en quota exceeded
4. **Séparation claire** — ✦ = IA avancée, APT = stats visuelles basiques

### Position
Colonne Actions du tableau → **✦ APT** (deux boutons côte à côte)

### 🛠 Diagnostic technique - 28 Avril 2026
- **Spider Chart (Radar) :** Identification de la cause du radar vide (absence de data dans l'objet `stats`).
- **Data Mapping :** Définition des 6 axes requis provenant des `/standings` d'API-Football.
- **Requête :** Nécessité de forcer le rafraîchissement des statistiques côté serveur pour peupler `database.json`.

---

## Session du 28 avril 2026 — Refonte IA + Expansion Ligues + Fixes

### 1. Refonte Assistant Scout IA (Gemini)

**server.js — Proxy `/api/v1/gemini` :**
- Injection automatique de `safetySettings: BLOCK_NONE` sur les 4 catégories (Harassment, Hate Speech, Sexually Explicit, Dangerous Content) — évite les faux-positifs sur les stats sportives
- Injection de `generationConfig.response_mime_type: "application/json"` — force Gemini à retourner du JSON pur sans backticks ni texte parasite

**server.js — `generateAIScout()` :**
- Même `safetySettings` + même `response_mime_type` appliqués
- Nouveau prompt rôle "Expert en mathématiques appliquées au sport" avec vocabulaire scientifique (λ Poisson, écart statistique, indice de stabilité)
- Constante `GEMINI_SAFETY_SETTINGS` partagée entre le proxy et l'AI Scout

**pariscore.html — `callGemini()` :**
- Nouveau rôle : "Tu es l'expert en mathématiques appliquées au sport de la plateforme PariScore"
- Vocabulaire : "Écart statistique (edge)" remplace "Edge value bet", "λ domicile" remplace "Expected Goals dom"
- Nouveau format JSON de sortie : `top_5_opportunites` avec les clés :
  - `1_indice_stabilite` (🔒 Safe)
  - `2_croissance_fonds` (📈 Value)
  - `3_ecart_statistique` (💎 Value Bet)
  - `4_indice_speculatif` (⚡ Risqué, champ `score_estime`)
  - `5_analyse_finesse` (🎯 Finesse)

**pariscore.html — `renderPowerScore()` :**
- Lit `j.top_5_opportunites || j.top_5_paris` (rétrocompatible avec ancienne structure)
- `parisConfig` mis à jour avec les 5 nouvelles clés + maintien des 5 anciennes en fallback

---

### 2. Fix Spider Chart (Radar APT)

**Cause réelle :** `Chart.js` n'était pas chargé dans le HTML — `new Chart()` appelait une fonction undefined.

**Corrections :**
- Ajout du CDN `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js">` dans `<head>`
- `maintainAspectRatio: false` dans `renderAttributesRadar()` pour remplir correctement le conteneur `height:360px`
- Les 6 axes (Rating, Attack, Squad, Goalkeepers, Defense, Midfield) s'appuient sur `m.stats.home/away` avec fallback `simStats()`

---

### 3. Colonne "Score ≈" dans le tableau des matchs

- Nouvelle colonne entre xG et les cotes (1/N/2)
- Affiche le score le plus probable calculé par Poisson : `1-0 (14%)` en vert (grand)
- Les 3 scores suivants en petit : `2-0(11%) 0-0(9%) 1-1(8%)`
- Données déjà disponibles dans `poisson.topScores` — zéro appel API supplémentaire
- En-tête marqué `Score ≈` (`rowspan="2"`) avec tooltip "Score le plus probable selon Poisson"

---

### 4. Expansion du Catalogue — `leagues_config.json`

Nouveau fichier de configuration des ligues extrait de `server.js` :

| Type | Ligues | cron_hours |
|------|--------|-----------|
| T1 Europe | Ligue 1(61), PL(39), CL(2), LaLiga(140), Bundesliga(78), SerieA(135), EL(3), CEL(848) | 6h |
| T1 Monde | MLS(253), Brasileirão(71), J1(98), K-League(292), Saudi Pro(307) | 12h |
| T2 Europe | Championship(40), Ligue 2(62), 2.Bundesliga(79), Serie B(136), Segunda(141) | 12h |

**server.js — Chargement dynamique :**
- `SPORT_LABELS`, `ALL_SPORTS`, `ALL_LEAGUE_IDS` construits depuis `leagues_config.json` au boot
- Fallback intégré si le fichier est absent (7 ligues par défaut)
- `fetchStats()` : démarre avec `ALL_LEAGUE_IDS` puis complète avec les IDs découverts via fixtures

**Résultat :** 141 matchs disponibles (vs ~43 avant) couvrant 16 ligues actives

---

### 5. Fix critique — Saison API-Football (plan gratuit)

**Problème :** `currentSeason()` retournait 2025 (avril 2026, mois < 7). Le plan gratuit API-Football ne donne accès qu'aux saisons 2022-2024 → `response: []` → 0 équipes → tous les matchs en mode SIM.

**Correction dans `fetchStats()` :**
- Détection de l'erreur `errors.plan` dans la réponse standings
- Fallback automatique : `activeSeason--` puis nouvel appel avec la saison précédente
- Log explicite : `Plan gratuit — saison 2025 non accessible, bascule sur 2024`

**Résultat après fix :** 158 équipes LIVE chargées, badges LIVE dans le tableau

---

### Fichiers modifiés
| Fichier | Modifications |
|---------|--------------|
| `server.js` | Proxy Gemini (+safetySettings+mime_type), GEMINI_SAFETY_SETTINGS, chargement leagues_config.json, fetchStats() saison fallback |
| `pariscore.html` | callGemini() prompt scientifique, renderPowerScore() top_5_opportunites, Chart.js CDN, maintainAspectRatio, colonne Score ≈ |
| `leagues_config.json` | Nouveau fichier — 18 ligues configurées T1/T2 |
| `CLAUDE.md` | Sections 16 et 17 marquées [x] |

---

## [2026-04-28] — Version 4.0 "Elite Stats"

### Ajouté
- **Modal "PariScore Insights"** : hub de statistiques ultra-complet ouvert via bouton `STATS` dans le tableau des matchs.
  - 4 onglets : **Résumé** (forme, barres comparaison, marchés Poisson, notes par secteur) | **Stats Équipe** (tirs, dom/ext, records, pénaltys, discipline) | **Joueurs** (buteurs/passeurs par équipe, MVP ★, top ligue) | **Classement** (interactif avec filtres).
- **Route backend** `GET /api/v1/insights/:matchId` — fusionne stats équipe, stats avancées, top buteurs et classement en une seule réponse.
- **`calculatePoisson(lH, lA, max)`** — fonction nommée côté serveur retournant la matrice brute de probabilités (alias de `computePoisson`).
- **Pilier 2 — Tirs** : `shots_on_home/away`, `shots_total_home/away` extraits de `/teams/statistics` et affichés dans l'onglet Stats.
- **Pilier 5 — Discipline** : `cards_yellow_total`, `cards_red_total`, `clean_sheet_home/away/total` extraits et affichés.
- **Pilier 6 — xG Différentiel** : calcul `λ_home − λ_away` affiché sous les barres de comparaison avec label favori Poisson.
- **Pilier 7 — Team MVP** : joueur avec le meilleur rating mis en avant (badge ★ MVP, card surlignée or) dans l'onglet Joueurs.
- **Pilier 8 — Notes par Secteur** : barres Attaque/Défense (0-10, colorées vert/orange/rouge) calculées depuis `avgScored`/`avgConceded`.
- **Pilier 9 — Classement dynamique** : 3 modes (Global / Dom. / Ext.) + tri multi-critères (Points / Buts+ / Buts- / Cartons) via `insSetStandingsMode()` / `insSetStandingsSort()`.

### Amélioré
- `fetchTeamAdvancedStats()` enrichi : +10 nouveaux champs (shots, cards, clean_sheets, goals_total_avg).
- Standings dans `/api/v1/insights` : +18 champs home/away split pour le filtre dynamique côté client.
- Algorithme IA hybridé avec la Distribution de Poisson pour une précision accrue des marchés.

### Non implémenté (roadmap P2)
- **Pilier 4 — Corners** : non disponible dans `/teams/statistics` → requiert `/fixtures?team=&last=10` (budget API, reporté).

---

## [2026-04-28] — Bugfixes Modals (v4.0.1)

### Corrigé
- **Bug critique — mauvais match dans les modals** : `openInsights`, `openGemini`, `openScoreMatrix`, `openAttributesRadar` utilisaient `allMatches[idx]` où `idx` était l'index dans le tableau **filtré**. Quand un filtre ligue ou jour était actif, cliquer sur Arsenal (position 0 du filtré) chargeait `allMatches[0]` = un tout autre match.
  - **Fix** : les 4 boutons de chaque ligne passent maintenant `m.id` (identifiant stable) ; les fonctions font `allMatches.find(x => x.id === matchId)`.
- **Stats manquantes pour ligues mineures (J1, K-League…)** : quand une équipe n'est pas trouvée dans `db.teamStats` (fuzzy match échoue), `homeStats` est null → onglet Résumé affichait uniquement xG, sans PPG/Victoires/Buts.
  - **Fix** : fallback sur `d.match.stats?.home/away` (toujours présent, calculé par Poisson/simStats lors du `buildMatchRecord`).
- **Cache `advancedTeamStats` périmé (migration v4.0)** : les entrées en cache avant la v4.0 n'ont pas les champs `shots_on_total`, `cards_yellow_total`, etc. → onglet Stats Équipe affichait des sections vides même pour des équipes avec données LIVE.
  - **Fix** : `fetchTeamAdvancedStats` détecte l'absence de `shots_on_total` et invalide l'entrée → re-fetch automatique au prochain appel.

---

## [2026-04-29] — Migration SQLite (v4.3)

### Ajouté
- **`better-sqlite3`** : seule dépendance npm introduite — SQLite natif synchrone pour Node.js.
- **`pariscore.db`** : fichier SQLite unique remplaçant `database.json`, `history.json` et `ai_cache.json`.
- **WAL mode** (`PRAGMA journal_mode = WAL`) : lecteurs et écrivains ne se bloquent plus mutuellement — critique pour le Smart Polling live 60s.
- **Transactions atomiques** : `saveDB()` écrit toutes les clés en une seule transaction — fin des corruptions partielles si le serveur crash mid-write.
- **Couche KV SQLite** : `initSQLite()` + `kvGet(key)` + `kvSet(key, value)` + `kvSetBatch(entries)` — abstraction propre que le reste du code n'a pas besoin de connaître.
- **Migration one-shot automatique** : au premier démarrage, `loadDB/History/AICache()` détectent les anciens JSON, les importent dans SQLite, puis les renomment en `.migrated`.

### Modifié
- `saveDB()` : `fs.writeFile()` → `kvSetBatch()` transactionnel (5 clés : `db_matches`, `db_team_stats`, `db_adv_stats`, `db_top_scorers`, `db_meta`).
- `loadDB()` : `fs.readFileSync()` → `kvGet()` par clé + migration automatique si ancien JSON présent.
- `saveHistory()` / `loadHistory()` : idem → clés `history_matches`, `history_accuracy`.
- `saveAICache()` / `loadAICache()` : idem → clé `ai_cache`.
- `initSQLite()` appelé en premier dans la séquence de boot, avant `loadDB()`.
- `BLOCKED_FILES` : ajout de `pariscore.db` (protégé en HTTP 403).

### Architecture
- L'objet `db` en mémoire est **inchangé** : zéro refactoring des 91 accès `db.*` dans server.js.
- La contrainte "zéro dépendance npm" est levée pour `better-sqlite3` uniquement (requis par l'upgrade plan PRO API-Football + Smart Polling live).

---

## [2026-04-29] — Quick Wins UX + Inspiration Datafoot (v4.2)

### Ajouté
- **Sparklines de forme** : mini-graphe SVG (W=haut / D=milieu / L=bas) affiché à côté de chaque équipe dans la colonne Match — `formSparkline(form)` généré côté client, dot coloré sur le dernier résultat.
- **Système de favoris ★** : bouton étoile sur chaque ligne du tableau, persisté en `localStorage` (`ps_fav`). Filtre "★ Favoris" dans la barre Edge pour afficher uniquement les matchs étoilés.
- **Badges de match count sur filtres Jour** (inspiration Datafoot "Planning view") : "Aujourd'hui (8)", "Demain (5)" — le count est calculé à chaque `renderMatches()` et mis à jour dynamiquement.
- **Onglet Graphique** dans le modal Insights : évolution de forme SVG pour les deux équipes (lignes + dots colorés W/D/L) + barres de bilan de saison (V/N/D en %) avec PPG. Zéro appel API supplémentaire.
- **Accuracy pills** dans la status bar : indicateurs de précision backtesting (O2.5/BTTS/Edge) affichés sous forme de badges colorés (vert ≥65%, orange ≥55%, gris sinon) à la place du texte brut.
- **Badges de zone** dans Rankings : #1-4 bleu (CL) / #5-6 vert (Europa) / 3 derniers rouge (Relégation) — classe CSS `.rk-zone-cl/.rk-zone-el/.rk-zone-rel` sur `.rk-num`.
- **Mobile compact** : `@media (max-width:768px)` masque Nuls, Défaites et xG pour réduire la largeur du tableau.
- **`home_form`/`away_form`** dans `buildMatchRecord` (server.js) : la chaîne de forme de chaque équipe est désormais transmise dans la réponse `/api/v1/matches` et utilisée par les sparklines.

### Source d'inspiration
- Audit Datafoot.fr (datafoot.fr/access/fr/) : Planning view (match counts), form graphs, accuracy rate prominent

---

## [2026-04-28] — Classement Dynamique Rankings/Standings (v4.1)

### Ajouté
- **Onglet Classement refactorisé** : deux vues switchables **Rankings** (liste) et **Standings** (tableau), inspirées de l'image de référence BeSoccer/SofaScore.
- **Vue Rankings** : liste numérotée `# | Équipe [H/A] | Valeur | Barre de progression` ; barres colorées (bleu = domicile, violet = extérieur, bleu semi-transparent = autres équipes).
- **Sélecteur de critère** : dropdown PPG / Buts+ / Buts- / Cartons (tri instantané côté client, zéro appel API).
- **Filtre temporel** : dropdown Saison / L5 / L10 / L25 — PPG L5/L10/L25 calculé depuis la chaîne `form` (ex: "WWDLW") ; autres stats affichent la saison avec note explicative.
- **Filtre de lieu** : dropdown Global / Domicile / Extérieur (recalcul des valeurs home/away split).
- **Badges H/A** : équipes du match mises en évidence par badge coloré et texte en gras dans les deux vues.
- Nouvelles classes CSS : `.rk-controls`, `.rk-view-tabs/.rk-view-tab`, `.rk-select`, `.rk-list/.rk-row`, `.rk-num/.rk-name/.rk-val/.rk-bar`, `.rk-badge-H/.rk-badge-A`.

### Modifié
- Variables JS : `insStandingsSort` supprimé → remplacé par `insRankingStat` + `insRankingPeriod` + `insTablesView`.
- Setters : `insSetStandingsMode/Sort` → `insSetMode`, `insSetTabView`, `insSetRankStat`, `insSetRankPeriod` (tous via `_rebuildClassement()`).


## [2026-04-30] - Session Matin (Audit & IA)

### Added
- Lancement et finalisation de l'audit comparatif (`auditintegrationIA.md`) incluant MatchonAI, OddAlerts, ScoutingStats et TNNS Live[cite: 1, 2].
- Définition du "Master Prompt" Expert Data Science pour le futur chatbot PariScore[cite: 1].
- Configuration des MCP `firecrawl` et `odds-api` pour le support de la recherche web en direct[cite: 1].
- Planification de l'architecture de streaming (SSE) pour l'analyse de matchs en temps réel[cite: 1].

### Changed
- Mise à jour de la roadmap `CLAUDE.md` pour prioriser l'intégration de l'IA et du Power Score V2[cite: 1, 2].

## [2026-04-30] - Session Matin (Status: Ongoing)

### Added
- Début de l'audit concurrentiel sur l'intégration de l'IA (MatchonAI, OddAlerts, TNNS Live)[cite: 1, 2].
- Initialisation du fichier `auditintegrationIA.md`[cite: 1].

### Changed
- **Priorité redéfinie** : La prospection comparative et l'analyse des chatbots concurrents sont placées en tête de liste pour la session de 15h20[cite: 1].
- Le développement technique (SSE/Chatbot) est suspendu jusqu'à la finalisation complète de l'audit.


