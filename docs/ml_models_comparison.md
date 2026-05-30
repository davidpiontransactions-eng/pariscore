# Modèles ML Gradient Boosting — XGBoost vs LightGBM

> **Document R&D / Architecture** — PariScore
> Auteur : CTO & Lead Data Scientist (Quant)
> Date : 2026-05-30
> Statut : Documentation technique + stratégie d'intégration backend

---

## 0. Contexte PariScore — l'existant ML

> **Important** : PariScore exécute **déjà** un pipeline ML en production. Toute extension XGBoost / LightGBM doit réutiliser ce harnais, pas le dupliquer.

| Composant existant | Locus | Rôle |
|---|---|---|
| `ml/infer_catboost.py` | `ml/` | Inférence batch CatBoost (1X2 + Over2.5 + BTTS) |
| `ml/train_catboost.py` | `ml/` | Entraînement + sérialisation `.cbm` |
| `models/catboost_football_*.cbm` | `models/` | 3 modèles sérialisés |
| `_runCatBoostBatchInference()` | `server.js:4400` | Spawn subprocess Python + timeout 30s + fallback Poisson |
| `_refreshCatBoostCache()` | `server.js:4460` | Blend CatBoost 60% / Poisson 40% → `m.blended_cb` |
| `.venv-data/` | racine | Venv Python isolé (`CATBOOST_PYTHON_BIN`) |

**Pattern d'intégration retenu (et prouvé)** : sidecar Python via `child_process.spawn`, IPC JSON sur stdin/stdout, modèles chargés une fois par batch, fallback automatique sur les modèles mathématiques natifs (Poisson foot / Elo+DR tennis) si le subprocess échoue ou dépasse le timeout.

Les sections 1-4 documentent XGBoost et LightGBM. Les sections 5-7 montrent comment les brancher dans **le harnais existant**.

---

## 1. XGBoost (Extreme Gradient Boosting)

### 1.1 Principes de base

XGBoost est une implémentation optimisée du **gradient boosting** : ensemble d'arbres de décision construits séquentiellement, chaque nouvel arbre corrigeant l'erreur résiduelle (gradient de la loss) des arbres précédents.

Caractéristiques fondamentales :

- **Croissance par niveau (level-wise / depth-wise)** : l'arbre grandit symétriquement, tous les nœuds d'un même niveau sont développés avant de descendre. Plus conservateur, moins sujet au surapprentissage par défaut.
- **Régularisation native** : termes L1 (`alpha`) + L2 (`lambda`) sur les poids des feuilles. C'est le « regularized boosting » du nom — différenciateur historique vs les GBM classiques.
- **`tree_method=hist`** : binning des features en histogrammes → entraînement quasi aussi rapide que LightGBM sur datasets modérés.
- **Gestion native des valeurs manquantes** : direction par défaut apprise par split (crucial pour nous — `poisson` peut être `NaN`).

### 1.2 API d'inférence (réf. context7 `/dmlc/xgboost`)

```python
from xgboost import XGBClassifier

# Entraînement
clf = XGBClassifier(
    objective="multi:softprob",   # 1X2 → 3 classes ; "binary:logistic" pour Over2.5/BTTS
    n_estimators=400,
    max_depth=5,
    learning_rate=0.05,
    tree_method="hist",
    reg_lambda=1.0,
    reg_alpha=0.0,
)
clf.fit(X_train, y_train)

# Probabilités décimales (ce que PariScore consomme)
proba = clf.predict_proba(X)        # (n, 3) pour 1X2

# Persistance — format UBJSON recommandé (compact, cross-version)
clf.save_model("models/xgb_football_1x2_v1.ubj")

# Rechargement
clf2 = XGBClassifier()
clf2.load_model("models/xgb_football_1x2_v1.ubj")
```

### 1.3 Cas d'usage idéaux dans les paris sportifs

