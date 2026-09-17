# Plan Complet — Onglet Handball PariScore

**Date** : 2026-09-16
**Objectif** : Nouvel onglet Handball avec calendrier, Top 8 par stratégies, même architecture que Football/Tennis.
**Scope** : 24 tâches, 7 phases, ~10h45 estimé.

---

## 1. Sources de Données — Inventaire Complet

### 1.1 APIs Commercialisées (données live + prematch)

| API | Couverture | Formats | Données clés | Tarif |
|-----|-----------|---------|-------------|-------|
| **API-Sports** (`api-sports.io/sports/handball`) | 211 ligues, 196K matchs, 3964 équipes, 21 ans | JSON | Schedule, standings, odds, résultats | Freemium (100 req/j) |
| **Data Sports Group** (`datasportsgroup.com/coverage/handball`) | 82 compétitions, 46K matchs, 24K joueurs | JSON/XML | Pre-match, live (buts, 7m, suspensions, stats), H2H, classements, transferts, cotes | Commercial |
| **Handball.ai** (`handball.ai/apis`) | Mondiale, xG handball, positioning | REST JSON | Games, players, lineups, xG, xS, live stats, webhooks | Beta |
| **Goalserve** (`goalserve.com`) | CL, ASOBAL, Bundesliga + | XML/JSON | Fixtures, live scores, prematch/inplay odds, standings | Commercial |
| **Statorium** (`statorium.com`) | Multi-ligues | JSON | Standings, fixtures, player data, live scores | Commercial |
| **Sportbex** (`sportbex.com`) | Multi-ligues | JSON | Fixtures, live scores, standings, player stats, H2H | Commercial |
| **Highlightly** (`highlightly.net`) | 180+ ligues, 35+ pays | JSON | Live scores, highlights vidéo, standings, H2H, last 5 | Freemium |
| **Sportradar** (`scores.sir.sportradar.com`) | Bundesliga + majeures | JSON | StatsHub complet : live, stats, standings | Enterprise |
| **OddsMatrix** (`oddsmatrix.com`) | 598 compétitions, 25 marchés, 57 pays | JSON/XML | Pre-match + live odds, scores, settlements | Commercial |

### 1.2 Sites Stats & Résultats (scraping fallback)

| Site | Contenu | Usage |
|------|---------|-------|
| **EHF** (`ehfcl.eurohandball.com`) | CL, Euro, EL — stats officielles | Source officielle, team/player stats |
| **FlashScore** (`fr.flashscore.com/handball`) | Résultats live, cotes, classements | Couverture mondiale temps réel |
| **SofaScore** (`sofascore.com/handball`) | Stats détaillées, ratings, momentum | Possession, tirs, suspensions, 7m |
| **LNH.fr** | Starligue officielle | Calendrier, résultats, stats Starligue |
| **HBL.de** (`liquimoly-hbl.de`) | HBL officielle | Stats, résultats, classements Bundesliga |
| **TousLesStats** (`touslesstats.com/handball`) | Résultats, calendrier | Ligues européennes |
| **HandballZone** (`handballzone.com`) | Résultats, stats, transferts | Ligue féminine, Starligue |
| **HandMag** (`handball-magazine.com`) | News, stats, analyses | Starligue, nationales |

### 1.3 Sites Paris Sportifs

| Site | Spécialité |
|------|-----------|
| **DraftKings** | Marchés 1X2, handicap, totaux |
| **Bet365** | Live betting complet |
| **OLBG** (`olbg.com`) | Tips gratuits par tipsters |
| **OddsJet** (`oddsjet.com`) | Comparateur cotes multi-bookmakers |
| **SignalOdds** (`signalodds.com`) | Prédictions IA EHF CL, Bundesliga |
| **OddsPortal** (`oddsportal.com`) | Archives cotes pour backtest |

### 1.4 Sources Académiques & Scientifiques

| Paper | Auteurs | Année | Modèle | Résultat |
|-------|---------|-------|--------|---------|
| "Predicting handball matches with ML" | Felice & Ley | 2025 | Random Forest + CMP strengths | **80%+ accuracy** |
| "Modelling handball outcomes" | Karlis, Michels, Otting | 2024 | Skellam, zero-inflated Skellam, copulas | Différence de score, sous-dispersion |
| "xG Prediction in Professional Handball" | Adams & David (ACM) | 2023 | CatBoost xG (event + positional) | **70% accuracy** xG |
| "Match Statistics as Predictors" | Redalyc | 2015 | Régression logistique | Tirs sauvés, fautes, interceptions |
| "Performance analysis Women's Euro 2022" | Nature | 2025 | Analyse performance | Indicateurs prédictifs goal diff |
| "Handball Performance Index" | HBL | 2021 | Index composite | Métrique officielle HBL |
| "Predictive Value of Technical Skills" | PMC/NIH | 2022 | Régression logistique | Vitesse lancer = prédicteur carrière |

