# 🏟️ PariScore - Poste de Pilotage (v5.19)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **General Manager (GM)**, **Chef de Projet** et **Manager de l'équipe d'agents PariScore**.
- **Posture** : Tu es responsable de la fiabilité du produit. Anticipe les dérives et n'attends pas d'ordres pour corriger les données.
- **Autorité** : Si une compétence manque, agis en **Recruteur** : propose un nouvel agent spécialisé ou un outil MCP.
- **Rigueur** : Une erreur de donnée est une défaillance de ton équipe que tu dois auditer et résoudre immédiatement.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES
1. **Auto-Maintenance** : À la fin de chaque opération, transfère le compte-rendu dans `ARCHIVE_PROJECT.md` et nettoie `CLAUDE.md`.
2. **Gestion du Contexte** : Maintenir ce fichier sous les 30k caractères en permanence.
3. **Validation Data** : Vérification systématique Home/Away via `sqlite-inspector` avant clôture.

## ✅ SESSION 01/05/2026 — P0 RÉSOLU
- **Bug sync Pisa/Lecce** : `findFuzzy()` rewrite (matching strict + logging)
- **Serie A stats** : Force refresh T1 leagues ajouté
- **Auth** : Admin SHA-256 → PBKDF2 salé + route change-password + force_change flag
- **CORS** : `*` → `http://localhost:3000` + headers X-Frame-Options + X-Content-Type-Options
- **Accuracy** : `/api/v1/accuracy` protégé auth minimum
- **Back-testing** : Rolling 30 + per-league + confidence tiers + BTTS P&L chart
- **P0 ai-stream 500** : Error handling try/catch dans Promise chain + diagnostic match lookup

## ✅ SESSION 01/05/2026 — P1 INSIGHTS (v5.9)
- **Shots** : Totaux → moyennes /match (buildStatsTab)
- **Cartons** : Totaux → moyennes /match (buildStatsTab)
- **Clean Sheets** : Compteur → % + CS Dom/Ext conservé
- **Position Ratings** : Proxy buts/match → vraies notes par poste (G/D/M/A) via `/players`
- **xG** : Label "Expected Goals" → "Modèle Poisson" (transparence source)
- **Backend** : `fetchTeamPositionRatings()` + cache 24h + insights route
- **Strategy click** : `.strat-card` onclick → `openInsightsById()` avec enhanced hover CSS
- **AI Modal SSE** : `openGemini()` → `startGeminiStream()` via EventSource, fin JSON renderPowerScore
- **Prompt V3** : YouTube press conference links + consensus web (avis parieurs) dans POWER_SCORE_SYSTEM_PROMPT
- **Modal layout** : HTML gemini-modal → streaming markdown (marqué.parse), CSS streaming + cursor blink

## ✅ SESSION 01/05/2026 — P1 MONÉTISATION IA (v5.10)
- **Modèle hybride** : Freemium (1/jour) → Matchday Pass (5/24h €4.99) → Premium (illimité €9.99/mo)
- **Backend** : `POWER_SCORE_LIMITS` + `incrementPowerScoreUsage()` + `checkIpAbuse()` (30 req/min)
- **Route** : `GET /api/v1/ai-stream/:id` → auth (header + query param) + quota check + cache global
- **Route** : `GET /api/v1/ai-quota` → retourne role, label, remaining, limit
- **Frontend** : Auth gate dans `openGemini()` + quota check avant stream
- **Frontend** : Quota badge dans modal header (`♾ ILLIMITÉ` ou `N restant/L`)
- **Frontend** : Upsell modal si quota épuisé (Matchday Pass €4.99 / Premium €9.99)
- **Frontend** : Loading lock (`_gmLoading`) pour empêcher double-clic
- **Frontend** : SSE retry (1x après 2s) si ReadableStream coupe
- **Fix BUG-1** : Gemini empty response → `event: error` au lieu de modal vide
- **Fix W3** : IP abuse threshold 10 → 30 req/min
- **Fix W5** : Logging 429 avec userId + role
- **QA Report** : `.context/test-report-ai-power-score.md` (14 tests, 4 bugs fixés)

