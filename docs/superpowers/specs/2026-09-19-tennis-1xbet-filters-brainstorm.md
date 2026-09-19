# Brainstorming — Filtres & KPIs Top10 Tennis basés marchés 1xBet

**Date** : 2026-09-19  
**Contexte** : Pariscore a déjà 45 marchés tennis mappés (`tennis-market-map.ts`) et un système Top10 par stratégie (9 stratégies actuelles). L'objectif est de monter un système de filtrage + KPI qui sélectionne les 10 meilleurs matchs **par rapport aux bets proposés par 1xBet**, avec un modèle prédictif de qualité.

---

## 1. Inventaire des marchés 1xBet tennis (47 marchés)

### 1.1 Classification par nature de pari

| Catégorie | Marchés | Type de prédiction |
|-----------|---------|-------------------|
| **Vainqueur** | match-winner, live-match-winner | Probabilité binaire |
| **Score exact sets** | 2-0, 2-1, 0-2, 1-2 | Distribution discrète |
| **Handicap sets** | ±1.5, ±2.5 | Seuil sur différence sets |
| **Handicap jeux** | ±2.5, ±4.5 | Seuil sur différence jeux |
| **Total jeux** | O/U 18.5 à 22.5 | Seuil sur somme jeux |
| **Total jeux par set** | O/U 6.5, 7.5, 8.5, 9.5, 10.5 par set | Seuil sur jeux d'un set |
| **Total jeux joueur** | A/B Over 12.5 | Seuil par joueur |
| **Aces** | O/U 9.5/12.5/15.5, most aces | Distribution Skellam |
| **Tiebreak** | yes/no, 1er set | Bernoulli conditionnel |
| **1er set** | winner, O/U 9.5 | Sous-modèle set 1 |
| **Double result** | set+match combos | Jointure 2 événements |
| **Live** | set en cours, prochain jeu | Markov temps réel |

### 1.2 Classification par difficulté de modélisation

| Difficulté | Marchés | Pourquoi |
|------------|---------|----------|
| **Facile** | match-winner, handicap sets, total jeux | Modèle Poisson/Markov classique |
| **Moyen** | score exact, handicap jeux, 1er set, double result, **total jeux par set** | Markov conditionnel par set |
| **Difficile** | aces, tiebreak, most aces | Modèles spécifiques (Skellam, Bernoulli conditionnel) |
| **Très difficile** | live (prochain jeu, set en cours) | Temps réel, blend bayésien |

---

## 2. Filtres proposés pour le Top10 par bets

### 2.1 Filtres de sélection des matchs qualifiés

L'idée : chaque match est noté sur plusieurs dimensions, et le Top10 agrège les meilleurs scores.

#### A. Filtres de qualité du signal (disponibilité des données)

| Filtre | Description | Seuil min | Impact |
|--------|-------------|-----------|--------|
| **Cotes disponibles** | Le match a des cotes 1xBet pour le marché ciblé | ≥ 1 marché | Éliminatoire |
| **Élo connu** | Les 2 joueurs ont un Élo surface | Élo A > 0 ET Élo B > 0 | Éliminatoire |
| **Forme L5/L10** | Au moins 5 matchs récents pour les 2 joueurs | ≥ 5 matchs | Qualité du signal |
| **Statistiques serveur** | Hold% connu pour les 2 joueurs | Hold% A > 0 ET Hold% B > 0 | Requis pour aces/tiebreak |
| **Historique H2H** | Confrontations directes disponibles | ≥ 1 H2H | Bonus qualité |

#### B. Filtres de value (écart modèle vs marché)

| Filtre | Description | Seuil | Formule |
|--------|-------------|-------|---------|
| **Edge** | Écart entre proba modèle et proba implicite cote | ≥ 3% | `edge = probModele - (1/cote)` |
| **Edge pondéré** | Edge ajusté par la confiance du modèle | ≥ 2% | `edge_pond = edge × confiance` |
| **Kelly fraction** | Mise optimale selon Kelly | ≥ 1% bankroll | `f = (edge × cote - 1) / (cote - 1)` |
| **CLV (Closing Line Value)** | Le prix bouge dans notre sens (live) | > 0 | `clv = cote_fermée / cote_ouverte - 1` |

