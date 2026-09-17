# Rapport de Recherche — Onglet Handball PariScore

**Date**: 2026-09-16
**Objectif**: Inventaire complet des sources de données, sites académiques, et modèles prédictifs pour l'onglet Handball.

---

## 1. Sites Web de Stats Handball (Données & API)

### 1.1 APIs Commercialisées (Sources primaires de données)

| Source | Couverture | Formats | Données dispo | Prix |
|--------|-----------|---------|---------------|------|
| **API-Sports Handball** (api-sports.io) | 211 ligues/coupes, 196K+ matchs, 3964 équipes, 21 ans d'historique | JSON | Schedule, standings, odds, résultats | Freemium (100 req/j gratuit) |
| **Data Sports Group** (datasportsgroup.com) | 82 compétitions, 46K matchs, 24K joueurs, 1.6K équipes | JSON/XML | Pre-match, live (buts, 7m, suspensions, stats), H2H, classements, transferts, cotes | Commercial |
| **Handball.ai** | couverture mondiale, xG handball, positioning | REST JSON | Games, players, lineups, xG, xS, live stats, webhooks | Beta (request access) |
| **Goalserve** (goalserve.com) | Champions League, Liga ASOBAL, Bundesliga, + | XML/JSON | Fixtures, live scores, prematch/inplay odds, standings | Commercial |
| **Statorium** (statorium.com) | Multi-ligues | JSON | Standings, fixtures, player data, live scores, news, WordPress integration | Commercial |
| **Sportbex** (sportbex.com) | Multi-ligues | JSON | Fixtures, live scores, standings, player stats, H2H | Commercial |
| **Highlightly** (highlightly.net) | 180+ ligues, 35+ pays | JSON | Live scores, highlights vidéo, standings, H2H, last 5 games | Freemium |
| **Sportradar** (scores.sir.sportradar.com) | Bundesliga + ligues majeures | JSON | StatsHub complet : live, stats, standings | Enterprise |
| **OddsMatrix** (oddsmatrix.com) | 598 compétitions, 25 marchés, 57 pays | JSON/XML | Pre-match + live odds, scores, settlements | Commercial |

### 1.2 Sites de Stats & Résultats (Scraping possible)

| Site | Contenu | Niveau de détail |
|------|---------|-----------------|
| **EHF European Handball** (ehfcl.eurohandball.com) | Champions League, Euro, European League — stats officielles | Team stats, player stats, classements, résultats — **source officielle** |
| **FlashScore** (fr.flashscore.com/handball) | Résultats live, cotes, classements | Couverture mondiale, temps réel |
| **SofaScore** (sofascore.com/handball) | Stats détaillées, ratings joueurs, momentum | Possession, tirs, suspensions, 7m |
| **Tous les Stats** (touslesstats.com/handball) | Résultats, calendrier, stats | Ligues européennes |
| **Handball Zone** (handballzone.com) | Résultats, stats, transferts | Ligue féminine, Starligue |
| **HandMag** (handball-magazine.com) | News, stats, analyses | Starligue, nationales |
| **LNH.fr** (lnh.fr) | Starligue officielle — calendrier, résultats, stats | **Source officielle Starligue** |
| **Handboll.se** | Resultat, statistik — championnats suédois | Allsvenskan, Elitserien |
| **Bundesliga.de** (liquimoly-hbl.de) | HBL officiel — stats, résultats, classements | **Source officielle HBL** |
| **Danzas Handball** (danzas-handball.com) | Stats, analyses | Statistiques avancées |
| **WorldHandball.news** | Résultats mondiaux, ranking IHF | Couverture globale |

### 1.3 Sites de Paris Sportifs Handball

| Site | Type | Spécialité Handball |
|------|------|-------------------|
| **DraftKings** (sportsbook.draftkings.com) | Sportsbook | Marchés 1X2, handicap, totaux |
| **Bet365** | Sportsbook | Live betting handball complet |
| **Unibet** | Sportsbook | Odds comparaison |
| **Betclic** | Sportsbook | Starligue + européeens |
| **OLBG** (olbg.com) | Tips gratuits | Predictions handball par tipsters |
| **OddsJet** (oddsjet.com) | Comparateur cotes | Meilleures cotes multi-bookmakers |
| **SignalOdds** (signalodds.com) | AI predictions | Prédictions IA EHF CL, Bundesliga |
| **OddsPortal** (oddsportal.com) | Historique cotes | Archives cotes pour backtest |

