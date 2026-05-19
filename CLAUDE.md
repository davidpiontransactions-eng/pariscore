# 🏟️ PariScore - Poste de Pilotage (v9.8.1 Mes Paris — Plan + Import + Sport)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO & Lead Data Scientist (Quant)** de PariScore.
- **Posture** : Expert en modélisation mathématique et en algorithmique prédictive. Tu ne crois qu'aux statistiques dévigées et aux modèles calibrés.
- **Rigueur Scientifique** : Aucun modèle n'est mis en production sans calcul d'Intervalle de Confiance (UQD). 
- **Recrutement** : Si l'architecture requiert une expertise en Machine Learning ou en scraping temps réel complexe, déploie un agent dédié.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES
1. **PROTOCOLE DE CLÔTURE (OBLIGATOIRE)** :
    *   **Archivage** : Transférer les algorithmes validés et les résultats de backtest dans `ARCHIVE_PROJECT.md`.
    *   **Nettoyage** : Purger `CLAUDE.md` pour maintenir l'efficacité.
    *   **Innovation** : Proposer 3 nouvelles pistes d'optimisation de l'Edge.
2. **Performance Backend** : Les calculs bayésiens et les itérations Bootstrap ne doivent pas bloquer le thread principal de Node.js (utiliser des Workers ou optimiser la complexité temporelle).

## 🚀 ROADMAP QUANTITATIVE (SESSION EN COURS)

### ✅ v7.1 — FIX CRITIQUES (COMPLÉTÉ)
- [x] **Init Boot Gate** : `bootInit()` IIFE + `serverReady` flag → API bloquée 503 tant que données non prêtes.
- [x] **Loading Black Hole** : `server.listen()` démarre immédiatement. `bootInit()` background + timeout 30s. Fallback cache SQLite si API échoue. SSE `system_ready` émis.
- [x] **Ghost Cleanup** : Double purge FT/AET/PEN + elapsed>120m avec SSE push.
- [x] **Forme L5 Asymétrique** : `getForm()` 3 niveaux (direct → fuzzy → prefix fallback) pour les 2 équipes.
- [x] **Crash Guards** : NaN guard possession + null-check tbody#vb-body.
- [x] **Filtres Kickoff** : [Tous], [<30min], [<1h], [<2h], [<6h], [<12h] en minutes.
- [x] **Filtres Pays→Ligues** : Navigation hiérarchique Oddalerts style. Pays → ligues + "🔙 Retour". 25 pays.
- [x] **Dual Scrollbar** : `#top-scrollbar` + `#top-scroll-content`. Sync bidirectionnelle `scrollLeft` + width update.
- [x] **Frontend Retry** : 503 → retry 2s. SSE `system_ready` → force reload. Erreur réseau → retry auto.

### ✅ v9.8.1 — MES PARIS — Plan 20%/jour + Import sécurisé + Sport (COMPLÉTÉ)
- [x] **Plan bankroll** : table `bankroll_plan` (capital départ 300€, target_pct 20/jour, split 50% banque / 50% capital, start_date 2026-05-12, floor optionnel). Routes `GET/PUT /api/v1/bankroll/plan` + `GET /bankroll/daily-tracker` (compound + split + écart cible par jour).
- [x] **Onglet "Plan 20%/jour"** : KPI row (capital départ/actuel/banque/total/cible/écart) + table jour-par-jour avec statut cible.
- [x] **Bookmakers ANJ + 1xbet** : 11 books — 1xbet, Winamax, Betclic, Unibet, PMU, Parions Sport, ZEbet, NetBet, Vbet, Genybet, PartoucheSport. Dropdowns dans bet-modal, cash-modal, import-modal, filtre. `normalizeBookmaker()` côté serveur.
- [x] **Colonne sport** : 15 sports (football, basketball, tennis, rugby, hockey, baseball, mma, boxe, cyclisme, formula1, volleyball, handball, esports, golf, autre). `ALTER TABLE user_bets ADD COLUMN sport TEXT DEFAULT 'football'` idempotent. Emoji par sport en table, filtre dédié, normalisation alias serveur.
- [x] **Import CSV sécurisé** : route `POST /api/v1/bets/import` exige **JWT + reverify_token** (token 5 min single-use issued by `POST /api/v1/auth/reverify` après re-confirmation mdp). CSV parser flexible (auto-détecte 10 alias colonnes, séparateur `,`/`;`/`\t`, dates DD/MM/YYYY + ISO). Dry-run mode pour preview. Dédup via `external_ref`. Audit log table `bet_import_audit` (user_id, ip, user_agent, filename, rows_parsed/inserted/skipped).
- [x] **UI Import** : modal 2-step (re-verify mdp → upload fichier OU paste CSV + dry-run/commit), tag "IMP" sur paris importés.
- [x] **Bug TZ corrigé** : `computeDailyTracker` utilise `Date.UTC()` pour parser `start_date` (évite décalage local).
- [x] **Migration ALTER** : pragma table_info check avant ALTER (idempotent sur DB existante).