#### C. Filtres de contexte match

| Filtre | Description | Seuil | Impact |
|--------|-------------|-------|--------|
| **Surface** | Type de surface (hard, clay, grass, indoor) | Toutes | Modèle surface-spécifique |
| **Catégorie tournoi** | Grand Slam, ATP 1000, 500, 250, Challenger, ITF | Pondération | Poids décroissant |
| **Round** | Tour du tournoi (R1, R2, ..., F, QF, SF) | Tous | Fatigue, motivation |
| **Jour/heure** | Fuseau horaire, heure locale du match | Tous | Fatigue décalage |
| **Retrait/forfait** | Historique de retraits récents | ≥ 1 retrait en 30j | Risque W/O |

#### D. Filtres de marché spécifique

| Filtre | Description | Seuil | Marchés liés |
|--------|-------------|-------|-------------|
| **Spread implicite** | Écart de cote entre favori et outsider | ≤ 3.0 | Handicap, total |
| **Volatilité cotes** | Mouvement des cotes dans les dernières 24h | ≥ 5% | Value mouvante |
| **Nombre de bookmakers** | Combien de bookmakers proposent le marché | ≥ 3 | Fiabilité du prix |
| **Liquideur** | Volume de paris (si disponible) | > 0 | Marché efficient |

### 2.2 Architecture de scoring combiné

```
Score_Match = Σ (poids_i × score_dimension_i)

Dimensions :
  1. Signal_Data    = f(Élo, forme, hold%, H2H)         [0-100]
  2. Value_Edge     = f(edge, kelly, clv)                [0-100]
  3. Context_Quality = f(surface, catégorie, round)      [0-100]
  4. Market_Confidence = f(spread, volatilité, liquidité) [0-100]

Poids recommandés :
  Signal_Data      : 35%  (données fiables = base)
  Value_Edge       : 35%  (c'est le but : trouver la value)
  Context_Quality  : 15%  (ajustement contextuel)
  Market_Confidence: 15%  (fiabilité du prix)
```

---

## 3. Méthode de calcul du modèle prédictif

### 3.1 Choix des métriques/stats par type de marché

#### Match Winner (Vainqueur)

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Élo surface** | TennisAbstract/ATP | 30% | `elo_surface = base_elo × surface_factor` |
| **Forme L5** | 5 derniers matchs | 20% | `forme = wins_L5 / 5 × 100` |
| **Hold% surface** | Stats serveur | 20% | `hold_pct = holds / service_games` |
| **Break% surface** | Stats retour | 15% | `break_pct = breaks / return_games` |
| **H2H** | Confrontations | 10% | `h2h = wins_h2h / total_h2h` |
| **Fatigue** | Matchs récents | 5% | `fatigue = matches_last_7d / max_healthy` |

**Formule composite :**
```
prob_A_win = sigmoid(
    0.30 × (elo_A - elo_B) / 400 +
    0.20 × (forme_A - forme_B) / 100 +
    0.20 × (hold_A - hold_B) / 100 +
    0.15 × (break_A - break_B) / 100 +
    0.10 × (h2h_A - h2h_B) / 100 +
    0.05 × (fatigue_B - fatigue_A) / 100
)
```

#### Handicap Jeux (±2.5, ±4.5)

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Hold% A** | Stats serveur | 30% | `expected_games_A = sets × (hold_A + break_B)` |
| **Hold% B** | Stats serveur | 30% | `expected_games_B = sets × (hold_B + break_A)` |
| **Élo surface** | TennisAbstract | 25% | Ajustement force relative |
| **Forme L10** | 10 derniers matchs | 15% | Stabilité récente |

**Modèle Poisson :**
```
λ_A = sets × (hold_A + break_B)  // jeux attendus joueur A
λ_B = sets × (hold_B + break_A)  // jeux attendus joueur B

P(handicap -2.5) = P(λ_A - λ_B > 2.5) = 1 - CDF_Poisson(2.5, λ_A - λ_B)
```