---

## 2. Sources Académiques & Scientifiques

### 2.1 Papers Fondamentaux (Modèles Prédictifs)

| Paper | Auteurs | Année | Modèle | Résultat clé |
|-------|---------|-------|--------|-------------|
| **"Predicting handball matches with ML and statistically estimated team strengths"** | Felice & Ley | 2025 | Random Forest + CMP strengths | **80%+ accuracy** (vs ~75% football) — best model: RF + SEL features |
| **"Modelling handball outcomes using univariate and bivariate approaches"** | Karlis, Michels, Otting | 2024 | Skellam distribution, zero-inflated Skellam, copulas bivariées | Modélise la différence de score (pas les buts individuels) — sous-dispersion vs Poisson |
| **"Expected Goals Prediction in Professional Handball"** | Adams & David (ACM MMSports) | 2023 | CatBoost xG (event + positional data) | **70% accuracy** xG prediction, 5-fold CV |
| **"Match Statistics as Predictors of Team's Performance"** | Redalyc | 2015 | Régression logistique multiple | facteurs clés : tirs sauvés, fautes techniques, interceptions, arrêts gardien |
| **"Performance analysis in won and lost matches — Women's Euro 2022"** | Nature Scientific Reports | 2025 | Analyse performance + prédiction | Indicateurs prédictifs du goal difference et résultat |
| **"Handball Performance Index (HPI)"** | HBL | 2021 | Index composite | Métrique officielle Bundesliga — données transparentes |
| **"Predictive Value of Technical Throwing Skills"** | PMC/NIH | 2022 | Régression logistique/multinomiale | Vitesse de lancer = prédicteur carrière pro |

### 2.2 Concepts Théoriques Clés pour Handball

**xG Handball (Expected Goals)**:
- Adaptation du xG football au handball
- Basé sur : position du tireur, type de tir (pivot, ailière, 7m), distance, angle
- CatBoost = meilleur algorithme (vs XGBoost, Random Forest, Neural Net)
- Source : Adams & David (2023)

**Conway-Maxwell-Poisson (CMP) Distribution**:
- Gère la sous-dispersion (variance < moyenne) contrairement à Poisson
- Adaptée aux sports à haute fréquence de buts comme le handball
- Permet de dériver un paramètre de "force d'équipe"
- Source : Felice (2024), Felice & Ley (2025)

**Skellam Distribution**:
- Distribution de la différence de deux variables Poisson
- Modélise l'écart de score directement
- Zero-inflated Skellam corrège la sous-représentation des matchs nuls
- Source : Karlis et al. (2024)

