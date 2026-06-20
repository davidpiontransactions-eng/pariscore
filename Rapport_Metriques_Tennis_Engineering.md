# Rapport Technique — Métriques Tennis pour Pariscore

## Analyse Croisée de 14 Thèses (2023-2026) pour le Système H2H Top 10

---

**Objet** : Définir le jeu de données métriques optimal pour la prédiction des matchs de tennis, en priorité pour le **Head-to-Head (H2H) du Top 10 ATP**, destiné à l'équipe engineering pour phase de codification et web scraping.

**Date** : 17 Juin 2026
**Version** : 1.0

---

## Table des Matières

1. [Synthèse des 14 Thèses Tennis](#1-synthèse-des-14-thèses-tennis)
2. [Hiérarchisation des Métriques par Pouvoir Prédictif](#2-hiérarchisation-des-métriques)
3. [Métriques Augmentées pour le H2H Top 10](#3-métriques-augmentées-h2h-top-10)
4. [Spécifications Techniques pour l'Équipe Engineering](#4-spécifications-engineering)
5. [Plan de Scraping Web](#5-plan-de-scraping-web)
6. [Sources de Données](#6-sources-de-données)
7. [Annexe : Tableau Complet des Modèles et Performances](#7-annexe)

---

## 1. Synthèse des 14 Thèses Tennis

### 1.1 Tableau Comparatif des Performances

| Thèse | Année | Modèle Champion | Accuracy Globale | Accuracy Grands Chelems | Métrique Clé #1 |
|-------|-------|----------------|------------------|------------------------|-----------------|
| **Dryja** | 2025 | Random Forest | 67.7% | **76.4%** | Serve Advantage (SRV_ADV) |
| **Buhamra** | 2025 | Random Forest | — | **82.0%** | Elo + Age.30 |
| **Ünal** | 2023 | XGBoost | **70.5%** | — | Cotes bookmakers |
| **Sokka** | 2026 | Logistic Regression | 68.3% | — | Elo surface-spécifique |
| **Schmidt** | 2026 | ELO-ML Hybride | 67.5% | — | Combinaison Elo + ML |
| **Sklenička** | 2024 | Logistic Regression | 63-65% | — | Spécialisation surface |
| **Illum et al.** | 2025 | XGBoost | 73.4%* | — | Sets gagnés, Rank |
| **Zhai & Wang** | 2024 | Ridge-XGBoost | 94%** | — | Serve Decay Factor |
| **Nübel** | 2024 | MCTS Greedy | — | — | Shot selection RL |
| **Alm & Markai** | 2024 | Deep Learning | — | — | Données marché |
| **Korpelshoek** | 2023 | FCN | — | — | Tracking balle |
| **Chen (Doubles)** | 2025 | CNN | — | — | Tracking video |
| **Thorpe et al.** | 2024 | Transformer | — | — | Simulation rallye |
| **Garcia de Baq.** | 2023 | Multi | — | — | Scouting |

*\* Prédiction point-par-point (baseline à 73.2%)*  
*\*\* Sur un seul match (Wimbledon 2023 final) — non généralisable*

### 1.2 Ranking des Métriques par Importance (Méta-Analyse)

Basé sur le croisement des feature importance, LOFO, SHAP et ablation studies des 14 thèses :

| Rang | Métrique | Thèses qui la valident | Présence | Impact |
|------|----------|------------------------|----------|--------|
| **1** | **Elo Surface-spécifique** | Dryja, Buhamra, Sokka, Schmidt, Sklenička | **5/5** | ⭐⭐⭐ |
| **2** | **Serve Advantage (SRV_ADV)** | Dryja (+ analyse SHAP) | 1/5 mais le + important de Dryja | ⭐⭐⭐ |
| **3** | **Points au classement ATP** | Buhamra, Sokka, Illum, Ünal | 4/5 | ⭐⭐ |
| **4** | **Completeness (CMPLT)** | Dryja | 1/5 (mais très innovant) | ⭐⭐ |
| **5** | **Momentum (MOMENTUM)** | Dryja, Zhai & Wang (serve decay) | 2/5 | ⭐⭐ |
| **6** | **Age (transformation Age.30)** | Buhamra (SEL framework) | 1/5 mais +2.5% accuracy | ⭐⭐ |
| **7** | **Win rate sur surface** | Dryja, Sklenička, Sokka | 3/5 | ⭐⭐ |
| **8** | **Stats de service EWMA** | Dryja (S/L), Illum (accumulé) | 2/5 | ⭐⭐ |
| **9** | **Spécialisation surface** | Sklenička (9 variables) | 1/5 dédié | ⭐⭐ |
| **10** | **Head-to-Head (H2H)** | Dryja, Ünal | 2/5 (présent mais pas top) | ⭐ |
| **11** | **Cotes bookmakers** | Ünal (domine toutes les features) | 1/5 | ⭐ variable |
| **12** | **Stats de retour** | Dryja, Illum | 2/5 | ⭐ |

---

## 2. Hiérarchisation des Métriques

### 2.1 Noyau Dur (À Implémenter en Priorité)

Ces métriques sont validées par **au moins 3 thèses** et ont le plus fort pouvoir prédictif :

```
┌─────────────────────────────────────────────────────────────┐
│                    MÉTRIQUES CŒUR (Core)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RANKING & SKILL                                            │
│  ├── ELO_SURFACE      → Rating Elo spécifique par surface   │
│  │                      (dur, terre battue, gazon)           │
│  ├── ELO_GLOBAL       → Rating Elo général                  │
│  ├── ATP_RANK         → Classement ATP officiel             │
│  └── ATP_PTS          → Points ATP cumulés                  │
│                                                             │
│  PERFORMANCE COMPOSÉE                                        │
│  ├── SRV_ADV          → Service Advantage                   │
│  │   (pts serv gagnés − pts retour adverses gagnés)          │
│  ├── CMPLT            → Completeness                         │
│  │   (pts serv gagnés × pts retour gagnés)                   │
│  └── MOMENTUM         → Direction forme récente              │
│                                                             │
│  STATS DE SURFACE                                            │
│  ├── WINRATE_SURFACE  → % victoires sur cette surface        │
│  ├── SRV_GMS_WON_SURF → % jeux service gagnés sur surface    │
│  └── RET_GMS_WON_SURF → % jeux retour gagnés sur surface     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Métriques EWMA (Validé par Dryja + Illum)

Deux échelles temporelles pour chaque métrique de performance :

```
Métrique de performance (ACE, DF, 1ST_IN, 1ST_WON, 2ND_WON,
                         SRV_PTS_WON, SRV_GMS_WON,
                         RET_PTS_WON, RET_GMS_WON,
                         BP_CONV, BP_SAVED)

    ├── EWMA court terme (α=0.18, ½ vie ≈ 3.5 matchs)
    │   → Forme récente, réactivité
    │
    └── EWMA long terme  (α=0.05, ½ vie ≈ 14 matchs)
        → Tendance stable, bruit filtré

    Puis : DIFFÉRENTIEL JoueurA − JoueurB
    Puis : MOMENTUM = EWMA_court − EWMA_long
```

### 2.3 Métriques Augmentées (Buhamra SEL Framework)

Innovations du framework **Statistically Enhanced Learning (SEL)** qui ont fait passer l'accuracy de 79.5% → 82.0% :

```
┌─────────────────────────────────────────────────────────────┐
│           TRANSFORMATIONS SEL (Buhamra 2025)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AGE.30    = |age − 30|              (âge optimal ≈ 30 ans)  │
│  AGE.int   = distance à [28, 32]      (fenêtre pic carrière) │
│  RANK_DIFF = rank_A − rank_B          (différentiel classmt) │
│  POINTS_DIFF = pts_A − pts_B          (différentiel points)  │
│                                                             │
│  Ces transformations ajoutent +2.5% d'accuracy à elles       │
│  seules, tous modèles confondus                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Métriques Live / In-Play (Validé par Illum + Zhai + Nübel)

```
┌─────────────────────────────────────────────────────────────┐
│               MÉTRIQUES LIVE (Phase 2)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  POINT-LEVEL                                                │
│  ├── P1Score, P2Score          (points dans le jeu)          │
│  ├── P1GamesWon, P2GamesWon    (jeux gagnés dans le set)     │
│  ├── P1SetsWon, P2SetsWon      (sets gagnés)                 │
│  ├── RallyCount                (nombre de coups échange)     │
│  └── Speed_KMH                 (vitesse service)             │
│                                                             │
│  ACCUMULATED (fenêtre glissante)                             │
│  ├── AceA, DFA                 (accumulés dans le match)     │
│  ├── WinnerA, UnfErrA          (coups gagnants / fautes)     │
│  ├── NetPointA, NetPointWonA   (points au filet)             │
│  ├── BreakPointA, BreakPointWonA (balles de break)           │
│  └── DistanceRunA              (distance parcourue)          │
│                                                             │
│  MOMENTUM LIVE (Zhai & Wang)                                 │
│  ├── Serve_Decay_Factor        (déclin dominance service)    │
│  ├── Winning_Rate_Derivative   (dérivée taux de victoire)    │
│  └── Game_Fluctuation          (volatilité jeu en cours)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**⚠️ Attention (Illum 2025)** : La prédiction point-par-point avec données publiques est **quasi impossible** (73.4% vs baseline 73.2%). Les données Hawk-Eye sont nécessaires pour le point-level. Ne pas investir dans le point-level avant d'avoir un flux Hawk-Eye.

---

## 3. Métriques Augmentées pour le H2H Top 10

### 3.1 Architecture du Module H2H

Le Head-to-Head (H2H) est présent dans plusieurs thèses (Dryja, Ünal) mais n'est **jamais le facteur le plus important**. L'innovation Pariscore est de l'**augmenter** avec les métriques contextuelles :

```
┌─────────────────────────────────────────────────────────────┐
│              SYSTÈME H2H AUGMENTÉ PARISCORE                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pour chaque paire (JoueurA, JoueurB) du Top 10 :           │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │ BASE H2H (classique)                             │       │
│  │  ├── H2H_WINS           → Victoires A vs B       │       │
│  │  ├── H2H_LOSSES         → Défaites A vs B        │       │
│  │  ├── H2H_WINRATE        → Ratio victoires         │       │
│  │  ├── H2H_LAST5          → Résultats 5 derniers     │       │
│  │  └── H2H_STREAK         → Séquence en cours        │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │ AUGMENTATION SURFACE (Sklenička + Dryja)         │       │
│  │  ├── H2H_SURFACE_WINS   → Victoires sur surface   │       │
│  │  ├── H2H_SURFACE_SET    → % sets gagnés surface   │       │
│  │  ├── H2H_SURFACE_GAMES  → % jeux gagnés surface   │       │
│  │  ├── H2H_SURFACE_BP     → Breaks convertis         │       │
│  │  └── H2H_SURFACE_SRV    → Points service gagnés    │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │ AUGMENTATION TOURNOI (Buhamra + Dryja)           │       │
│  │  ├── H2H_GRAND_SLAM     → H2H en Grand Chelem     │       │
│  │  ├── H2H_MASTERS        → H2H en Masters 1000     │       │
│  │  ├── H2H_FINAL          → H2H en finale            │       │
│  │  ├── H2H_5TH_SET        → H2H en 5ème set          │       │
│  │  ├── H2H_TIEBREAK       → H2H en tie-break         │       │
│  │  └── H2H_DECIDING_SET   → H2H set décisif          │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │ AUGMENTATION TEMPORELLE (EWMA + Momentum)         │       │
│  │  ├── H2H_LAST2Y         → H2H sur 2 dernières ans │       │
│  │  ├── H2H_LAST1Y         → H2H dernière année      │       │
│  │  ├── H2H_LAST6M         → H2H 6 derniers mois     │       │
│  │  ├── H2H_RECENT_FORM    → EWMA court terme         │       │
│  │  └── H2H_MOMENTUM       → Tendance H2H récente     │       │
│  │                           (victoires consécutives)  │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │ AUGMENTATION CONTEXTUELLE                         │       │
│  │  ├── H2H_RANK_DIFF      → Différence classement   │       │
│  │  ├── H2H_AGE_DIFF       → Différence d'âge        │       │
│  │  ├── H2H_BEST_OF_5      → H2H en BO5 / BO3        │       │
│  │  ├── H2H_INDOOR_OUTDOOR → H2H indoor vs outdoor   │       │
│  │  ├── H2H_SURFACE_CHANGE → Changement surface       │       │
│  │  │                        depuis dernier H2H       │       │
│  │  └── H2H_TIME_SINCE     → Temps depuis dernier     │       │
│  │                           affrontement             │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Pourquoi le Top 10 ?

Les thèses montrent que :

1. **Grands Chelems** : accuracy ~76-82% vs ~67% global (Dryja, Buhamra)
2. **Top joueurs** : plus de données disponibles, variance plus faible
3. **H2H plus riches** : plus d'affrontements directs entre eux
4. **Marché plus liquide** : meilleures cotes, opportunités d'arbitrage
5. **Meilleur ROI** : les stratégies de paris sur favoris modérés (cote ~1.71) sont les plus rentables

### 3.3 Pondération Recommandée des Features H2H

Basée sur les feature importances croisées des thèses :

```
POIDS_H2H_AUGMENTE = 0.30 × H2H_SURFACE
                   + 0.20 × H2H_TOURNAMENT
                   + 0.20 × H2H_TEMPORELLE
                   + 0.15 × H2H_CLASSIC
                   + 0.10 × H2H_CONTEXT
                   + 0.05 × H2H_PSYCHOLOGICAL (optionnel)
```

### 3.4 Format de Données pour l'Engineering

```python
# data_models/h2h_augmented.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum

class Surface(str, Enum):
    HARD = "hard"
    CLAY = "clay"
    GRASS = "grass"
    CARPET = "carpet"

class TournamentLevel(str, Enum):
    GRAND_SLAM = "grand_slam"
    MASTERS_1000 = "masters_1000"
    ATP_500 = "atp_500"
    ATP_250 = "atp_250"
    ATP_FINALS = "atp_finals"
    DAVIS_CUP = "davis_cup"

class H2HBase(BaseModel):
    """Noyau H2H classique — validé par Dryja, Ünal"""
    player_a_id: str
    player_b_id: str
    total_matches: int
    wins_a: int
    wins_b: int
    winrate_a: float           # ratio victoires A
    last_5_results: list[int]  # [1,0,1,1,0] (1 = A gagne)
    current_streak: int        # victoires consécutives
    time_since_last_match_days: float

class H2HSurfaceAugmented(BaseModel):
    """Augmentation surface — validé par Sklenička, Dryja, Sokka"""
    surface: Surface
    matches_on_surface: int
    wins_a_surface: int
    wins_b_surface: int
    winrate_a_surface: float
    sets_won_a_surface: int
    sets_won_b_surface: int
    games_won_a_surface: int
    games_won_b_surface: int
    bp_converted_a: int
    bp_converted_b: int
    srv_points_won_a: float    # % points gagnés au service
    srv_points_won_b: float
    ret_points_won_a: float    # % points gagnés en retour
    ret_points_won_b: float

class H2HTournamentAugmented(BaseModel):
    """Augmentation tournoi — validé par Buhamra, Dryja, Illum"""
    level: TournamentLevel
    matches: int
    wins_a: int
    wins_b: int
    in_finals: Optional[dict] = None       # {"matches": 3, "wins_a": 2}
    in_5th_set: Optional[dict] = None       # {"matches": 2, "wins_a": 1}
    in_tiebreak: Optional[dict] = None      # {"matches": 5, "wins_a": 3}
    deciding_set: Optional[dict] = None     # dernier set

class H2HTemporalAugmented(BaseModel):
    """Augmentation temporelle — validé par Dryja (EWMA), Zhai (momentum)"""
    last_2_years: dict           # {"matches": 4, "wins_a": 3}
    last_1_year: dict            # {"matches": 2, "wins_a": 1}
    last_6_months: dict          # {"matches": 1, "wins_a": 0}
    ewma_short: Optional[float]  # EWMA court terme (α=0.18)
    ewma_long: Optional[float]   # EWMA long terme (α=0.05)
    momentum: Optional[float]    # EWMA_court - EWMA_long
    h2h_trend: str               # "up", "down", "stable"

class H2HContextAugmented(BaseModel):
    """Augmentation contextuelle — validé par Buhamra (SEL), toutes les thèses"""
    rank_diff_a_b: int           # classement A - classement B
    age_diff_years: float        # âge A - âge B
    age_30_a: float              # |age_A - 30| (SEL)
    age_30_b: float              # |age_B - 30| (SEL)
    points_diff: int             # points ATP A - points ATP B
    best_of_5_record: dict       # {"matches": 3, "wins_a": 2}
    indoor_record: Optional[dict]
    outdoor_record: Optional[dict]
    surface_change: bool         # surface différente du dernier H2H?

class H2HAugmentedResponse(BaseModel):
    """Structure complète pour l'API"""
    match_id: str
    player_a: str
    player_b: str
    tournament: str
    surface: Surface
    level: TournamentLevel
    base: H2HBase
    surface_stats: list[H2HSurfaceAugmented]
    tournament_stats: list[H2HTournamentAugmented]
    temporal_stats: H2HTemporalAugmented
    context: H2HContextAugmented
    prediction_score: float       # probabilité A gagne (0-1)
    confidence: float             # niveau de confiance (0-1)
    key_factors: list[str]        # top 3 facteurs déterminants
```

---

## 4. Spécifications pour l'Équipe Engineering

### 4.1 Stack Technique Recommandée

```
┌─────────────────────────────────────────────────────────────┐
│              STACK TECHNIQUE PARISCORE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DATA LAYER                                                 │
│  ├── PostgreSQL + TimescaleDB  → stockage temporel          │
│  ├── Redis                     → cache H2H, sessions live   │
│  └── Parquet/Arrow             → données historiques batch  │
│                                                             │
│  FEATURE ENGINEERING                                         │
│  ├── Python 3.12+              → langage principal           │
│  ├── Pandas / Polars           → transformations             │
│  ├── NumPy                     → EWMA, calculs matriciels   │
│  └── Scikit-learn              → preprocessing, scaling     │
│                                                             │
│  ML MODELS                                                  │
│  ├── Random Forest (600 arbres) → modèle principal          │
│  │   (Dryja: meilleur calibrage, seul rentable)              │
│  ├── Logistic Regression       → baseline, interprétable    │
│  │   (Sokka: 68.3%, parfois meilleur que RF)                │
│  └── XGBoost                   → backup, précision brute    │
│      (Ünal: 70.5%, mais sur-confiance)                      │
│                                                             │
│  API                                                         │
│  ├── FastAPI                   → REST + WebSocket            │
│  ├── Pydantic v2               → validation des données      │
│  └── ONNX Runtime              → inférence optimisée         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Pipeline de Données

```python
# pipeline/steps.py — Ordre d'exécution

ETAPE 1: DATA ACQUISITION
─────────────────────────
  Sources :
    - Jeff Sackmann Tennis Data (GitHub) → matches historiques
    - ATP Official API → classements, profiles joueurs
    - Tennis Data API → stats live, scores
    - Web scraping ciblé → métriques manquantes (cf. §5)

ETAPE 2: FEATURE ENGINEERING BASE
───────────────────────────────────
  a) Calcul des Elo (global + surface)
     - K-factor dynamique (Dryja, adapté de FiveThirtyEight)
     - Decay après 90 jours d'inactivité
     - Comeback boost (K augmenté temporairement)
  
  b) Calcul des EWMA court/long terme pour chaque métrique
     - α_short = 0.18  (demi-vie ≈ 3.5 matchs)
     - α_long  = 0.05  (demi-vie ≈ 14 matchs)
     - Fenêtre minimale : 5 matchs pour court, 20 pour long
  
  c) Transformation SEL (Buhamra)
     - Age.30 = |age - 30|
     - Age.int = distance à [28, 32]
  
  d) Métriques composées (Dryja)
     - SRV_ADV = SRV_PTS_WON - OPP_RET_PTS_WON
     - CMPLT = SRV_PTS_WON × RET_PTS_WON
     - MOMENTUM = ∑ sign(m_i) × |m_i| / N

ETAPE 3: H2H AUGMENTÉ
──────────────────────
  a) Calcul du H2H classique (tous matchs)
  b) Segmentation par surface (+38% accuracy selon Sklenička)
  c) Segmentation par tournoi (+8% selon Buhamra)
  d) Fenêtres temporelles (EWMA appliqué au H2H)
  e) Contexte (âge, classement, surface change)

