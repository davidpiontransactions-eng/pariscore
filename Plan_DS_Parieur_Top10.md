# Plan de Travail — Mise en Place des Métriques Top 10 ATP

## Phase Pré-Engineering : Data Scientist + Parieur Pro

---

**Objet :** Définir, valider et spécifier les métriques de prédiction pour le Top 10 ATP, en collaboration entre un Data Scientist et un Parieur Professionnel, AVANT que l'équipe engineering ne commence à coder.

**Contexte :** 14 thèses scientifiques analysées (Dryja, Buhamra, Ünal, Sokka, Schmidt, Sklenička, Illum, etc.). 60+ métriques identifiées. Besoin de réduire à un noyau dur validé à la fois scientifiquement ET par l'expertise terrain.

---

## Pourquoi une phase DS + Parieur Pro avant le code ?

### Le constat

Les 14 thèses analysées montrent une vérité inconfortable :

> Toutes les métriques qui marchent en laboratoire ne marchent pas en conditions réelles de pari.

Exemples concrets tirés des thèses :
- **Illum et al. (2025)** : La prédiction point-par-point donne 73.4%... pour une baseline à 73.2%. **Aucun gain réel.**
- **Dryja (2025)** : Le XGBoost a la meilleure précision brute... mais **perd de l'argent** (ROI -0.88%) alors que le Random Forest gagne (+2.17%).
- **Ünal (2023)** : La meilleure feature unique est... **la cote bookmaker** — pas une métrique tennis.

### Ce que chaque rôle apporte

| Rôle | Apporte | Ne fait PAS |
|------|---------|-------------|
| **Expert Documentaire** | Synthèse des 14 thèses, identification des métriques validées, bibliographie, état de l'art | Ne valide pas sur données réelles |
| **Data Scientist** | Test des hypothèses sur données réelles, feature importance, backtesting, calibration, détection de fuite de données | Ne connaît pas le betting réel |
| **Parieur Professionnel** | Validation terrain, connaissance des biais de marché, stratégies qui vivent | Ne code pas |
| **Engineering** | Implémente ce qui est validé, industrialise, scale | Ne fait PAS la R&D métier |

---

## Les 3 piliers de la collaboration

### Pilier A : Data Science — Validité Statistique

Le Data Scientist doit répondre à ces questions AVANT que le code commence :

