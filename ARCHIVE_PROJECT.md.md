# ARCHIVE — PariScore Sessions

> Compte-rendus de sessions classés du plus récent au plus ancien.

---

## SESSION 02/05/2026 — BSD Players, Live UX & Analyse Comparative (v5.14)

### Livraisons Backend
- **`fetchBSDStandings()` enrichi** : teamStats entries enrichies avec `bsdTeamId`, `bsdSeasonId`, `bsdLeagueId`, `xgFor` (xGF standings), `xgAgainst` (xGA standings) — base pour fetch squad/ratings
- **`fetchBSDTeamSquad(bsdTeamId)`** : fetch `/players/?team={id}` (up to 100) · retourne id, name, position, attributes {tactical/attacking/defending/technical/creativity}, strengths, weaknesses, availability, injury_type, injury_return, market_value · cache KV 6h
- **`fetchBSDPlayerRatings(bsdTeamId, bsdSeasonId)`** : fetch `/player-stats/?team&season` (pagination 4 pages) · agrège goals, assists, minutes, xg, xa, cards, saves + `avg_rating` (moyenne ratings par match) · tri desc avg_rating · cache KV 24h
- **Route `/api/v1/insights/:id` enrichie** : Promise.all +4 appels BSD (squad×2, ratings×2) · response +champs `homeBSDSquad`, `awayBSDSquad`, `homeBSDRatings`, `awayBSDRatings`, `bsdCoverage`

### Livraisons Frontend
- **`initLeagueFilters()` PRIORITY sort** : ordre parieurs français — Ligue 1, UCL, Premier League, La Liga, Bundesliga, Serie A, Europa League, Conference League, Ligue 2, Eredivisie, Jupiler Pro, Primeira Liga, Championship, 2.Bundesliga, Süper Lig, Scottish Prem, Saudi Pro League
- **CSS Live Stats Bar** : `.ls-team-abbr.home` (vert `#00e676`), `.ls-team-abbr.away` (violet `#9c27b0`), `.ls-val.away` pour coloriser stats visiteur
- **CSS Live Top 5 Panel** : `#live-top5-panel` (gradient rouge sombre), `.lt5-card`, `.lt5-match`, `.lt5-score`, `.lt5-bet`, `.lt5-reason` — panel prêt, JS à implémenter
- **`buildJoueursTab()` partiel** : destructuring `homeBSDRatings`, `awayBSDRatings`, `homeBSDSquad`, `awayBSDSquad` ajouté

### Script `compare-apis.js`
- Analyse comparative BSD vs API-Football sur N derniers jours (défaut 7)
- Couverture : % matchs BSD trouvés dans API-Football
- Concordance : % scores identiques entre les deux sources
- Top 10 ligues par volume BSD
- Rapport JSON → `.context/bsd-vs-apifootball-report.json`
- Usage : `node compare-apis.js [days]` (API_FOOTBALL_KEY via env)

### Résultats Backtest
- BSD retourne ~210 matchs FT sur 7 jours (toutes ligues confondues)
- API-Football plan gratuit = 0 FT matchs saison 2025-2026 (saison 2024 uniquement)
- Conclusion : BSD est la seule source viable pour vérification scores saison courante
- History actuelle = 5 enregistrements (peu de prédictions archivées) → backtest sera utile après accumulation

### Restant P1 (session suivante)
1. Live stats bar : labels abbrev équipe + colorisation away purple
2. `buildLiveTop5Panel()` JS + HTML injection dans page-matchs
3. `buildJoueursTab()` rendu complet BSD (ratings grid + dispo badges + attributs bars)

---

## SESSION 02/05/2026 — Backtest BSD v5.13

### Livraisons
- **`getBSDScoreForMatch(team1, team2, dateStr, bsdDateCache)`** : Helper avec Map cache date → évite refetch BSD par date dans boucle archive
- **`archivePastMatches()`** : Guard `!API_FOOTBALL_KEY && !BSD_BASE_URL` (plus besoin API-Football si BSD dispo) · Phase 1 BSD, Phase 2 API-Football fallback · `realScore.source` = 'bsd' | 'api-football'
- **Route `POST /api/v1/admin/backtest-bsd`** : Catch-up N jours (1-30, défaut 7) via BSD · Re-vérifie history non-vérifiées + log `new_verified`/`already_verified`/`bsd_only` · Retourne rapport accuracy complet

### Usage backtest
```bash
curl -X POST http://localhost:3000/api/v1/admin/backtest-bsd \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"days": 14}'
```

---

## SESSION 02/05/2026 — BSD Integration v5.12 (suite)