ETAPE 4: MODÈLE
───────────────
  a) Time-aware train/test split (pas de shuffle!)
  b) Expanding window CV (5-fold outer, 3-fold inner)
  c) Random Forest (600 arbres, max_depth=10, min_samples_leaf=4)
  d) Calibration Platt Scaling
  e) Backtesting stratégies de paris

ETAPE 5: API & MONITORING
──────────────────────────
  a) Endpoint /predict/h2h/{player_a}/{player_b}
  b) WebSocket /live/{match_id} pour mises à jour
  c) Monitoring dérive (PSI), alerts
  d) Grafana dashboard performances
```

### 4.3 Architecture du Module H2H Augmenté

```
┌─────────────────────────────────────────────────────────────┐
│                   H2H ENGINE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  match_id + player_a + player_b + surface + tournoi         │
│                    │                                        │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │           H2H Data Fetcher                        │      │
│  │  Récupère tous les matchs A vs B depuis la DB     │      │
│  └──────────────────────┬───────────────────────────┘      │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │         H2H Feature Calculator                    │      │
│  │                                                   │      │
│  │  ┌─────────────┐  ┌──────────────┐               │      │
│  │  │ BaseH2H     │  │ SurfaceAug   │               │      │
│  │  │ (statique)  │  │ (par surface) │               │      │
│  │  └─────────────┘  └──────────────┘               │      │
│  │                                                   │      │
│  │  ┌─────────────┐  ┌──────────────┐               │      │
│  │  │ TournAug    │  │ TempAug      │               │      │
│  │  │ (par niveau)│  │ (EWMA)       │               │      │
│  │  └─────────────┘  └──────────────┘               │      │
│  │                                                   │      │
│  │  ┌──────────────────────────────────────────┐    │      │
│  │  │ ContextAug (SEL transformations)          │    │      │
│  │  └──────────────────────────────────────────┘    │      │
│  └──────────────────────┬───────────────────────────┘      │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │          H2H Scorer                               │      │
│  │  Applique la pondération et retourne le score     │      │
│  │  prediction_score = 0.30 × surface + 0.20 × ...   │      │
│  └──────────────────────┬───────────────────────────┘      │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │         Model Predictor                           │      │
│  │  Random Forest (pré-chargé, ONNX Runtime)         │      │
│  │  Retourne : proba, confidence, key_factors        │      │
│  └──────────────────────────────────────────────────┘      │
│                         │                                   │
│                         ▼                                   │
│              H2HAugmentedResponse (JSON)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Spécifications API