- **Probabilités d'avant-match (pré-live)** : XGBoost excelle sur les features tabulaires statiques (Elo, forme L5/L10, xG saison, classements home/away). Sa robustesse au surapprentissage en fait le choix sûr pour un modèle dont les prédictions sont publiées et pariées.
- **Meta-learner / stacking** : prend en entrée les sorties Poisson + Elo + cotes no-vig et apprend la pondération optimale. Exactement le rôle actuel de CatBoost chez nous.
- **Datasets de taille modérée** (10k–500k matchs historiques) : sweet spot.

---

## 2. LightGBM (Light Gradient Boosting Machine)

### 2.1 Principes de fonctionnement

LightGBM (Microsoft) est un framework de gradient boosting optimisé pour la **vitesse** et la **faible empreinte mémoire**.

Innovations clés :

- **Croissance par feuille (leaf-wise / best-first)** : au lieu de développer un niveau entier, LightGBM développe **la feuille au gain de loss maximal**, où qu'elle soit dans l'arbre. Convergence beaucoup plus rapide à nombre d'arbres égal.
  > ⚠️ **Contrepartie** (réf. context7) : *« the leaf-wise growth may be over-fitting if not used with the appropriate parameters »*. L'arbre devient profond et asymétrique → risque de surapprentissage élevé sur petits datasets si non bridé.
- **GOSS (Gradient-based One-Side Sampling)** : sous-échantillonne les exemples à faible gradient (déjà bien prédits) → moins de données traitées sans perte de précision.
- **EFB (Exclusive Feature Bundling)** : fusionne les features sparse mutuellement exclusives → réduit la dimensionnalité effective.
- **Histogrammes** : binning des valeurs continues (défaut 255 bins).

### 2.2 Paramètres critiques (réf. context7 — Parameters Tuning)

| Paramètre | Défaut | Rôle | Recommandation PariScore |
|---|---|---|---|
| `num_leaves` | 31 | Complexité de l'arbre (knob principal) | `< 2^max_depth`. Ex. `max_depth=7` → tester 50-80, **jamais 127** |
| `min_data_in_leaf` | 20 | **Anti-overfitting #1** | Centaines à milliers sur gros dataset ; ≥ 50 sur nos volumes modérés |
| `max_depth` | -1 (illimité) | Borne explicite de profondeur | Fixer 6-8 pour brider le leaf-wise |
| `learning_rate` | 0.1 | Pas d'apprentissage | 0.03-0.05 + early stopping |

### 2.3 API d'inférence (réf. context7 `lightgbm_readthedocs`)

```python
from lightgbm import LGBMClassifier

clf = LGBMClassifier(
    objective="multiclass", num_class=3,   # 1X2
    n_estimators=600,
    num_leaves=63,
    min_data_in_leaf=80,
    max_depth=7,
    learning_rate=0.04,
)
clf.fit(X_train, y_train)

proba = clf.predict_proba(X)        # (n, 3)
clf.booster_.save_model("models/lgbm_football_1x2_v1.txt")
```

### 2.4 Cas d'usage idéaux

- **Traitement ultra-rapide des flux en direct (live)** : inférence sur des milliers de matchs/secondes. Idéal pour recalculer `proba_live` à chaque tick SSE (60s) sans bloquer le thread Node.
- **Très grands datasets** (millions de lignes point-par-point tennis, événements live foot) : la consommation RAM réduite et GOSS permettent d'entraîner là où XGBoost saturerait.
- **Itération R&D rapide** : entraînement le plus court → plus de cycles backtest/jour.

---

## 3. Tableau comparatif synthétique