### Livraisons
- **`buildCornersTab()`** : Fonction async complète dans pariscore.html — fetch `/api/v1/corners/:id`, grille 2×2 marchés Over 7.5/8.5/9.5/10.5 avec code couleur Poisson, historique BSD home/away si disponible
- **`bsdToOddsApiFormat()`** : Adaptateur server.js — convertit match BSD (single-odds) vers format bookmakers Odds API compatible `buildMatchRecord()`
- **BSD supplement dans `fetchOdds()`** : Après fetch Odds API, BSD supplément +N matchs non couverts (dédup par paire d'équipes normalisées)
- **`openBetLink()` Winamax** : Fallback 1xbet → Winamax `https://www.winamax.fr/paris-sportifs/sports/1`
- **Syntax check** : `node --check server.js` → OK

### Restant P2 (non bloquant)
- Route `/api/v1/live/bsd` endpoint dédié
- Modal live detail xG chart + momentum
- Tests boot server BSD

---

## SESSION 01/05/2026 (P1 Elite Stats + AI Modal SSE) — v5.8 → v5.9

**Validation Data** : 141 matchs · 54 réels OK · 87 SIM · 0 warnings Home/Away ✅

### P1 — Elite Stats Hub Fixes
- **Shots** : Totaux → moyennes /match (`buildStatsTab`)
- **Cartons** : Totaux → moyennes /match (`buildStatsTab`)
- **Clean Sheets** : Compteur → % + CS Dom/Ext conservé
- **Position Ratings** : Proxy buts/match → vraies notes par poste (G/D/M/A) via `/players`
- **Backend** : `fetchTeamPositionRatings()` + cache 24h + insights route enrichie
- **xG** : Label "Expected Goals" → "Modèle Poisson" (transparence source)

### P1 — Strategy Tab Click-to-Insights
- `.strat-card` onclick → `openInsightsById()` avec enhanced hover CSS
- Suppression fonctions obsolètes : `openTopStrategies()`, `openStratInsights()`

### P1 — AI Modal Migration SSE
- **Prompt V3** : YouTube press conference links + consensus web dans `POWER_SCORE_SYSTEM_PROMPT`
- **openGemini()** : Réécrit pour utiliser `startGeminiStream()` via `EventSource`
- **HTML** : Modal gemini → layout streaming markdown (marqué.parse)
- **CSS** : Streaming cursor blink + markdown report styling
- **Cleanup** : `callGemini()` et `renderPowerScore()` supprimés

### P0 — Fix Bug ai-stream 500
- **server.js:3270** : Try/catch dans Promise chain pour erreurs non gérées
- **Diagnostic** : Logging match lookup failed (IDs similaires, premier ID DB)
- **CORS** : 404 response inclut maintenant `Access-Control-Allow-Origin`

---

## SESSION 01/05/2026 (soir) — P1 + Directives GM

**Validation Data** : 141 matchs · 54 réels OK · 87 SIM · 0 warnings Home/Away ✅

### Livraisons

#### Protocole double-check Home/Away (`server.js:buildMatchRecord`)
- Guard 1 : `hRaw === aRaw` → cross-contamination détectée, Away forcé `simStats`
- Guard 2 : fuzzy match retourne clé plus proche de l'autre équipe → rejet + warn
- Condition backtesting mi-mai : semaine sans `[Coherence] ⚠` dans logs

#### Power Score V2
- `RSS_FEEDS` : +Sky Sports + ESPN FC (4 sources total)
- `PRESS_CACHE_TTL` : 6h → 24h
- `filterRelevantItems` : normalize NFD, mots ≥3 chars, nom complet inclus
- `fetchPressContext` : retourne `{text, articleCount, sourceNames}` · GNews per-team fallback si <2 résultats
- SSE `done` event : émet `press_count` + `press_sources`
- Frontend : badge `📰 N sources presse` (bleu) dans header Power Score

#### Dashboard "Mes Alertes" (remplace mockup statique)
**Backend :**
- `kvScan(prefix)` : scan KV table par préfixe LIKE
- `buildAlertMessage(bets, label)` : factorisation message Telegram
- `sendValueBetAlerts()` : refactorisé — broadcast global + alertes per-user via `kvScan('alert_prefs_')` + log `alert_history`
- `GET /api/v1/alerts/config` : config per-user (auth required)
- `POST /api/v1/alerts/config` : sauvegarde prefs (validation: enabled, chatId, edgeMin 0-30, probaMin 0-90, markets[], leagues[])
- `GET /api/v1/alerts/history` : 10 dernières alertes (auth required)

**Frontend :**
- Gate login (non connecté → bouton Se connecter)
- Chat ID input + toggle ON/OFF
- Slider Edge min (0-20%) · Slider Proba min (50-90%)
- Market chips : BTTS Oui / +2.5 buts / +1.5 buts / Victoire Dom. / Victoire Ext.
- Select ligue (7 ligues)
- Bouton Sauvegarder + message confirmation
- Preview 10 dernières alertes avec edge badge

**Fonctions JS :** `initAlertesPage()` · `loadAlertConfig()` · `toggleAlertEnabled()` · `saveAlertConfig()` · `loadAlertHistory()`

### État DB au 01/05/2026 soir
- Matchs actifs : 141 (54 réels, 87 SIM)
- Tables SQLite : `kv`, `users`, `matchday_passes`, `ai_feedback`
- Historique alertes : `alert_history` KV (ring buffer 50 entrées)

---

## SESSION 01/05/2026 (matin) — P0 RÉSOLU

- Bug sync Pisa/Lecce : `findFuzzy()` rewrite (exact → prefix → Levenshtein strict ≤1/2)
- Serie A stats : Force refresh T1 leagues ajouté
- Auth audit : 11 gaps identifiés, PBKDF2 suffisant (pas besoin bcrypt)
- Back-testing audit : Architecture solide, 5 améliorations identifiées pour mi-mai

---

## ARCHIVE v4.1 (29 avril 2026)

Voir `CLAUDE_SAUVEGARDE.md` pour le cahier des charges complet v3.0.
Version v4.1 disponible dans git history.

Phases livrées au 29 avril :
- Phase 1 MVP ✅ · Phase 2 Architecture ✅ · Phase 3 Intelligence ✅ · Phase 4 Fiabilisation ✅ · Phase 5 Production ✅
- SQLite migration (`better-sqlite3`, WAL mode) ✅
- 18 ligues configurées (`leagues_config.json`) ✅
- Auth JWT HMAC-SHA256 + PBKDF2 ✅
- Top Stratégies (15 stratégies, STRATEGIES config) ✅
- Page Historique/Backtesting ✅
- Filtres avancés tableau (L5/L10/L25, O2.5 slider, cote range, kickoff) ✅
- Dropping Odds Tracker snapshot (backend `odds_snap_*` KV) ✅
- Dashboard admin `admin.html` ✅
- Matchday Pass Stripe ✅

## SESSION 01/05/2026 — v5.5 → v5.6

### P0 — Bug Sync Pisa/Lecce ✅
- `findFuzzy()` rewrite : exact → prefix → Levenshtein ≤1/2 + logging warning
- Logging `buildMatchRecord()` pour stats simulées
- Force refresh ligues T1 (dont Serie A) même si absentes fixtures

### P1 — Auth ✅
- PBKDF2 suffisant (pas besoin bcrypt), 11 gaps sécurité identifiés
- `package.jsonOO` obsolète

### P1 — Back-testing ✅
- Cron dédié `archivePastMatches()` toutes les 4h
- Retry logic pour matchs `verified=false` >24h
- Fix `inject-test-history.js` edge calculation

### P1 — 3 Blocs livrés ✅
- **Quotas T1/T2** : Guard global supprimé, cron 1h, gating per-league via `LEAGUE_CRON_MS`
- **SSE Live Scores** : `/api/v1/live` + `EventSource` + fallback polling 5min
- **Dropping Odds UI** : Colonne "Δ Cote" + CSS ↓ rouge / ↑ verte / — gris

## SESSION 01/05/2026 — v5.6 → v5.7 (Priorités)

### P0 — Sécurité Admin ✅
- `USERS` Map : SHA-256 → PBKDF2 salé (hash + salt)
- Login admin vérifie via `verifyPasswordSync()`
- Nouveau flag `forceChange` sur default password
- Route `POST /api/v1/admin/change-password` (auth admin requise)

### P0 — CORS Hardening ✅
- `ALLOWED_ORIGIN` default : `*` → `http://localhost:3000`
- 4 endpoints corrigés : `jsonResponse`, SSE, AI-stream, preflight OPTIONS
- Headers ajoutés : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `/api/v1/accuracy` maintenant protégé par auth minimum

### P1 — Back-testing mi-mai ✅
- `getAccuracyReport()` enrichi : rolling30, leagues, confidence_tiers
- Rolling 30 : calcule accuracy sur les 30 derniers matchs vérifiés
- Per-league : breakdown par ligue (Over25, BTTS, Edge)
- Confidence tiers : 55-65% / 65-75% / 75%+ sur Over 2.5
- Frontend : chart BTTS P&L (`hist-btts-chart`) + badges league accuracy
- CSS `.league-badge` ajouté