```yaml
openapi: 3.0.0
info:
  title: Pariscore H2H Augmented API
  version: 1.0.0

paths:
  /api/v1/h2h/predict:
    get:
      summary: Prédiction H2H augmentée
      parameters:
        - name: player_a
          in: query
          required: true
          schema: { type: string }
          example: "N.Djokovic"
        - name: player_b
          in: query
          required: true
          schema: { type: string }
          example: "C.Alcaraz"
        - name: surface
          in: query
          required: true
          schema: { type: string, enum: [hard, clay, grass] }
        - name: tournament_level
          in: query
          schema: { type: string, enum: [grand_slam, masters_1000, atp_500, atp_250] }
          default: atp_500
      responses:
        '200':
          description: Prédiction H2H complète
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/H2HAugmentedResponse'

  /api/v1/h2h/refresh-cache:
    post:
      summary: Force le recalcul du cache H2H pour une paire
      parameters:
        - name: player_a
          in: query
          required: true
          schema: { type: string }
        - name: player_b
          in: query
          required: true
          schema: { type: string }

  /api/v1/live/{match_id}:
    get:
      summary: WebSocket pour prédiction live
      parameters:
        - name: match_id
          in: path
          required: true
          schema: { type: string }
```

### 4.5 Modèle de Données pour la DB