**Concepts clés** :
- **xG Handball** : position tireur, type tir (pivot, ailière, 7m), distance, angle → CatBoost > XGBoost > RF > NN
- **CMP Distribution** : gère sous-dispersion (variance < moyenne) → better than Poisson pour handball
- **Skellam** : distribution différence deux Poisson → modélise écart de score
- **SEL (Statistically Enhanced Learning)** : features statistiques améliorent TOUS les modèles (+5-15%)

---

## 2. Ligues Prioritaires

### Tier 1 — Essentielles
| Ligue | Pays | API Source |
|-------|------|-----------|
| **Starligue (LNH)** | France 🇫🇷 | API-Sports, Data Sports Group |
| **Handball-Bundesliga (HBL)** | Allemagne 🇩🇪 | API-Sports, Data Sports Group, Sportradar |
| **EHF Champions League** | Europe 🇪🇺 | EHF officiel, Data Sports Group |
| **Liga ASOBAL** | Espagne 🇪🇸 | API-Sports, Goalserve |

### Tier 2 — Important
| Ligue | Pays | API Source |
|-------|------|-----------|
| **Herre Handbold Ligaen** | Danemark 🇩🇰 | API-Sports, Goalserve |
| **Extraliga** | Rép. Tchèque 🇨🇿 | API-Sports |
| **EHF European League** | Europe 🇪🇺 | EHF officiel |
| **SEHA League** | Europe de l'Est | API-Sports |
| **Liga Austria** | Autriche 🇦🇹 | API-Sports |

### Tier 3 — Secondaires
Proliga 🇭🇷, Handbollsligan 🇸🇪, Eliteserien 🇳🇴, Super League 🇨🇭, Division 1 🇧🇪

---

## 3. Stratégies de Paris Proposées (8)

Basé sur la littérature académique et les patterns football (13) / tennis (9) :

| # | Clé | Nom | Description | Fondement |
|---|-----|-----|-------------|-----------|
| 1 | `bestTeam` | Meilleure équipe (forme) | PPG L5/L10, pondéré ligue | Form-based PPG |
| 2 | `bestTeam1x2` | Meilleure équipe 1X2 | Score composite forme + H/A + défense | Dixon-Coles adapté |
| 3 | `over55` | Over 55.5 buts | Moyenne buts/ligue + vitesse jeu | Poisson total |
| 4 | `under62` | Under 62.5 buts | Ligue défensive + gardiens | CMP inverse |
| 5 | `handicap` | Handicap ±4.5 | Force relative équipes | Régression logistique |
| 6 | `btts30` | Both Teams 30+ | Capacité offensive des deux | Bivariate scoring |
| 7 | `htLeader` | Leader HT | Équipes dominantes 1ère période | Skellam HT→FT |
| 8 | `valueBet` | Value Bet (EV+) | Prob modèle > prob marché | Shin probabilities |

**Spécificités handball vs football** :
- Score moyen : 55 buts/match (vs 2.7 football) → totaux élevés
- Match nul : ~8% (vs ~25% football) → 1X2 biaisé victoire
- Avantage domicile : ~55% (vs ~46% football) → plus marquant
- Corrélation HT→FT : forte → bon predictor live

---

## 4. Architecture Technique — Fichiers Exact

### 4.1 Fichiers à créer

```
src/lib/
├── handball-data.ts                    # Types HandballMatch, HandballLeague
├── handball-strategy-top8.ts           # Moteur 8 stratégies (mirror football-strategy-top5.ts)
├── handball-api.ts                     # Service API-Sports (cache SWR côté serveur)
└── top-matches/handball.ts             # SportAdapter (implémente interface SportAdapter)

src/app/api/handball/
├── matches/route.ts                    # GET → { matches, source, degraded, updatedAt }
├── live/route.ts                       # GET → { matches, updatedAt }
├── prematch/route.ts                   # GET → matchs programmés
├── strategy-top8/route.ts             # GET → StrategyTableRow[] (params: strat, win, forme)
└── strategy-top8/backtest/route.ts    # GET → métriques backtest (ROI, accuracy, Brier)

src/components/handball/
├── handball-tab-content.tsx            # Conteneur onglet principal (live/prematch toggle)
├── handball-calendar.tsx               # Calendrier FotMob-style
├── handball-match-card.tsx             # Carte match (équipes, score, cotes, badge ligue)
├── handball-live-card.tsx              # Carte live (score, minute, suspended, momentum)
├── handball-top8-widget.tsx            # Top 8 par stratégie → map vers TopStrategiesTable
├── handball-strategy-bar.tsx           # Pills sélection stratégie (8 options)
├── handball-filters.tsx                # Filtres ligues (Starligue, HBL, EHF CL...)
├── handball-match-detail-dialog.tsx    # Dialog détail (lazy, momentum, stats, H2H)
├── handball-banker.tsx                 # Widget banker bet du jour (EV+ max)
├── handball-rankings.tsx               # Classement ligue (PPG, GF, GA)
└── handball-error-boundary.tsx         # Error boundary avec fallback UI

src/hooks/
├── use-handball-matches.ts             # SWR → /api/handball/matches (60s refresh)
├── use-handball-live.ts               # SSE ou polling → /api/handball/live (30s)
├── use-handball-top8.ts               # SWR → /api/handball/strategy-top8
└── use-handball-rankings.ts           # SWR → /api/handball/rankings
```