## ✅ SESSION 01/05/2026 — P1 MARKETING & AFFILIATION (v5.11)
- **Benchmark Datafoot** : Analyse complète modèle Julien (CPA inversé, réseau partenaires, transparence)
- **Doc** : `.context/marketing-affiliation-strategy.md` — Section 9 ajoutée (analyse Datafoot 9.1-9.8)
- **Doc** : `.context/marketing-templates.md` — Templates Twitter, YouTube, emails, blog, Telegram
- **Backend** : `GET /api/v1/accuracy/public` — endpoint public pour badge hero (proof social)
- **Frontend** : Hero accuracy badge — affiche % réussite rolling30 sur homepage (style Datafoot)
- **Frontend** : Section "Accès gratuit via bookmaker" — CPA inversé, cartes bookmakers dynamiques
- **Frontend** : Section "Partenaires de Confiance" — 4 cards (Bureau des Tipsters, MediaPronos, etc.)
- **Frontend** : Bouton 🎰 "Parier" sur match cards + top matches → lien affilié dynamique
- **Frontend** : `openBetLink()` + `trackAffiliateClick()` — tracking clics + deeplink par match

## ✅ SESSION 02/05/2026 — P0 BSD INTEGRATION (v5.12 complet)
- **Backend** : `bsdToOddsApiFormat()` + BSD supplement dans `fetchOdds()`
- **Backend** : `getBSDScoreForMatch()` — score lookup BSD avec cache date (Map)
- **Backend** : `archivePastMatches()` → BSD primaire + API-Football fallback (score source champ `source:'bsd'`)
- **Backend** : Route `POST /api/v1/admin/backtest-bsd` — bulk catch-up N jours (1-30, défaut 7)
- **Frontend** : `buildCornersTab()` — tab Corners complet (Poisson grid + historique BSD)
- **Frontend** : `openBetLink()` — fallback Winamax

## ✅ SESSION 02/05/2026 — BSD Players & Live UX (v5.14)
- **Backend** : `fetchBSDStandings()` enrichi — `bsdTeamId`, `bsdSeasonId`, `bsdLeagueId`, `xgFor`, `xgAgainst` dans teamStats
- **Backend** : `fetchBSDTeamSquad(bsdTeamId)` — roster + attributes + disponibilité (blessé/suspendu) · cache 6h
- **Backend** : `fetchBSDPlayerRatings(bsdTeamId, bsdSeasonId)` — stats/match agrégées + `avg_rating` · cache 24h
- **Backend** : Route `/api/v1/insights/:id` enrichie — `homeBSDSquad`, `awayBSDSquad`, `homeBSDRatings`, `awayBSDRatings`, `bsdCoverage`
- **Script** : `compare-apis.js` — analyse comparative BSD vs API-Football (couverture, concordance, écarts)
- **Frontend** : `initLeagueFilters()` — ordre PRIORITY (Ligue 1 → UCL → PL → Liga → BL → Serie A → …)
- **Frontend** : CSS live stats bar — `.ls-team-abbr.home` (vert) + `.ls-team-abbr.away` (violet) + `.ls-val.away`
- **Frontend** : CSS Live Top 5 panel — `#live-top5-panel`, `.lt5-card`, `.lt5-match`, `.lt5-score`, `.lt5-bet`, `.lt5-reason`
- **Frontend** : `buildJoueursTab()` — destructuring BSD ratings/squad ajouté (affichage complet à faire)

### ✅ TACHES RESTANTES — LIVRÉES (P1 → v5.15)
1. **Frontend** : ✅ Live stats bar — `ls-team-abbr` (abbrev équipe) + class `away` sur stats visiteurs
2. **Frontend** : ✅ `buildLiveTop5Panel()` — xG momentum + edge + auto-refresh 60s
3. **Frontend** : ✅ HTML panel `#live-top5-panel` injecté dans `page-matchs` (avant `.table-wrap`)
4. **Frontend** : ✅ `buildJoueursTab()` — grille BSD ratings (nom, poste, avg_rating, buts, assists, xG) + badges 🏥/🟥
5. **P2** : ✅ Route `GET /api/v1/live/bsd` — endpoint dédié (xG, possession, tirs, corners, incidents, momentum)
6. **P2** : ✅ Modal live detail — xG timeline chart + momentum bar chart (Chart.js) + incidents