```sql
-- PostgreSQL + TimescaleDB

-- Table centrale des matchs
CREATE TABLE matches (
    match_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   VARCHAR(50) NOT NULL,
    year            INTEGER NOT NULL,
    surface         surface_enum NOT NULL,
    round           VARCHAR(20),
    best_of         INTEGER DEFAULT 3,
    player_a_id     VARCHAR(50) NOT NULL,
    player_b_id     VARCHAR(50) NOT NULL,
    winner_id       VARCHAR(50),
    score           TEXT,
    duration_min    INTEGER,
    match_date      DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Hypertable pour les stats temporelles (TimescaleDB)
-- Stocke les EWMA par joueur au fil du temps
CREATE TABLE player_ewma_stats (
    time            TIMESTAMPTZ NOT NULL,
    player_id       VARCHAR(50) NOT NULL,
    surface         surface_enum,
    
    -- Ranking
    elo_global      FLOAT,
    elo_surface     FLOAT,
    atp_rank        INTEGER,
    atp_points      INTEGER,
    
    -- Service (EWMA court)
    ace_s           FLOAT,
    df_s            FLOAT,
    first_in_s      FLOAT,
    first_won_s     FLOAT,
    second_won_s    FLOAT,
    srv_pts_won_s   FLOAT,
    srv_gms_won_s   FLOAT,
    srv_adv_s       FLOAT,
    
    -- Service (EWMA long)
    ace_l           FLOAT,
    df_l            FLOAT,
    first_in_l      FLOAT,
    first_won_l     FLOAT,
    second_won_l    FLOAT,
    srv_pts_won_l   FLOAT,
    srv_gms_won_l   FLOAT,
    srv_adv_l       FLOAT,
    
    -- Retour (EWMA court)
    ret_pts_won_s   FLOAT,
    ret_gms_won_s   FLOAT,
    bp_conv_s       FLOAT,
    bp_saved_s      FLOAT,
    
    -- Retour (EWMA long)
    ret_pts_won_l   FLOAT,
    ret_gms_won_l   FLOAT,
    bp_conv_l       FLOAT,
    bp_saved_l      FLOAT,
    
    -- Composées
    completeness    FLOAT,
    momentum        FLOAT,
    winrate_surface FLOAT,
    
    -- SEL (Buhamra)
    age_30          FLOAT,
    
    PRIMARY KEY (time, player_id, surface)
);

-- Convertir en hypertable TimescaleDB
SELECT create_hypertable('player_ewma_stats', 'time');

-- Index pour requêtes H2H
CREATE INDEX idx_h2h_players ON matches(player_a_id, player_b_id, match_date);
CREATE INDEX idx_h2h_surface ON matches(player_a_id, player_b_id, surface);
CREATE INDEX idx_player_time ON player_ewma_stats(player_id, surface, time DESC);
```