1. **Fuite de données** : Est-ce que la métrique utilise des informations du futur ?
2. **Stationnarité** : La relation métrique → résultat est-elle stable dans le temps ?
3. **Overfitting** : Les 82% de Buhamra sont-ils reproductibles en 2025-2026 ?
4. **Distribution** : Les features sont-elles bien calibrées pour le Top 10 (faible variance d'élite) ?
5. **Multicolinéarité** : Est-ce que Serve Advantage et Completeness apportent la même information ?

**Protocole :**
`
Pour chaque métrique candidate → Test LOFO (Leave One Feature Out)
                             → Test de stabilité temporelle
                             → Test de significativité (McNemar)
                             → Rapport de colinéarité (VIF)
`

### Pilier B : Parieur Pro — Validité Terrain

Le parieur pro doit répondre à ces questions :

1. « Est-ce que je parierais là-dessus ? » — Validation instinctive
2. « Quelle est la vraie edge ? » — Différence entre proba modèle et proba marché
3. « Où sont les angles morts ? » — Ce que les stats ne captent pas
4. « Quelle gestion de bankroll ? » — Kelly fractionnaire, sizing, drawdown max acceptable
5. « Quelles sont les limites du marché ? » — Liquidité, timing de prise de cote

**Protocole :**
`
Pour chaque stratégie candidate → Revue par le parieur
                              → Test sur 100 matchs à blanc (sans argent réel)
                              → Comité d'approbation avant go
`

### Pilier C : Documentation Technique — Pont vers l'Engineering

Les deux produisent ensemble un **cahier des charges** qui permet à l'engineering de coder sans ambiguïté :

`
Pour chaque métrique :
  - Formule mathématique exacte
  - Source de données
  - Fenêtre temporelle
  - Validation croisée
  - Seuils / normalisation
  - Priorité (MVP vs V2)
`

---

## Planning des Sessions de Travail

### Format
- **5 sessions de 2h** sur 2 semaines
- Participation : Data Scientist + Parieur Pro + Expert Doc + Lead Engineer (observateur S3+S5)
- Chaque session produit un **livrable concret**

### Timeline

`
┌─────────────────────────────────────────────────────────────────────┐
│  SEMAINE 1                                                       │
├───────┬─────────────────────────────────────────────────────────────┤
│  LUN  │ Session 1 : Kickoff — Revue des thèses & priorisation      │
│       │ (2h, tous)                                                  │
│  MAR  │ Session 2 : Data Dive — Validation des métriques            │
│       │ (2h, DS + Expert Doc)                                       │
│  MER  │ Travail individuel DS : prototypage rapide, notebooks       │
│  JEU  │ Session 3 : Atelier Feature Engineering                    │
│       │ (2h, DS + Parieur + Expert Doc)                             │
│  VEN  │ Travail individuel Parieur : revue stratégies               │
├───────┼─────────────────────────────────────────────────────────────┤
│  SEMAINE 2                                                       │
├───────┼─────────────────────────────────────────────────────────────┤
│  LUN  │ Session 4 : Stratégie de Paris & ROI                       │
│       │ (2h, DS + Parieur + Expert Doc)                             │
│  MAR  │ Travail DS : backtesting final, rédaction spec              │
│  MER  │ Travail Parieur : validation finale, rédaction guide        │
│  JEU  │ Session 5 : Spécifications pour l'Engineering              │
│       │ (2h, TOUS + Lead Engineer)                                  │
│  VEN  │ Livraison : Cahier des charges finalisé                    │
│       │ → Engineering commence à coder                              │
└───────┴─────────────────────────────────────────────────────────────┘
`

---

## Session 1 : Kickoff — Revue des Thèses & Priorisation

### Objectif
Mettre tout le monde à niveau sur l'état de l'art et prioriser les métriques à tester.

### Ordre du jour (2h)

| Durée | Sujet | Qui mène |
|-------|-------|----------|
| 15 min | Contexte Pariscore, objectifs Top 10 | CEO |
| 30 min | Revue des 14 thèses : ce qui marche, ce qui ne marche pas | Expert Doc |
| 30 min | Présentation du jeu de métriques candidates (60 → 20) | Expert Doc |
| 30 min | Débat DS vs Parieur : premières impressions | Tous |
| 15 min | Priorisation des 10 métriques pour la Session 2 | Tous |

### Jeu de métriques candidates (filtré 60 → 20)

**NIVEAU 1 — VALIDÉ PAR 5+ THÈSES (incontournable)**
- ELO_SURFACE → Rating Elo par surface
- ELO_GLOBAL → Rating Elo général
- ATP_RANK → Classement ATP
- ATP_POINTS → Points ATP
- SRV_PTS_WON → points service gagnés (EWMA)
- RET_PTS_WON → points retour gagnés (EWMA)

**NIVEAU 2 — VALIDÉ PAR 2-3 THÈSES (fort potentiel)**
- SRV_ADV → Service Advantage (composé)
- CMPLT → Completeness (composé)
- MOMENTUM → Direction forme récente
- AGE.30 → |age - 30| (SEL, Buhamra)
- WINRATE_SURFACE → % victoires sur surface
- H2H_SURFACE → H2H filtré par surface
- BP_CONV → % conversion balles de break
- BP_SAVED → % balles de break sauvées

**NIVEAU 3 — 1 THÈSE SEULEMENT (exploratoire)**
- AGE.INT → distance à [28,32] (Buhamra)
- SERVE_DECAY → déclin dominance service (Zhai)
- WINNING_DERIV → dérivée taux de victoire (Zhai)
- H2H_TIEBREAK → H2H en tie-break
- H2H_5TH_SET → H2H en 5ème set
- PRESSURE_INDEX → ratio points importants gagnés

### Livrable
`
PRIORISATION_METRIQUES.md
  - 20 métriques classées par niveau de confiance
  - Premier filtre DS/Parieur
  - Top 10 à tester en Session 2
`

---

## Session 2 : Data Dive — Validation des Métriques sur Données Réelles

### Objectif
Le Data Scientist valide CHAQUE métrique sur les données réelles du Top 10.

### Protocole de validation

Pour chacune des 10 métriques prioritaires :

`python
def valider_metrique(metrique, df):
    """
    Retourne une fiche de validation structurée.
    """
    result = {
        "metrique": metrique,
        "tests": {}
    }
    
    # TEST 1 : Stabilité temporelle
    # La métrique prédit-elle aussi bien en 2015 qu'en 2024 ?
    result["tests"]["stabilite_temporelle"] = {
        "method": "rolling_accuracy(3_years)",
        "verdict": "PASS/FAIL/WARN"
    }
    
    # TEST 2 : Discrimination Top 10 vs Top 50
    # La métrique est-elle assez fine pour l'élite ?
    result["tests"]["discrimination_elite"] = {
        "method": "accuracy_split(top10_vs_rest)",
        "verdict": "PASS/FAIL/WARN"
    }
    
    # TEST 3 : LOFO (Leave One Feature Out)
    result["tests"]["lofo"] = {
        "method": "rf_accuracy_drop_without_feature",
        "score": ...,  # drop en points d'accuracy
        "verdict": "PASS/FAIL/WARN"
    }
    
    # TEST 4 : Multicolinéarité (VIF)
    result["tests"]["vif"] = {
        "method": "variance_inflation_factor",
        "verdict": "PASS si VIF < 5"
    }
    
    # TEST 5 : Distribution Top 10
    result["tests"]["distribution_elite"] = {
        "method": "ks_test_uniform_distribution",
        "verdict": "PASS/FAIL/WARN"
    }
    
    return result
`

### Travail du Data Scientist (individuel, jour 3)
- Notebook d'analyse pour chaque métrique
- Test de reproductibilité des résultats des thèses
- Identification des métriques redondantes (corr > 0.8)
- Rapport de colinéarité

### Livrable
`
FICHES_VALIDATION_METRIQUES.md
  - 10 fiches de validation individuelles
  - Matrice de corrélation entre métriques
  - Verdict : VALIDÉ / À CREUSER / REJETÉ
`

---

## Session 3 : Atelier Feature Engineering — Le Noyau Dur

### Objectif
À partir des 20 métriques candidates, le DS et le Parieur définissent ensemble le jeu de features optimal.

### Ordre du jour (2h)

| Durée | Sujet | Qui mène |
|-------|-------|----------|
| 15 min | Résultats de la Session 2 — verdicts | DS |
| 30 min | DOUBT SESSION : Chaque métrique est challengée | Tous |
| 30 min | Construction des métriques composées Pariscore | DS + Parieur |
| 30 min | Définition du H2H Augmenté | Tous |
| 15 min | Validation des formules mathématiques | DS |

### Doubt Session — Protocole

`
Pour chaque métrique, le Parieur Pro pose 3 questions :

1. « Est-ce que cette métrique a déjà été vraie pour un match 
   que j'ai vécu et où j'ai perdu de l'argent ? »
   → Si oui : la métrique a une valeur réelle

2. « Est-ce que je peux obtenir cette donnée en temps réel 
   AVANT le match / AVANT le point suivant ? »
   → Si non : inutilisable en conditions réelles

3. « Est-ce que le marché a déjà intégré cette information ? »
   → Si oui : pas d'edge (ex: cotes bookmakers)
   → Si non : edge potentielle
`

### Construction des Métriques Composées Pariscore

**SERVE_EDGE** (amélioration de SRV_ADV)
`
SERVE_EDGE = (SRV_PTS_WON_S - RET_PTS_WON_OPP_S) 
           * SURFACE_WEIGHT  (gazon: 1.2, dur: 1.0, terre: 0.8)
`

**CLUTCH_FACTOR** (nouveau — les joueurs du Top 10 se distinguent dans les moments importants)
`
CLUTCH_FACTOR = (BP_CONV_S * BP_SAVED_S * TIEBREAK_WINRATE) ^ (1/3)
`

**H2H_CONTEXT_SCORE** (amélioration radicale du H2H simple)
`
H2H_CONTEXT_SCORE = (0.30 * H2H_SURFACE 
                   + 0.25 * H2H_TEMPOREL 
                   + 0.20 * H2H_TOURNOI 
                   + 0.15 * H2H_BASE 
                   + 0.10 * H2H_CONTEXT)
`

**MOMENTUM_ELITE** (amélioré de MOMENTUM — spécifique Top 10)
`
MOMENTUM_ELITE = (EWMA_short_5matches - EWMA_long_20matches)
              * TOP10_BOOST  (1.2 si les deux joueurs sont Top 10)
              * SURFACE_CONSISTENCY
`

### Livrable
`
FEATURES_NOYAU_DUR.md
  - 6 à 8 métriques finales validées
  - Formules mathématiques exactes pour chacune
  - Seuils, normalisation, poids
`

---

## Session 4 : Stratégie de Paris & ROI

### Objectif
Le Parieur Pro définit les stratégies de paris qui seront backtestées, et le DS valide la faisabilité statistique.

### Ordre du jour (2h)

| Durée | Sujet | Qui mène |
|-------|-------|----------|
| 15 min | Revue des stratégies des thèses | Expert Doc |
| 30 min | Présentation du Parieur : sa méthode, ses règles | Parieur Pro |
| 30 min | Définition des 3 stratégies à backtester | Tous |
| 30 min | Gestion de bankroll : Kelly, drawdown, sizing | Parieur + DS |
| 15 min | Définition du cadre d'évaluation | DS |

### Les 3 stratégies candidates

**STRATÉGIE A — VALUE_BETTING (basée sur Dryja Threshold)**
- Règle : Parier quand proba_modèle > proba_marché × 1.10
- Seuil : odds ≥ 1.50, ≤ 5.00
- Sizing : Kelly fractionnaire (25%)
- Cible : ROI > 5% sur 500+ paris

**STRATÉGIE B — FAVORI_MODÉRÉ (basée sur Dryja Short Price)**
- Règle : Parier le favori si proba_modèle > 65% ET cote < 2.0
- Sizing : Taille fixe (1 unité)
- Cible : ROI > 2% sur 1000+ paris

**STRATÉGIE C — CONTRARIEN (nouveau, proposé par le parieur)**
- Règle : Parier contre le favori si écart cote/proba > seuil
- Sizing : Kelly fractionnaire (15%)
- Cible : ROI > 8% mais moins de paris

### Gestion de Bankroll

`
  Bankroll initiale    : 10 000€
  Unité de base        : 1% de la bankroll
  Drawdown max         : 20% → STOP
  Réévaluation         : Hebdomadaire
  Kelly fractionnaire  : 25% (conservateur)
  Stop-loss mensuel    : -10% → pause 1 semaine
  Stop-win mensuel     : +20% → pause 1 semaine
`

### Livrable
`
STRATEGIES_PARIS.md
  - 3 stratégies détaillées
  - Règles de gestion de bankroll
  - Critères de succès
`

---

## Session 5 : Spécifications Finales pour l'Engineering

### Objectif
Remettre à l'équipe engineering un cahier des charges exécutable : ni ambiguïté, ni question en suspens.

### Ordre du jour (2h)

| Durée | Sujet | Qui mène |
|-------|-------|----------|
| 15 min | Synthèse des 4 sessions précédentes | Expert Doc |
| 30 min | Présentation du Feature Set Final | DS |
| 30 min | Présentation des Stratégies Validées | Parieur Pro |
| 30 min | Questions de l'Engineering | Lead Engineer |
| 15 min | Planification Sprint 1 | Tous |

### Feature Set Final — Template de Livraison

`yaml
feature_01:
  name: "ELO_SURFACE"
  type: "rating"
  priority: "MVP"
  source: "Sackmann + calcul interne"
  formula: "EloCalculator.update()"
  params:
    k_factor: "dynamic(40→20 selon experience)"
    decay: "90 jours vers 1500"
    surfaces: ["hard", "clay", "grass"]
  validation:
    accuracy_contribution: "+2.5%"
    vif: 1.8
    stability: "PASS"
  story_points: 3
`

### Backtesting Framework

`yaml
backtesting_framework:
  train_period: "2010-01-01 to 2024-12-31"
  test_period: "2025-01-01 to 2026-06-01"
  min_matches_per_player: 20
  target_league: "top_10_atp"
  
  evaluation_metrics:
    - accuracy, brier_score, log_loss, roc_auc
    - roi_total, sharpe_ratio, max_drawdown, win_rate
  
  validation_method: "expanding_window_cv"
  outer_folds: 5
  inner_folds: 3
  
  models_to_benchmark:
    - random_forest (600 trees, max_depth=10)
    - logistic_regression (C=0.215, L1 penalty)
    - xgboost (n=500, lr=0.01, max_depth=5)
    - ensemble_voting (RF + LR)
`

### Livrable
`
CAHIER_DES_CHARGES_ENGINEERING.md
  - Feature set final (6-8 métriques)
  - Spécifications techniques complètes
  - Planification Sprint 1 (story points)
  - Critères d'acceptation
  - Backtesting framework
`

---

## Arbre de Décision Global

`
20 métriques candidates (S1)
  |
  v Validation DS (S2)
  |
  +-- VALIDÉES (10-12)
  |   |
  |   v Validation Parieur (S3)
  |   |
  |   +-- NOYAU DUR (6-8)
  |   +-- REJETÉES (2-4)
  |
  +-- REJETÉES (8-10)
      Raison : colinéarité, instabilité, pas d'edge

Noyau dur (6-8) -> Stratégies (S4) -> Specs Engineering (S5)
`

---

## Risques & Atténuations

| Risque | Probabilité | Impact | Atténuation |
|--------|-------------|--------|-------------|
| DS et Parieur en désaccord | Élevée | Moyen | Sessions animées, décision = CEO |
| Métriques des thèses ne tiennent pas sur données réelles | Moyenne | Élevé | C'est normal — objectif = découvrir AVANT de coder |
| Top 10 a trop peu de matchs H2H | Élevée | Moyen | Utiliser les matchs contre Top 20 comme proxy |
| Sur-performance en backtest mais pas en réel | Élevée | Élevé | Le parieur pro est là pour ça |
| Biais du parieur pro | Élevée | Moyen | Décisions documentées et reproductibles |

---

## Profil Recommandé des Participants

**Data Scientist**
- 3+ ans en sports analytics
- Maîtrise scikit-learn, XGBoost, validation temporelle
- Capable de reproduire les résultats des thèses en 2 jours
- Connaissance du tennis (passionné = idéal)
- Ne doit PAS être un parieur (conflit d'intérêts)

**Parieur Professionnel**
- 5+ ans en betting sportif, spécialisé tennis
- Track record vérifiable (ROI positif sur 1000+ paris)
- Capable d'expliquer POURQUOI il gagne
- Ne doit PAS coder (reste dans son rôle métier)

**Expert Documentaire**
- A analysé les 14 thèses
- Connaît forces et faiblesses de chaque étude
- Traducteur entre les 3 mondes (académique, betting, engineering)

**Lead Engineer (observateur S3+S5)**
- Connaît la stack technique
- Challenge la faisabilité
- Absorbe le contexte pour les spécifications

---

*Document produit par l'Expert Documentaire — Pariscore*
*Basé sur 14 thèses scientifiques (2023-2026)*
*Juin 2026*