#### Total Jeux (O/U 18.5 à 22.5)

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Hold% A** | Stats serveur | 35% | `λ_total = sets × (hold_A + hold_B)` |
| **Hold% B** | Stats serveur | 35% | Idem |
| **Élo surface** | TennisAbstract | 20% | Ajustement |
| **Tiebreak% historique** | H2H + stats | 10% | Si tiebreak probable, +1 jeu |

**Modèle Poisson :**
```
λ_total = 2 × (hold_A + hold_B) × expected_sets

P(Over 21.5) = 1 - CDF_Poisson(21.5, λ_total)
```

#### Aces (O/U, Most Aces)

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Aces/match joueur A** | Stats ATP | 35% | `λ_aces_A = aces_per_match_A × surface_factor` |
| **Aces/match joueur B** | Stats ATP | 35% | `λ_aces_B = aces_per_match_B × surface_factor` |
| **Aces/match adversaire** | Stats défense | 20% | `aces_conceded_per_match` |
| **Surface** | Hard/Clay/Grass | 10% | Grass × 1.3, Hard × 1.0, Clay × 0.7 |

**Modèle Skellam (différence de Poissons) :**
```
λ_aces_A = aces_per_match_A × surface_factor × opponent_aces_factor
λ_aces_B = aces_per_match_B × surface_factor × opponent_aces_factor

P(most_aces_A) = P(Skellam(λ_aces_A, λ_aces_B) > 0)
P(Over 12.5) = P(Poisson(λ_aces_A + λ_aces_B) > 12.5)
```

#### Tiebreak (Yes/No)

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Hold% A** | Stats serveur | 30% | `p_tiebreak_set = P(6-6)` |
| **Hold% B** | Stats serveur | 30% | `= CDF_Binom(6, hold_A) × CDF_Binom(6, hold_B)` |
| **Élo surface** | TennisAbstract | 20% | Plus serré → plus tiebreak |
| **H2H tiebreak%** | Confrontations | 20% | Historique direct |

**Modèle Bernoulli conditionnel :**
```
p_hold_set = hold_A^6 × hold_B^6 × C(12,6)  // probabilité 6-6

P(tiebreak_match) = 1 - (1 - p_hold_set)^expected_sets
```

#### Score Exact Sets (2-0, 2-1, etc.)

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Prob set gagné A** | Markov | 40% | `p_set_A = gameWinProb(hold_A, break_B)` |
| **Prob set gagné B** | Markov | 40% | `p_set_B = gameWinProb(hold_B, break_A)` |
| **Élo surface** | TennisAbstract | 20% | Ajustement |

**Modèle DP (programmation dynamique) :**
```
P(2-0) = p_set_A^2
P(2-1) = C(2,1) × p_set_A^2 × p_set_B  // A gagne 2 sets, B en gagne 1
P(0-2) = p_set_B^2
P(1-2) = C(2,1) × p_set_B^2 × p_set_A
```

#### Double Result (Set + Match)

```
P(A-A) = p_set1_A × p_match_A_given_set1_A
P(B-B) = p_set1_B × p_match_B_given_set1_B
P(A-B) = p_set1_A × p_match_B_given_set1_A
P(B-A) = p_set1_B × p_match_A_given_set1_B
```

#### 1er Set

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Hold% A** | Stats serveur | 35% | `p_game_A = hold_A` |
| **Hold% B** | Stats serveur | 35% | `p_game_B = hold_B` |
| **Élo surface** | TennisAbstract | 20% | Ajustement |
| **Momentum** | Forme récente | 10% | Derniers 3 matchs |

**Modèle Markov :**
```
p_set1_A = setWinProb(hold_A, hold_B)  // DP récursif
p_set1_B = 1 - p_set1_A

P(1er set Over 9.5) = P(set score ≥ 6-4 ou 7-5 ou 7-6)
                    = 1 - P(6-0) - P(6-1) - P(6-2) - P(6-3)
```