### 4.6 Code Squelette pour l'Équipe Engineering

```python
# src/h2h/calculator.py

"""
Module H2H Augmenté — Calcul des métriques H2H pour le Top 10 ATP

Basé sur l'analyse croisée de 14 thèses (2023-2026) :
  - Dryja (2025) : EWMA, SRV_ADV, CMPLT, MOMENTUM
  - Buhamra (2025) : SEL framework (Age.30, Elo)
  - Sokka (2026) : LOFO, Elo surface-critique
  - Sklenička (2024) : Spécialisation surface (9 variables)
  - Ünal (2023) : SRP-CRISP-DM framework
  - Schmidt (2026) : ELO-ML hybride
  - Illum et al. (2025) : Point-level accumulated features
  - Zhai & Wang (2024) : Serve decay, momentum dérivé
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field

# ─── Constantes ───────────────────────────────────────────────

EWMA_ALPHA_SHORT = 0.18    # demi-vie ≈ 3.5 matchs
EWMA_ALPHA_LONG  = 0.05    # demi-vie ≈ 14 matchs
ELO_DECAY_DAYS   = 90      # decay après inactivité
ELO_BASELINE     = 1500    # Elo de départ
AGE_OPTIMAL      = 30      # pic carrière (Buhamra SEL)

# ─── Data Models ──────────────────────────────────────────────

@dataclass
class PlayerMatch:
    """Données d'un match pour un joueur"""
    match_id: str
    date: datetime
    surface: str
    tournament_level: str
    opponent_id: str
    won: bool                     # True si ce joueur a gagné
    aces: int
    double_faults: int
    first_serve_in: int
    first_serve_won: int
    second_serve_won: int
    break_points_converted: int
    break_points_faced: int
    break_points_saved: int
    service_points_won: int
    return_points_won: int
    total_points: int
    rank: int
    age: float                    # âge en années
    height: float                 # taille en cm

# ─── Feature Calculators ──────────────────────────────────────

class EWMA:
    """Exponentially Weighted Moving Average
    Validé par Dryja 2025 (α_court=0.18, α_long=0.05)
    """
    
    @staticmethod
    def compute(values: list[float], alpha: float) -> float:
        """Calcule l'EWMA d'une série de valeurs"""
        if not values:
            return 0.0
        ewma = values[0]
        for v in values[1:]:
            ewma = alpha * v + (1 - alpha) * ewma
        return ewma
    
    @staticmethod
    def compute_series(values: list[float], alpha: float) -> list[float]:
        """Retourne toute la série EWMA (pour analyse temporelle)"""
        if not values:
            return []
        result = [values[0]]
        for v in values[1:]:
            result.append(alpha * v + (1 - alpha) * result[-1])
        return result


class EloCalculator:
    """Système Elo avec K-factor dynamique et decay
    Validé par Dryja, Sokka, Schmidt, Buhamra
    
    Spécificités :
    - K-factor diminue avec l'expérience (plus de matchs → K plus stable)
    - Decay vers 1500 après 90 jours d'inactivité
    - Comeback boost temporaire après inactivité
    - Elo séparé par surface (3 ladders : dur, terre, gazon)
    """
    
    @staticmethod
    def expected_score(rating_a: float, rating_b: float) -> float:
        return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))
    
    @staticmethod
    def dynamic_k_factor(matches_played: int) -> float:
        """K-factor plus élevé pour les joueurs avec peu de matchs
        → s'adapte plus vite en début de carrière"""
        if matches_played < 20:
            return 40.0
        elif matches_played < 50:
            return 30.0
        elif matches_played < 100:
            return 25.0
        else:
            return 20.0
    
    @staticmethod
    def apply_decay(rating: float, days_since_last_match: int) -> float:
        """Decay vers la baseline après inactivité
        Comeback boost si > 90 jours"""
        if days_since_last_match > ELO_DECAY_DAYS:
            decay_months = (days_since_last_match - ELO_DECAY_DAYS) / 30
            decay = min(decay_months * 5, 50.0)  # max 50 points de decay
            return rating - decay
        return rating
    
    @classmethod
    def update(cls, rating_a: float, rating_b: float, 
               won_a: bool, matches_played_a: int,
               matches_played_b: int) -> tuple[float, float]:
        """Met à jour les ratings après un match"""
        expected_a = cls.expected_score(rating_a, rating_b)
        score_a = 1.0 if won_a else 0.0
        k_a = cls.dynamic_k_factor(matches_played_a)
        k_b = cls.dynamic_k_factor(matches_played_b)
        
        new_rating_a = rating_a + k_a * (score_a - expected_a)
        new_rating_b = rating_b + k_b * ((1 - score_a) - (1 - expected_a))
        
        return new_rating_a, new_rating_b


class H2HCalculator:
    """Calcul des métriques H2H augmentées
    Combine : base + surface + tournoi + temporel + contexte
    """
    
    def __init__(self, matches_db: list[PlayerMatch]):
        self.matches = matches_db
    
    def compute_base(self, player_a_matches: list[PlayerMatch],
                     player_b_matches: list[PlayerMatch]) -> dict:
        """H2H classique (Dryja, Ünal)"""
        # Filtrer les matchs entre A et B
        h2h_matches = self._filter_h2h(player_a_matches, player_b_matches)
        return {
            "total_matches": len(h2h_matches),
            "wins_a": sum(1 for m in h2h_matches if m.won),
            "winrate_a": self._safe_ratio(
                sum(1 for m in h2h_matches if m.won), len(h2h_matches)),
            "last_5": [m.won for m in h2h_matches[-5:]],
            "streak": self._compute_streak(h2h_matches),
        }
    
    def compute_surface(self, h2h_matches: list[PlayerMatch]) -> dict:
        """H2H par surface (Sklenička 2024 — crucial)
        Validé : +38% d'accuracy quand la surface est prise en compte
        """
        surfaces = {}
        for surface in ["hard", "clay", "grass"]:
            surf_matches = [m for m in h2h_matches if m.surface == surface]
            if not surf_matches:
                continue
            surfaces[surface] = {
                "matches": len(surf_matches),
                "wins_a": sum(1 for m in surf_matches if m.won),
                "winrate_a": self._safe_ratio(
                    sum(1 for m in surf_matches if m.won), len(surf_matches)),
                "games_won_a": self._compute_games_won(surf_matches),
                "bp_converted": self._compute_bp_conversion(surf_matches),
            }
        return surfaces
    
    def compute_temporal(self, h2h_matches: list[PlayerMatch]) -> dict:
        """H2H temporel avec EWMA (Dryja 2025)
        Fenêtres : 2 ans, 1 an, 6 mois + momentum
        """
        now = datetime.now()
        windows = {
            "last_2_years": [m for m in h2h_matches 
                            if m.date >= now - timedelta(days=730)],
            "last_1_year": [m for m in h2h_matches 
                           if m.date >= now - timedelta(days=365)],
            "last_6_months": [m for m in h2h_matches 
                             if m.date >= now - timedelta(days=182)],
        }
        
        result = {}
        for name, matches in windows.items():
            result[name] = {
                "matches": len(matches),
                "wins_a": sum(1 for m in matches if m.won),
                "winrate_a": self._safe_ratio(
                    sum(1 for m in matches if m.won), len(matches)),
            }
        
        # Momentum H2H (EWMA court - EWMA long)
        if h2h_matches:
            results = [1.0 if m.won else 0.0 for m in h2h_matches]
            result["ewma_short"] = EWMA.compute(results, EWMA_ALPHA_SHORT)
            result["ewma_long"] = EWMA.compute(results, EWMA_ALPHA_LONG)
            result["momentum"] = result["ewma_short"] - result["ewma_long"]
        
        return result
    
    def compute_context(self, player_a: dict, player_b: dict) -> dict:
        """Contexte du match (Buhamra SEL, Sokka LOFO)"""
        return {
            "rank_diff": player_a.get("rank", 0) - player_b.get("rank", 0),
            "points_diff": player_a.get("points", 0) - player_b.get("points", 0),
            "age_diff": player_a.get("age", 25) - player_b.get("age", 25),
            "age_30_a": abs(player_a.get("age", 25) - AGE_OPTIMAL),
            "age_30_b": abs(player_b.get("age", 25) - AGE_OPTIMAL),
            "height_diff": player_a.get("height", 180) - player_b.get("height", 180),
            "elo_diff": player_a.get("elo", ELO_BASELINE) - player_b.get("elo", ELO_BASELINE),
            "elo_surface_diff": (
                player_a.get("elo_surface", ELO_BASELINE) - 
                player_b.get("elo_surface", ELO_BASELINE)
            ),
        }
    
    def compute_ewma_metrics(self, matches: list[PlayerMatch]) -> dict:
        """Métriques EWMA clés (Dryja 2025 — le coeur du feature engineering)
        Pour chaque métrique : court terme + long terme + différentiel
        """
        # Série des valeurs par match
        series = {
            "ace": [(m.aces / max(m.total_points, 1)) for m in matches],
            "df": [(m.double_faults / max(m.total_points, 1)) for m in matches],
            "first_in": [self._safe_ratio(m.first_serve_in, 
                                          m.first_serve_in + m.double_faults) 
                       for m in matches],
            "first_won": [self._safe_ratio(m.first_serve_won, m.first_serve_in) 
                         for m in matches],
            "srv_pts_won": [self._safe_ratio(m.service_points_won, 
                                             m.total_points) for m in matches],
            "ret_pts_won": [self._safe_ratio(m.return_points_won, 
                                             m.total_points) for m in matches],
        }
        
        result = {}
        for name, values in series.items():
            if values:
                result[f"{name}_s"] = EWMA.compute(values, EWMA_ALPHA_SHORT)
                result[f"{name}_l"] = EWMA.compute(values, EWMA_ALPHA_LONG)
                result[f"{name}_momentum"] = result[f"{name}_s"] - result[f"{name}_l"]
        
        # Métriques composées (Dryja)
        srv = result.get("srv_pts_won_s", 0)
        ret = result.get("ret_pts_won_s", 0)
        result["srv_adv"] = srv - ret
        result["completeness"] = srv * ret
        
        return result
    
    def compute_prediction_score(self, h2h_data: dict) -> float:
        """Score de prédiction pondéré (0-1)
        Poids basés sur la méta-analyse des 14 thèses
        """
        score = 0.0
        
        # H2H classique (poids: 0.15)
        base = h2h_data.get("base", {})
        score += 0.15 * base.get("winrate_a", 0.5)
        
        # H2H surface (poids: 0.30) — le plus important
        surface = h2h_data.get("surface", {})
        current_surface = h2h_data.get("_current_surface", "hard")
        if current_surface in surface:
            score += 0.30 * surface[current_surface].get("winrate_a", 0.5)
        
        # H2H temporel (poids: 0.20) — forme récente
        temporal = h2h_data.get("temporal", {})
        last_year = temporal.get("last_1_year", {})
        score += 0.20 * last_year.get("winrate_a", 0.5)
        
        # Contexte / Elo (poids: 0.25)
        context = h2h_data.get("context", {})
        elo_diff = context.get("elo_surface_diff", 0)
        # Normalisation: diff de 100 points Elo ≈ 0.1 en proba
        score += 0.25 * (0.5 + elo_diff / 1000)
        
        # EWMA momentum (poids: 0.10)
        ewma = h2h_data.get("ewma", {})
        momentum = ewma.get("srv_adv", 0)
        score += 0.10 * momentum
        
        return np.clip(score, 0.0, 1.0)
    
    def get_key_factors(self, h2h_data: dict) -> list[str]:
        """Top 3 facteurs déterminants pour ce matchup"""
        factors = []
        
        surface = h2h_data.get("surface", {})
        current_surface = h2h_data.get("_current_surface", "hard")
        if current_surface in surface:
            wr = surface[current_surface].get("winrate_a", 0.5)
            if wr > 0.65:
                factors.append(f"Domination sur {current_surface} ({wr:.0%})")
            elif wr < 0.35:
                factors.append(f"Faiblesse sur {current_surface} ({wr:.0%})")
        
        context = h2h_data.get("context", {})
        elo_diff = context.get("elo_surface_diff", 0)
        if abs(elo_diff) > 50:
            better = "A" if elo_diff > 0 else "B"
            factors.append(f"Elo surface favorable à {better}")
        
        temporal = h2h_data.get("temporal", {})
        momentum = temporal.get("momentum", 0)
        if momentum > 0.1:
            factors.append("Momentum H2H positif (forme récente)")
        elif momentum < -0.1:
            factors.append("Momentum H2H négatif (tendance baissière)")
        
        return factors[:3]
    
    @staticmethod
    def _safe_ratio(numerator: float, denominator: float) -> float:
        return numerator / denominator if denominator > 0 else 0.0
    
    @staticmethod
    def _compute_streak(matches: list) -> int:
        streak = 0
        for m in reversed(matches):
            if m.won:
                streak += 1
            else:
                break
        return streak
    
    @staticmethod
    def _filter_h2h(a_matches: list, b_matches: list) -> list:
        """Trouve les matchs entre A et B"""
        b_ids = {m.match_id for m in b_matches}
        return [m for m in a_matches if m.match_id in b_ids]
```