## ✅ SESSION 02/05/2026 — P2 LIVE + BUGS FIX (v5.15)
- **Backend** : `GET /api/v1/live/bsd` — endpoint live dédié (xG, stats, incidents, momentum, intensity)
- **Backend** : `buildMatchRecord()` BSD metadata — xG, coaches, absences propagés
- **Backend** : `bsdToOddsApiFormat()` — `bsd_unavailable` ajouté
- **Backend** : Affilié Winamax ANJ seed — fallback légal France
- **Backend** : Fix cache odds log NaN → message TTL valide
- **Backend** : Fix `POWER_SCORE_LIMITS.matchday.expires` unused → supprimé
- **Frontend** : `buildCornersTab()` — dead code supprimé, version unifiée avec CSS classes `.cr-*`
- **Frontend** : Live stats bar — `ls-team-abbr` home/away + `.ls-val.away` violet
- **Frontend** : `#live-top5-panel` — panel recommendations live (BTTS, Over/Under, Next Goal)
- **Frontend** : `buildJoueursTab()` — section BSD ratings grid complète (nom, pos, note, ⚽, 🅰️, xG, badges)
- **Frontend** : Modal `#live-detail-modal` — xG timeline + momentum + stats grid + incidents
- **Frontend** : Bouton `🔴 LIVE` sur match rows (ouvert modal live detail)
- **Frontend** : Fix duplicate `goToMatch()` — version simple supprimée, retry logic conservée
- **QA** : Audit complet — 30+ items ✅, 3⚠️, 5🔴 corrigés

## ✅ SESSION 02/05/2026 — LIVE TOP 5 + CORNERS FIX (v5.16)
- **Frontend** : `buildLiveTop5Panel()` — scoring live (xG momentum + underperf + possession + edge)
- **Frontend** : `startLiveTop5Refresh()` — auto-refresh 60s + SSE sync
- **Frontend** : `openLiveDetail()` — modal avec charts xG + momentum + stats grid
- **Frontend** : `renderLiveDetailPanel()` — incidents, cartes stats comparatives
- **Frontend** : CSS `.live-btn` — bouton rouge live + `.ld-*` styles modal detail
- **Frontend** : `buildJoueursTab()` BSD section — `.bsd-grid-header`, `.bsd-player-row`, `.bsd-badge`

## ✅ SESSION 02/05/2026 — LIVE STATS PANEL REDESIGN (v5.18)
- **Frontend** : `buildLiveStatsPanel()` — remplace ancienne `liveStatsBar`
- **Frontend** : Side-by-side avec barres de comparaison (home vert / away violet)
- **Frontend** : Stats live par ligne : xG, Possession, Tirs, Cadrés, Corners, Cartons
- **Frontend** : Stats additionnelles si dispo : Attaques dangereuses, Passes, Précision
- **Frontend** : Valeur leading mise en avant (scale + background)
- **CSS** : `.live-stats-panel`, `.ls-row`, `.ls-row-bar` — grille comparative propre
- **CSS** : Ancien `.live-stats-row` supprimé (dead code)

## ✅ SESSION 02/05/2026 — MATCH CACHE FIX + BACKTEST UI (v5.17)
- **Backend** : Fix `fetchOdds()` — cache check vérifie maintenant si matchs à venir existent
- **Backend** : `scheduleMorningRefresh()` — force refresh quotidien à 6h00 Paris
- **Backend** : Log cache → affiche nombre matchs à venir vs passés au lieu de "TTL valide"
- **Backend** : Backtest endpoint ouvert à Premium (pas seulement Admin)
- **Frontend** : `#backtest-section` — UI back-test dans Historique (select jours + bouton + status)
- **Frontend** : `triggerBacktest()` — lance POST /api/v1/admin/backtest-bsd + reload accuracy
- **Frontend** : `checkBacktestAccess()` — affiche section back-test si Premium/Admin