#### Total Jeux par Set (O/U 6.5, 7.5, 8.5, 9.5, 10.5)

Marché 1xBet : chaque set est un pari indépendant. Le modèle calcule la distribution exacte du nombre de jeux dans un set.

| Métrique | Source | Poids | Calcul |
|----------|--------|-------|--------|
| **Hold% A** | Stats serveur | 35% | `p_game_A = hold_A` |
| **Hold% B** | Stats serveur | 35% | `p_game_B = hold_B` |
| **Élo surface** | TennisAbstract | 20% | Ajustement force relative |
| **Surface** | Hard/Clay/Grass | 10% | Clay → sets plus longs |

**Modèle Markov — distribution exacte des jeux par set :**

Le set tennis est un processus de Markov sur la grille (i,j) où i=jeux A, j=jeux B.
On calcule P(set se termine avec exactement N jeux) pour chaque N.

```
États absorbants : {6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6} pour A
                   {0-6, 1-6, 2-6, 3-6, 4-6, 5-7, 6-7} pour B

P(set = N jeux) = Σ P(chemin vers score final avec N jeux)

Exemples :
  P(set = 6 jeux)  = P(6-0) + P(0-6)           = hold^6 + (1-hold)^6
  P(set = 7 jeux)  = P(6-1) + P(1-6)           = C(6,1)×hold^6×(1-hold) + ...
  P(set = 8 jeux)  = P(6-2) + P(2-6)
  P(set = 9 jeux)  = P(6-3) + P(3-6)
  P(set = 10 jeux) = P(6-4) + P(4-6)
  P(set = 12 jeux) = P(7-6) + P(6-7)           = probabilité tiebreak
  P(set = 13 jeux) = P(7-6 tiebreak) × (jeux supplémentaires)

P(Over 7.5) = P(set ≥ 8 jeux) = 1 - P(set ≤ 7)
            = 1 - [P(6-0) + P(0-6) + P(6-1) + P(1-6)]

P(Over 8.5) = P(set ≥ 9 jeux) = 1 - P(set ≤ 8)
            = 1 - [P(6-0) + P(0-6) + P(6-1) + P(1-6) + P(6-2) + P(2-6)]
```

**Table de probabilité typique (hold_A=0.70, hold_B=0.65) :**

| Jeux dans le set | P(set = N) | P(Over N-0.5) |
|------------------|------------|---------------|
| 6 (6-0, 0-6) | ~5% | 95% |
| 7 (6-1, 1-6) | ~18% | 77% |
| 8 (6-2, 2-6) | ~28% | 49% |
| 9 (6-3, 3-6) | ~25% | 24% |
| 10 (6-4, 4-6) | ~14% | 10% |
| 12 (7-6, 6-7) | ~10% | 10% |

**Implication pour le scoring :**
- Over 6.5 : quasiment toujours vrai (95%+) → cotes très basses, peu de value
- Over 7.5 : ~77% → bon ratio risque/value si le modèle est calibré
- Over 8.5 : ~49% → coin flip, value si edge détecté
- Over 9.5 : ~24% → outsider, value si hold% élevés des 2 côtés
- Over 10.5 : ~10% → gros outsider, value si match très serré

### 3.2 Métriques d'évaluation du modèle

| Métrique | Description | Cible | Calcul |
|----------|-------------|-------|--------|
| **Brier Score** | Erreur quadratique moyenne | ≤ 0.20 | `BS = (1/n) Σ (p_i - outcome_i)²` |
| **Log Loss** | Log-vraisemblance négative | ≤ 0.60 | `LL = -(1/n) Σ [y×log(p) + (1-y)×log(1-p)]` |
| **Calibration** | Proba prédite vs observée | Diagonale | Graphique de fiabilité |
| **ROI** | Retour sur investissement | > 5% | `ROI = (gains - mises) / mises × 100` |
| **CLV** | Closing Line Value | > 0% | `CLV = cote_fermée / cote_ouverte - 1` |
| **Hit Rate** | % de paris gagnants | > 55% | `hits / total_bets` |
| **Profit Factor** | Gains / Pertes | > 1.5 | `Σ gains / Σ pertes` |
| **Sharpe Ratio** | Rendement ajusté risque | > 1.0 | `mean_return / std_return` |