---

## 5. Plan de Scraping Web

### 5.1 Sources de Données Prioritaires

| Source | Données | Priorité | Méthode |
|--------|---------|----------|---------|
| **Jeff Sackmann Tennis Data** | Matchs ATP historiques complets | ⭐⭐⭐ | GitHub clone |
| **ATP Tour Official API** | Classements, stats joueurs | ⭐⭐⭐ | API REST |
| **ITF Tennis** | Données tournois, qualifications | ⭐⭐ | Web scraping |
| **Ultimate Tennis Statistics** | Stats avancées, Elo, momentum | ⭐⭐⭐ | API + scrape |
| **Tennis Abstract** | Stats historiques, match charts | ⭐⭐⭐ | Web scraping |
| **Flashscore** | Scores live, stats temps réel | ⭐⭐⭐ | API/WebSocket |
| **Betfair Exchange** | Cotes live, liquidité | ⭐⭐ | API |
| **SofaScore** | Stats live, tracking | ⭐⭐ | API |
| **Tennis Data (TennisVisuals)** | Stats HD, point-by-point | ⭐⭐⭐ | API payante |

### 5.2 Métriques à Scraper (Par Source)

```yaml
sackmann_github:
  type: git_clone
  url: https://github.com/JeffSackmann/tennis_atp
  files:
    - atp_matches_*.csv
    - atp_players.csv
    - atp_rankings_*.csv
  metrics:
    - score, surface, tournoi, round
    - aces, df, 1st_in, 1st_won, 2nd_won
    - sv_gms, bp_saved, bp_faced
    - winner_id, loser_id, rank, age, height

ultimate_tennis:
  type: api + scrape
  url: https://www.ultimatetennisstatistics.com
  metrics:
    - Elo global et par surface (historique)
    - momentum indices
    - Big Titles, Big Win stats
    - H2H avancé avec contexte

tennis_abstract:
  type: web_scrape
  url: https://www.tennisabstract.com
  metrics:
    - match charting data (point-by-point)
    - shot patterns, rally length
    - serve direction, return position
    - net points, running distance

flashscore:
  type: websocket
  url: wss://flashscore.com/live
  metrics:
    - score live
    - stats en cours (aces, fautes, % 1ère)
    - momentum graph
    - head-to-head instantané

sofascore:
  type: api
  url: https://api.sofascore.com
  metrics:
    - stats live avancées
    - ball possession (tennis : points gagnés par type)
    - heat maps

betfair:
  type: api
  url: https://api.betfair.com
  metrics:
    - cotes pre-match et live
    - volume échangé
    - sentiment marché
```