### 4.2 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/types/sports-sidebar.ts` | Ajouter `\| "handball"` à `SportTabId` |
| `src/lib/top-matches/types.ts` | Ajouter `"handball"` à `SportType` + `SPORT_TYPES[]` + `LIVE_STATUS_PATTERNS` |
| `src/lib/match-view.ts` | Ajouter `"handball"` à `STRATEGY_FILTERS_BY_SPORT` |
| `src/app/page.tsx` | Ajouter `HandballTabContent` import + case `handball` + `"handball"` dans `SPORT_ORDER` |
| `src/components/dashboard/top-multi-sport.tsx` | Ajouter `handballAdapter` au registre adapters |

### 4.3 Composants réutilisés (pas de duplication)

| Composant | Fichier source | Réutilisation |
|-----------|---------------|---------------|
| `TopStrategiesTable` | `src/components/football/top-strategies-table.tsx` | **Direct** — mapper `StrategyTableRow` handball |
| `FotmobCalendarTable` | `src/components/football/fotmob-calendar-table.tsx` | **Direct** — adapter colonnes |
| `TopMultiSport` | `src/components/dashboard/top-multi-sport.tsx` | **Direct** — ajouter adapter |
| `useSportsSidebarStore` | `src/stores/use-sports-sidebar-store.ts` | **Direct** — `"handball"` reconnu |
| SWR pattern | `src/hooks/use-prematch-matches.ts` | **Copier** — même structure |
| URL state sync | `src/hooks/use-tennis-top5.ts` | **Copier** — `readInitialParams()` |

---

## 5. Boucle Ingénierie (par tâche)

Chaque tâche suit le cycle :

```
1. [Claim]    → bd update <id> --claim
2. [Research] → Grep/Glob/Read → verify: contexte compris
3. [Implement]→ Edit/Write → verify: code compile
4. [Quality]  → bun run lint + bun run typecheck → verify: 0 errors
5. [Close]    → bd close <id>
```

---

## 6. Plan d'Implémentation Détaillé

### Phase 0 — Fondation (45 min)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 0.1 | Types `HandballMatch` + `HandballLeague` | `implement` | `src/lib/handball-data.ts` | `typecheck` passe |
| 0.2 | Enregistrer `"handball"` SportTabId + SportType + SPORT_ORDER | `implement` | `src/types/sports-sidebar.ts`, `src/lib/top-matches/types.ts`, `src/lib/match-view.ts` | `typecheck` passe |
| 0.3 | SportAdapter `handball.ts` | `implement` | `src/lib/top-matches/handball.ts` | module compile |

### Phase 1 — Data Layer (2h20)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 1.1 | Service API-Sports Handball (cache) | `implement` | `src/lib/handball-api.ts` | appel test retourne JSON |
| 1.2 | Endpoint `/api/handball/matches` | `implement` | `src/app/api/handball/matches/route.ts` | GET 200 + JSON valide |
| 1.3 | Endpoint `/api/handball/live` | `implement` | `src/app/api/handball/live/route.ts` | GET 200 |
| 1.4 | Hook `use-handball-matches` (SWR) | `implement` | `src/hooks/use-handball-matches.ts` | hook compile |
| 1.5 | Hook `use-handball-live` (SSE/polling) | `implement` | `src/hooks/use-handball-live.ts` | hook compile |

### Phase 2 — Moteur Stratégies (2h15)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 2.1 | `handball-strategy-top8.ts` — 8 stratégies | `implement` | `src/lib/handball-strategy-top8.ts` | `typecheck` passe, retourne `StrategyTableRow[]` |
| 2.2 | Endpoint `/api/handball/strategy-top8` | `implement` | `src/app/api/handball/strategy-top8/route.ts` | GET retourne 8 lignes triées |
| 2.3 | Hook `use-handball-top8` | `implement` | `src/hooks/use-handball-top8.ts` | hook compile |
| 2.4 | Backtest (si données dispo) | `implement` | `src/app/api/handball/strategy-top8/backtest/route.ts` | endpoint retourne métriques |