### 3.3 Architecture du pipeline prédictif

```
┌─────────────────────────────────────────────────────────┐
│                    DATA COLLECTION                       │
├─────────────────────────────────────────────────────────┤
│  API 1xBet (cotes)  │  TennisAbstract (Élo, stats)     │
│  API BSD (fixtures)  │  Flashscore (live scores)        │
│  ATP/WTA (classements) │  Scraping (hold%, break%)     │
└──────────┬──────────┴──────────────┬────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                   FEATURE ENGINEERING                    │
├─────────────────────────────────────────────────────────┤
│  Élo surface    │  Hold%/Break% par surface             │
│  Forme L5/L10   │  Aces/match, DF/match                │
│  H2H stats      │  Fatigue (matchs 7j)                 │
│  Tiebreak%      │  Catégorie tournoi, round            │
└──────────┬──────────┴──────────────┬────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                   MODEL ENSEMBLE                        │
├─────────────────────────────────────────────────────────┤
│  Markov (sets/jeux)  │  Poisson (total, handicap)       │
│  Skellam (aces)      │  DP (score exact)                │
│  Bayesian Blend (live) │  Logistic Regression (meta)    │
└──────────┬──────────┴──────────────┬────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                   VALUE DETECTION                       │
├─────────────────────────────────────────────────────────┤
│  edge = prob_modele - prob_implicite                    │
│  kelly = (edge × cote - 1) / (cote - 1)                │
│  confidence = f(data_quality, model_agreement)          │
│  score = edge × confidence × kelly_factor               │
└──────────┬──────────┴──────────────┬────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                   TOP10 SELECTION                       │
├─────────────────────────────────────────────────────────┤
│  1. Filtrer : données complètes + edge ≥ seuil          │
│  2. Scorer : par marché 1xBet (score_market)            │
│  3. Agréger : score_composite = Σ(poids × score)        │
│  4. Trier : décroissant par score_composite             │
│  5. Sélectionner : top 10 non-redondants                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Implémentation dans Pariscore

### 4.1 Fichiers à créer/modifier

| Fichier | Action | Contenu |
|---------|--------|---------|
| `src/lib/tennis-1xbet-filters.ts` | **Créer** | Filtres + scoring par marché 1xBet |
| `src/lib/tennis-market-scorer.ts` | **Créer** | Calcul score par marché (Markov, Poisson, Skellam, DP) |
| `src/lib/tennis-value-detector.ts` | **Créer** | Edge, Kelly, CLV, confiance |
| `src/lib/prediction/tennis-market-map.ts` | **Modifier** | Ajouter marchés manquants (straight sets, 1er set score exact, etc.) |
| `src/components/tennis/tennis-top10-matches-widget.tsx` | **Modifier** | Ajouter filtres 1xBet dans l'UI |
| `src/app/api/tennis/strategy-top10/route.ts` | **Modifier** | Intégrer le nouveau pipeline |
| `src/lib/tennis-filters.ts` | **Modifier** | Filtres enrichis (cotes, edge, Kelly) |

### 4.2 Nouveaux filtres UI proposés

```
┌─────────────────────────────────────────────────────────┐
│  Top 10 matchs par stratégie                            │
├─────────────────────────────────────────────────────────┤
│  [Sélection stratégie ▼]  [Tournoi ▼]  [Surface ▼]     │
│                                                         │
│  ┌─ Fenêtre temporelle ─┐  ┌─ Filtre value ──────────┐  │
│  │ Tout │ Jour │ 48h │ Sem. │  │ Edge ≥ [3]%  [✓]     │  │
│  └──────────────────────┘  │ Kelly ≥ [1]%  [✓]        │  │
│                            │ Cote ≤ [3.0]  [✓]        │  │
│  ┌─ Marché 1xBet ────────┐  └────────────────────────┘  │
│  │ Vainqueur │ Handicap   │                             │
│  │ Total jeux │ Aces      │                             │
│  │ Tiebreak │ 1er set     │                             │
│  │ Score exact │ Double   │                             │
│  └────────────────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Workflow d'implémentation (étapes)