### ✅ v9.8 — MES PARIS — Bet Tracking 1xbet (COMPLÉTÉ)
- [x] **Schéma SQLite** : `user_bets` (status pending/won/lost/void/cashout/half_won/half_lost + payout_cents) + `bankroll_transactions` (deposit/withdrawal/adjustment).
- [x] **Routes CRUD** : `/api/v1/bets` (GET/POST/PATCH/DELETE), `/bets/:id/settle`, `/bets/suggest-settlement/:id`, `/bets/kelly`, `/bets/export.csv`, `/bankroll/tx` (GET/POST/DELETE), `/bankroll/summary` (synthèse complète + daily_series).
- [x] **Page `Mes Paris`** dans nav SPA : 8 KPI tiles (Bankroll/Disponible/P&L/ROI/WinRate/Drawdown/Ouverts/Streak), chart Chart.js bankroll réelle (#29b6f6) + markers dépôts/retraits (triangle vert/rouge), 3 tabs (Paris ouverts / Historique / Trésorerie), filtres (statut/bookmaker/marché/équipe/date).
- [x] **Modals** : Nouveau pari (autocomplete matchs + Kelly helper Full/Half/Quarter, défaut Full Kelly 1.0, cap 25%), Règlement (suggestion auto si match archivé verified + bandeau "Accepter"), Dépôt/Retrait.
- [x] **Kelly** : `computeKellyFraction(prob,odds,cap)` + `suggestStakeCents(bankrollCents,prob,odds,mult,cap)`. Default mult=1.0 (Full Kelly), cap=0.25.
- [x] **Hook archive** : `archivePastMatches` flag les paris pending sur match archivé via `updated_at`, bande jaune `.bet-row-suggest` côté UI.
- [x] **Export CSV** : OWASP injection guard (préfixe `'` si cellule commence par `= + - @`), Content-Disposition attachment, blob download avec Bearer.
- [x] **Alias `/api/v1/bankroll/simulated`** : route simulée renommée explicitement (marketing), `/api/v1/bankroll` reste comme legacy 1 release.
- [x] **Sécurité multi-user** : `requireUserAuth` (exige user.userId), `WHERE user_id = ?` sur 100% des queries.
- [x] **Devise** : INTEGER cents partout, formatter unique `centsToEur`.
- [x] **Drawdown** : 2 métriques — `max_drawdown_pct` (raw bankroll curve) + `raw_drawdown_pct` (risk DD sur cumul P&L paris seuls).

### ✅ v9.7 — LIVE DANGER MATRIX (COMPLÉTÉ)
- [x] **Suppression Événements** : Panneau "Événements" (textuel, instable) supprimé HTML/CSS/JS.
- [x] **Danger Matrix** : Grille 2x2 — Tirs Cadrés, Corners, Attaques Dang., Possession.
- [x] **Barres Comparatives** : Progress bars Domicile (vert) vs Extérieur (violet).
- [x] **Backend Cleanup** : `incidents` retiré des réponses BSD + API-Football live.

### ✅ v9.6 — BULLETPROOF BODY LOCK (COMPLÉTÉ)
- [x] **Body Lock** : `position: fixed` + `top: -scrollY` — physiquement impossible de scroller.
- [x] **Body Unlock** : Restauration exacte de la position du scroll à la fermeture.
- [x] **Scroll Tracking** : `window.addEventListener('scroll', ...)` met à jour `--scroll-y`.
- [x] **Anti-CLS** : Chart containers `min-height:300px; height:300px; position:relative`.
- [x] **Canvas Absolute** : Canvas en `position:absolute` avec dimensions calculées.

### ✅ v9.5 — NAVIGATION FIX (COMPLÉTÉ)
- [x] **Root Cause** : Double déclaration `let ldXGChart` → SyntaxError → crash script → menu non cliquable.
- [x] **Mur de Verre** : `closeLiveDetail` force `pointer-events: none` + timeout restaurateur.
- [x] **Isolation Events** : `e.preventDefault()` dans try/catch séparé, ne remonte pas au menu.
- [x] **Crash Guards** : Try/catch sur openLiveDetail, closeLiveDetail, et render fallback.

### ✅ v9.4 — LIVE TRACKER 2.0 (COMPLÉTÉ)
- [x] **Anti-Scroll** : `e.preventDefault()` + `e.stopPropagation()` sur tous les clics Live.
- [x] **Body Lock** : `document.body.style.overflow = 'hidden'` à l'ouverture, restauré à la fermeture.
- [x] **Theater Mode** : Glassmorphism (`backdrop-filter: blur(8px)`) + animation fade & slide up.
- [x] **Pulse-danger** : Bouton LIVE pulse rouge si intensity > 25.
- [x] **Pressure Index** : Jauge dynamique 0-100 (momentum + tirs + xG bias + possession).
- [x] **Live Edge** : Détection value bet en live — alerte visuelle si edge > 10%.
- [x] **Memory Management** : `chart.destroy()` + `clearInterval()` à la fermeture.
- [x] **Polling Adaptatif** : 15s (75'+), 30s (2ème MT), 60s (1ère MT).
- [x] **Chart.js Focus Fix** : `animation: {duration:300}` + `events` limités pour éviter scroll.

### ✅ v9.2 — DEEP MAPPING FIX (COMPLÉTÉ)
- [x] **Root Cause** : `buildSideStats` extrayait l'objet `goals.for` au lieu du nombre → NaN.
- [x] **Dual Format** : `extractGoals()` gère API-Football (imbriqué) ET BSD (plat).
- [x] **Schema Validation** : `validateMatchIntegrity` vérifie types (`typeof !== 'number'`).
- [x] **Debug Logging** : `[DATA MAPPING]` logs pour tracer l'extraction.
- [x] **Migration** : `fix-matches.js` patch les records existants + fuzzy matching amélioré.
- [x] **Vérification** : Lille 1.59/1.09, Le Havre 0.94/1.34, Midtjylland 2/0.75.

### ✅ v9.1 — CRASH SYSTEM FIX (COMPLÉTÉ)
- [x] **Anti-Crash** : `unhandledRejection` + `uncaughtException` handlers → server ne crashe plus.
- [x] **ID Validation** : Toutes les routes vérifient `!id || 'undefined' || 'null'` avant fetch.
- [x] **Promise.allSettled** : Insights route (8 fetches) + deep-stats (ratings/squad) résilients.
- [x] **Purge SIM** : Badge "SIM" → "PRE", message classement corrigé.
- [x] **UI Lockdown** : Plus de "999h"/"Calcul en cours..." — spinner bloquant jusqu'à données valides.
- [x] **Error UI** : Après 3 retries → message propre "fournisseurs indisponibles".

### ✅ v9.0 — INTÉGRITÉ DES DONNÉES (COMPLÉTÉ)
- [x] **Validation Contenu** : `validateMatchIntegrity()` — NE JAMAIS marquer FULL si stats/ratings à 0.
- [x] **Statut FAILED_INTEGRITY** : Matchs incomplets reprogrammés automatiquement (retry 60s).
- [x] **Fatigue Fallback** : `computeFatigueIndex` scan `archive_matches` si 999h (pas de match récent).
- [x] **Anti-Zero Poisson** : Calcul bloqué si expHome=0 ET expAway=0 → erreur explicite.
- [x] **UI Integrity Check** : `openInsights()` reste sur loader + POST `/api/v1/force-hydrate` si stats à 0.
- [x] **999h UI Fix** : Remplacé par "Calcul en cours..." au lieu de "999h".
- [x] **Route Force-Hydrate** : `POST /api/v1/force-hydrate/:id` avec re-validation intégrité.
- [x] **Test Script** : `test-integrity.js` — audit FULL matchs, repasse en PENDING si stats à 0.

### ✅ v8.9 — HYDRATATION TOTALE (COMPLÉTÉ)
- [x] **Route Deep-Stats** : `/api/v1/deep-stats/:id` Full-or-Nothing — bloque jusqu'à données complètes.
- [x] **isMatchReady()** : Validation ratings + squad + poisson avant réponse.
- [x] **Historical Fallback** : `getHistoricalAvgGoals()` scan 5 derniers matchs terminés → fini les stats à 0.
- [x] **Loader Progressif** : Frontend 45s timeout avec barre de progression visuelle.
- [x] **Rendu Garanti** : Render QUE si stats non nulles (avgScored > 0 OU poisson.over25 > 0).

### 🧠 P0 : BAYESIAN VALUE RADAR (Le Cœur du Réacteur)
- [ ] **Data Blending** : Implémenter le `Bayesian Model Blender` fusionnant Poisson Bivarié, Elo dynamique et xG Logistic.
- [ ] **Calibration** : Écrire le script de calibration sur l'historique des 500 matchs (fiabilisation des probabilités extrêmes).
- [x] **Dévigage (Devigging)** : Shin-Hurley déjà implémenté dans `devig1X2()`.
- [x] **UI EV%** : Colonne EV déjà présente dans le tableau.

### ⚡ P1 : CONFIDENCE SCORE & UQD (Uncertainty Quantification)
- [ ] **Bootstrap UQD** : Mettre en place 500 itérations Bootstrap pour calculer l'Intervalle de Confiance (IC 90%) sur chaque match.
- [ ] **Score Composite** : Calculer un score de fiabilité sur 100 (Volume Data + Stabilité xG + Calibration).
- [ ] **Règle de Décision Stricte** : Modifier le Rapport Expert pour n'afficher "BET" que si EV > 5% ET borne inférieure IC > 0.

### 🎯 P2 : CONTEXT-ADJUSTED LIVE SNIPER
- [ ] **Poisson Time-Inhomogène** : Remplacer le Poisson statique du Live par un modèle conditionnel se réajustant minute par minute.
- [ ] **Context Engine** : Connecter des flux de données secondaires (Météo, Arbitres, Kilométrage) pour ajuster le xG dynamique.
- [ ] **Alertes SSE** : Créer des triggers "favorite_trap" et "goal_flood" pour envoyer des notifications push au front-end.

## 🏗️ ARCHITECTURE & STACK (Data Science)
- **Backend** : Node.js (Vanilla), SQLite3, SSE.
- **Math Engine** : Fonctions d'algèbre et de probabilité optimisées en JS natif.
- **Limites** : Attention à l'usage de la RAM lors des 500 itérations Bootstrap (optimisation mémoire exigée).

---
*Dernière mise à jour : Version 10.71 — Colonne « Bets Prédictifs / 2e ligne conseillés » onglet Tennis. server.js `computeTennisPredictiveBets(e)` : moteur PredScore composite (avec cote 0.45·normEV + 0.35·Confiance + 0.20·Accord Elo/BSD ; sans cote 0.55·proba + 0.45·Confiance), 6 marchés candidats (ML, Set1, Score sets exact, ≥1 set Markov, Total jeux O/U, King of Aces), top 3 + verdict directif BET FORT (EV>5 & IC bas>0 & badge vert) / VALUE / PASS. Confiance = confidence_badge.accuracy, ×0.8 si ml_market_div HIGH, ×0.6/×0.8 échantillon faible. 100 % dérivé buildTennisValueBets, zéro nouvelle source réseau. Champ `predictive` ajouté à l'enrichi VB + `toCanonicalTennisMatch` (/board). Frontend pariscore.html : colonne insérée APRÈS Match (onglet VB 15→16 col) + colonne dédiée onglet Live (8→9 col) ; `_tvbPredictiveCell` (badge KPI + 3 chips), `tnLiveBets` (signaux modèle re-conditionnés au score `_live` : winner ±15/set, set en cours selon serveur, comeback ≥1 set ou total jeux), `tnLiveBetsFromScore` (heuristique score pur ESPN/LiveScore onglet Live), `patchTennisLive` rafraîchit `data-tn-pred` 30s. Vérifié : node --check server.js OK + build 200 matchs zéro erreur/exception + test unitaire fonctions pures (prematch top3+verdict, live re-pricing, onglet Live) tous corrects. ⚠️ Upload server.js + pariscore.html VPS + pm2 restart. v10.70 — Tri PowerScore onglet Tennis. Nouvelle option tri `#tennis-vb-sort` value `powerscore` (colonne 7 Forme/PowerScore) : score match = max(PowerScore J1, J2), tri décroissant meilleur→moins bon, PS absent renvoyé en bas (-1). Case ajouté dans le switch de `renderTennisValueBets`. Vérifié preview : option présente, ordre exact C(88)→D(72)→A(55)→null via vrai render path, zéro erreur console. ⚠️ Upload pariscore.html VPS + pm2 restart. v10.69 — Voie D : scaffold Transfermarkt via Apify (zero-dep). server.js `_apifyRunSync` (helper générique run-sync-get-dataset-items, httpsPost), `_tmBuildUrl`, `fetchTransfermarkt` (cache 24h, pass-through défensif) + route `GET /api/v1/transfermarkt/:kind?id=&slug=` (kind ∈ profile|market_value|transfers|injuries) gate footPro. Token `process.env.APIFY_TOKEN` (jamais .env committé). Testé E2E : 503 no-token, 400 bad-kind/id, 403 unauth, full path → Apify → 403 actor-is-not-rented mappé 503 gracieux. BLOQUÉ data réelle : actor payant $15/mo Apify non loué. Parser typé à finaliser après location (W1). Voir `.context/test-report-transfermarkt-apify.md`. v10.68 — Frontend hook LiveScore onglet Tennis. `tickTennisLive` : fallback automatique BSD→LiveScore quand `/tennis/api/v2/matches/live/` vide OU en erreur (apiFetch `/api/v1/tennis/livescore/day`, mappé via `_lsMapEvents` → forme renderTennisLive, id préfixé `ls:`, tour ATP/WTA dérivé du libellé stage, is_live via `_lsIsLive`). `openTennisDetail` guard `ls:` → `_renderLivescoreDetail` (route `/api/v1/tennis/livescore/match/:eid`, table sets/jeux + tiebreak sup, zéro emoji style L'Équipe rouge #E2001A). Statut bandeau affiche source (BSD/LiveScore). Vérifié preview : JS parse OK, mapping exact, render, routing détail, 403 gracieux anon. ⚠️ Upload pariscore.html VPS + pm2 restart. v10.67 — Intégration LiveScore tennis (API publique JSON officielle). Module server.js `_lsFetch`/`_lsNormStages`/`_lsNormEvent`/`getLivescoreTennis`/`getLivescoreTennisMatch` + 3 routes Pro tennis `GET /api/v1/tennis/livescore/{day?date=YYYYMMDD,live,match/:eid}`. Base `prod-cdn-public-api.livescore.com` — **Node https natif passe (zéro CF/JA3/token, AUCUNE dépendance curl, zero-dep préservé)**, supérieur à aiscore pour le live score. Cache 5min/30s/30s. 1 bug QA corrigé (date invalide silencieusement = aujourd'hui → 400). PBP/statuts live à confirmer sur match live (W1/W3). Script GitHub Selenium scoreboard.com rejeté (obsolète). Voir `.context/test-report-livescore-tennis.md`. v10.66 — Intégration AiScore tennis Option A (sitemap-driven scrape). Module server.js `_aiscoreFetch`/`_aiscoreParseMatch`/`getAiscoreTennisIndex`/`getAiscoreMatch` + routes `GET /api/v1/tennis/aiscore/index` & `/match/:id` (gate Pro tennis, cache 5min, throttle 1req/2s). Cloudflare bloque le JA3 TLS de Node `https` → fetch via `curl` execFile (args array injection-safe, URL whitelistée, scope aiscore uniquement — seule dérogation zero-dep). 5 bugs trouvés/corrigés en QA (mediaTitle nested div, classe mainContent_1, sidePairs arg, CF 403, port test). Frontend hook = follow-up bd. Voir `.context/test-report-aiscore-tennis.md`. v10.65 — Correctif dropdown stratégies illisible (bloc desktop-filters-flat stylait .mls-opt mais pas .mls-row → rangées invisibles ; ajout règles claires alignées). v10.64 — Correctif nav laissée claire (logo PARISCORE noir illisible sur fond sombre v10.63). v10.63 Axe C « Élite Dark Trading » : nappe sombre continue desktop (console filtres + bandeau résultats + league banner = #0f172a, override 2-ids `#page-matchs #filter-console` bat le thème clair, ADN rouge L'Équipe conservé, mobile étanche, zéro JS). Suite v10.62 — Harmonisation grille desktop Option B « Ligne 100% Dark Premium » : surface ligne unifiée (override 2-ids `#vb-table #vb-body td` bat `#fff!important` clair), CONSEILS IA encastré (chrome retiré, plus de bloc flottant), pbet/forme/scores en finition néon, vertical-align middle, sans hack absolu, mobile `.mc` étanche. Suite v10.61 (propagation neon) / v10.60 (v3 flashy) / v10.59 (Fiche Quant + fix sport-hub). ⚠️ Upload pariscore.html sur VPS + pm2 restart. v10.58 : fix LIVE server.js ([LiveDBG]). Voir CHANGELOG.md.*


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