### Phase 3 — UI Onglet Principal (1h35)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 3.1 | `handball-tab-content.tsx` | `implement` | `src/components/handball/handball-tab-content.tsx` | onglet rend sans erreur |
| 3.2 | `handball-match-card.tsx` | `implement` | `src/components/handball/handball-match-card.tsx` | carte rend avec mock |
| 3.3 | `handball-live-card.tsx` | `implement` | `src/components/handball/handball-live-card.tsx` | carte live rend |
| 3.4 | `handball-filters.tsx` | `implement` | `src/components/handball/handball-filters.tsx` | filtres rendent |

### Phase 4 — Calendrier + Top 8 (1h20)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 4.1 | `handball-calendar.tsx` | `implement` | `src/components/handball/handball-calendar.tsx` | calendrier affiche matchs |
| 4.2 | `handball-top8-widget.tsx` | `implement` | `src/components/handball/handball-top8-widget.tsx` | widget affiche top 8 |
| 4.3 | `handball-strategy-bar.tsx` | `implement` | `src/components/handball/handball-strategy-bar.tsx` | barre interactive |
| 4.4 | Intégrer `TopMultiSport` | `implement` | `src/components/dashboard/top-multi-sport.tsx` | dashboard affiche handball |

### Phase 5 — Intégration (30 min)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 5.1 | Brancher onglet dans `page.tsx` | `implement` | `src/app/page.tsx` | `typecheck` passe |
| 5.2 | Sidebar store | `implement` | `src/stores/use-sports-sidebar-store.ts` | `"handball"` reconnu |
| 5.3 | Error boundary | `implement` | `src/components/handball/handball-error-boundary.tsx` | fallback UI affiché |
| 5.4 | Qualité globale | `quality-gates` | — | `lint` + `typecheck` = 0 erreurs |

### Phase 6 — Enrichissement (2h20)

| # | Tâche | Skill | Fichiers | Vérification |
|---|-------|-------|----------|-------------|
| 6.1 | Détail match dialog | `implement` | `src/components/handball/handball-match-detail-dialog.tsx` | dialog s'ouvre |
| 6.2 | Analyse xG handball | `implement` | `src/lib/handball-xg.ts` | calcul xG cohérent |
| 6.3 | Banker bet widget | `implement` | `src/components/handball/handball-banker.tsx` | widget affiche match |
| 6.4 | Classements ligue | `implement` | `src/components/handball/handball-rankings.tsx` | classement affiche données |

---

## 7. Checklists de Validation

### Par phase
- [ ] Phase 0 : Types + enregistrement → `typecheck` passe
- [ ] Phase 1 : Data layer → `GET /api/handball/matches` retourne JSON
- [ ] Phase 2 : Moteur → `GET /api/handball/strategy-top8` retourne 8 lignes
- [ ] Phase 3 : UI onglet → onglet handball visible et navigable
- [ ] Phase 4 : Calendrier + Top 8 → matchs affichés, stratégies cliquables
- [ ] Phase 5 : Intégration → tout fonctionne, pas de régression
- [ ] Phase 6 : Enrichissement → features bonus opérationnelles

### Globale
- [ ] `bun run lint` : 0 erreurs
- [ ] `bun run typecheck` : 0 erreurs
- [ ] `next build` : build réussi
- [ ] Aucune régression football/tennis/autres onglets
- [ ] Zéro variable `any`
- [ ] Comments en français
- [ ] Convention : `src/components/handball/` + `src/lib/handball-*.ts`

---

## 8. Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Pas d'API gratuite fiable pour live | Élevé | API-Sports (100 req/j) ou scraping FlashScore |
| xG handball absent APIs gratuites | Moyen | Version simplifiée (base tirs + position) |
| Données historiques limitées backtest | Moyen | OddsPortal archives cotes |
| Starligue pas dans toutes APIs | Faible | Scraping LNH.fr + API-Sports |
| Perf calcul 8 stratégies temps réel | Faible | Cache SWR + pruning interval |

---

## 9. Estimation Totale

| Phase | Temps | Tâches |
|-------|-------|--------|
| Phase 0 — Fondation | 45 min | 3 |
| Phase 1 — Data Layer | 2h20 | 5 |
| Phase 2 — Moteur Stratégies | 2h15 | 4 |
| Phase 3 — UI Onglet | 1h35 | 4 |
| Phase 4 — Calendrier + Top 8 | 1h20 | 4 |
| Phase 5 — Intégration | 30 min | 4 |
| Phase 6 — Enrichissement | 2h20 | 4 |
| **TOTAL** | **~10h45** | **24** |