### 5.3 Architecture du Scraper

```python
# scraper/architecture.py

"""
Architecture du module de scraping Pariscore

Sources : Sackmann (GitHub) + UTS + Tennis Abstract + Flashscore
         + SofaScore + Betfair

Pipeline :
  1. Planification : cron toutes les heures pour live, quotidien pour historique
  2. Extraction : workers parallèles (un par source)
  3. Normalisation : format commun (Pydantic models)
  4. Validation : contrôles de cohérence
  5. Stockage : TimescaleDB + Redis cache
  6. Feature Engineering : déclenché automatiquement après chaque insertion
"""

# Voir: scraper/sources/*.py
# Voir: scraper/normalizers/*.py
# Voir: scraper/pipeline.py

# Structure des répertoires recommandée :
#
# scraper/
# ├── __init__.py
# ├── pipeline.py              # Orchestrateur principal
# ├── scheduler.py             # Planification (APScheduler)
# ├── sources/
# │   ├── base.py              # Classe abstraite Source
# │   ├── sackmann.py          # Git clone / refresh
# │   ├── ultimatetennis.py    # API + scrape
# │   ├── tennisabstract.py    # Web scraping
# │   ├── flashscore.py        # WebSocket live
# │   ├── sofascore.py         # API REST
# │   └── betfair.py           # API Betfair
# ├── normalizers/
# │   ├── base.py              # Schéma commun
# │   ├── match_normalizer.py
# │   └── player_normalizer.py
# └── storage/
#     ├── writer.py            # TimescaleDB writer
#     └── cache.py             # Redis cache H2H
```

---

## 6. Sources de Données

