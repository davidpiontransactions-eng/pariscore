# Analyse Comparative — Projections de Classements Football
## Revues Académiques, Concurrents & Plan d'Implémentation

**Date** : 2026-09-09  
**Auteur** : PariScore Research Loop (skills: research, explore, task)  
**Contexte** : Enrichir le popup prematch avec des projections de classement avancées

---

## Table des matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [État de l'Art Académique](#2-état-de-lart-académique)
3. [Analyse Concurrentielle](#3-analyse-concurrentielle)
4. [Gap Analysis — PariScore vs. SOTA](#4-gap-analysis)
5. [Ce que PariScore a déjà](#5-ce-que-pariscore-a-déjà)
6. [Ce qui Manque — Opportunités](#6-ce-qui-manque)
7. [Plan d'Implémentation](#7-plan-dimplémentation)
8. [Références](#8-références)

---

## 1. Résumé Exécutif

### Le constat principal

La littérature académique (2010-2026) converge sur un point : **la qualité des features compte plus que le choix du modèle** (Kissinger 2024, Hubáček 2022). La différence entre Poisson, Dixon-Coles et Random Forest est de ~1% en accuracy (51-54%). En revanche, **l'ajout du xG et de la forme récente** améliore significativement les projections de classement.

### Ce que les concurrents font

| Concurrent | Méthode | Projection titre/relégation | xG | API |
|-----------|---------|---------------------------|-----|-----|
| **Opta Supercomputer** | Monte Carlo + Power Ratings | ✅ (enterprise) | ✅✅ | ❌ ($10k+/an) |
| **BeSoccer** | ELO basique + MC | ✅ (limité) | ❌ | ❌ |
| **FotMob** | Opta (sous-traitance) | ✅ (via Opta) | ✅ | ❌ |
| **FiveThirtyEight** | SPI Poisson + MC | ⚠️ MORT (2023) | ✅ | ❌ (CSVs archivées) |
| **PariScore** | Poisson + ELO + MC | ✅ (panel BeSoccer) | ✅ | ✅ (API interne) |

### L'opportunité

Le vide laissé par FiveThirtyEight (SPI) n'a pas été comblé. PariScore peut devenir le **"538 successor"** avec un modèle public, des données xG gratuites, et une API accessible.

---

## 2. État de l'Art Académique

### 2.1 Modèles de prédiction de matchs

#### Dixon-Coles (1997) — Le fondamental

> *Modelling Association Football Scores and Inefficiencies in the Football Betting Market*  
> Journal of the Royal Statistical Society: Series C, 46(2), pp. 265–280  
> **439 citations.** DOI: 10.1111/1467-9876.00065

- **Innovation** : Poisson bivarié corrigé pour les scores bas (0-0, 1-0, 0-1, 1-1) via le paramètre ρ
- **Time-decay** : pondère les matchs récents plus fortement
- **Résultat** : retour positif sur le marché des paris
- **Statut** : Standard industriel, implémenté dans PariScore (`src/lib/prediction/football/dixon-coles.ts`)

#### Maher (1982) — Le premier

> *Modelling Association Football Scores*  
> Statistica Neerlandica, 36(3), pp. 109–118

- Premier modèle Poisson indépendant : chaque équipe a un paramètre d'attaque et de défense
- Base théorique de tous les modèles ultérieurs

#### Glicko-2 Adaptatif (2026) — Le state-of-the-art

> arXiv:2607.01722 — *An Adaptive Glicko-2 Rating Framework for Probabilistic Football Forecasting and Season Simulation*

- Extension du Glicko-2 au football avec :
  - **Margin-of-victory** : victoire large = mise à jour plus forte
  - **Dominance weighting** : pondère les performances dominantes
  - **Structural shocks** : ajuste pour les changements de mercato
  - **Home advantage team-specific** : avantage domicile par équipe (random walk bayésien)
- **Résultats** :
  - Brier Score : **0.1587** (amélioration 4.04% vs Glicko-2 standard)
  - Simulation saison : Spearman ρ = **0.8495**, MAE points = **5.49**, erreur rang = **2.12 positions**
  - Top-4 prédit avec **91.67% d'accuracy**
- **Écart au marché** : 2.82% en Brier Score (les bookmakers restent meilleurs)

### 2.2 Machine Learning vs. Statistiques

#### Kissinger (2024) — La comparaison définitive

> arXiv:2408.08331 — *Match predictions in soccer: Machine learning vs. Poisson approaches*

- **Méthode** : Comparaison exhaustive sur 14 000 matchs des 5 top ligues
- **Résultat** : La différence entre modèles est minime :

| Modèle | RPS | Accuracy |
|--------|-----|----------|
| Dixon-Coles | ~0.20 | ~52% |
| Réseau de neurones | 0.205 | 53.9% |
| Poisson (benchmark) | 0.206 | 53.5% |
| Ensemble (Pi+DC+XGB) | **0.193** | ~56% |
| Marché (bookmakers) | **0.154** | — |

- **Conclusion clé** : "La qualité des features compte plus que le choix du modèle"

#### Frontiers in Sports (2025) — EPV vs. xG

- **xG post-match** = meilleur prédicteur (RPS 0.148, accuracy 65.6%)
- **EPV pré-match** = meilleur que xG pré-match (RPS 0.194 vs 0.199)
- L'Expected Possession Value est plus prédictif pour les performances futures

### 2.3 Simulation de saison (Monte Carlo)

#### Peltola (2024) — Méthodologie standard

> LUT University, Bachelor's Thesis — *Forecasting English Premier League season outcomes using xG-based Monte Carlo*

- **Pipeline** : xG = attaque_équipe × défense_adversaire × avantage_domicile
- **Échantillonnage** : Poisson avec λ = xG
- **Itérations** : 100 000 simulations
- **Output** : Distribution de probabilité de chaque position finale

#### Données d'entrée standard

| Input | Utilisation | Source académique |
|-------|-------------|-------------------|
| **xG** | Force attaque/défense, ±30% vs buts réels | Torvaney (70% xG + 30% buts) |
| **Forme (last N)** | 5–10 derniers matchs, pondération temporelle | Dixon-Coles time-decay |
| **ELO/Glicko** | Rating dynamique par équipe | Hvattum & Arntzen 2010 |
| **Domicile/Extérieur** | +100 points ELO ou λ séparé | Standard |
| **Calendrier restant** | Difficulté des matchs à venir | Simulation Monte Carlo |

**Référence clé** : ESPN/O'Hanlon (2025) utilise le **"adjusted goal differential"** = 70% xG + 30% buts réels. Devient prédictif autour de la 10e journée.

### 2.4 Champions League — Nouveau format

#### Winkelmann, Michels & Deutscher (2025)

> arXiv:2508.20075 — *Predicting Qualification Thresholds in the UEFA Champions League under the New League Phase Format*

- **Modèle** : Dixon-Coles + ratings ELO pour le format "league" (36 équipes, 8 matchs)
- **Constat** : baisse des nuls dans le nouveau format (moins d'incitation au match nul)
- **Seuils** : 17 pts ≈ 100% R16, mais seulement 39% pour 15 pts
- **10 000 simulations** — meilleur que les prédictions Opta sur la saison 2024/25

#### Csató (2023) — Coefficients UEFA

> arXiv:2304.09078 — *Club coefficients in the UEFA Champions League: Time for shift to an Elo-based formula*

- Le coefficient UEFA actuel est sous-optimal pour le seeding
- Un ELO basé sur les résultats des championnats domestiques prédit mieux les performances en CL

### 2.5 Sources de données académiques

| Provider | Usage académique | Accessibilité |
|----------|-----------------|---------------|
| **football-data.co.uk** | Standard pour les paris (28 000+ matchs) | Gratuit |
| **FBref / StatsBomb open-data** | xG et stats détaillées | Gratuit |
| **Understat** | xG open source | Gratuit |
| **Wyscout** | Données de scouting | Payant (Figshare pour recherche) |
| **Opta** | Standard broadcast, xG | Enterprise ($10k+) |

---

## 3. Analyse Concurrentielle

### 3.1 FiveThirtyEight — SPI (MORT)

**Statut** : Fermé en 2023 (layoffs Disney/ABC). Données supprimées en mai 2026.

**Modèle historique** :
- Ratings **off** (xG marqués vs adversaire moyen, baseline ~1.40) et **def** (xG encaissés)
- SPI = 100 × off / (off + def)
- Monte Carlo 10 000 itérations pour les classements
- Précision : ~50-55% sur 1X2

**Impact** : Le vide est comblé par personne. Les CSVs historiques (spi_matches, spi_global_rankings) étaient la source #1 pour les data scientists.

### 3.2 Opta Supercomputer

**Modèle** :
- Monte Carlo 25 000 simulations
- Power Ratings (Elo-like) + odds du marché + force adversaire
- xG, xA, Pressions via StatsBomb

**Accessibilité** :
- Public : articles The Analyst (gratuit)
- Pro : API Stats Perform ($10k+/an)
- **Pas d'API self-serve**

### 3.3 FotMob

**Données affichées** :
- xG table ("justice table") — classement par xPts
- Win probability (via Opta supercomputer)
- League table projections

**Modèle** : Pas de modèle propre — sous-traitance totale à Opta

### 3.4 BeSoccer — Le concurrent direct

**Panel "Table Prediction" exact** :
- **Pour chaque équipe** : probabilité (%) de terminer dans chaque zone :
  - Champion
  - Champions League qualifying
  - Conference League
  - Mid-table
  - Relegation play-offs
  - Relegation
- **Exemple réel** (Eliteserien 2025/26) :
  - FK Bodo Glimt : 62% Champion, 35% CL qual., 3% Conf. League
  - IK Start : 3% Mid-table, 5% Repêchage, **92% Relégation**

- **Analyses pré-match** : ELO ratings ("84 ELO"), win probability, "Tilt" (ajustement forme)

**Modèle** : ELO + Monte Carlo. Pas de xG. Pas d'API officielle.

**Acquis par Livesport** (FlashScore) en 2024.

### 3.5 Football-Data.org — API gratuite

- Standings, fixtures, résultats historiques
- **Pas de prédictions, pas de xG**
- Gratuit : 10 req/min, top ligues

### 3.6 API-Football (api-sports.io)

- **Endpoint `/predictions`** : probabilités par fixture (boîte noire)
- 1244+ ligues, 20 ans d'historique
- Gratuit : 100 req/j — Pro : $19/mois
- **Pas de xG, pas de projections de classement**

### 3.7 Sofascore

- Sofascore Rating (2000 itérations par match, 60 updates/match)
- Power Rankings + Monte Carlo
- xG tables + player ratings
- **Pas d'API publique**

### 3.8 Tableau comparatif synthétique

| Concurrent | xG | Projections titre/relégation | API | Gratuit | Qualité du modèle |
|-----------|-----|----------------------------|-----|---------|-------------------|
| Opta | ✅✅ | ✅✅ | ❌ enterprise | Articles | ⭐⭐⭐⭐⭐ |
| FotMob | ✅ (via Opta) | ✅ (via Opta) | ❌ | Partiel | ⭐⭐⭐⭐ (Opta) |
| BeSoccer | ❌ | ✅ (ELO+MC) | ❌ tiers | Partiel | ⭐⭐ |
| 538 SPI | ✅ | ✅ (MC) | ❌ CSVs | ✅ | ⭐⭐⭐⭐ |
| **PariScore** | ✅ | ✅ (Poisson+MC) | ✅ interne | ✅ | ⭐⭐⭐ |

---

## 4. Gap Analysis — PariScore vs. SOTA

### 4.1 Ce que PariScore fait bien

| Fonctionnalité | Status | Qualité vs. SOTA |
|---------------|--------|-------------------|
| Poisson bivarié | ✅ `poisson.ts` | ⭐⭐⭐⭐ (standard) |
| Dixon-Coles | ✅ `dixon-coles.ts` | ⭐⭐⭐⭐ (standard) |
| ELO → Poisson | ✅ `engine.ts` | ⭐⭐⭐ (basique) |
| ML hybride (RF+XGB+DC) | ✅ `prediction-ml-engine.ts` | ⭐⭐⭐ (approximation) |
| xG Understat | ✅ `football-xg.ts` | ⭐⭐⭐ (5 ligues) |
| Monte Carlo saison | ✅ `table-projection.ts` | ⭐⭐ (basique) |
| Forme soccerstats | ✅ `football-form.ts` | ⭐⭐⭐ |
| Backtest & calibration | ✅ `brier-score.ts` | ⭐⭐⭐⭐ |
| Walk-forward validation | ✅ `walk-forward.ts` | ⭐⭐⭐ |
| Drift detection | ✅ `drift-detection.ts` | ⭐⭐⭐⭐ |

### 4.2 Ce qui manque (gaps critiques)

| Gap | Impact | Priorité | Difficulté |
|-----|--------|----------|------------|
| **ELO/Glicko dynamique par équipe** | Rating par équipe mis à jour après chaque match (pas juste 1500 fixe) | 🔴 Haute | Moyenne |
| **xG ajusté (70/30)** | "Adjusted goal differential" = 70% xG + 30% buts réels (Torvaney) | 🔴 Haute | Faible |
| **Strength of schedule** | Difficulté du calendrier restant dans la projection | 🟡 Moyenne | Faible |
| **Time-decay Dixon-Coles** | Pondération exponentielle des matchs récents | 🟡 Moyenne | Faible |
| **Home advantage team-specific** | Avantage domicile par équipe (pas global) | 🟡 Moyenne | Faible |
| **Structural shocks** | Ajustement mercato/promus/départs clés | 🟢 Basse | Élevée |
| **Seuils CL/EL** | Projection spécifique pour le nouveau format Champions League | 🟡 Moyenne | Moyenne |
| **xG "justice table"** | Classement par xPts (xG converti en points attendus) | 🟡 Moyenne | Faible |
| **Graphique trajectoire** | Courbe positions par journée dans le panel | 🟢 Basse | Faible |

---

## 5. Ce que PariScore a déjà

### 5.1 Moteur de prédiction complet

```
src/lib/prediction/football/
├── engine.ts              # ELO → λ → Poisson → blend → EV
├── poisson.ts             # PMF, matrice 9×9, marchés
├── dixon-coles.ts         # Dixon-Coles avec ρ + time-decay
├── prediction-ml-engine.ts # RF + XGBoost + DixonColes ensemble
├── random-forest.ts       # JS-native, 50 arbres, soft-voting
├── ml-features.ts         # 20 features (ELO, forme, xG, H2H...)
├── catboost-bridge.ts     # CatBoost via Python subprocess
├── brier-score.ts         # Brier, log-loss, RPS, calibration
├── walk-forward.ts        # Validation glissante
├── drift-detection.ts     # Détection de dérive
└── ab-testing.ts          # A/B testing pour modèles
```

### 5.2 Données disponibles

| Donnée | Source | Couverture | Dispo pour projections ? |
|--------|--------|-----------|--------------------------|
| Scores + cotes | BSD | 50+ ligues | ✅ |
| xG (live + final) | BSD | Top ligues | ✅ |
| ELO (fixe 1500) | Calcul local | Toutes | ⚠️ (pas dynamique) |
| Forme W/D/L | soccerstats | 24 ligues | ✅ |
| xG détaillé | Understat | 5 ligues | ✅ |
| Standings | BSD + football-data | 50+ ligues | ✅ |
| Head-to-head | BSD | Limité | ⚠️ |
| PPDA/Pressing | Non dispo | — | ❌ |
| Blessures/compositions | BSD (partiel) | Top ligues | ⚠️ |

### 5.3 Table projection existant

```typescript
// src/lib/table-projection.ts
simulateTable(teams, fixtures, n=2000)
// → { expPts, best, worst, titleProb, top4Prob, relegProb, expRank }
// Lambda = (homeGF/homePlayed) × (awayGA/awayPlayed) × 2.70
```

**Limites actuelles** :
- Lambda basique (ratio GF/GA, pas de xG)
- Pas de time-decay
- Pas de strength of schedule
- Pas de home advantage spécifique
- Monte Carlo sur forces fixes (pas de mise à jour ELO en cours de simu)

---

## 6. Ce qui Manque — Opportunités

### 6.1 Opportunité #1 : Glicko-2 adaptatif

**Pourquoi** : Le paper arXiv:2607.01722 montre que le Glicko-2 adaptatif surpasse tous les modèles existants (Brier 0.1587, Spearman ρ=0.85). C'est le state-of-the-art académique 2026.

**Ce qu'il faut** :
- Rating par équipe (pas global 1500)
- Deviation (incertitude) + volatilité
- Mise à jour après chaque match
- Avantage domicile par équipe

### 6.2 Opportunité #2 : xG-adjusted standings

**Pourquoi** : Le "adjusted goal differential" (70% xG + 30% buts réels) est plus prédictif que les buts réels. Devient prédictif dès la 10e journée.

**Ce qu'il faut** :
- Convertir xG en "expected points" (xPts) via Poisson
- Classement par xPts au lieu de points réels
- Afficher l'écart xPts vs points réels (« luck factor »)

### 6.3 Opportunité #3 : Strength of schedule

**Pourquoi** : La difficulté du calendrier restant affecte massivement les projections. Une équipe avec 5 matchs faciles restants a plus de chances de monter qu'une avec 5 top matchs.

**Ce qu'il faut** :
- Calculer la force moyenne des adversaires restants
- Ajuster les probabilités de victoire en conséquence
- Afficher le "remaining difficulty" dans le panel

### 6.4 Opportunité #4 : Seuils CL/EL

**Pourquoi** : Le nouveau format Champions League (36 équipes, 8 matchs) a des seuils de qualification spécifiques. Le paper Winkelmann (2025) montre des écarts importants vs. Opta.

**Ce qu'il faut** :
- Projection spécifique CL/EL avec seuils (R16, QF, SF, F)
- Probabilité de qualification par équipe
- Adaptation au format "league phase"

### 6.5 Opportunité #5 : Le "538 successor"

**Pourquoi** : FiveThirtyEight est mort. Personne n'a repris leur modèle public avec CSVs accessibles. Les data scientists qui utilisaient spi_matches n'ont plus de source.

**Ce qu'il faut** :
- Exposer les prédictions via API publique
- CSVs téléchargeables par ligue
- Méthodologie publique et transparente

---

## 7. Plan d'Implémentation

### Phase 1 : Améliorer le moteur existant (1-2 semaines)

#### 1.1 ELO dynamique par équipe
**Fichier** : `src/lib/prediction/football/engine.ts`

```typescript
// Avant: eloProb({ rating: 1500 }, { rating: 1500 }) → 50%
// Après: eloProb({ rating: 1650, deviation: 45 }, { rating: 1580, deviation: 60 }) → 58%
```

- Stocker les ratings ELO par équipe (Map ou DB)
- Mise à jour après chaque match terminé
- Gérer deviation (incertitude) et volatilité
- Init 1500 pour les équipes inconnues

#### 1.2 xG-adjusted lambda
**Fichier** : `src/lib/table-projection.ts`

```typescript
// Avant: lambda = (GF/GF_avg) × (GA/GA_avg) × BTW
// Après: lambda = (0.7 × xG + 0.3 × GF) / avg × (0.7 × xGA + 0.3 × GA) / avg × BTW
```

- Utiliser `computeXGa()` existant (déjà dans `football-predictions.ts`)
- Blend 70% xG + 30% buts réels (Torvaney/ESPN)

#### 1.3 Home advantage team-specific
**Fichier** : `src/lib/table-projection.ts`

- Calculer l'avantage domicile par équipe (PPG home - PPG away)
- Remplacer le facteur global 100 (ELO) ou 2.70 (BTW)

#### 1.4 Time-decay Dixon-Coles
**Fichier** : `src/lib/prediction/football/dixon-coles.ts`

- Déjà implémenté (tau function) — vérifier qu'il est utilisé dans les projections

### Phase 2 : Enrichir les données (1 semaine)

#### 2.1 Strength of schedule
**Nouveau fichier** : `src/lib/strength-of-schedule.ts`

```typescript
export function remainingDifficulty(
  teamId: string,
  fixtures: Fixture[],
  ratings: Map<string, number>
): number {
  // Retourne la force moyenne des adversaires restants
}
```

#### 2.2 Expected points (xPts)
**Nouveau fichier** : `src/lib/expected-points.ts`

```typescript
export function xPtsFromXg(
  homeXg: number,
  awayXg: number,
  homeXga: number,
  awayXga: number
): { homeXpts: number; awayXpts: number } {
  // Poisson sur xG → P(W/D/L) → xPts
}
```

#### 2.3 Standings par xPts
**Modification** : `src/lib/league-stats-compute.ts`

- Ajouter un classement xPts (classement par points attendus)
- Afficher l'écart xPts vs points réels

### Phase 3 : UI Panel amélioré (1 semaine)

#### 3.1 xPts table
**Modification** : `src/components/football/besoccer-table-panel.tsx`

- Afficher xPts en plus des points réels
- Barre d'écart luck (xPts - pts)
- Classement xPts vs classement réel

#### 3.2 Graphique trajectoire
**Nouveau fichier** : `src/components/football/projection-trajectory-chart.tsx`

- SVG chart avec courbes par équipe
- Positions par journée (x = journée, y = position)
- Ligne pointillée = projection, ligne pleine = historique

#### 3.3 Panel CL/EL
**Nouveau fichier** : `src/components/football/cl-projection-panel.tsx`

- Seuils de qualification (R16, QF, SF, F)
- Probabilité de qualification par équipe
- Adapté au format "league phase" 36 équipes

### Phase 4 : API publique + CSVs (1 semaine)

#### 4.1 API prédictions
**Nouveau fichier** : `src/app/api/v1/predictions/route.ts`

```
GET /api/v1/predictions?league=pl&matchday=10
→ { matches: [{ home, away, homeProb, drawProb, awayProb, xG, model }] }
```

#### 4.2 CSVs téléchargeables
**Nouveau dossier** : `public/data/predictions/`

- `pl_predictions_2026.csv`
- `la_liga_predictions_2026.csv`
- etc.

#### 4.3 Méthodologie publique
**Nouveau fichier** : `docs/METHODOLOGY.md`

- Description complète du modèle
- Données d'entrée
- Métriques de calibration
- Comparaison avec les bookmakers

### Planning résumé

| Phase | Durée | Livrables |
|-------|-------|-----------|
| **Phase 1** : Moteur | 1-2 sem | ELO dynamique, xG-adjusted, team-specific home adv |
| **Phase 2** : Données | 1 sem | Strength of schedule, xPts, standings xPts |
| **Phase 3** : UI | 1 sem | xPts table, trajectoire chart, panel CL/EL |
| **Phase 4** : API | 1 sem | API publique, CSVs, méthodologie |
| **Total** | **4-5 sem** | Produit complet "538 successor" |

---

## 8. Références

### Papers académiques

1. Dixon & Coles (1997). *Modelling Association Football Scores and Inefficiencies in the Football Betting Market.* JRSS-C, 46(2), 265–280.
2. Maher (1982). *Modelling Association Football Scores.* Statistica Neerlandica, 36(3), 109–118.
3. Hvattum & Arntzen (2010). *Using ELO ratings for match result prediction in association football.* Int J Forecasting, 26(3), 450–463.
4. Glickman (1999). *Parameter estimation in large dynamic paired comparison experiments.* JRSS-C, 48(3), 377–394.
5. arXiv:2607.01722 (2026). *An Adaptive Glicko-2 Rating Framework for Probabilistic Football Forecasting and Season Simulation.*
6. Kissinger (2024). *Match predictions in soccer: Machine learning vs. Poisson approaches.* arXiv:2408.08331.
7. arXiv:2508.20075 (2025). *Predicting Qualification Thresholds in the UEFA Champions League under the New League Phase Format.*
8. arXiv:2304.09078 (2023). *Club coefficients in the UEFA Champions League: Time for shift to an Elo-based formula.*
9. Frontiers in Sports (2025). *AI in Bundesliga match analysis — EPV vs. xG to predict match outcomes.*
10. Peltola (2024). *Forecasting English Premier League season outcomes using expected goals-based Monte Carlo simulation.* LUT University.
11. Constantinou & Fenton (2013). *Profiting from an Inefficiency in the Over/Under 2.5 Goals Betting Market.*

### Sites concurrents

12. FiveThirtyEight SPI — fivethirtyeight.com (archivé, données supprimées 2026)
13. Opta Supercomputer — theanalyst.com
14. FotMob — fotmob.com
15. BeSoccer — besoccer.com
16. Football-Data.org — football-data.org
17. API-Football — api-sports.io
18. Sofascore — sofascore.com
19. FootyStats.org — footystats.org

### Données

20. football-data.co.uk — odds + résultats (28 000+ matchs)
21. FBref / StatsBomb open-data — xG + stats détaillées
22. Understat — xG open source (5 ligues)
23. Soccerstats.com — forme home/away
24. BSD (bzzoiro.com) — scores, cotes, xG live, stats