| Étape | Durée | Description |
|-------|-------|-------------|
| **1. Data layer** | 2h | Enrichir `tennis-market-map.ts` avec marchés manquants |
| **2. Scoring engine** | 4h | `tennis-market-scorer.ts` — calcul proba par marché |
| **3. Value detector** | 2h | `tennis-value-detector.ts` — edge, Kelly, confiance |
| **4. Filtres** | 2h | `tennis-1xbet-filters.ts` — filtres combinés |
| **5. API route** | 1h | Modifier `/api/tennis/strategy-top10` |
| **6. UI** | 2h | Filtres marché 1xBet dans le widget Top10 |
| **7. Tests** | 2h | Tests unitaires + intégration |
| **8. Calibration** | ∞ | Backtesting continu, ajustement poids |

**Total estimé : ~15h de développement**

### 4.4 Intégration avec l'existant

Le système actuel (`TENNIS_STRATEGY_DEFS` avec 9 stratégies) reste en place. Le nouveau système **ajoute** une couche "marché 1xBet" par-dessus :

```
Stratégie actuelle (surfaceEloGap, momentum, etc.)
    ↓
Filtres marché 1xBet (handicap, total, aces, etc.)
    ↓
Value detection (edge, Kelly, CLV)
    ↓
Score composite → Top10
```

L'utilisateur peut choisir :
- **Mode stratégie** : les 9 stratégies actuelles (rapide, léger)
- **Mode marché 1xBet** : sélection par type de pari (plus précis, plus de données)

---

## 5. Recommandations

### 5.1 Prioriser les marchés à forte edge

| Priorité | Marché | Pourquoi |
|----------|--------|----------|
| **P0** | Match winner | Le plus liquide, le plus de données |
| **P0** | Total jeux (O/U 21.5) | Modèle Poisson fiable, bonne calibration |
| **P0** | **Total jeux par set (O/U 7.5, 8.5)** | Modèle Markov précis, marché très liquide |
| **P1** | Handicap jeux (±4.5) | Bonne différenciation, données hold% |
| **P1** | 1er set winner | Sous-modèle Markov, données fiables |
| **P2** | Aces (O/U 12.5) | Modèle Skellam, données spécifiques |
| **P2** | Tiebreak (yes/no) | Bernoulli conditionnel, données limitées |
| **P3** | Score exact sets | Distribution fine, mais moins de données |
| **P3** | Double result | Jointure, complexité élevée |

### 5.2 Garde-fous

1. **Ne jamais parier sans edge ≥ 3%** — le modèle peut avoir raison mais le prix est juste
2. **Kelly fraction capped à 5%** — éviter le ruin
3. **Calibration mensuelle** — recalculer les poids avec les résultats réels
4. **Diversification** — ne pas concentrer sur un seul marché
5. **CLV tracking** — si CLV < 0 sur 100 paris, revoir le modèle

### 5.3 Métriques de suivi

| Métrique | Fréquence | Seuil alerte |
|----------|-----------|-------------|
| Brier Score | Hebdo | > 0.25 |
| ROI | Mensuel | < 0% |
| Hit Rate | Hebdo | < 52% |
| CLV moyen | Mensuel | < 0% |
| Profit Factor | Mensuel | < 1.2 |
| Calibration | Mensuel | Écart > 5% |

---

## 6. Conclusion

Le système proposé combine :
- **47 marchés 1xBet** classés par catégorie et difficulté
- **Filtres multi-dimensions** (données, value, contexte, marché)
- **Modèles spécialisés** par type de marché (Markov, Poisson, Skellam, DP, Bayesian)
- **KPIs robustes** (Brier, ROI, CLV, calibration)
- **Intégration progressive** dans l'architecture Pariscore existante

L'approche recommandée : commencer par **P0** (match winner + total jeux), valider la calibration, puis étendre aux marchés P1/P2/P3.