| Source | Type | URL | Gratuit ? | Notes |
|--------|------|-----|-----------|-------|
| **Sackmann ATP** | CSV (GitHub) | https://github.com/JeffSackmann/tennis_atp | ✅ Gratuit | Dataset de base des thèses Dryja, Sokka, Illum |
| **ATP Rankings API** | API | https://www.atptour.com | ✅ Gratuit | Classements officiels |
| **Ultimate Tennis Stats** | API/Web | https://www.ultimatetennisstatistics.com | ✅ Gratuit | Elo, stats avancées |
| **Tennis Abstract** | Web | https://www.tennisabstract.com | ⚠️ Partiel | Point-by-point, charting |
| **Flashscore** | API/WS | https://www.flashscore.com | ⚠️ Freemium | Live scores, stats |
| **SofaScore** | API | https://www.sofascore.com | ⚠️ Freemium | Stats live avancées |
| **Betfair** | API | https://www.betfair.com | ❌ Payant | Cotes, volume |
| **Sportradar** | API | https://www.sportradar.com | ❌ Payant | Données officielles |
| **Tennis Data** | API | https://tennis-data.com | ❌ Payant | Stats HD |

---

## 7. Annexe

### 7.1 Tableau Complet des Modèles et Performances

| Thèse | Modèle | Accuracy | Brier | ROC AUC | Dataset | Période |
|-------|--------|----------|-------|---------|---------|---------|
| **Dryja** | RF | 0.677 | 0.205 | 0.745 | Tous ATP | 2010-2024 |
| **Dryja** | RF (GS) | **0.764** | **0.160** | **0.853** | Grands Chelems | 2010-2024 |
| **Dryja** | XGBoost | 0.677 | 0.204 | 0.745 | Tous ATP | 2010-2024 |
| **Dryja** | LR | 0.676 | 0.205 | 0.744 | Tous ATP | 2010-2024 |
| **Buhamra** | RF (enhanced) | **0.820** | 0.151 | — | Grands Chelems | 2011-2022 |
| **Buhamra** | LR (enhanced) | 0.795 | 0.153 | — | Grands Chelems | 2011-2022 |
| **Buhamra** | GAM (splines) | 0.792 | 0.149 | — | Grands Chelems | 2011-2022 |
| **Ünal** | XGBoost | **0.705** | 0.191 | — | ATP + cotes | 2009-2022 |
| **Sokka** | LR | **0.683** | — | — | ATP | 2000-2019 |
| **Sokka** | RF | 0.678 | — | — | ATP | 2000-2019 |
| **Schmidt** | ELO-ML hybride | **0.675** | — | — | ATP | 1968-2024 |
| **Schmidt** | DNN (best) | 0.662 | — | — | ATP | 1968-2024 |
| **Schmidt** | Elo seul | 0.659 | — | — | ATP | 1968-2024 |
| **Sklenička** | LR (surface) | 0.65 | — | — | ATP | — |
| **Illum** | XGBoost (1er service) | 0.734 | — | — | GS point-level | 2016-2020 |
| **Zhai & Wang** | Ridge-XGBoost | 0.94* | — | — | 1 match | 2023 |

*\* Non généralisable (1 seul match)*

### 7.2 Consistance des Résultats Entre Thèses

| Résultat | Validé par | Niveau de confiance |
|----------|-----------|-------------------|
| **RF meilleur calibrage (Brier)** | Dryja, Buhamra, Sokka, Juuri | ⭐⭐⭐⭐⭐ |
| **Elo > ATP Rank** | Dryja, Sokka, Schmidt, Buhamra | ⭐⭐⭐⭐⭐ |
| **Surface spécifique cruciale** | Dryja, Sklenička, Sokka, Buhamra | ⭐⭐⭐⭐⭐ |
| **Grands Chelems + prédictibles** | Dryja, Buhamra | ⭐⭐⭐⭐ |
| **Bookmakers odds ultra-puissantes** | Ünal (70.5%), Dryja (RF = bookmakers) | ⭐⭐⭐⭐ |
| **XGBoost meilleure précision brute** | Ünal (70.5%), Dryja (67.7%) | ⭐⭐⭐ |
| **LR peut égaler RF** | Sokka (68.3% LR vs 67.8% RF) | ⭐⭐ |
| **Age.30 transformation utile** | Buhamra (SEL) | ⭐⭐ |
| **Point-level impossible sans Hawkeye** | Illum (73.4% ≈ baseline) | ⭐⭐⭐⭐⭐ |

### 7.3 Recommandations Finales pour l'Équipe

```
┌─────────────────────────────────────────────────────────────┐
│           ACTIONS IMMÉDIATES (SPRINT 1 - SEMAINES 1-2)      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ SCRAPER SACKMANN                                        │
│     Cloner le repo GitHub, parser les CSV                   │
│     → Matchs ATP historiques complets                        │
│     → Base de données PostgreSQL + TimescaleDB               │
│                                                             │
│  ✅ FEATURE ENGINEERING CORE                                 │
│     Implémenter les 4 classes du squelette ci-dessus :       │
│     1. EWMA (α=0.18, α=0.05)                                │
│     2. Elo (global + surface, decay 90j)                     │
│     3. H2H Augmenté (base + surface + temporel + contexte)   │
│     4. Métriques composées (SRV_ADV, CMPLT, MOMENTUM)        │
│                                                             │
│  ✅ API H2H BASIQUE                                          │
│     Endpoint GET /api/v1/h2h/predict                         │
│     → Pour un joueur A, joueur B, surface, tournoi           │
│     → Retourne proba, confiance, key factors                 │
│     → Cache Redis (TTL: 24h pour pré-match, 5min live)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│           PROCHAINES ACTIONS (SPRINT 2 - SEMAINES 3-4)      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔄 WEB SCRAPING ÉLARGI                                     │
│     Ultimate Tennis Statistics → Elo historique              │
│     Tennis Abstract → point-by-point si accessible           │
│     Flashscore → scores live                                │
│                                                             │
│  🔄 MODÈLE COMPLET                                           │
│     Random Forest (600 arbres) avec time-aware CV            │
│     Comparaison avec LR et XGBoost                          │
│     Backtesting stratégies de paris                          │
│                                                             │
│  🔄 TABLEAU DE BORD                                          │
│     Grafana : accuracy glissante, Brier, ROI                 │
│     Métriques de dérive (PSI)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Rapport généré pour l'équipe engineering Pariscore — Juin 2026*  
*Basé sur 14 thèses scientifiques (2023-2026) : Dryja, Buhamra, Ünal, Sokka, Schmidt, Sklenička, Nübel, Alm & Markai, Zhai & Wang, Illum et al., Korpelshoek, Chen, Thorpe et al., Garcia de Baquedano*
