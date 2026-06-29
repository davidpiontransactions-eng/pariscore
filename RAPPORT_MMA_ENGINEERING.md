# RAPPORT MMA ENGINEERING

> **Projet :** Pariscorebis — Extension MMA UFC  
> **Statut :** Spécification v1.0  
> **Date :** Juin 2026  
> **Référence :** `RAPPORT_PREDICTION_UFC_MMA.md`

---

## Table des Matières

1. [Brainstorming : Pro Parieur × Data Scientist](#1-brainstorming--pro-parieur--data-scientist)
2. [Architecture Générale](#2-architecture-générale)
3. [Spécifications Frontend](#3-spécifications-frontend)
4. [Spécifications Backend](#4-spécifications-backend)
5. [Pipeline ML Détailé](#5-pipeline-ml-détaillé)
6. [Leviers d'Amélioration 63% → 68%+](#6-leviers-damélioration-63--68)
7. [Extensions Charte Graphique](#7-extensions-charte-graphique)
8. [Plan d'Exécution](#8-plan-dexécution)

---

# 1. Brainstorming : Pro Parieur × Data Scientist

## Personae

| Rôle | Nom | Expertise |
|------|-----|-----------|
| **Pro Parieur UFC/MMA** | Alex | 12 ans de paris sportifs, spécialiste MMA, bankroll 6 chiffres, suivi 200+ card par an |
| **Data Scientist** | Dr. Chen | PhD ML, 8 ans en predictive modeling, a travaillé sur des systèmes de cotation pour opérateurs européens |

---

## Acte I : Le Constat — Pourquoi le MMA est Différent

**Alex :**  
« J'ai commencé par le tennis. Franchement, le MMA c'est un autre monde. Au tennis, tu as des centaines de points par match, des surfaces standardisées, des joueurs qui jouent 20+ tournois par an. En MMA, t'as 3 rounds de 5 minutes. Un combat peut se finir en 30 secondes. Un combattant peut disparaître 18 mois et revenir complètement transformé. »

**Dr. Chen :**  
« Les chiffres le confirment. Dans mon analyse des papiers de référence — Dryja (2024), Petersen (2024), Bunker (2023) — le plafond des modèles MMA tourne autour de 65-68% de précision, contre 72-75% pour le tennis. Pourquoi ? Parce que le MMA a un ratio signal/bruit beaucoup plus faible. Trop peu d'observations par combattant, trop de variance aléatoire, et pas de "surface" stable pour créer des clusters. »

**Alex :**  
« Exact. Et le pire, c'est que les parieurs amateurs ne comprennent pas ça. Ils voient un type avec un record de 15-2 et ils pensent "favori solide". Ils oublient que 12 de ses victoires étaient contre des gatekeepers. Il faut pondérer la force de l'opposition. »

**Dr. Chen :**  
« On est d'accord. Le True Talent model de Bunker (2023) fait exactement ça : il utilise un prior bayésien pour estimer le niveau réel d'un combattant, en tenant compte de la qualité de l'opposition. C'est un point de départ solide. »

---

## Acte II : Quels Paris Cibler — Moneyline, Méthode, ou Rounds ?

**Alex :**  
« Pour moi, la priorité numéro 1, c'est la **moneyline** — prédire qui gagne. C'est le marché le plus liquide, celui où les bookmakers font les plus grosses erreurs, surtout sur les fights hors main card. Ensuite, en phase 2, on peut attaquer la **méthode de victoire** (KO/TKO, submission, décision). C'est beaucoup plus dur mais les cotes sont souvent mal calibrées. »

**Dr. Chen :**  
« La moneyline est effectivement le bon point d'entrée. Pour la méthode de victoire, je suis plus réservé : le déséquilibre des classes est violent. 48% des combats vont à la décision en UFC, mais chez les heavyweights, c'est 32%. Il faudrait soit un modèle par classe de poids, soit un modèle hiérarchique. Je recommande de laisser ça en phase 2. »

**Alex :**  
« Je suis d'accord. Même en phase 2, la méthode c'est compliqué. Un combat qui est -450 pour la décision peut finir en KO au premier round. Les bookmakers mettent des marges énormes sur ces marchés — jusqu'à 15-20% — donc même avec un bon modèle, le value betting est difficile. »

**Dr. Chen :**  
« Bon, on cible la moneyline. Et les **propositions** ? Total de rounds, fighter de la soirée ? »

**Alex :**  
« Les propositions UFC, c'est un piège à cons. Les marges sont à 25-30%. À moins d'avoir un edge monstrueux, tu perds à la longue. On laisse tomber. »

**Décision :** Phase 1 = moneyline uniquement. Phase 2 = méthode de victoire. Phase 3 = over/under rounds.

---

## Acte III : Features — Qu'est-ce Qui Marche Vraiment ?

**Dr. Chen :**  
« Regardons les features utilisées dans les meilleurs papiers. J'ai identifié trois catégories :

1. **Features de carrière** : record, âge, taille, reach, stance (orthodoxe/southpaw), temps depuis dernier combat
2. **Features EWMA** : moyennes pondérées des performances récentes (strikes landed, takedown accuracy, defense)
3. **Features contextuelles** : changement d'entraînement, weight cut, short notice, opponent strength

Le consensus, c'est que les **EWMA short-term** (3 derniers combats) sont les plus prédictives. La forme récente pèse plus que la carrière. »

**Alex :**  
« OK mais attention : les EWMA sur les stats de combat, c'est un piège à leakage. Si tu utilises les stats du combat que tu veux prédire pour calculer l'EWMA, ton modèle va sur-apprendre et être inutilisable en conditions réelles. »

**Dr. Chen :**  
« Absolument. C'est la règle numéro un : **point-in-time validation**. On calcule les features uniquement avec les données disponibles avant le combat. C'est un problème bien connu en finance de marché. La solution, c'est de construire un pipeline qui "remonte le temps" et calcule les features séquentiellement. »

**Alex :**  
« Et les **cotes** ? J'ai vu des papiers qui intègrent les cotes d'ouverture comme feature. »

**Dr. Chen :**  
« Les cotes d'ouverture sont un excellent régularisateur : elles résument des milliers d'heures d'expertise humaine. Dans l'étude de Petersen, l'ajout des cotes d'ouverture fait passer le Brier score de 0.218 à 0.203. C'est significatif. En revanche, utiliser les **cotes de fermeture** pour la détection de value, c'est un piège : si tu les utilises en entrée du modèle, tu crées une circularité. »

**Alex :**  
« OK, donc : cotes d'ouverture dans le modèle → OK. Cotes de fermeture pour détecter la value → OK. Mais jamais les deux mélangés. »

**Décision :**
- EWMA features (3 fenêtres : court/moyen/long terme) sur strikes, takedowns, défense
- True Talent Rating bayésien (for de l'opposition)
- Cotes d'ouverture (uniquement comme feature d'entrée)
- Point-in-time validation obligatoire
- Short-notice flag pour les replacements

---

## Acte IV : La Dure Réalité du Plafond à 65-68%

**Dr. Chen :**  
« Parlons du plafond. Dryja (2024) arrive à 65.2% avec un Random Forest calibré. Petersen (2024) atteint 67.8% avec un stacked ensemble EWMA + Glicko-2. Bunker (2023) fait 63% avec un True Talent model seul.

Mon analyse c'est que le **vrai plafond théorique** du MMA moneyline est autour de 70-72%, pour plusieurs raisons :

1. **Variance intrinsèque** : un KO peut arriver à n'importe quel moment
2. **Informations privées** : poids de veille, blessures cachées, morale du camp
3. **Judge scoring** : 3 juges × 3 rounds × décisions subjectives
4. **Corner strategy** : game plan imprévisible

Donc 68% est un objectif ambitieux mais réaliste. »

**Alex :**  
« 65-68%, ça peut sembler faible comparé au tennis. Mais en pratique, si tu as un edge de 5-7% sur les cotes des bookmakers et que tu appliques le **Kelly Criterion**, tu peux générer un ROI de 15-25% par an sur 500-1000 paris. C'est très rentable.

Le vrai problème, c'est que beaucoup de data scientists se concentrent sur l'accuracy et négligent la **calibration**. Un modèle à 65% d'accuracy mais mal calibré, c'est inutile pour le value betting. Je préfère un modèle à 63% avec une calibration parfaite qu'un modèle à 66% mal calibré. »

**Dr. Chen :**  
« C'est exactement pourquoi j'ai choisi le Platt Scaling plutôt que l'Isotonic Regression dans la spec. La Isotonic Regression donne des probabilités mieux calibrées localement, mais elle sur-ajuste sur les petits échantillons — et en MMA, on a exactement ce problème : peu de combats par combattant.

Pour la calibration, on vise un **Brier score ≤ 0.205** et une **calibration curve** qui ne dévie pas de plus de 0.02 dans la zone 40-60%. »

**Alex :**  
« Et on garde un **recalibrage hebdomadaire** ? Les cotes bougent vite. »

**Dr. Chen :**  
« Oui, un recalibrage hebdomadaire du Platt Scaling sur les 100 derniers combats. Et un **retraining complet du modèle tous les 6 mois**. »

---

## Acte V : Le Value Betting — Comment Monétiser le Modèle

**Alex :**  
« Le value betting, c'est simple en théorie, dur en pratique : tu paries quand ta probabilité estimée est significativement supérieure à la probabilité implicite des cotes.

La formule : si `P_modèle / P_marché > 1 + ε`, tu paries.

Le ε, c'est la **marge de sécurité** pour compenser l'incertitude du modèle. »

**Dr. Chen :**  
« J'ai fait une simulation Monte Carlo sur les données historiques. Le seuil optimal de value detection est autour de 1.15-1.20. En dessous, trop de bruit ; au-dessus, trop peu d'opportunités.

Voici ce qu'on peut attendre :

| Seuil | Paris/mois | Win rate | ROI |
|-------|-----------|----------|-----|
| 1.10 | 40-60 | 62% | +8% |
| 1.15 | 25-35 | 65% | +14% |
| 1.20 | 15-20 | 69% | +18% |
| 1.30 | 5-10 | 74% | +12% |

Le sweet spot est à 1.15-1.20. »

**Alex :**  
« Attention au **drawdown**. MMA a des streaks de variance. En 2023, j'ai eu 3 mois consécutifs négatifs avec un modèle à 67%. Le Kelly fractionnaire (25-33%) est indispensable pour survivre. »

**Dr. Chen :**  
« La simulation intègre un Kelly fractionnaire à 25%. Avec 10 000€ de bankroll initiale :

- ROI annualisé : 16-22%
- Max drawdown : -18%
- Probabilité de ruine (5 ans) : < 2%

C'est solide. Mais il faut un **suivi rigoureux** des paris pour détecter la dérive du modèle. »

---

## Conclusions du Brainstorming

| Point | Décision | Justification |
|-------|----------|---------------|
| Cible | Moneyline → Méthode → Rounds | Phasage pour gérer complexité croissante |
| Modèle | Stacked ensemble (RF + XGB + True Talent) | Meilleur compromis accuracy/calibration |
| Calibration | Platt Scaling | Robuste sur petits échantillons |
| Validation | Point-in-time + expanding window | Anti-leakage obligatoire |
| Cotes entrée | Ouverture seulement | Pas de circularité |
| Value détection | Seuil 1.15-1.20 + Kelly 25% | Viable économiquement |
| Brier cible | ≤ 0.205 | Standard académique |
| Retraining | Complet tous les 6 mois + calibration hebdo | Suivi de dérive |

---

---

# 2. Architecture Générale

## 2.1 Vue d'Ensemble — Diagramme des Composants

```
┌────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  App.tsx      │  │  /tennis/*   │  │    /mma/*         │  │
│  │  (Router)     │──│  PreMatch    │──│  MMAPreMatch      │  │
│  │               │  │  LiveTracker │  │  FightCardView    │  │
│  └──────┬───────┘  └──────────────┘  └────────┬─────────┘  │
│         │                                      │            │
│         └───────────────┬──────────────────────┘            │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────┐       │
│  │          Composants Partagés (shared/)            │       │
│  │  MatchCard │ PredictionOverview │ KeyFactors       │       │
│  │  MetricCardXXL │ OddsFlow │ PredictionBar         │       │
│  └──────────────────────┬───────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────┐       │
│  │              API Layer (api/)                      │       │
│  │  tennisApi.ts │ mmaApi.ts │ predictionApi.ts       │       │
│  └──────────────────────┬───────────────────────────┘       │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP / Proxy
┌─────────────────────────┼───────────────────────────────────┐
│                 BACKEND (FastAPI)                           │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────┐       │
│  │           Model Registry (sport-agnostic)          │       │
│  │                                                   │       │
│  │  registry = {                                      │       │
│  │    "tennis": {"model": RF, "pipeline": FeaturePipe},│       │
│  │    "ufc":    {"model": Ensemble, "pipeline": UFCPipe}│       │
│  │  }                                                 │       │
│  │                                                   │       │
│  │  predict(sport: str, features: dict) → proba       │       │
│  └──────────────────────┬───────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────┐       │
│  │              Routes API                            │       │
│  │                                                   │       │
│  │  POST /predict/pre-match  → tennis (existante)    │       │
│  │  POST /predict/ufc        → mma (nouvelle)        │       │
│  │  POST /predict/{sport}    → route unifiée (v2)    │       │
│  │  POST /features/generate  → tennis (inchangée)    │       │
│  │  POST /features/ufc       → scraping UFC (nouvelle)│       │
│  │  GET  /strategy/simulate   → unifiée               │       │
│  └──────────────────────┬───────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────┐       │
│  │        Sports Database (schémas disjoints)         │       │
│  │                                                   │       │
│  │  tennis_matches │ tennis_players │ tennis_ewma    │       │
│  │  ufc_fights    │ ufc_fighters   │ ufc_round_stats │       │
│  └───────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

## 2.2 Flux de Données — Prédiction UFC

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│ Scraper  │───→│  Pipeline    │───→│  Model       │───→│  API     │
│ (UFCStat)│    │  Features    │    │  Registry    │    │  Route   │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
     │                │                    │                  │
     │  Récupère      │  Calcule :         │  Prédit :        │  Retourne :
     │  - match card  │  - EWMA strikes    │  - Random Forest │  - proba A
     │  - fighter bio │  - EWMA td         │  - XGBoost       │  - proba B
     │  - historique  │  - True Talent     │  - True Talent   │  - confidence
     │  - cotes       │  - cotes opening   │  ├─ Stacking     │  - key_factors
     │                │  - short_notice    │  └─ Platt Scale  │  - odds_value
     └────────────────┴────────────────────┴──────────────────┘
```

### Détail du Flux

1. **Scraper** (`src/scrapers/ufc_stats.py`) : appelé par cron quotidien, récupère les combats à venir depuis UFCStats / BestFightOdds / Tapology
2. **Pipeline Features** (`src/features/ufc_pipeline.py`) : pour chaque matchup, calcule les features EWMA, True Talent Rating, et features contextuelles
3. **Model Registry** (`src/models/registry.py`) : route la requête vers le modèle UFC entraîné, applique la calibration Platt
4. **API Route** (`POST /predict/ufc`) : endpoint dédié qui reçoit `{fight_id, fighter_a_id, fighter_b_id}` et retourne `PredictionResponse`
5. **Frontend** : affiche la prédiction dans une `FightCard` avec les key factors UFC

## 2.3 Registry de Modèles — Architecture Sport-Agnostic

L'architecture actuelle est **monolithique** (un seul modèle, des chemins codés en dur). On la refactorise en **registry sport-agnostic** :

```python
# src/models/registry.py (concept)
class ModelRegistry:
    """Registry sport-agnostic pour les modèles de prédiction."""

    _models: dict[str, ModelEntry] = {}

    def register(self, sport: str, entry: ModelEntry):
        self._models[sport] = entry

    def predict(self, sport: str, features: dict) -> PredictionResult:
        entry = self._models[sport]
        # 1. Pipeline features spécifique au sport
        vector = entry.pipeline.transform(features)
        # 2. Prédiction du modèle entraîné
        prob = entry.model.predict_proba([vector])[0, 1]
        # 3. Calibration spécifique
        calib = entry.calibrator.calibrate(prob) if entry.calibrator else prob
        # 4. Key factors sport-spécifiques
        factors = entry.factor_extractor.extract(vector)
        return PredictionResult(prob=calib, confidence=..., factors=factors)
```

### Entrées du Registry (MVP)

| Sport | Modèle | Pipeline | Calibration | Facteurs clés |
|-------|--------|----------|-------------|---------------|
| `tennis` | RandomForest (existant) | `FeaturePipeline` | Platt Scaling (existant) | `_extract_key_factors` (tennis) |
| `ufc` | Stacked Ensemble (RF+XGB) | `UFCPipeline` | Platt Scaling (UFC) | `_extract_ufc_factors` |

### Points d'Extension

- **Nouveau sport** : `registry.register("basketball", entry)` → nouveau pipeline, nouveau modèle, nouveaux facteurs
- **Versioning** : chaque `ModelEntry` a un `model_version` et une date de déploiement
- **Fallback** : si le modèle UFC n'est pas chargé, retourne proba 0.5 avec `confidence: 0`
- **A/B Testing** : possibilité de router X% du trafic vers un modèle challenger

## 2.4 Arbre de Décision — UFC vs Tennis

```
Requête API
    │
    ├─ sport = "tennis" ───→ TennisFeaturePipeline
    │                              │
    │                         EWMA tennis stats
    │                              │
    │                         RandomForest (600 trees)
    │                              │
    │                         Platt Calibration
    │                              │
    │                         KeyFactors tennis
    │
    └─ sport = "ufc" ──────→ UFCPipeline
                               │
                          EWMA strikes/takedowns/defense
                          True Talent Rating bayésien
                          Short-notice flag
                          Opening odds feature
                               │
                          Stacked Ensemble:
                            ├─ RandomForest (800 trees)
                            ├─ XGBoost (learning_rate=0.05)
                            └─ True Talent Model (logistic)
                               │
                          Platt Calibration (recalibré hebdo)
                               │
                          KeyFactors UFC spécifiques
```

## 2.5 Contraintes Techniques

| Contrainte | Impact | Solution |
|------------|--------|----------|
| Point-in-time validation | Pas de fuite de données | Pipeline séquentiel qui "rewind" la date du combat |
| Données UFC hétérogènes | Sources multiples, formats différents | Couche d'abstraction `BaseScraper` + normalisation |
| Combattants peu actifs | Features creuses (2-3 combats) | True Talent bayésien avec prior fort |
| Cotes en évolution rapide | Calibration qui dérive | Recalibrage Platt hebdomadaire glissant |
| Short notice (~15% fights) | Features incomplètes | ShortNoticePipeline spécifique + flag binaire |
| Performance mobile | Temps de réponse < 500ms | Cache Redis des features pré-calculées |
| Coexistence tennis/UFC | Pas de régression tennis | Registry isolé, tests de non-régression |

## 2.6 Base de Données — Schémas Disjoints

Les données tennis et UFC restent dans des **schémas/tables séparés** pour éviter toute contamination :

```
┌─────────────────────┐    ┌──────────────────────────┐
│  tennis_matches     │    │  ufc_fights               │
│  tennis_players     │    │  ufc_fighters              │
│  tennis_rankings    │    │  ufc_rankings              │
│  tennis_ewma        │    │  ufc_round_stats           │
│  tennis_sackmann    │    │  ufc_historical_odds       │
└─────────────────────┘    └──────────────────────────┘
```

**Principe** : les deux sports sont totalement indépendants dans la DB. Seul le registry backend les fédère. Cela permet de :
- Déployer l'onglet MMA sans toucher aux tables tennis
- Faire évoluer les schémas UFC indépendamment
- Permettre des stratégies de backup/sharding différentes (tennis = dataset Sackmann stable, UFC = scraping continu)


---

# 3. Spécifications Frontend

## 3.1 Extension des Types TypeScript

Le fichier `frontend/src/types/index.ts` actuel est tennis-only. On l'étend avec une union discriminante :

```typescript
// === Types existants (tennis) — NE PAS MODIFIER ===

export interface FeatureVector {
  // tennis-specific
  surface: 'hard' | 'clay' | 'grass' | 'carpet';
  srv_edge: number;
  clutch_factor: number;
  atp_points: number;
  // ... reste inchangé
}

// === NOUVEAUX Types UFC/MMA ===

export type UFCSport = 'ufc';

export type Stance = 'orthodox' | 'southpaw' | 'switch';

export type WeightClass =
  | 'strawweight' | 'flyweight' | 'bantamweight'
  | 'featherweight' | 'lightweight' | 'welterweight'
  | 'middleweight' | 'light_heavyweight' | 'heavyweight';

export type FightMethod = 'ko_tko' | 'submission' | 'decision_unanimous'
  | 'decision_split' | 'decision_majority' | 'draw' | 'no_contest';

export type FightRound = 1 | 2 | 3 | 4 | 5;

export interface UFCFighterFeatures {
  fighter_id: string;
  fighter_name: string;
  nickname?: string;
  record: string;                // "15-2-0"
  stance: Stance;
  age: number;
  height_cm: number;
  reach_cm: number;
  weight_class: WeightClass;

  // EWMA features (short / medium / long)
  ewma_sig_str_landed_S: number;
  ewma_sig_str_landed_M: number;
  ewma_sig_str_landed_L: number;
  ewma_td_avg_S: number;
  ewma_td_avg_M: number;
  ewma_td_defense_S: number;
  ewma_sub_attempts_S: number;
  ewma_ctrl_time_sec_S: number;

  // True Talent
  true_talent_rating: number;    // bayésien, centré sur 0
  opponent_strength_sos: number; // Strength of Schedule

  // Contexte
  days_since_last_fight: number;
  is_short_notice: boolean;
  camp_changed: boolean;
  weight_cut_concern: boolean;   // weight miss warning
}

export interface UFCMatchFeatures {
  sport: UFCSport;
  fight_id: string;
  event_name: string;
  event_date: string;            // ISO date
  weight_class: WeightClass;
  is_title_fight: boolean;
  is_main_event: boolean;
  is_interim: boolean;
  rounds: FightRound;            // 3 ou 5

  fighter_a: UFCFighterFeatures;
  fighter_b: UFCFighterFeatures;

  // Head-to-head
  h2h_fights: number;
  h2h_wins_a: number;

  // Odds features
  opening_odds_a: number;        // cote décimal (ex: 1.85)
  opening_odds_b: number;

  // Composées
  reach_advantage_a: number;     // reach_a - reach_b (cm)
  age_difference_a: number;      // age_a - age_b
  stance_advantage: number;      // 1 si southpaw vs orthodox, sinon 0
  weight_class_avg_finish_rate: number; // % de finitions dans la catégorie
}

export interface UFCPrediction {
  fight_id: string;
  prob_a: number;                // probabilité fighter A gagne
  prob_b: number;
  confidence: number;            // 0.0 – 1.0
  predicted_method?: FightMethod;
  predicted_round?: FightRound;
  key_factors: UFCKeyFactor[];
  value_alert?: ValueAlert;
}

export interface UFCKeyFactor {
  label: string;
  fighter_a_value: number | string;
  fighter_b_value: number | string;
  advantage: 'a' | 'b' | 'neutral';
  weight: number;                // importance relative (0-1)
  icon: string;                  // lucide-react icon name
}

export interface ValueAlert {
  threshold: number;             // ratio P_modèle / P_marché
  recommendation: 'bet_a' | 'bet_b' | 'no_bet';
  expected_value: number;
  kelly_fraction: number;
}

// === Union discriminante pour le router ===

export type Sport = 'tennis' | 'ufc';

export interface SportRoute {
  sport: Sport;
  label: string;
  icon: string;
  path: string;
}
```

## 3.2 Composants UFC — Arborescence

```
frontend/src/
├── components/
│   ├── shared/                       ← existant, réutilisé
│   │   ├── MatchCard.tsx             ← adapté via props sport
│   │   ├── PredictionOverview.tsx    ← adapté via props sport
│   │   ├── KeyFactors.tsx            ← adapté via props sport
│   │   ├── MetricCardXXL.tsx         ← existant, inchangé
│   │   ├── OddsFlow.tsx              ← existant, inchangé
│   │   └── PredictionBar.tsx         ← existant, inchangé
│   │
│   ├── mma/                          ← NOUVEAU
│   │   ├── FightCard.tsx             ← carte complète d'un combat
│   │   ├── FighterAvatar.tsx         ← cercle avec photo/nom/stance
│   │   ├── StanceBadge.tsx           ← badge Orthodoxe/Southpaw
│   │   ├── WeightClassBadge.tsx      ← badge catégorie
│   │   ├── StyleMatchupBadge.tsx     ← Grappler vs Striker
│   │   ├── RecordBadge.tsx           ← record 15-2 (avec streak)
│   │   ├── MethodDistribution.tsx    ← diagramme %KO/%SUB/%DEC
│   │   ├── RoundBreakdown.tsx        ← stats par round (strikes, td)
│   │   ├── OctagonCanvas.tsx         ← vue stylisée de l'octogone
│   │   ├── FightCardList.tsx         ← liste pour la card d'event
│   │   └── ValueAlertBanner.tsx      ← alerte value betting
│   │
│   └── tennis/                       ← existant, inchangé
│
├── pages/
│   ├── PreMatch.tsx                  ← existant tennis
│   ├── LiveTracker.tsx               ← existant tennis
│   ├── MMAPreMatch.tsx               ← NOUVEAU
│   └── MMAEventView.tsx              ← NOUVEAU
│
├── api/
│   ├── tennisApi.ts                  ← existant
│   ├── mmaApi.ts                     ← NOUVEAU
│   └── predictionApi.ts              ← existant (sport dispatch)
│
└── hooks/
    ├── usePrediction.ts              ← existant (générique sport)
    └── useUFCEvent.ts                ← NOUVEAU
```

## 3.3 Composants UFC — Spécifications Détaillées

### FightCard (composant principal)

```
┌──────────────────────────────────────────────────┐
│  ⭐❓ UFC 314 │ Volkanovski vs Lopes │ Main Card  │
│  ┌──────────────────────────────────────────────┐ │
│  │                                               │ │
│  │  ┌──────────┐              ┌──────────┐       │ │
│  │  │  [Photo]  │   VS         │  [Photo]  │       │ │
│  │  │  Alex     │              │  Diego    │       │ │
│  │  │Volkanovski│              │  Lopes    │       │ │
│  │  │           │              │           │       │ │
│  │  │  🇦🇺      │              │  🇧🇷      │       │ │
│  │  │ 26-4-0   │              │ 26-6-0   │       │ │
│  │  │ Orthodox │              │ Orthodox  │       │ │
│  │  │  1.75m   │              │  1.80m    │       │ │
│  │  └──────────┘              └──────────┘       │ │
│  │                                               │ │
│  │  ┌────────────────────────────────────────┐   │ │
│  │  │  ████████████████████████████████░░ 64% │   │ │
│  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 36% │   │ │
│  │  │  Confidence: ████████░░ 0.72           │   │ │
│  │  └────────────────────────────────────────┘   │ │
│  │                                               │ │
│  │  Key Factors:                                  │ │
│  │  ┌──────────┬──────────┬──────────┬────────┐  │ │
│  │  │Striking │Takedowns│ Finishing│ Recent │  │ │
│  │  │ +12% 🔥 │  -3%    │  +8% 🔥  │  +5%   │  │ │
│  │  └──────────┴──────────┴──────────┴────────┘  │ │
│  │                                               │ │
│  │  ⚡ VALUE BET: Cote 2.20, notre proba 64%      │ │
│  │     Ratio: 1.41 | Kelly: 8.7% | EV: +17%     │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Composants Atomiques UFC

**`StanceBadge.tsx`**
- Affiche la garde (orthodox / southpaw / switch)
- Icône: `Fist` (lucide) avec rotation
- Couleurs: `--color-mma-badge-orthodox`, `--color-mma-badge-southpaw`

**`WeightClassBadge.tsx`**
- Badge compact de la catégorie de poids
- Icône: `Weight` (lucide)
- Couleur dégradée: plus lourde = plus foncée (de `#a8e6cf` strawweight à `#ff8a80` heavyweight)

**`StyleMatchupBadge.tsx`**
- Affiche le style principal du combattant (Grappler / Striker / Brawler / All-rounder)
- Icône: `Crosshair` pour striker, `Anchor` pour grappler
- `--color-mma-badge-striking: #ef4444`, `--color-mma-badge-grappling: #8b5cf6`

**`MethodDistribution.tsx`**
- Mini diagramme horizontal %KO / %SUB / %DEC
- Utilise `recharts` (déjà installé) — petites barres colorées
- Couleurs: KO #ef4444, SUB #8b5cf6, DEC #3b82f6

**`RoundBreakdown.tsx`**
- Tableau stats par round : significant strikes, takedowns, control time
- Affiché en détail sur clic (expandable row)
- Calculé à partir des EWMA par round

**`ValueAlertBanner.tsx`**
- Bannière conditionnelle (visible uniquement si `value_alert` présent)
- Score EV (Expected Value) + fraction Kelly recommandée
- Bouton "Placer un pari simulé" (logique locale, pas d'API bet réelle)

## 3.4 Routing — Ajout des Routes UFC

```typescript
// App.tsx — ajout des routes UFC
const ROUTES: SportRoute[] = [
  { sport: 'tennis', label: 'Top 10 ATP', icon: 'TennisBall', path: '/tennis' },
  { sport: 'ufc',    label: 'UFC MMA',    icon: 'Swords',      path: '/mma' },
];

<Routes>
  {/* Routes existantes tennis */}
  <Route path="/tennis" element={<PreMatch />} />

  {/* Routes UFC — NOUVELLES */}
  <Route path="/mma" element={<MMAPreMatch />} />
  <Route path="/mma/event/:eventId" element={<MMAEventView />} />

  {/* Default redirect */}
  <Route path="/" element={<Navigate to="/mma" />} />
</Routes>
```

Note : la page d'accueil (`/`) redirige vers `/mma` car l'onglet UFC est le nouveau module vedette. L'utilisateur bascule via la navigation entre "Top 10 ATP" et "UFC MMA".

## 3.5 API Layer — Client UFC

```typescript
// frontend/src/api/mmaApi.ts
import { UFCMatchFeatures, UFCPrediction } from '../types';

const BASE = '/predict';

export async function predictUFC(
  fightId: string,
  fighterAId: string,
  fighterBId: string,
): Promise<UFCPrediction> {
  const res = await fetch(`${BASE}/ufc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fight_id: fightId, fighter_a_id: fighterAId, fighter_b_id: fighterBId }),
  });
  if (!res.ok) throw new Error(`UFC API error: ${res.status}`);
  return res.json();
}

export async function getUFCEvent(eventId: string): Promise<UFCMatchFeatures[]> {
  const res = await fetch(`${BASE}/ufc/event/${eventId}`);
  if (!res.ok) throw new Error(`UFC Event API error: ${res.status}`);
  return res.json();
}
```

## 3.6 Composants Partagés — Adaptation

Les composants existants `MatchCard`, `PredictionOverview`, `KeyFactors` sont rendus **sport-agnostic** via props :

```typescript
// MatchCard accepte un paramètre sport
interface MatchCardProps {
  sport: 'tennis' | 'ufc';
  // ...
  // tennis: player_a_name, player_b_name
  // ufc:    fighter_a, fighter_b (nickname, record, stance, weight_class)
  renderSportSpecific: () => React.ReactNode;
}
```

**Stratégie** : pas de réécriture — on ajoute une prop `renderSportSpecific` optionnelle. Si absente, le composant se comporte comme avant (mode tennis legacy). Si présente, il rend le contenu spécifique au sport dans les zones prévues (en-tête de carte, badge, etc.).


---

# 4. Spécifications Backend

## 4.1 Nouveaux Schémas Pydantic — UFC

Ajouter dans `src/schema/match.py` (ou nouveau fichier `src/schema/ufc.py`) :

```python
"""Schémas Pydantic UFC — module indépendant du schéma tennis."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Enums ──

class Stance(str, Enum):
    orthodox = "orthodox"
    southpaw = "southpaw"
    switch = "switch"

class WeightClass(str, Enum):
    strawweight = "strawweight"
    flyweight = "flyweight"
    bantamweight = "bantamweight"
    featherweight = "featherweight"
    lightweight = "lightweight"
    welterweight = "welterweight"
    middleweight = "middleweight"
    light_heavyweight = "light_heavyweight"
    heavyweight = "heavyweight"

class FightMethod(str, Enum):
    ko_tko = "ko_tko"
    submission = "submission"
    decision_unanimous = "decision_unanimous"
    decision_split = "decision_split"
    decision_majority = "decision_majority"
    draw = "draw"
    no_contest = "no_contest"


# ── Entités ──

class UFCFighter(BaseModel):
    """Combattant UFC."""
    fighter_id: str = Field(..., description="Identifiant unique (UFCStats / Tapology)")
    fighter_name: str = Field(..., description="Nom complet")
    nickname: Optional[str] = None
    nationality: Optional[str] = Field(None, description="Code ISO pays")
    birth_date: Optional[date] = None
    height_cm: Optional[int] = Field(None, ge=120, le=250)
    reach_cm: Optional[int] = Field(None, ge=120, le=250)
    weight_class: WeightClass
    stance: Stance = Stance.orthodox
    record_wins: int = Field(..., ge=0)
    record_losses: int = Field(..., ge=0)
    record_draws: int = Field(0, ge=0)

    @property
    def record_str(self) -> str:
        return f"{self.record_wins}-{self.record_losses}-{self.record_draws}"

    @property
    def win_rate(self) -> float:
        total = self.record_wins + self.record_losses
        return self.record_wins / total if total > 0 else 0.0


class UFCFight(BaseModel):
    """Combat UFC complet."""
    fight_id: str = Field(..., description="Identifiant unique")
    event_id: str
    event_name: str
    event_date: date
    weight_class: WeightClass
    is_title_fight: bool = False
    is_main_event: bool = False
    is_interim: bool = False
    rounds: int = Field(3, ge=3, le=5)  # 3 ou 5 rounds
    fighter_a_id: str
    fighter_b_id: str
    winner_id: Optional[str] = None
    method: Optional[FightMethod] = None
    round_finished: Optional[int] = Field(None, ge=1, le=5)
    time_finished_sec: Optional[int] = Field(None, ge=0, le=1800)


# ── Features calculées ──

class UFCEwmaFeatures(BaseModel):
    """Features EWMA pour un combattant sur un combat."""
    # Significant strikes
    sig_str_landed_pct_S: Optional[float] = None   # court terme (τ=0.3)
    sig_str_landed_pct_M: Optional[float] = None   # moyen terme (τ=0.15)
    sig_str_landed_pct_L: Optional[float] = None   # long terme  (τ=0.05)
    sig_str_absorbed_pct_S: Optional[float] = None
    sig_str_defense_S: Optional[float] = None

    # Takedowns
    td_avg_per_15_S: Optional[float] = None
    td_accuracy_S: Optional[float] = None
    td_defense_S: Optional[float] = None
    td_avg_per_15_M: Optional[float] = None

    # Submission & control
    sub_attempts_per_15_S: Optional[float] = None
    ctrl_time_per_15_sec_S: Optional[float] = None

    # KO power
    ko_rate_career: Optional[float] = None
    sub_rate_career: Optional[float] = None
    dec_rate_career: Optional[float] = None

    # Volume
    sig_str_landed_per_min_S: Optional[float] = None
    sig_str_absorbed_per_min_S: Optional[float] = None
    strike_differential_S: Optional[float] = None     # landed - absorbed


class UFCFightFeatures(BaseModel):
    """Feature vector complet pour un combat UFC pré-fight."""
    fight_id: str

    # True Talent (bayésien)
    true_talent_a: Optional[float] = None
    true_talent_b: Optional[float] = None
    opponent_strength_a: Optional[float] = None   # Strength of Schedule
    opponent_strength_b: Optional[float] = None

    # EWMA différentiel A − B
    ewma_strike_diff_S: Optional[float] = None
    ewma_td_diff_S: Optional[float] = None
    ewma_defense_diff_S: Optional[float] = None

    # Contextuelles
    reach_advantage_a: Optional[float] = None
    age_difference_a: Optional[float] = None
    days_since_last_a: Optional[int] = None
    days_since_last_b: Optional[int] = None
    is_short_notice_a: bool = False
    is_short_notice_b: bool = False
    is_title_fight: bool = False
    stance_advantage: Optional[float] = Field(None, description="+1 si southpaw vs orthodox")
    weight_class_avg_finish_rate: Optional[float] = None

    # Cotes d'ouverture (feature d'entrée uniquement)
    opening_odds_implied_prob_a: Optional[float] = None
    opening_odds_implied_prob_b: Optional[float] = None

    # Angles morts
    camp_changed_a: bool = False
    camp_changed_b: bool = False
    weight_cut_concern_a: bool = False
    weight_cut_concern_b: bool = False
    same_opponent_rematch: bool = False
    fighter_a_streak: Optional[int] = None   # positive = win streak, negative = loss streak
    fighter_b_streak: Optional[int] = None


class UFCPredictionResponse(BaseModel):
    """Réponse de prédiction pour un combat UFC."""
    fight_id: str
    fighter_a_id: str
    fighter_b_id: str
    fighter_a_name: str
    fighter_b_name: str
    weight_class: WeightClass
    prob_a: float = Field(..., ge=0, le=1)
    prob_b: float = Field(..., ge=0, le=1)
    confidence: Optional[float] = Field(None, ge=0, le=1)
    key_factors: list[dict] = Field(default_factory=list)
    value_alert: Optional[dict] = None
    model_version: str = "pariscore-ufc-v1.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

## 4.2 Endpoints API — Nouveaux

Dans `src/api/main.py`, ajouter les routes UFC :

```python
# ── Routes UFC ──

@app.post("/predict/ufc")
async def predict_ufc(features: UFCFightFeatures):
    """Prédiction UFC pré-fight à partir d'un vecteur de features complet.

    Les features doivent être générées par le pipeline UFC avant l'appel.
    """
    if not state.ufc_model_loaded:
        raise HTTPException(status_code=503, detail="Modèle UFC non chargé")

    prob_a = _predict_ufc(features)
    value_alert = _detect_value(prob_a, features)

    return UFCPredictionResponse(
        fight_id=features.fight_id,
        fighter_a_id=..., fighter_b_id=...,
        fighter_a_name=..., fighter_b_name=...,
        weight_class=...,
        prob_a=round(float(prob_a), 4),
        prob_b=round(1.0 - float(prob_a), 4),
        confidence=_compute_ufc_confidence(prob_a),
        key_factors=_extract_ufc_key_factors(features),
        value_alert=value_alert,
        model_version="pariscore-ufc-v1.0",
    )


@app.post("/features/ufc")
async def generate_ufc_features(data: dict):
    """Génère les features UFC à partir des données brutes (scraper).

    Entrée: données brutes du combat (UFCStats).
    Sortie: vecteur de features prêt pour prédiction.
    """
    result = ufc_pipeline.run(data)
    if not result:
        raise HTTPException(status_code=400, detail="Impossible de générer les features UFC")
    state.ufc_feature_cache[data["fight_id"]] = result
    return {"fight_id": data["fight_id"], "status": "features_generated", "features": result}


@app.get("/predict/ufc/event/{event_id}")
async def predict_ufc_event(event_id: str):
    """Prédictions pour tous les combats d'un event UFC."""
    # TODO: récupérer les combats de l'event, générer features, prédire
    return {"event_id": event_id, "fights": [...], "status": "placeholder"}
```

### Refactor : Extraction du `_predict()` générique

```python
def _predict_sport(sport: str, features: dict) -> float:
    """Prédit la probabilité via le registry sport-agnostic.

    Args:
        sport: 'tennis' ou 'ufc'
        features: vecteur de features spécifique au sport

    Returns:
        probabilité calibrée [0, 1]
    """
    entry = MODEL_REGISTRY.get(sport)
    if not entry or not entry.model_loaded:
        logger.warning(f"Modèle {sport} non chargé, fallback neutre")
        return 0.5

    cols = entry.feature_columns
    x = np.array([[features.get(col, 0.0) for col in cols]])
    prob = entry.model.predict_proba(x)[0, 1]

    if entry.calibrator:
        prob = entry.calibrator.calibrate(prob)

    return prob
```

## 4.3 Registry — Implémentation Python

```python
# src/models/registry.py
from dataclasses import dataclass
from typing import Optional, Callable

@dataclass
class ModelEntry:
    sport: str
    model: object                # sklearn-compatible classifier
    pipeline: object             # FeaturePipeline (sport-specific)
    feature_columns: list[str]
    calibrator: Optional[object] = None  # PlattCalibrator
    factor_extractor: Optional[Callable] = None
    model_loaded: bool = False
    model_version: str = "0.0.0"

class SportModelRegistry:
    """Registry thread-safe pour tous les modèles sportifs."""

    def __init__(self):
        self._entries: dict[str, ModelEntry] = {}

    def register(self, sport: str, entry: ModelEntry):
        self._entries[sport] = entry

    def get(self, sport: str) -> Optional[ModelEntry]:
        return self._entries.get(sport)

    def predict(self, sport: str, features: dict) -> float:
        entry = self.get(sport)
        if not entry or not entry.model_loaded:
            return 0.5
        cols = entry.feature_columns
        import numpy as np
        x = np.array([[features.get(col, 0.0) for col in cols]])
        return entry.model.predict_proba(x)[0, 1]

    @property
    def loaded_sports(self) -> list[str]:
        return [s for s, e in self._entries.items() if e.model_loaded]

# Instance globale (singleton)
MODEL_REGISTRY = SportModelRegistry()
```

### Initialisation au démarrage

```python
@app.on_event("startup")
async def startup():
    """Charge les deux modèles au démarrage."""
    tennis_entry = load_tennis_model()
    MODEL_REGISTRY.register("tennis", tennis_entry)

    ufc_entry = load_ufc_model()
    MODEL_REGISTRY.register("ufc", ufc_entry)
```

## 4.4 Endpoint Health — Extension

```python
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "models": MODEL_REGISTRY.loaded_sports,
        "version": "2.0.0",
    }
```

## 4.5 Proxy Vite — Extension

Nouveaux proxys à ajouter dans `frontend/vite.config.ts` :

```typescript
server: {
  proxy: {
    '/health':    { target: 'http://localhost:8000', changeOrigin: true },
    '/predict':   { target: 'http://localhost:8000', changeOrigin: true },
    '/features':  { target: 'http://localhost:8000', changeOrigin: true },
    '/strategy':  { target: 'http://localhost:8000', changeOrigin: true },
    // NOUVEAU (les endpoints UFC passent déjà par /predict et /features)
  },
},
```

Pas besoin de nouvelles entrées — `/predict/ufc` et `/features/ufc` sont déjà couverts par les proxys `/predict` et `/features` existants.

---

---

# 5. Pipeline ML Détaillé

## 5.1 Architecture du Stacked Ensemble

```
                    ┌──────────────────────┐
                    │    Input Features     │
                    │  (EWMA + True Talent  │
                    │   + Context + Odds)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Level 0 (Base)      │
                    │                       │
                    │  ┌─────┐  ┌───────┐   │
                    │  │ RF  │  │ XGBoost│   │
                    │  │800  │  │ lr=0.05│   │
                    │  │trees│  │max_d=8 │   │
                    │  └──┬──┘  └───┬───┘   │
                    │     │         │        │
                    │  ┌──▼─────────▼───┐   │
                    │  │ True Talent    │   │
                    │  │ (Logistic Reg) │   │
                    │  └───────┬───────┘   │
                    └──────────┼───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Level 1 (Meta)      │
                    │                       │
                    │  LogisticRegression   │
                    │  (Stacking blender)   │
                    │  5-fold CV stacking   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Calibration         │
                    │                       │
                    │  Platt Scaling        │
                    │  (sigmoid)            │
                    │  Recalibré /semaine   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Value Detection     │
                    │                       │
                    │  P_modèle / P_marché  │
                    │  > 1.15 → value bet   │
                    │  Kelly 25% fraction   │
                    └──────────────────────┘
```

## 5.2 Modèle 1 : Random Forest

Paramètres validés pour le contexte UFC (basé sur Dryja 2024 + tuning MMA spécifique) :

```python
RF_UFC_PARAMS = {
    "n_estimators": 800,          # +200 vs tennis (plus de variance à capturer)
    "max_depth": 12,              # légèrement plus profond
    "min_samples_leaf": 5,        # +1 vs tennis (plus de régularisation)
    "max_features": "sqrt",
    "random_state": 42,
    "n_jobs": -1,
    "class_weight": "balanced",
    "min_samples_split": 10,
    "criterion": "log_loss",      # meilleur pour calibration probabiliste
}
```

**Justification des changements vs tennis :**
- **+200 arbres** : le MMA a plus de variance aléatoire, plus d'arbres stabilise l'estimation
- **max_depth=12** (vs 10) : les features UFC sont plus nombreuses et plus riches
- **min_samples_leaf=5** (vs 4) : léger sur-régularisation pour éviter le sur-apprentissage sur petits échantillons
- **criterion=log_loss** : optimise directement la calibration, pas juste le rang (AUC)

## 5.3 Modèle 2 : XGBoost

Le XGBoost apporte une capacité à capturer les interactions non-linéaires que le RF peut manquer :

```python
XGB_UFC_PARAMS = {
    "n_estimators": 600,
    "learning_rate": 0.05,
    "max_depth": 8,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "gamma": 0.1,                 # pénalité split
    "reg_alpha": 0.1,             # L1 regularization
    "reg_lambda": 1.0,            # L2 regularization
    "random_state": 42,
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "early_stopping_rounds": 50,
}
```

## 5.4 Modèle 3 : True Talent Rating (Bayésien)

```python
class TrueTalentModel:
    """
    Modèle bayésien hiérarchique inspiré de Bunker (2023).

    Estime le 'vrai niveau' d'un combattant en tenant compte de la
    force de l'opposition, du nombre de combats, et d'un prior
    empirique basé sur la moyenne de la division de poids.

    Principe :
        talent_posterior = talent_prior + Σ(performances_pondérées)

        où le prior est la moyenne de la catégorie de poids,
        et chaque performance est pondérée par la force de l'opposition
        et un facteur de décroissance temporelle (plus récent = plus important).

    Returns:
        probabilité calibrée du combattant A de gagner.
    """
    def predict(self, tt_a: float, tt_b: float) -> float:
        # Différence de talent → proba logistique
        diff = tt_a - tt_b
        return 1.0 / (1.0 + np.exp(-diff * SIGMOID_SCALE))
```

**SIGMOID_SCALE** : paramètre calibré sur données historiques (~1.8), ajuste la pente de la sigmoïde.

## 5.5 Stacking — Level 1

```python
from sklearn.linear_model import LogisticRegression

STACKING_META_PARAMS = {
    "C": 0.5,                     # régularisation L2 modérée
    "penalty": "l2",
    "solver": "lbfgs",
    "max_iter": 1000,
    "class_weight": "balanced",
}
```

**Processus :** les 3 modèles de base sont entraînés en **5-fold CV**. Les prédictions hors-fold sont utilisées comme features d'entrée pour la Logistic Regression de stacking. Cela évite le sur-apprentissage du meta-model.

## 5.6 Calibration — Platt Scaling Spécifique UFC

```python
class UFCCalibrator:
    """
    Calibration Platt avec recalibrage glissant hebdomadaire.
    Entraîné sur les 100 derniers combats avec cotes connues.
    """
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.platt: Optional[CalibratedClassifierCV] = None
        self.last_trained: Optional[date] = None

    def calibrate(self, prob: float) -> float:
        if self.platt is None:
            return prob  # fallback non calibré
        return self.platt.predict_proba([[prob]])[0, 1]

    def should_recalibrate(self, today: date) -> bool:
        if self.last_trained is None:
            return True
        return (today - self.last_trained).days >= 7

    def recalibrate(self, X: np.ndarray, y: np.ndarray):
        """Recalibre sur les derniers window_size combats."""
        from sklearn.calibration import CalibratedClassifierCV
        from sklearn.linear_model import LogisticRegression
        base = LogisticRegression(C=1.0, max_iter=500)
        self.platt = CalibratedClassifierCV(base, method='sigmoid', cv=3)
        self.platt.fit(X, y)
        self.last_trained = date.today()
```

## 5.7 Value Detection

```python
def detect_value(
    model_prob: float,          # probabilité calibrée du modèle
    market_odds_decimal: float, # cote décimal du marché
    threshold: float = 1.15,    # seuil de value detection
    kelly_fraction: float = 0.25,
) -> Optional[dict]:
    """
    Détecte une opportunité de value bet.

    Args:
        model_prob: probabilité du modèle [0, 1]
        market_odds: cote décimal (ex: 2.20)
        threshold: ratio minimum P_modèle / P_marché
        kelly_fraction: fraction de Kelly (0.25 = 25%)

    Returns:
        dict si value détectée, None sinon
    """
    market_prob = 1.0 / market_odds_decimal
    ratio = model_prob / market_prob

    if ratio <= threshold:
        return None

    # Kelly Criterion : f* = (p * odds - 1) / (odds - 1)
    kelly_full = (model_prob * market_odds_decimal - 1.0) / (market_odds_decimal - 1.0)
    kelly_safe = max(0, kelly_full * kelly_fraction)

    expected_value = (model_prob * (market_odds_decimal - 1)) - (1 - model_prob)

    return {
        "market_prob": round(market_prob, 4),
        "model_prob": round(model_prob, 4),
        "ratio": round(ratio, 3),
        "kelly_fraction": round(kelly_safe, 4),
        "expected_value": round(expected_value, 4),
        "recommendation": "bet" if kelly_safe > 0.01 else "no_bet",
    }
```

## 5.8 Pipeline de Features UFC

```python
# src/features/ufc_pipeline.py
class UFCPipeline:
    """
    Pipeline de features pour les combats UFC.
    Transforme les données brutes (UFCStats) → vecteur de features.

    Ordre d'exécution :
    1. Chargement et validation des données brutes
    2. Calcul des EWMA pour chaque combattant (3 fenêtres)
    3. Calcul du True Talent Rating (bayésien)
    4. Calcul des features contextuelles
    5. Calcul des features composites
    6. Normalisation / clipping
    7. Assemblage du vecteur final
    """

    def __init__(self):
        self.ewma_calculator = EwmaCalculator(
            windows={"S": 0.30, "M": 0.15, "L": 0.05}
        )
        self.talent_estimator = TrueTalentEstimator()
        self.context_calculator = ContextCalculator()

    def run(self, raw_data: dict) -> UFCFightFeatures:
        """Exécute le pipeline complet pour un combat."""
        fighter_a, fighter_b = raw_data["fighter_a"], raw_data["fighter_b"]

        # 1. EWMA
        ewma_a = self.ewma_calculator.calculate(fighter_a)
        ewma_b = self.ewma_calculator.calculate(fighter_b)

        # 2. True Talent
        tt_a = self.talent_estimator.estimate(fighter_a)
        tt_b = self.talent_estimator.estimate(fighter_b)
        opp_a = self.talent_estimator.avg_opponent_rating(fighter_a)
        opp_b = self.talent_estimator.avg_opponent_rating(fighter_b)

        # 3. Contexte
        ctx = self.context_calculator.calculate(fighter_a, fighter_b)

        # 4. Composées
        features = UFCFightFeatures(
            fight_id=raw_data["fight_id"],
            true_talent_a=tt_a,
            true_talent_b=tt_b,
            opponent_strength_a=opp_a,
            opponent_strength_b=opp_b,
            ewma_strike_diff_S=ewma_a.sig_str_landed_pct_S - ewma_b.sig_str_absorbed_pct_S,
            ewma_td_diff_S=ewma_a.td_avg_per_15_S - ewma_b.td_defense_S,
            reach_advantage_a=fighter_a.reach_cm - fighter_b.reach_cm,
            age_difference_a=fighter_a.age - fighter_b.age,
            **ctx,
        )
        return features
```

## 5.9 Entraînement du Modèle UFC

```python
# src/models/train_ufc.py
def train_ufc_ensemble(
    df_fights: pd.DataFrame,
    n_splits: int = 5,
) -> tuple[StackingClassifier, dict]:
    """
    Entraîne le stacked ensemble UFC.

    1. Prépare les features (EWMA + TT + contexte)
    2. TimeSeriesSplit (expanding window)
    3. Entraîne RF + XGB + TT en parallèle
    4. Stack avec LogisticRegression
    5. Calibration Platt finale

    Métriques cibles :
      - Accuracy : ≥ 0.65
      - Brier : ≤ 0.205
      - AUC-ROC : ≥ 0.72
      - Log loss : ≤ 0.60
    """
    # Préparation
    X, y = prepare_ufc_features(df_fights)
    tscv = TimeSeriesSplit(n_splits=n_splits)

    # Modèles de base
    base_models = [
        ("rf", RandomForestClassifier(**RF_UFC_PARAMS)),
        ("xgb", XGBClassifier(**XGB_UFC_PARAMS)),
        ("tt", LogisticRegression(C=0.5, max_iter=1000)),
    ]

    # Stacking avec 5-fold CV
    stack = StackingClassifier(
        estimators=base_models,
        final_estimator=LogisticRegression(C=0.5, max_iter=1000),
        cv=5,
        stack_method="predict_proba",
    )

    # Entraînement avec validation temporelle
    metrics = {"accuracy": [], "brier": [], "roc_auc": []}
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        stack.fit(X_train.values, y_train.values)
        y_prob = stack.predict_proba(X_val.values)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)

        metrics["accuracy"].append(accuracy_score(y_val, y_pred))
        metrics["brier"].append(brier_score_loss(y_val, y_prob))
        metrics["roc_auc"].append(roc_auc_score(y_val, y_prob))

    # Modèle final
    stack.fit(X.values, y.values)

    # Calibration Platt
    calibrated = CalibratedClassifierCV(stack, method="sigmoid", cv=3)
    calibrated.fit(X.values, y.values)

    summary = {
        "accuracy_mean": np.mean(metrics["accuracy"]),
        "brier_mean": np.mean(metrics["brier"]),
        "roc_auc_mean": np.mean(metrics["roc_auc"]),
        "n_features": X.shape[1],
        "n_train_samples": X.shape[0],
        "n_fights_total": len(df_fights),
    }
    return calibrated, summary
```

---

---

# 6. Leviers d'Amélioration 63% → 68%+

## 6.1 État des Lieux — Où en Sommes-Nous ?

Le stacked ensemble de base (Phase 1) devrait atteindre ~63-64% d'accuracy avec un Brier ~0.215.  
Pour atteindre 68%+, les leviers suivants sont identifiés, classés par impact estimé :

| Levier | Gain estimé | Effort | Complexité | Priorité |
|--------|-------------|--------|------------|----------|
| 1. Cotes d'ouverture en feature | +3-4% | Faible | Faible | 🔴 P0 |
| 2. Data augmentation (bootstrap) | +1-2% | Moyen | Faible | 🟡 P1 |
| 3. Glicko-2 rating dynamique | +1-2% | Moyen | Moyenne | 🟡 P1 |
| 4. Short-notice features | +1% | Faible | Faible | 🟡 P1 |
| 5. Calibration adaptative (tranches) | +1% | Moyen | Faible | 🟢 P2 |
| 6. Blending avec cotes fermeture (value) | +2-3% | Faible | Moyenne | 🟢 P2 |
| 7. Features avancées (fraude) | +0.5% | Élevé | Élevée | 🔵 P3 |
| 8. Modèle hiérarchique (poids) | +1% | Élevé | Élevée | 🔵 P3 |

**Gain total estimé : 10.5-16% → 68-70% théorique**

## 6.2 Levier 1 : Cotes d'Ouverture en Feature (P0)

**Problème :** Les bookmakers ont une expertise humaine que le modèle n'a pas.  
**Solution :** Ajouter `opening_odds_implied_prob_a` et `opening_odds_implied_prob_b` comme features d'entrée.

```python
# Validation croisée : ne PAS leak les cotes de fermeture
# Les cotes d'ouverture sont disponibles AVANT le combat
features["opening_odds_implied_prob_a"] = 1.0 / opening_odds_decimal_a
```

**Gain :** +3-4% sur l'accuracy, +0.015 sur le Brier (confirmé par Petersen 2024).  
**Risque :** Si les cotes d'ouverture sont indisponibles (petits events), imputer par la proba moyenne de la catégorie.

## 6.3 Levier 2 : Data Augmentation par Bootstrap (P1)

**Problème :** Peu de combats par combattant (médiane = 8 en UFC).  
**Solution :** Bootstrap replique des combats existants avec perturbation gaussienne des features continues.

```python
def augment_fight(fight_row: pd.Series, noise_scale: float = 0.02) -> pd.Series:
    """Crée une copie bruitée d'un combat existant."""
    augmented = fight_row.copy()
    for col in CONTINUOUS_FEATURES:
        noise = np.random.normal(0, noise_scale * abs(augmented[col] or 1))
        augmented[col] += noise
    return augmented

# Usage : pour chaque combat, créer 2-3 repliques avec noise
# Attention : ne PAS augmenter les données de test
```

**Gain :** +1-2% sur les classes minoritaires (finishers, submission artists).  
**Condition :** La perturbation doit être assez faible pour ne pas changer la nature du combat.

## 6.4 Levier 3 : Glicko-2 Rating Dynamique (P1)

**Problème :** Le True Talent Rating est statique (basé sur toute la carrière).  
**Solution :** Remplacer par Glicko-2, qui s'adapte en temps réel à chaque nouveau combat et quantifie l'incertitude (RD).

```python
class Glicko2Rating:
    def __init__(self, rating: float = 1500, rd: float = 350, vol: float = 0.06):
        self.rating = rating
        self.rd = rd        # Rating Deviation (incertitude)
        self.vol = vol      # Volatilité
```

**Gain :** +1-2%. Le RD (Rating Deviation) est une feature puissante : un RD élevé = combattant imprévisible.  
**Avantage collateral :** Excellent pour détecter les revenants après longue absence (RD augmente mécaniquement).

## 6.5 Levier 4 : Short-Notice Features (P1)

**Problème :** ~15% des combats UFC sont des remplacements court préavis. Le combattant remplaçant a souvent une préparation incomplète.  
**Solution :** Features binaires + contextuelles :

```python
features["is_short_notice"] = days_before_fight < 14
features["is_replacement"] = opponent_changed_after_fight_announcement
features["weight_cut_severity"] = ... # basé sur poids hors saison connu
features["camp_change_recent"] = camp_id != previous_camp_id
```

**Gain :** +1%. Les bookmakers sous-estiment systématiquement l'impact du short notice.

## 6.6 Levier 5 : Calibration Adaptative par Tranche (P2)

**Problème :** Le Platt Scaling global peut sous-calibrer dans les zones extrêmes.  
**Solution :** Calibration par tranche de probabilité avec lissage spline :

```
Tranche 0-20%   : calibration séparée (sous-estimé)
Tranche 20-40%  : calibration séparée
Tranche 40-60%  : inchangé (Platt global)
Tranche 60-80%  : calibration séparée
Tranche 80-100% : calibration séparée (surestimé)
```

**Gain :** +1% sur le Brier global. Particulièrement utile pour les probabilités extrêmes (>80%) où le modèle a tendance à être trop confiant.

## 6.7 Levier 6 : Blending avec Cotes de Fermeture (P2)

**Problème :** Les cotes de fermeture intègrent toute l'information publique jusqu'au combat.  
**Solution :** Blending simple après prédiction pour la détection de value :

```python
# PAS dans le modèle — uniquement pour la détection de value
blended_prob = 0.7 * model_prob + 0.3 * closing_implied_prob

# Comparer blended_prob vs opening_odds → détection value plus stable
```

**⚠️ Attention :** Ne JAMAIS mettre les cotes de fermeture dans les features d'entraînement.  
**Gain :** +2-3% sur le ROI (pas sur l'accuracy).

## 6.8 Levier 7 : Features Avancées — Drapeaux Rouges (P3)

```python
# Drapeaux de "fraude" / anomalie
features["weight_miss_history"] = ...     # combien de fois a manqué le poids
features["injury_rumor_score"] = ...       # NLP sur les news pré-fight
features["social_media_sentiment"] = ...   # changement d'attitude pré-fight
features["coach_change_timing"] = ...      # changement d'entraîneur proche du fight
features["weight_cut_yo_yo"] = ...         # poids hors saison très différent
```

**Gain :** ~+0.5-1%. Données difficiles à obtenir (NLP, scrapping réseaux sociaux).

## 6.9 Levier 8 : Modèle Hiérarchique par Poids (P3)

**Problème :** Le meta-model global peut être biaisé par les différences de dynamique entre catégories.  
**Solution :** Modèle hiérarchique où chaque catégorie de poids a ses propres paramètres, reliés par un prior global :

```
Level 0 : paramètres globaux (tous poids)
Level 1 : paramètres par catégorie (heavyweight, lightweight, ...)
Level 2 : paramètres par combattant (True Talent)
```

**Gain :** +1% potentiel. Complexité élevée (PyMC / Stan). À réserver après Phase 2.

---

## 6.10 Roadmap d'Amélioration

```
Phase 1 (MVP) : RF + XGB + TT stacking + Platt     → 63-64%
       ↓
Phase 1.1 : + Cotes ouverture feature (P0)         → 66-67%
       ↓
Phase 1.2 : + Data augmentation + Glicko-2 (P1)    → 67-68%
       ↓
Phase 2 : + Short notice + Calibration (P1/P2)     → 68-69%
       ↓
Phase 3 : + Blending fermeture + Hiérarchique (P2/P3) → 69-70%
```

**Cible finale réaliste : 68-70%** (selon Petersen 2024, c'est le plafond max atteignable avec des données publiques).

---

---

# 7. Extensions Charte Graphique

## 7.1 Principes — Extension MMA

La charte existante (`tokens.css` + `RAPPORT_DESIGN_FINAL.md`) reste inchangée pour le tennis.  
L'extension MMA ajoute des **tokens spécifiques** et des **composants dédiés** sans casser le design system existant.

**Philosophie :**
- Même dark theme (`#0b0e17`), mêmes polices (Poppins / Inter)
- Palette MMA : tons plus chauds et agressifs que le tennis
- Accents distinctifs pour les styles de combat (Striking rouge, Grappling violet)
- Badges de catégorie de poids avec code couleur progressif

## 7.2 Nouveaux Tokens CSS — MMA-Specific

```css
/* ── tokens.css — EXTENSIONS MMA ── */

/* === Palette MMA === */
--color-mma-bg-card:         #131622;       /* légèrement plus clair que le bg principal */
--color-mma-border:          #1e2235;       /* border des cartes UFC */
--color-mma-gold:            #fbbf24;       /* titre, champion, main event */
--color-mma-octagon:         #d32f2f;       /* rouge octogone */

/* === Badges de style === */
--color-mma-badge-striking:  #ef4444;       /* rouge striking */
--color-mma-badge-striking-bg: rgba(239, 68, 68, 0.15);
--color-mma-badge-grappling: #8b5cf6;       /* violet grappling */
--color-mma-badge-grappling-bg: rgba(139, 92, 246, 0.15);
--color-mma-badge-allrounder: #22c55e;      /* vert all-rounder */

/* === Badges de catégorie (dégradé du plus léger au plus lourd) === */
--color-mma-peso-strawweight:   #a8e6cf;    /* 52kg */
--color-mma-peso-flyweight:     #80cbc4;    /* 57kg */
--color-mma-peso-bantamweight:  #4db6ac;    /* 61kg */
--color-mma-peso-featherweight: #26a69a;    /* 66kg */
--color-mma-peso-lightweight:   #00897b;    /* 70kg */
--color-mma-peso-welterweight:  #f57c00;    /* 77kg */
--color-mma-peso-middleweight:  #e65100;    /* 84kg */
--color-mma-peso-light-heavy:   #bf360c;    /* 93kg */
--color-mma-peso-heavyweight:   #b71c1c;    /* 120kg */

/* === Alertes value betting === */
--color-mma-value-high:       #22c55e;       /* value > 1.30 */
--color-mma-value-medium:     #eab308;       /* value 1.15-1.30 */
--color-mma-value-low:        #ef4444;       /* value < 1.15 */

/* === Méthode de victoire (diagrammes) === */
--color-mma-method-ko:        #ef4444;
--color-mma-method-sub:       #8b5cf6;
--color-mma-method-dec:       #3b82f6;

/* === Prédiction === */
--color-mma-prob-bar:         linear-gradient(90deg, #d32f2f, #fbbf24, #22c55e);
--color-mma-confidence-high:  #22c55e;
--color-mma-confidence-med:   #eab308;
--color-mma-confidence-low:   #ef4444;

/* === Fighter === */
--color-mma-fighter-a:        #d32f2f;       /* corner rouge */
--color-mma-fighter-b:        #2563eb;       /* corner bleu */
```

## 7.3 Composants Stylisés — Tableau de Correspondance

| Composant UFC | Tokens Utilisés | Éléments Graphiques |
|---------------|----------------|---------------------|
| `FightCard` | `--color-mma-bg-card`, `--color-mma-border`, `--color-mma-gold` | Octogone stylisé en filigrane |
| `StanceBadge` | Garde : `--color-mma-badge-striking` (striker) / `--color-mma-badge-grappling` (grappler) | Icône `Fist` avec rotation |
| `WeightClassBadge` | `--color-mma-peso-*` selon catégorie | Icône `Weight` |
| `MethodDistribution` | `--color-mma-method-*` pour chaque barre | Barres horizontales recharts |
| `RecordBadge` | Win streak vert, Loss streak rouge | `TrendingUp` / `TrendingDown` |
| `ValueAlertBanner` | `--color-mma-value-*` selon ratio | Icône `Zap` + flèche |
| `PredictionBar` | `--color-mma-prob-bar` gradient | Barre de progression animée |
| `OctagonCanvas` | `--color-mma-octagon` | SVG octogone 8 côtés en fond |

## 7.4 Principes de Design — MMA vs Tennis

| Principe | Tennis | MMA |
|----------|--------|-----|
| Palette | Froide (bleus/verts) | Chaude (rouges/oranges) |
| Typographie | Poppins (léger, élégant) | Poppins bold (agressif, impact) |
| Layout | 1 joueur central | 2 fighters face à face |
| Badges | Surface (terre/herbe/dur) | Style (striker/grappler/...) |
| Animation | Douce, transitions fluides | Sharp, flash, impact |
| Données clés | ATP points, surface | Record, finish rate, reach |

## 7.5 Exemple — Carte MMA Stylisée

```html
<!-- Structure CSS de base pour une FightCard -->
<div class="fight-card" style="background: var(--color-mma-bg-card); border: 1px solid var(--color-mma-border); border-radius: 12px;">
  <div class="fight-card__header">
    <span class="weight-class-badge" style="background: var(--color-mma-peso-lightweight);">Lightweight</span>
    <span class="fight-type" style="color: var(--color-mma-gold);">⭐ Main Event · 5 Rounds</span>
  </div>
  <div class="fight-card__matchup">
    <!-- Fighter A — corner rouge -->
    <div class="fighter fighter--red">
      <div class="fighter__avatar" style="border-color: var(--color-mma-fighter-a);"></div>
      <div class="fighter__name">Islam Makhachev</div>
      <div class="fighter__record">26-1-0</div>
      <div class="fighter__badge" style="background: var(--color-mma-badge-grappling);">Grappler</div>
    </div>
    <div class="vs-badge">VS</div>
    <!-- Fighter B — corner bleu -->
    <div class="fighter fighter--blue">
      <div class="fighter__avatar" style="border-color: var(--color-mma-fighter-b);"></div>
      <div class="fighter__name">Arman Tsarukyan</div>
      <div class="fighter__record">22-3-0</div>
      <div class="fighter__badge" style="background: var(--color-mma-badge-striking);">Striker</div>
    </div>
  </div>
  <!-- Barre de probabilité -->
  <div class="prediction-bar" style="background: var(--color-mma-prob-bar);">
    <div class="prediction-bar__a" style="width: 68%;">68%</div>
    <div class="prediction-bar__b" style="width: 32%;">32%</div>
  </div>
</div>
```

---

# 8. Plan d'Exécution

## 8.1 Phasage Recommandé

```
Semaine 1-2   │ Phase 0 : Infrastructure
              │  - Création des schémas Pydantic UFC (src/schema/ufc.py)
              │  - Création du ModelRegistry (src/models/registry.py)
              │  - Structure scraper UFC (src/scrapers/ufc_stats.py)
              │  - Test unitaires des schémas

Semaine 3-4   │ Phase 1 : Pipeline Features
              │  - EWMA Calculator (src/features/ufc_pipeline.py)
              │  - True Talent Estimator bayésien
              │  - Context Calculator (short-notice, camp, weight cut)
              │  - Tests de non-régression tennis
              │  - Validation point-in-time

Semaine 5-6   │ Phase 2 : Modèle ML
              │  - Stacked Ensemble (RF + XGB + TT)
              │  - Platt Scaling UFC
              │  - TimeSeriesSplit validation
              │  - Métriques : Brier ≤ 0.215, AUC ≥ 0.70
              │  - Sauvegarde modèle + metadata

Semaine 7-8   │ Phase 3 : Backend API
              │  - Route /predict/ufc
              │  - Route /features/ufc
              │  - Intégration ModelRegistry
              │  - Cache Redis (features pré-calculées)
              │  - Tests d'intégration API

Semaine 9-10  │ Phase 4 : Frontend
              │  - Types TypeScript UFC
              │  - Composants atomiques (StanceBadge, WeightClassBadge, etc.)
              │  - FightCard + MMAPreMatch page
              │  - Routing /mma
              │  - ValueAlertBanner
              │  - Tests composants (Storybook)

Semaine 11    │ Phase 5 : Value Betting
              │  - Value detection engine
              │  - Kelly Criterion calculator
              │  - Simulation de stratégie
              │  - Dashboard de suivi ROI

Semaine 12    │ Phase 6 : Améliorations
              │  - Cotes ouverture feature (P0)
              │  - Data augmentation (P1)
              │  - Glicko-2 rating (P1)
              │  - Short-notice features (P1)
```

## 8.2 Dépendances entre Phases

```
Phase 0 (Infra)
   │
   ▼
Phase 1 (Features) ────┐
   │                    │
   ▼                    ▼
Phase 2 (Modèle)    Phase 4 (Frontend) ──── Phase 6 (Améliorations)
   │
   ▼
Phase 3 (Backend)
   │
   ▼
Phase 5 (Value Betting)
```

## 8.3 Métriques de Succès par Phase

| Phase | Critère de Succès | Mesure |
|-------|-------------------|--------|
| 0 | Schémas validés | Tests Pydantic passent |
| 1 | Features reproduisibles | Point-in-time OK, pas de leakage |
| 2 | Accuracy ≥ 63% | Brier ≤ 0.215, AUC ≥ 0.70 |
| 3 | API répond < 200ms | k6 benchmark |
| 4 | UI fonctionnelle | Tests Playwright passent |
| 5 | ROI simulé > 10% | Backtest 3 ans de données |
| 6 | Accuracy ≥ 66% | Brier ≤ 0.205 |

## 8.4 Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Rétraction API UFCStats | Faible | Élevé | Multi-sources (Tapology, BestFightOdds) |
| Combattants inconnus au modèle | Moyen | Moyen | True Talent bayésien avec prior fort |
| Dérive du modèle post-entraînement | Moyen | Élevé | Calibration hebdo + monitoring Brier |
| Performance frontend mobile | Faible | Moyen | Cache Redis, features pré-calculées |
| Contamination tennis/UFC | Faible | Élevé | Registry isolé, tests de non-régression |
| Coût scraping (cron quotidien) | Faible | Faible | Données UFC = ~50 combats/semaine, volumétrie faible |

---

> **Document rédigé le 20 Juin 2026**  
> Sur la base de : `RAPPORT_PREDICTION_UFC_MMA.md` (recherche), `RAPPORT_DESIGN_FINAL.md` (charte graphique), analyse de la codebase Pariscorebis existante.  
> Prochaine étape : Phase 0 — Création des schémas Pydantic UFC et du ModelRegistry.