| Critère | XGBoost | LightGBM | CatBoost *(en prod)* |
|---|---|---|---|
| **Croissance des arbres** | Par niveau (depth-wise) | Par feuille (leaf-wise) | Symétrique (oblivious) |
| **Vitesse d'entraînement** | 🟠 Bonne (`hist`) | 🟢 Excellente (la + rapide) | 🟠 Moyenne |
| **Vitesse d'inférence** | 🟢 Très rapide | 🟢 Très rapide | 🟢 Rapide (arbres symétriques) |
| **Précision (tabulaire)** | 🟢 Excellente | 🟢 Excellente | 🟢 Excellente |
| **Grands datasets** | 🟠 Bon | 🟢 Excellent (GOSS+EFB) | 🟠 Bon |
| **Utilisation RAM** | 🔴 Élevée | 🟢 Faible | 🟠 Moyenne |
| **Risque d'overfitting (défaut)** | 🟢 Faible (régularisé, depth-wise) | 🔴 Élevé si non bridé (leaf-wise) | 🟢 Faible (ordered boosting) |
| **Features catégorielles brutes** | 🔴 Encodage requis | 🟠 Support partiel (`categorical_feature`) | 🟢 Natif (raison du choix actuel) |
| **Valeurs manquantes (`NaN`)** | 🟢 Natif | 🟢 Natif | 🟢 Natif |
| **Maturité / écosystème** | 🟢 Référence historique | 🟢 Mature | 🟠 Plus jeune |
| **Taille modèle sérialisé** | 🟠 Moyenne | 🟢 Compacte (`.txt`) | 🟠 Moyenne |

> **Note clé** : CatBoost a été retenu initialement pour son **support natif des features catégorielles** (`home_team`, `away_team`, `league` sans encodage — cf. `infer_catboost.py:36`). XGBoost et LightGBM exigent un encodage explicite (target/ordinal encoding) de ces colonnes. C'est le principal coût d'intégration.

---

## 4. Avantages & Inconvénients par sport

### 4.1 Football (pré-match — modèle statique)

**XGBoost — RECOMMANDÉ pour le pré-match**

| ✅ Forces | ❌ Faiblesses |
|---|---|
| Robustesse au surapprentissage → prédictions publiées fiables | Encodage des équipes/ligues requis (vs CatBoost natif) |
| Régularisation L1/L2 → calibration stable des probas | RAM plus élevée à l'entraînement |
| Excellent comme meta-learner sur Poisson + Elo + cotes | Entraînement un peu plus lent que LightGBM |
| Gestion native des `NaN` (Poisson absent) | |

**LightGBM**

| ✅ Forces | ❌ Faiblesses |
|---|---|
| Entraînement le + rapide → backtests massifs (saisons multiples) | Overfitting si `num_leaves`/`min_data_in_leaf` mal réglés |
| RAM faible | Calibration des probas plus sensible au tuning |

### 4.2 Tennis (live — modèle dynamique point-par-point)

**LightGBM — RECOMMANDÉ pour le live**

| ✅ Forces | ❌ Faiblesses |
|---|---|
| Inférence ultra-rapide → recalcul `proba_live` à chaque tick | Tuning anti-overfitting impératif sur features bruitées (DR, momentum) |
| Gère les gros volumes point-par-point (Dominance Ratio, breaks) | |
| Faible latence compatible avec le polling 60s + SSE | |

**XGBoost**

| ✅ Forces | ❌ Faiblesses |
|---|---|
| Très robuste sur features Elo pré-match tennis | Surdimensionné pour du live haute fréquence |
| Bon fallback de calibration | Légèrement plus lourd en RAM |

### 4.3 Synthèse de la stratégie modèle

```
Football pré-match   → XGBoost   (robustesse, meta-learner)
Tennis pré-match     → XGBoost   (features Elo statiques)
Live (foot + tennis) → LightGBM  (latence, volume, RAM)
Catégoriel lourd     → CatBoost  (déjà en prod, garder)
```

Les trois familles **coexistent** dans le même harnais sidecar. Le choix par contexte se fait via le paramètre `engine` du service d'inférence (cf. §6).

---

## 5. Architecture d'intégration — Option A vs Option B

Le backend PariScore est **Node.js zéro-dépendance** (`server.js`). XGBoost/LightGBM/CatBoost sont natifs Python. Il faut un pont Node ↔ Python.

### Option A — Microservice d'inférence Python (Flask / FastAPI)

```
server.js  ──HTTP localhost:8001──▶  uvicorn/FastAPI (process PM2 séparé)
                                       └─ modèles chargés en RAM en permanence
```