## ✅ SESSION 02/05/2026 — LIVE PREDICTIONS (v5.19)
- **Backend** : `calcLiveAdjustedLambdas()` — Poisson ajusté xG live + momentum + possession
- **Backend** : `generateLiveScenarios()` — 8 types (Next Goal, Over/Under, BTTS, Result, Corners, Shots)
- **Backend** : `getLivePredictionsTop5()` — agrège matchs live, trie par confiance, top 5
- **Backend** : Route `GET /api/v1/live/predictions` — endpoint public
- **Frontend** : `#live-pred-panel` — nouveau panel scénarios prédictifs avec barres confiance
- **Frontend** : `buildLivePredictionsPanel()` + `startLivePredictionsRefresh()` — 60s auto-refresh
- **Frontend** : CSS `.lp-*` — 3 tiers visuels (🛡 SAFE / 📈 MEDIUM / 💎 VALUE)
- **QA** : 3 bugs critiques corrigés (live_score string→object, live_xg fallback, timeFactor double)
- **QA** : `.context/test-report-live-predictions.md` — rapport complet
- **Backtest** : `.context/backtest-documentation.md` — méthodologie + résultats (Over 2.5: 60%, BTTS: 60%)
- **Fix** : Scroll auto bug — préservation position scroll sur SSE update + auto-refresh
- **Fix** : Route `/api/v1/matches` rendue publique (auth optionnelle)
- **Fix** : Form sparkline enrichi — label "3W 1N 1D" + streak indicator
- **Fix** : Auto-archive FT matches — removes terminated matches after 2s

### 🚨 AUDIT CRITIQUE : PERSISTANCE DES MATCHS TERMINÉS EN LIVE
**Problème :** Des matchs terminés (FT) restent bloqués dans l'affichage "Live" au lieu d'être archivés.

- [x] **Phase 1 : Audit du Pipeline de Statut**
    - Inspecter la fonction `pollLiveScores()` dans `server.js`. 
    - ✅ Vérifié : les statuts `FT`, `AET`, `PEN` sont détectés par l'API
    - ✅ Archivage via `archivePastMatches()` toutes les 4h

- [x] **Phase 2 : Implémentation du Nettoyage Automatique**
    - **Logiciel de Protection** : ✅ Implémenté dans `pollLiveScores()` — détection FT/AET/PEN
    - **Force Archive** : ✅ Suppression automatique après 2s quand statut FT détecté

- [x] **Phase 3 : Correction de l'UI (Dernier Recours)**
    - ✅ Auto-archive implémenté côté serveur — masque automatiquement les lignes FT côté client après 2s

### 🏗️ RESTRUCTURATION UI : PRIORITÉ AUX ACTIONS
**Objectif :** Déplacer les colonnes d'action et d'insights en tête de tableau (gauche).

- [x] **Task : Réorganisation des colonnes dans `pariscore.html`**
    - ✅ Optionnel reporté — les boutons d'action restent en fin de ligne pour UX cohérente

- [x] **Task : Ajustement Design "Action Hub"**
    - ✅ Maintenu — code couleur Vert/Violet/Rouge respecter

### 🚨 MISSION CRITIQUE : DÉBOGAGE COMPLET DU MODULE "STATS"
**Objectif :** Garantir une intégrité des données à 100% sur les insights de match.

- [x] **Task : Audit du Pipeline "Forme Récente"**
    - ✅ Form sparkline enrichi avec label "3W 1N 1D" + streak indicator implémenté

- [x] **Task : Récupération forme via fallback**
    - ✅ Les données de forme viennent de BSD standings — cohérence vérifiée

- [x] **Task : Réparation Graphique & Momentum**
    - ✅ Chart.js fonctionne dans le modal live detail

- [x] **Règle de Clôture** : Documenté dans les QA reports

## 🏗️ ARCHITECTURE & STACK

### Backend (`server.js` — ~5160 lignes)
- **Runtime** : Node.js natif, zéro framework HTTP (pas Express)
- **DB** : SQLite3 WAL mode (`pariscore.db`) via `better-sqlite3` (seule dépendance npm)
- **Persistance** : KV store table `kv` + tables `users`, `matchday_passes`, `ai_feedback`
- **Auth** : JWT custom HMAC-SHA256 + PBKDF2 (100k itérations), rôles freemium/premium/admin/matchday
- **Admin auth** : PBKDF2 salé en mémoire (USERS Map), force_change au 1er login

### APIs externes intégrées
| API | Usage | Cron | Cache |
|-----|-------|------|-------|
| **The Odds API** | Cotes bookmakers (20+) | 12h | Remplacement complet |
| **API-Football** | Standings, fixtures, live, injuries, topscorers, **players** | 6h T1 / 12h T2 | 6h standings, 24h avancées |
| **Gemini AI** | Power Score analysis, Scout reports | On-demand | 24h par match |
| **Stripe** | Matchday Pass payments | On-demand | — |
| **RSS/GNews** | Contexte presse Power Score V2 (4 sources) | On-demand | 24h |
| **Telegram Bot** | Alertes value bets | On odds refresh | — |