**Statistically Enhanced Learning (SEL)**:
- Ajout de features statistiques (forces d'équipe estimées) aux modèles ML
- Améliore TOUS les modèles testés (+5-15% accuracy)
- Source : Felice & Ley (2025)

### 2.3 Métriques Spécifiques Handball

| Métrique | Description | Pertinence paris |
|----------|-------------|-----------------|
| **xG (Expected Goals)** | Probabilité de but par tir | Over/Under, victoire |
| **Taux de tirs** | % tirs / attaques | Performance offensive |
| **Efficacité 7m** | % tirs francs transformés | Handicap, totaux |
| **Interceptions** | Volées par match | Transitions rapides |
| **Saves gardien** | % arrêts / tirs subis | Under, victoire |
| **Suspensions 2min** | Nombre / match | Discipline, momentum |
| **Temps de possession** | % temps balle | Contrôle match |
| **Goal Difference** | Diff buts moyenne | Handicap, 1X2 |
| **PPG (Points per game)** | Points par match (victoire=2, nul=1, défaite=0) | Forme équipe |
| **Home/Away PPG** | PPG domicile vs extérieur | Avantage terrain |
| **Buts mi-temps** | Score à la HT | Live betting, HT/FT |
| **Différence mi-temps** | Écart buts HT | Predictor final score |

---

## 3. Ligues Prioritaires à Couvrir

### Tier 1 — Essentielles
| Ligue | Pays | Source API | Niveau |
|-------|------|-----------|--------|
| **Starligue (LNH)** | France 🇫🇷 | API-Sports, Data Sports Group | Élite |
| **Handball-Bundesliga (HBL)** | Allemagne 🇩🇪 | API-Sports, Data Sports Group, Sportradar | Élite |
| **EHF Champions League** | Europe 🇪🇺 | EHF officiel, Data Sports Group | Élite |
| **Liga ASOBAL** | Espagne 🇪🇸 | API-Sports, Goalserve | Élite |
| **Santander Liga ASOBAL** | Espagne 🇪🇸 | Data Sports Group | Élite |

### Tier 2 — Important
| Ligue | Pays | Source API |
|-------|------|-----------|
| **Ligaopponenten (HNL)** | Pays-Bas 🇳🇱 | API-Sports |
| **Herre Handbold Ligaen** | Danemark 🇩🇰 | API-Sports, Goalserve |
| **Bundesliga Autriche** | Autriche 🇦🇹 | API-Sports |
| **Extraliga** | Rép. Tchèque 🇨🇿 | API-Sports |
| **SEHA League** | Europe de l'Est | API-Sports |
| **EHF European League** | Europe 🇪🇺 | EHF officiel |

### Tier 3 — Secondaires
| Ligue | Pays |
|-------|------|
| Proliga (Croatie) 🇭🇷 | Premijer Liga (Bosnie) 🇧🇦 |
| Handbollsligan (Suède) 🇸🇪 | Eliteserien (Norvège) 🇳🇴 |
| Super League (Suisse) 🇨🇭 | Division 1 (Belgique) 🇧🇪 |

---

## 4. Stratégies de Paris Handball Proposées

Basé sur la littérature académique et les patterns existants (football 13 stratégies, tennis 9 stratégies), voici **8 stratégies handball** :

### 4.1 Stratégies Pré-Match

| # | Clé | Nom | Description | Fondement académique |
|---|-----|-----|-------------|---------------------|
| 1 | `bestTeam` | Meilleure équipe (forme) | PPG sur L5/L10 matchs, pondéré par ligue | Form-based PPG (football existant) |
| 2 | `bestTeam1x2` | Meilleure équipe 1X2 | Score composite: forme + PPG H/A + force défensive | Dixon-Coles adapté |
| 3 | `over55` | Over 55.5 buts | Basé sur moyenne buts/ligue + vitesse de jeu | Poisson sur total buts |
| 4 | `under62` | Under 62.5 buts | Ligue défensive + gardiens performants | CMP inverse |
| 5 | `handicap` | Handicap -4.5/+4.5 | Force relative des équipes | Régression logistique |
| 6 | `btts30` | Both Teams 30+ buts | Capacité offensive des deux équipes | Bivariate scoring |
| 7 | `htLeader` | Leader à la mi-temps | Équipes dominantes en 1ère période | Skellam HT → FT |
| 8 | `valueBet` | Value Bet (EV+) | Probabilité modèle > probabilité implicite marché | Shin probabilities |

### 4.2 Spécificités Handball vs Football

| Aspect | Football | Handball | Impact betting |
|--------|----------|---------|---------------|
| Score moyen | 2.7 buts/match | 55 buts/match | Totaux beaucoup plus élevés |
| Écart-type | ~1.6 | ~6.5 | Modèles plus stables |
| Match nul | ~25% des matchs | ~8% des matchs | 1X2 biaisé vers victoire |
| Avantage domicile | ~46% victoires | ~55% victoimes | Plus marquant |
| Draw rare | Oui | Non (mais possible) | Poids du nul faible |
| Mi-temps → FT | Corrélation forte | Corrélation forte | HT score = bon predictor |

---

## 5. Schéma Technique — Même architecture que Football/Tennis

### 5.1 Fichiers à créer (mirror de football/tennis)

```
src/
├── app/
│   └── api/
│       └── handball/
│           ├── matches/route.ts          # Endpoint principal matchs
│           ├── live/route.ts             # Matchs live
│           ├── prematch/route.ts         # Matchs programmés
│           ├── strategy-top8/route.ts    # Moteur stratégies
│           └── calendar/route.ts         # Données calendrier
├── components/
│   └── handball/
│       ├── handball-tab-content.tsx      # Conteneur onglet principal
│       ├── handball-calendar.tsx         # Calendrier matchs
│       ├── handball-match-card.tsx       # Carte match
│       ├── handball-live-card.tsx        # Carte live
│       ├── handball-top8-widget.tsx      # Top 8 par stratégie
│       ├── handball-strategy-bar.tsx     # Barre sélection stratégie
│       └── handball-filters.tsx          # Filtres ligues
├── hooks/
│   ├── use-handball-matches.ts           # SWR matchs
│   ├── use-handball-top8.ts             # SWR top 8
│   └── use-handball-live.ts             # Live data
├── lib/
│   ├── handball-strategy-top8.ts         # Moteur de scoring
│   ├── handball-data.ts                  # Types HandballMatch
│   └── top-matches/handball.ts           # SportAdapter
└── types/
    └── (ajout "handball" à SportTabId)
```

### 5.2 Patterns réutilisés

| Composant | Source existante | Réutilisation |
|-----------|-----------------|---------------|
| `TopStrategiesTable` | `src/components/football/top-strategies-table.tsx` | **Direct** — mapper `StrategyTableRow` |
| `FotmobCalendarTable` | Calendar shared | **Direct** — adapter colonnes handball |
| `TopMultiSport` | `src/components/dashboard/top-multi-sport.tsx` | **Direct** — ajouter adapter handball |
| `useSportsSidebarStore` | Store Zustand | **Direct** — ajouter `"handball"` aux SportTabId |
| SWR pattern | Tennis hooks | **Copier** — même structure fetch + polling |
| URL state sync | Tennis top10 | **Copier** — `readInitialParams()` |

### 5.3 Enregistrement du sport

Fichiers à modifier :
1. `src/types/sports-sidebar.ts` → ajouter `"handball"` à `SportTabId`
2. `src/lib/top-matches/types.ts` → ajouter `"handball"` à `SportType` + `SPORT_TYPES`
3. `src/lib/match-view.ts` → ajouter `"handball"` à `STRATEGY_FILTERS_BY_SPORT`
4. `src/app/page.tsx` → ajouter case `handball` dans le switch + `SPORT_ORDER`
5. `src/components/dashboard/dashboard-data-provider.tsx` → optional: data handball

---

## 6. Plan d'Implémentation — Boucle Ingénierie

### Phase 0 : Fondation (1 tâche par skill)

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 0.1 | Créer les types `HandballMatch` + `HandballLeague` | `writing-plans` | Haute | 15 min |
| 0.2 | Enregistrer `"handball"` dans `SportTabId`, `SportType`, `SPORT_ORDER` | `implement` | Haute | 10 min |
| 0.3 | Créer le SportAdapter `src/lib/top-matches/handball.ts` | `implement` | Haute | 20 min |

### Phase 1 : Data Layer (API + Scraper)

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 1.1 | Scraper/cache API-Sports Handball (résultats, standings) | `scraping` | Haute | 45 min |
| 1.2 | Endpoint `/api/handball/matches` (prematch) | `implement` | Haute | 30 min |
| 1.3 | Endpoint `/api/handball/live` (live scores) | `implement` | Moyenne | 30 min |
| 1.4 | Hook `use-handball-matches` (SWR) | `implement` | Haute | 15 min |
| 1.5 | Hook `use-handball-live` (SSE) | `implement` | Moyenne | 20 min |

### Phase 2 : Moteur Stratégies

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 2.1 | `handball-strategy-top8.ts` — 8 stratégies (Poission/CMP/Skellam) | `implement` | Haute | 60 min |
| 2.2 | Endpoint `/api/handball/strategy-top8` | `implement` | Haute | 20 min |
| 2.3 | Hook `use-handball-top8` (SWR) | `implement` | Haute | 10 min |
| 2.4 | Backtest des stratégies sur données historiques | `implement` | Moyenne | 45 min |

### Phase 3 : UI — Onglet Principal

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 3.1 | `handball-tab-content.tsx` — structure onglet (live/prematch) | `implement` | Haute | 30 min |
| 3.2 | `handball-match-card.tsx` — carte match | `implement` | Haute | 25 min |
| 3.3 | `handball-live-card.tsx` — carte live avec score | `implement` | Moyenne | 25 min |
| 3.4 | `handball-filters.tsx` — filtres ligues | `implement` | Moyenne | 15 min |

### Phase 4 : UI — Calendrier + Top 8

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 4.1 | `handball-calendar.tsx` — calendrier FotMob-style | `implement` | Haute | 30 min |
| 4.2 | `handball-top8-widget.tsx` — top 8 par stratégie | `implement` | Haute | 25 min |
| 4.3 | `handball-strategy-bar.tsx` — sélecteur de stratégie | `implement` | Moyenne | 15 min |
| 4.4 | Intégrer `TopMultiSport` avec adapter handball | `implement` | Moyenne | 10 min |

### Phase 5 : Intégration

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 5.1 | Brancher onglet dans `page.tsx` (switch + imports) | `implement` | Haute | 10 min |
| 5.2 | Sidebar store : ajouter `"handball"` | `implement` | Haute | 5 min |
| 5.3 | SWR config + error boundary | `implement` | Basse | 10 min |
| 5.4 | Qualité : lint + typecheck | `quality-gates` | Haute | 5 min |

### Phase 6 : Enrichissement

| # | Tâche | Skill | Priorité | Estimation |
|---|-------|-------|----------|-----------|
| 6.1 | Détail match dialog (momentum, stats live) | `implement` | Moyenne | 40 min |
| 6.2 | Analyse xG handball (si source disponible) | `implement` | Basse | 60 min |
| 6.3 | Banker bet widget | `implement` | Basse | 20 min |
| 6.4 | Classements ligue widget | `implement` | Basse | 20 min |

---

## 7. Estimation Totale

| Phase | Temps estimé | Tâches |
|-------|-------------|--------|
| Phase 0 — Fondation | 45 min | 3 |
| Phase 1 — Data Layer | 2h20 | 5 |
| Phase 2 — Moteur Stratégies | 2h15 | 4 |
| Phase 3 — UI Onglet | 1h35 | 4 |
| Phase 4 — Calendrier + Top 8 | 1h20 | 4 |
| Phase 5 — Intégration | 30 min | 4 |
| Phase 6 — Enrichissement | 2h20 | 4 |
| **TOTAL** | **~10h45** | **24 tâches** |

---

## 8. Risques & Dépendances

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Pas d'API gratuite fiable pour handball live | Élevé | API-Sports (100 req/j) ou scraping FlashScore |
| xG handball non disponible dans APIs gratuites | Moyen | Implémenter version simplifiée (base shoots + position) |
| Données historiques limitées pour backtest | Moyen | Utiliser OddsPortal pour archives cotes |
| Starligue pas dans toutes les APIs | Faible | Scraping LNH.fr + API-Sports |
| Performance (calcul 8 stratégies en temps réel) | Faible | Cache SWR + pruning interval |

---

## 9. Sources Citées

### APIs
- https://api-sports.io/sports/handball
- https://datasportsgroup.com/coverage/handball
- https://handball.ai/apis
- https://goalserve.com/en/sport-data-feeds/handball-api
- https://statorium.com/handball-api
- https://sportbex.com/handball-api
- https://highlightly.net/handball-api/documentation
- https://oddsmatrix.com/sports/handball/

### Académiques
- Felice & Ley (2025) — "Predicting handball matches with ML" — journals.sagepub.com
- Karlis, Michels, Otting (2024) — "Modelling handball outcomes" — arxiv.org/abs/2404.04213
- Adams & David (2023) — "xG Prediction in Professional Handball" — ACM MMSports
- Nature Scientific Reports (2025) — "Performance analysis Women's Euro 2022"
- Redalyc — "Match Statistics as Predictors" — redalyc.org
- PMC/NIH (2022) — "Predictive Value of Technical Throwing Skills"
- HBL (2021) — "Handball Performance Index"

### Officiels
- https://ehfcl.eurohandball.com
- https://lnh.fr (Starligue)
- https://liquimoly-hbl.de (HBL)
- https://www.ohb-wasserburg.de (OHB)