| ✅ | ❌ |
|---|---|
| Modèles chargés une seule fois (pas de cold start par requête) | **2e process à superviser** sous PM2 (point de défaillance) |
| Latence inférence minimale (modèle déjà chaud) | Surface réseau locale à sécuriser (bind `127.0.0.1` strict) |
| Scalable horizontalement | Ajoute Flask/FastAPI + uvicorn = dépendances Python lourdes |
| | Gestion santé/restart/ordering au boot plus complexe |

### Option B — Subprocess Node.js (`child_process.spawn`) — **EN PRODUCTION**

```
server.js  ──spawn + stdin JSON──▶  python infer_*.py (process éphémère)
           ◀──stdout JSON──────────  └─ charge modèles, prédit batch, exit
```

| ✅ | ❌ |
|---|---|
| **Zéro process permanent** — rien à superviser en plus sous PM2 | Cold start : chargement modèles à chaque batch (~0.5-2s) |
| Isolation totale : un crash Python ne tue jamais Node | Inadapté à une inférence par-requête haute fréquence |
| Pas de port réseau ouvert (zéro surface d'attaque) | |
| Fallback trivial : exit≠0 ou timeout → modèle math natif | |
| **Déjà implémenté, testé, déployé** (CatBoost) | |

### 5.1 Recommandation : **Option B**

**Justification résilience VPS / PM2** :

1. **Mono-process supervisé** : PM2 ne gère que `pariscore`. Pas de race au boot, pas de second service à redémarrer, pas de healthcheck inter-process. Sur un VPS OVH mutualisé, c'est décisif.
2. **Isolation des pannes** : un segfault dans une lib C++ de boosting reste confiné au subprocess. Node récupère `code≠0` et bascule sur Poisson/Elo. L'interface n'est **jamais** vide.
3. **Surface d'attaque nulle** : aucun port d'inférence exposé (vs FastAPI qu'il faut binder `127.0.0.1` + firewall).
4. **Cadence compatible** : nos inférences sont **batch** (cron foot toutes les 12h, refresh cache, polling live 60s) — pas par-requête-utilisateur. Le cold start de 0.5-2s est amorti sur tout le batch. Option A ne se justifierait qu'en inférence temps réel sub-seconde par requête, ce qui n'est pas notre cas.
5. **Continuité** : CatBoost prouve déjà le pattern. Ajouter XGBoost/LightGBM = nouveaux scripts `ml/infer_*.py` + modèles `models/*` dans **le même moule**.

> **Bascule future vers Option A** : seulement si l'inférence devient un goulot temps réel (ex. < 100 ms par requête utilisateur). Le service `mlInferenceService.js` (§6) abstrait le transport — migrer vers HTTP n'impacterait que ce module.

---

## 6. Pipeline d'inférence — `services/mlInferenceService.js`

Le module `services/mlInferenceService.js` **généralise** le pattern inline `_runCatBoostBatchInference()` en un service réutilisable multi-moteur (`catboost` | `xgboost` | `lightgbm`), avec fallback strict.

Contrat IPC (identique à `infer_catboost.py`, donc compatible) :

```
stdin  : { "features": [ {id, home_team, away_team, league, commence_time, poisson, fair, ...} ], "sport": "football" }
stdout : { "predictions": { "<matchId>": { home, draw, away, over25, btts } } }
exit≠0 ou timeout ou stdout invalide → Node fallback modèle math natif
```

Voir le fichier livré pour l'implémentation complète. Points clés :

- `ML_ENGINES` : registre moteur → `{ inferScript, modelSentinel, enabledEnv }`.
- `runInference({ engine, sport, matches, timeoutMs })` : spawn générique, timeout, parse du dernier objet JSON de stdout, retourne `{}` sur toute erreur.
- `predictWithFallback(matches, opts, fallbackFn)` : try/catch strict — si ML vide/échec → exécute `fallbackFn` (Poisson foot / Elo+DR tennis). **L'UI n'est jamais vide.**
- `mapProbasToMarket(pred, sport)` : convertit les probas décimales du modèle en variables métier (`proba_live`, `odds_player1`, `odds_player2`).

### 6.1 Scripts Python à créer (réplication du moule CatBoost)

```
ml/infer_xgboost.py     # mirror infer_catboost.py, charge models/xgb_*.ubj
ml/train_xgboost.py     # mirror train_catboost.py
ml/infer_lightgbm.py    # mirror infer_catboost.py, charge models/lgbm_*.txt
ml/train_lightgbm.py
ml/requirements-xgboost.txt    # xgboost>=2.0, numpy, scikit-learn
ml/requirements-lightgbm.txt   # lightgbm>=4.0, numpy, scikit-learn
```

> **Critique** : le `FEATURE_NAMES` de chaque `infer_*.py` doit matcher **exactement** son `train_*.py` (cf. `infer_catboost.py:27`). Tout désalignement = prédictions silencieusement fausses. Pour XGBoost/LightGBM, ajouter une étape d'encodage des colonnes catégorielles (`league`, `home_team`, `away_team`) absente du flux CatBoost.

---

## 7. Arborescence cible (respecte l'existant)

```
ParisScorebis/
├── server.js                       # require('./services/mlInferenceService')
├── services/
│   └── mlInferenceService.js       # ← NOUVEAU — service multi-moteur + fallback
├── ml/
│   ├── infer_catboost.py           # existant
│   ├── train_catboost.py           # existant
│   ├── requirements-catboost.txt   # existant
│   ├── infer_xgboost.py            # ← à créer (moule CatBoost)
│   ├── train_xgboost.py            # ← à créer
│   ├── infer_lightgbm.py           # ← à créer
│   ├── train_lightgbm.py           # ← à créer
│   ├── requirements-xgboost.txt    # ← à créer
│   └── requirements-lightgbm.txt   # ← à créer
├── models/
│   ├── catboost_football_*.cbm     # existant (3)
│   ├── xgb_football_1x2_v1.ubj     # ← généré par train_xgboost.py
│   └── lgbm_football_1x2_v1.txt    # ← généré par train_lightgbm.py
└── .venv-data/                     # venv Python partagé (CATBOOST_PYTHON_BIN)
```

### 7.1 Variables d'environnement

```bash
CATBOOST_ENABLED=true              # existant
XGBOOST_ENABLED=false              # activer après train + validation backtest
LIGHTGBM_ENABLED=false             # idem
CATBOOST_PYTHON_BIN=.venv-data/Scripts/python.exe   # Windows / python3 sur VPS
```

---

## 8. Roadmap d'intégration

| Phase | Tâche | Effort | Bloqueur |
|---|---|---|---|
| 1 | `services/mlInferenceService.js` (livré, generic) | ✅ | — |
| 2 | `ml/train_xgboost.py` + encodage catégoriel + `.ubj` | 1j | dataset historique étiqueté |
| 3 | `ml/infer_xgboost.py` (moule CatBoost) | 0.5j | Phase 2 |
| 4 | Backtest Brier/logloss XGB vs CatBoost vs Poisson | 1j | Phases 2-3 |
| 5 | `ml/*_lightgbm.py` pour le live (tennis DR + foot pressure) | 1.5j | features live étiquetées |
| 6 | Wire `predictWithFallback` dans `buildMatchRecord` + cron | 0.5j | Phases 3/5 |
| 7 | A/B calibration en prod (reliability diagram) | continu | déploiement |

**Critère de mise en prod (rigueur Quant)** : aucun modèle activé (`*_ENABLED=true`) sans Brier score + reliability diagram sur ≥ 500 matchs backtest, et borne inférieure IC du gain de calibration > 0 vs baseline Poisson.

---

*Document maintenu par le pôle Data Science PariScore. Sources techniques : context7 `/dmlc/xgboost`, `/websites/lightgbm_readthedocs_io_en_stable`. Pattern d'intégration dérivé de l'implémentation CatBoost en production (`ml/infer_catboost.py`, `server.js:4400`).*