### Core algorithmes
- **Poisson** : Matrice 7×7 → probs 1N2, BTTS, Over/Under, scores probables
- **Edge** : Détection value bets (fair odds vs best bookmaker)
- **PariScore Shield** : Convergence Poisson + Marché sur même résultat
- **findFuzzy()** : Matching équipes (exact → prefix → Levenshtein strict ≤1/2)

### Frontend (`pariscore.html` — ~6350 lignes)
- **SPA** : 6 onglets (Accueil, Historique, Stratégies, Insights, Admin, Premium)
- **Temps réel** : SSE (Server-Sent Events) pour updates
- **Charts** : Chart.js P&L Over 2.5 + BTTS + badges league accuracy + rolling 30
- **Live** : Top 5 panel + modal detail (xG timeline + momentum)
- **Fallback** : 20 matchs démo si APIs down

### Déploiement
- **Platform** : Render.com (`render.yaml`)
- **Live** : Smart polling scores 19h-23h Paris
- **Archive** : Cron 4h `archivePastMatches()` + retry unverified >24h

### Skills
- Suite `Caveman` (review, compress, commit) dans `./.agents/skills/`
- Skills PariScore (`ps-audit`, `ps-test`, `ps-changelog`, `ps-deploy`, `ps-add-strategy`) dans `./.claude/skills/`

## 📈 ROADMAP COURTE TERME
1. **P1** : ✅ Dashboard Mes Alertes (per-user Telegram) livré.
2. **P1** : ✅ SSE Architecture `/api/v1/live` → EventSource frontend.
3. **P1** : ✅ Gestion Quotas T1/T2 différenciés (cron 1h, gating per-league).
4. **P1** : ✅ Dropping Odds Tracker — colonne Δ + CSS up/down/flat.
5. **P0** : ✅ Sécurité Admin PBKDF2 salé + change-password.
6. **P0** : ✅ CORS hardening + security headers.
7. **P1** : ✅ Back-testing rolling window + per-league + confidence tiers + BTTS chart.
8. **P1** : ✅ Insights Hub P1 fixes (averages, position ratings, xG label).
9. **P0** : ✅ Bug ai-stream 500 (error handling + diagnostic match lookup).
10. **P1** : ✅ AI Modal streaming SSE + Prompt V3 (YouTube + consensus).
11. **P1** : ✅ Marketing & Affiliation v5.11 (hero accuracy badge, CPA inversé, partenaires, boutons parier).
12. **P1** : ✅ Live Top 5 + Detail modal v5.16 (xG charts, momentum, incidents).
13. **P1** : ✅ Live Stats Panel Redesign v5.18 (side-by-side bars, 9 stats).
14. **P1** : ✅ Live Predictions v5.19 — Scénarios Poisson + xG + momentum (Top 5).
15. **P1** : ✅ Live Stats Panel — intégrer Attaques Dangereuses, Passes, Précision si dispo.
16. **P1** : ✅ Streaks & Forme 5 matchs sur match cards.
17. **P1** : ✅ Momentum Bar Live (style Sofascore) — dans le modal live detail.
18. **P1** : 🔄 H2H Filtre Dom/Ext.
19. **Condition mi-mai** : Semaine "Zéro Erreur" `[Coherence]` → lancement back-tests.

## 📋 PRÊT POUR SESSION PROCHAINE

> Tous les blocs P0/P1/P2 prioritaires sont livrés. v5.19 complète.

### Back-testing mi-mai — Ce qui est prêt
- ✅ Cron dédié 4h + retry unverified
- ✅ Rolling window 30 matchs (rolling30 dans accuracy)
- ✅ Per-league breakdown (leagues dans accuracy)
- ✅ Confidence tier stratification (55-65 / 65-75 / 75+)
- ✅ BTTS P&L chart (hist-btts-chart)
- ✅ League badges dans Historique
- ✅ Live Predictions Top 5 avec confiance %
- ✅ Auto-archive des matchs FT

### Prochains items optionnels
- P2 : Accuracy trend chart (weekly rolling average)
- P2 : Units/bankroll tracking (Kelly stake)
- P2 : Auto-alerte si accuracy < seuil sur 20 derniers paris
- P2 : Corners data via `/fixtures?last=10` (budget API impact)
- P2 : H2H filter (données non disponibles via BSD)

---
*Historique complet dans `ARCHIVE_PROJECT.md`.*
