# Agent D — Prototype RF & Calibration des Probabilités

**Date** : 2026-06-26
**Contexte** : Audit des rapports de prédiction cyclisme PariScore
**Objectifs** :
1. Implémenter un prototype Random Forest minimal sur données publiques
2. Ajouter une section complète sur la calibration des probabilités

---

## Tâche 1 : Prototype RF minimal sur données publiques

### 1.1 Architecture du prototype

| Composant | Choix | Justification |
|---|---|---|
| Langage | Python 3.11+ | Écosystème data science mature |
| Modèle | Random Forest (scikit-learn) | Robuste, interprétable, peu d'hyperparamètres à tuner |
| Target | Top-10 binaire (1 si classé 1-10) | Événement plus fréquent que podium → mieux pour l'apprentissage |
| Split temporel | TimeSeriesSplit | Pas de shuffle — le futur ne doit pas fuiter dans le passé |

**Features (15 dimensions)** :

| Feature | Type | Description |
|---|---|---|
| `age` | continu | Âge du coureur le jour de la course |
| `uci_points_ytd` | continu | Points UCI cumulés dans la saison en cours AVANT la course |
| `uci_points_career` | continu | Points UCI totaux de la carrière |
| `days_since_last_race` | continu | Nombre de jours depuis la dernière course du coureur |
| `top10_same_race_prev` | binaire | Top-10 à cette même course l'année précédente |
| `top10_same_race_career` | continu | Nombre de top-10 sur cette course dans la carrière |
| `grand_tour` | binaire | 1 si Grand Tour, 0 si classique |
| `race_distance_km` | continu | Distance totale de la course |
| `elevation_gain_m` | continu | Dénivelé positif total |
| `flat_terrain_pct` | continu | % de plat (0-100) |
| `mountain_terrain_pct` | continu | % de montagne (0-100) |
| `team_strength` | continu | Points UCI totaux de l'équipe du coureur au départ |
| `prev_year_ranking` | ordinal | Classement UCI individuel de fin d'année N-1 |
| `form_index` | continu | Moyenne glissante (EMA) du classement des 5 dernières courses |
| `home_race` | binaire | 1 si la course est dans le pays natal du coureur |

### 1.2 Stratégie de collecte de données

#### Source principale : ProCyclingStats (PCS)

**Raison** : FirstCycling est protégé par Cloudflare (HTTP 403). PCS permet le scraping (robots.txt n'interdit que `/nogooglebot/`).

**Structure PCS exploitée** :

```
# GC résultats par course/année
GET https://www.procyclingstats.com/race/{race-slug}/{annee}/gc
  → Tableau HTML : rider, team, UCI points, time, bonus

# Startlist par course/année
GET https://www.procyclingstats.com/race/{race-slug}/{annee}/startlist
  → Liste des coureurs par équipe, avec âge, nationalité

# Profil coureur
GET https://www.procyclingstats.com/rider/{rider-slug}
  → Âge, poids, taille, nationalité, palmarès, historique complet
```

**Courses ciblées (2015-2025, ~110 éditions)** :

| Catégorie | Courses | Éditions | Coureurs/éd. | Lignes |
|---|---|---|---|---|
| Grands Tours | TdF, Giro, Vuelta | 3 × 11 = 33 | ~176 | ~5 800 |
| Classiques | Roubaix, Flandres, Liège, Lombardie, MSR | 5 × 11 = 55 | ~175 | ~9 600 |
| **Total** | **8 courses** | **88 éditions** | — | **~15 400** |

**Script de scraping (structure)** :

```python
# scripts/scrape_pcs.py
import requests
from bs4 import BeautifulSoup
import time
import sqlite3
from urllib.parse import urljoin

BASE_URL = "https://www.procyclingstats.com"
HEADERS = {"User-Agent": "PariScore-Research/1.0 (contact@pariscore.app)"}
DELAY = 2.0  # secondes entre requêtes — politesse

RACES = {
    "tour-de-france": {"type": "GT", "slugs": ["tour-de-france"]},
    "giro-d-italia": {"type": "GT", "slugs": ["giro-d-italia"]},
    "vuelta-a-espana": {"type": "GT", "slugs": ["vuelta-a-espana"]},
    "paris-roubaix": {"type": "classic", "slugs": ["paris-roubaix"]},
    "ronde-van-vlaanderen": {"type": "classic", "slugs": ["ronde-van-vlaanderen"]},
    "liege-bastogne-liege": {"type": "classic", "slugs": ["liege-bastogne-liege"]},
    "giro-di-lombardia": {"type": "classic", "slugs": ["giro-di-lombardia"]},
    "milano-sanremo": {"type": "classic", "slugs": ["milano-sanremo"]},
}

def scrape_gc(race_slug, year):
    """Extrait le classement GC d'une course."""
    url = f"{BASE_URL}/race/{race_slug}/{year}/gc"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("table.basic tbody tr")
    results = []
    for row in rows:
        cols = row.select("td")
        if len(cols) < 4:
            continue
        rank = int(cols[0].text.strip())
        rider_link = cols[2].find("a")
        rider_name = rider_link.text.strip() if rider_link else ""
        rider_url = urljoin(BASE_URL, rider_link["href"]) if rider_link else ""
        team = cols[3].text.strip() if len(cols) > 3 else ""
        uci_points = parse_float(cols[4].text) if len(cols) > 4 else 0.0
        results.append({
            "race_slug": race_slug, "year": year,
            "rank": rank, "rider_name": rider_name,
            "rider_url": rider_url, "team": team, "uci_points": uci_points,
        })
    return results

def parse_float(s):
    try:
        return float(s.replace(",", "").replace("−", "-"))
    except ValueError:
        return 0.0

def scrape_rider_profile(rider_url):
    """Extrait l'âge, le palmarès et l'historique d'un coureur."""
    resp = requests.get(rider_url, headers=HEADERS, timeout=30)
    soup = BeautifulSoup(resp.text, "html.parser")
    # Âge depuis le champ "Date of birth"
    dob_text = soup.select_one("div.rdr-info-cont:contains('Born')")
    # Points UCI carrière
    career_points = soup.select_one("div.rdr-info-cont:contains('UCI')")
    return {"dob": dob_text, "career_uci": career_points}
```

#### Base de données SQLite

```sql
-- schema.sql
CREATE TABLE races (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    race_type TEXT NOT NULL CHECK(race_type IN ('GT', 'classic')),
    UNIQUE(slug, year)
);

CREATE TABLE results (
    id INTEGER PRIMARY KEY,
    race_id INTEGER NOT NULL REFERENCES races(id),
    rider_slug TEXT NOT NULL,
    rank INTEGER,
    uci_points REAL,
    time_seconds REAL,
    UNIQUE(race_id, rider_slug)
);

CREATE TABLE riders (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dob DATE,
    nationality TEXT,
    weight_kg REAL,
    height_cm REAL
);

CREATE TABLE rider_uci_history (
    rider_slug TEXT NOT NULL REFERENCES riders(slug),
    year INTEGER NOT NULL,
    points REAL,
    ranking INTEGER,
    PRIMARY KEY(rider_slug, year)
);
```

### 1.3 Pipeline de données

```
                    ┌──────────┐
                    │  PCS API │
                    │ (scrape) │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  parser  │
                    │ (BS4)    │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  clean   │ ← remove DNF, DNS, outliers
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ features │ ← join riders + history + race profile
                    └────┬─────┘
                         │
                    ┌────▼──────┐
                    │  train/   │ ← TimeSeriesSplit (year-based)
                    │  test     │
                    │  split    │
                    └────┬──────┘
                         │
                    ┌────▼──────┐
                    │  RF fit   │
                    └────┬──────┘
                         │
                    ┌────▼──────┐
                    │ evaluate  │
                    │ precision │
                    │ recall F1 │
                    │ MCC Brier │
                    └───────────┘
```

### 1.4 Code Python (pseudo-code exécutable)

```python
# scripts/train_rf_cycling.py
"""
Prototype Random Forest pour prédiction top-10 courses cyclistes.
Usage : python scripts/train_rf_cycling.py
"""

import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, matthews_corrcoef, brier_score_loss,
    roc_auc_score, confusion_matrix
)
from sklearn.calibration import CalibratedClassifierCV

from imblearn.over_sampling import SMOTE  # pip install imbalanced-learn


# ─── Configuration ───────────────────────────────────────────────────────────

SEED = 42
N_ESTIMATORS = 300
MAX_DEPTH = 15
MIN_SAMPLES_LEAF = 5
TEST_YEARS = [2023, 2024, 2025]  # held-out temporel

FEATURES = [
    "age",
    "uci_points_ytd",
    "uci_points_career",
    "days_since_last_race",
    "top10_same_race_prev",
    "top10_same_race_career",
    "grand_tour",
    "race_distance_km",
    "elevation_gain_m",
    "flat_terrain_pct",
    "mountain_terrain_pct",
    "team_strength",
    "prev_year_ranking",
    "form_index",
    "home_race",
]

TARGET = "top10"  # 1 si classé 1-10, 0 sinon


# ─── 1. Chargement des données ───────────────────────────────────────────────

def load_data(path: str = "data/cycling_features.parquet") -> pd.DataFrame:
    """
    Charge le dataset produit par le pipeline de scraping.
    Colonnes : FEATURES + TARGET + year + rider_id
    """
    df = pd.read_parquet(path)
    df = df.dropna(subset=FEATURES + [TARGET]).reset_index(drop=True)
    return df


# ─── 2. Split temporel ───────────────────────────────────────────────────────

def temporal_split(df: pd.DataFrame):
    """
    Split basé sur l'année : entraînement sur les années N-1 et avant,
    test sur l'année N. Pas de shuffle — respect strict de la chronologie.
    """
    train = df[~df["year"].isin(TEST_YEARS)]
    test = df[df["year"].isin(TEST_YEARS)]

    X_train = train[FEATURES].values
    y_train = train[TARGET].values
    X_test = test[FEATURES].values
    y_test = test[TARGET].values

    return X_train, y_train, X_test, y_test


# ─── 3. Entraînement ─────────────────────────────────────────────────────────

def train_rf(X_train, y_train, use_smote=True, class_weight="balanced"):
    """
    Random Forest avec options SMOTE et class weighting.
    """
    if use_smote:
        smote = SMOTE(random_state=SEED)
        X_train, y_train = smote.fit_resample(X_train, y_train)

    rf = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        max_depth=MAX_DEPTH,
        min_samples_leaf=MIN_SAMPLES_LEAF,
        class_weight=class_weight,
        random_state=SEED,
        n_jobs=-1,
        verbose=0,
    )
    rf.fit(X_train, y_train)
    return rf


# ─── 4. Évaluation ───────────────────────────────────────────────────────────

def evaluate(model, X_test, y_test, label="RF"):
    """
    Évalue le modèle : métriques classiques + calibration.
    """
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "model": label,
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "mcc": matthews_corrcoef(y_test, y_pred),
        "brier": brier_score_loss(y_test, y_proba),
        "roc_auc": roc_auc_score(y_test, y_proba),
    }

    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    metrics["specificity"] = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    return metrics, y_pred, y_proba


# ─── 5. Pipeline complet ─────────────────────────────────────────────────────

def main():
    print("[INFO] Chargement des données...")
    df = load_data()

    print(f"[INFO] Shape: {df.shape}")
    print(f"[INFO] Target balance:\n{df[TARGET].value_counts(normalize=True)}")

    X_train, y_train, X_test, y_test = temporal_split(df)

    print(f"[INFO] Train: {X_train.shape[0]} lignes")
    print(f"[INFO] Test:  {X_test.shape[0]} lignes")

    # === V0 : RF basique (sans SMOTE) ===
    print("\n[V0] RF basique (sans SMOTE)...")
    rf0 = train_rf(X_train, y_train, use_smote=False,
                    class_weight=None)
    m0, _, _ = evaluate(rf0, X_test, y_test, label="V0-RF-basic")
    print(m0)

    # === V1 : RF + SMOTE ===
    print("\n[V1] RF + SMOTE + balanced...")
    rf1 = train_rf(X_train, y_train, use_smote=True,
                    class_weight="balanced")
    m1, _, _ = evaluate(rf1, X_test, y_test, label="V1-RF-SMOTE")
    print(m1)

    # === V1b : RF calibré ===
    print("\n[V1b] RF calibré (Platt scaling)...")
    rf1_cal = CalibratedClassifierCV(rf1, method="sigmoid", cv=5)
    rf1_cal.fit(X_train, y_train)
    m1b, _, _ = evaluate(rf1_cal, X_test, y_test,
                          label="V1b-RF-calibrated")
    print(m1b)

    # ─── Rapport final ───
    results = pd.DataFrame([m0, m1, m1b])
    results.to_csv("output/eval_results.csv", index=False)
    print("\n[INFO] Résultats sauvegardés dans output/eval_results.csv")
    print(results.round(4).to_markdown())


if __name__ == "__main__":
    main()
```

### 1.5 Métriques attendues

| Métrique | Baseline naïve | RF attendu (V0) | RF+SMOTE (V1) | RF calibré (V1b) |
|---|---|---|---|---|
| Accuracy | 0.92-0.95 | 0.70-0.80 | 0.65-0.78 | 0.65-0.78 |
| Precision | 0.00 | 0.30-0.45 | 0.35-0.50 | 0.35-0.50 |
| Recall | 0.00 | 0.50-0.65 | 0.55-0.70 | 0.55-0.70 |
| F1 | 0.00 | 0.38-0.53 | 0.43-0.58 | 0.43-0.58 |
| MCC | 0.00 | 0.30-0.45 | 0.35-0.50 | 0.35-0.50 |
| Brier | — | 0.18-0.22 | 0.16-0.20 | **0.12-0.16** |
| ROC-AUC | 0.50 | 0.70-0.80 | 0.70-0.80 | 0.70-0.80 |

**Pourquoi la baseline naïve est élevée (92-95%) ?**
- Le top-10 est un événement rare (~5-8% des coureurs au départ)
- Prédire "pas top-10" pour tout le monde donne 92-95% d'accuracy
- C'est pourquoi l'accuracy n'est PAS une bonne métrique ici
- **MCC** est la métrique principale (corrige le déséquilibre de classe)

### 1.6 Plan d'itération

```
V0 ─────────► V1 ──────────► V2 ───────────► V3
RF basique    RF + SMOTE     RF + feature    XGBoost vs RF
sans SMOTE    + class        engineering     + hyperparameter
naïve         weights        (EMA, form)     tuning (Optuna)
                              + calibration
│             │              │               │
accuracy      recall ↑       F1 ↑           MCC ↑
0.75          0.65           0.55           0.50
brier 0.20    brier 0.18     brier 0.14     brier 0.12
```

#### V3 détaillée : XGBoost

```python
import xgboost as xgb

def train_xgb(X_train, y_train, scale_pos_weight=None):
    ratio = (y_train == 0).sum() / (y_train == 1).sum()
    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight or ratio,
        eval_metric="logloss",
        use_label_encoder=False,
        random_state=SEED,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train)],
        verbose=False,
    )
    return model
```

---

## Tâche 2 : Calibration des probabilités

### 2.1 Pourquoi calibrer ?

Un classifieur Random Forest produit des **scores bruts** : la proportion d'arbres dans la forêt qui ont voté pour la classe positive. Ce score **n'est pas une probabilité bien calibrée**.

**Pourquoi ?**
- Les arbres de décision sont entraînés à minimiser l'impureté (Gini/entropie), pas à produire des probabilités fidèles
- Le bagging et le bootstrap créent un biais vers les classes majoritaires
- La RF a tendance à être **sur-confidente** (prédit des probabilités trop extrêmes)

**Exemple concret** :

```
Score brut RF  →  Vraie probabilité  →  Erreur
    0.8                0.60            +0.20 (sur-confiance)
    0.6                0.45            +0.15 (sur-confiance)
    0.4                0.35            +0.05 (légère sur-confiance)
    0.2                0.25            -0.05 (sous-confiance)
```

Sans calibration, un score de 0.8 ne signifie PAS "80% de chance d'être top-10" — il peut signifier 60% en réalité.

### 2.2 Méthodes de calibration

#### Platt Scaling (recommandé pour PariScore)

**Algorithme** : Régression logistique sur les scores bruts du modèle. On ajuste une fonction sigmoïde :

```
P(y=1 | f(x)) = 1 / (1 + exp(A·f(x) + B))
```

où `f(x)` est le score brut et `A, B` sont appris sur un validation set.

**Implémentation scikit-learn** :
```python
from sklearn.calibration import CalibratedClassifierCV

# Platt scaling = method='sigmoid'
calibrated = CalibratedClassifierCV(base_estimator=rf, method='sigmoid', cv=5)
calibrated.fit(X_train, y_train)
probas = calibrated.predict_proba(X_test)[:, 1]
```

**Avantages** :
- Simple, rapide, paramètres (A, B) interprétables
- Préserve l'ordre des prédictions (monotone)
- Fonctionne bien avec peu de données de calibration
- Inclus dans scikit-learn, pas de dépendance supplémentaire

**Inconvénient** :
- Suppose que l'erreur de calibration suit une forme sigmoïde — pas toujours vrai
- Peut dégrader si l'erreur est non-monotone

#### Isotonic Regression

**Algorithme** : Fonction non-paramétrique croissante par morceaux (PAV — Pool Adjacent Violators).

```python
calibrated = CalibratedClassifierCV(base_estimator=rf, method='isotonic', cv=5)
```

**Avantages** :
- Plus flexible que Platt — s'adapte à n'importe quelle forme d'erreur
- Meilleur avec beaucoup de données de calibration (> 1000 échantillons)

**Inconvénients** :
- **Overfit** avec peu de données (≤ 500 échantillons)
- Peut violer la monotonie locale (prédictions instables sur des jeux de test petits)
- Non recommandé pour PariScore en phase prototype

#### Temperature Scaling (modèles multiclasses / ensembles)

**Algorithme** : Facteur d'échelle T unique appliqué au logits/softmax :

```
P(y=i | x) = exp(logit_i / T) / Σ_j exp(logit_j / T)
```

```python
# Pour un réseau de neurones ou un ensemble, après entraînement
# T est optimisé sur validation set via NLL
def temperature_scale(logits, T):
    return torch.softmax(logits / T, dim=-1)
```

**Avantage** : Préserve parfaitement l'ordre (aucun changement dans le ranking).
**Inconvénient** : Moins pertinent pour un classifieur binaire RF (pas de logits).

### 2.3 Métriques de calibration

#### Brier Score (métrique principale)

**Formule** :
```
BS = 1/N × Σ(p_i − y_i)²
```

Où `p_i` = probabilité prédite, `y_i` = résultat observé (0 ou 1).

**Interprétation** :

| Brier Score | Signification |
|---|---|
| 0.00 | Calibration parfaite |
| 0.12−0.16 | Bonne calibration (acceptable PariScore) |
| 0.20−0.25 | Calibration médiocre |
| 0.25 | Prédiction aléatoire (P(y=1)=0.5 constant) |
| > 0.30 | Mauvaise calibration |

**Seuil PariScore** : `BS < 0.15` pour un modèle acceptable, `BS < 0.12` pour un modèle de production.

**Décomposition du Brier Score** :

```
BS = Reliability + Resolution + Uncertainty
```

Où :
- **Reliability** : écart à la diagonale (calibration pure)
- **Resolution** : capacité à séparer les classes
- **Uncertainty** : variance de la variable cible

#### Reliability Diagram

```
Vraie proportion de top-10
         │
  1.0    │ ╱                        ╱ = calibration parfaite
         │ ╱                       ● = modèle non calibré
  0.8    │  ╱                     ★ = modèle calibré
         │   ╱
  0.6    │    ╱
         │     ╱
  0.4    │  ★★★ ╱                    Zone de sur-confiance
         │        ╱                  (points sous la diagonale)
  0.2    │ ●●●●●●  ╱
         │           ╱
  0.0    └───────────────┤
         0.0  0.2  0.4  0.6  0.8  1.0
               Probabilité prédite
```

**Implémentation** :

```python
import matplotlib.pyplot as plt
from sklearn.calibration import calibration_curve

def plot_reliability(y_true, y_proba, title="Reliability Diagram"):
    prob_true, prob_pred = calibration_curve(
        y_true, y_proba, n_bins=10, strategy="uniform"
    )
    plt.plot([0, 1], [0, 1], "k--", label="Parfait")
    plt.plot(prob_pred, prob_true, "o-", label=title)
    plt.xlabel("Probabilité prédite moyenne")
    plt.ylabel("Fréquence observée")
    plt.legend()
    plt.savefig(f"output/{title.replace(' ', '_')}.png")
```

#### Expected Calibration Error (ECE)

**Formule** :
```
ECE = Σ_{m=1}^{M} |B_m|/N × |ȳ_m − p̄_m|
```

Où M = 10 bins, B_m = échantillons dans le bin m, ȳ_m = proportion observée, p̄_m = probabilité moyenne prédite.

**Seuil PariScore** : `ECE < 0.05`

```python
def expected_calibration_error(y_true, y_proba, n_bins=10):
    bins = np.linspace(0, 1, n_bins + 1)
    bin_indices = np.digitize(y_proba, bins) - 1
    ece = 0.0
    for i in range(n_bins):
        mask = bin_indices == i
        if mask.sum() == 0:
            continue
        acc = y_true[mask].mean()
        conf = y_proba[mask].mean()
        ece += np.abs(acc - conf) * mask.sum()
    return ece / len(y_true)
```

### 2.4 Recommandation pour PariScore

| Décision | Choix | Justification |
|---|---|---|
| **Méthode** | Platt Scaling (sigmoid) | Robuste avec peu de données, préserve l'ordre |
| **Métrique principale** | Brier Score | Interprétable, décomposable, standard |
| **Métrique secondaire** | ECE + ROC-AUC | ECE pour calibration pure, ROC-AUC pour discriminination |
| **Visualisation** | Reliability Diagram | Debugging visuel, communication métier |
| **Validation** | 5-fold cross-validation | CalibratedClassifierCV(cv=5) évite le data leakage |
| **Split** | Calibration sur validation set | Jamais sur le test set — pollution des métriques |

**Protocole strict** :
```
1. Split temporel : train (2015-2022) / val (2023) / test (2024-2025)
2. Entraîner RF sur train
3. Calibrer sur val (CalibratedClassifierCV fit sur train+val avec cv=5)
4. Évaluer sur test (inchangé, jamais utilisé avant)
5. Comparer Brier/ECE avant/après calibration
```

### 2.5 Impact sur le value betting

La calibration n'est pas optionnelle — elle est **critique** pour la gestion de bankroll en value betting.

#### Scénario : sous-confiance

| Variable | Valeur |
|---|---|
| Probabilité réelle (P) | 0.50 |
| Probabilité modèle (p̂) | 0.30 |
| Cote | 4.0 (proba implicite = 0.25) |
| Edge calculé | 0.30 − 0.25 = **+0.05** (5%) |
| Edge réel | 0.50 − 0.25 = **+0.25** (25%) |
| **Conséquence** | On mise **moins** que ce qu'on devrait (Kelly sous-optimal) |

#### Scénario : sur-confiance

| Variable | Valeur |
|---|---|
| Probabilité réelle (P) | 0.30 |
| Probabilité modèle (p̂) | 0.50 |
| Cote | 4.0 (proba implicite = 0.25) |
| Edge calculé | 0.50 − 0.25 = **+0.25** (25%) |
| Edge réel | 0.30 − 0.25 = **+0.05** (5%) |
| **Conséquence** | On mise **trop** → on perd de l'argent |

#### Formule d'impact Kelly

```python
def kelly_fraction(edge, odds):
    """Fraction Kelly = edge / (odds - 1)"""
    return edge / (odds - 1) if odds > 1 else 0.0

# Avec calibration correcte
p_real = 0.50
odds = 4.0
edge_real = p_real - (1 / odds)
kelly_real = kelly_fraction(edge_real, odds)
# → kelly_real = (0.50 - 0.25) / 3.0 = 8.3%

# Sans calibration (sous-confiance)
p_pred = 0.30
edge_pred = p_pred - (1 / odds)
kelly_pred = kelly_fraction(edge_pred, odds)
# → kelly_pred = (0.30 - 0.25) / 3.0 = 1.7%

# Différence : 8.3% vs 1.7% → 5× de rendement en moins !
```

**Conclusion** : Une mauvaise calibration dégrade directement le ROI. Avec une calibration correcte, un modèle peut être rentable même avec une accuracy modeste.

### 2.6 Code d'exemple complet

```python
# scripts/calibrate_cycling.py
"""
Démonstration complète de la calibration pour PariScore.
Usage : python scripts/calibrate_cycling.py
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import brier_score_loss, roc_auc_score

from imblearn.over_sampling import SMOTE


def brier_decomposition(y_true, y_proba, n_bins=10):
    """
    Décompose le Brier Score en Reliability + Resolution + Uncertainty.
    """
    bins = np.linspace(0, 1, n_bins + 1)
    bin_indices = np.digitize(y_proba, bins) - 1

    reliability = 0.0
    resolution = 0.0
    uncertainty = y_true.var()

    for i in range(n_bins):
        mask = bin_indices == i
        if mask.sum() == 0:
            continue
        n_b = mask.sum()
        obs = y_true[mask].mean()
        pred = y_proba[mask].mean()
        reliability += n_b * (obs - pred) ** 2
        resolution += n_b * (obs - y_true.mean()) ** 2

    reliability /= len(y_true)
    resolution /= len(y_true)

    return {
        "brier": brier_score_loss(y_true, y_proba),
        "reliability": reliability,
        "resolution": resolution,
        "uncertainty": uncertainty,
    }


def main():
    # ─── Données simulées (remplacer par vrai dataset) ───
    np.random.seed(42)
    n = 10_000

    # Features synthétiques
    X = np.random.randn(n, 10)
    # Target : top-10 binaire (~8% de positifs)
    y = (X[:, 0] + X[:, 1] * 0.5 + np.random.randn(n) * 0.5 > 2.0).astype(int)

    # Split temporel (simulé)
    split = int(n * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    # ─── Modèle non calibré ───
    rf = RandomForestClassifier(
        n_estimators=300, max_depth=15,
        class_weight="balanced", random_state=42
    )
    rf.fit(X_train, y_train)
    proba_raw = rf.predict_proba(X_test)[:, 1]

    # ─── Modèle calibré (Platt) ───
    rf_cal = CalibratedClassifierCV(rf, method="sigmoid", cv=5)
    rf_cal.fit(X_train, y_train)
    proba_cal = rf_cal.predict_proba(X_test)[:, 1]

    # ─── Métriques ───
    print("=" * 60)
    print("MÉTRIQUES DE CALIBRATION")
    print("=" * 60)

    for label, proba in [("Raw (non calibré)", proba_raw),
                          ("Platt (calibré)",  proba_cal)]:
        brier = brier_score_loss(y_test, proba)
        auc = roc_auc_score(y_test, proba)
        decomp = brier_decomposition(y_test, proba)

        print(f"\n{label}:")
        print(f"  Brier Score         : {decomp['brier']:.4f}")
        print(f"    - Reliability     : {decomp['reliability']:.4f}")
        print(f"    - Resolution      : {decomp['resolution']:.4f}")
        print(f"    - Uncertainty     : {decomp['uncertainty']:.4f}")
        print(f"  ROC-AUC             : {auc:.4f}")

    # ─── Reliability Diagram ───
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    for ax, (proba, title) in zip(axes, [
        (proba_raw, "RF non calibré"),
        (proba_cal, "RF + Platt Scaling"),
    ]):
        prob_true, prob_pred = calibration_curve(
            y_test, proba, n_bins=10, strategy="uniform"
        )
        ax.plot([0, 1], [0, 1], "k--", label="Calibration parfaite")
        ax.plot(prob_pred, prob_true, "o-", label=title)
        ax.set_xlabel("Probabilité prédite moyenne")
        ax.set_ylabel("Fréquence observée")
        ax.set_title(title)
        ax.legend()
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("output/calibration_comparison.png", dpi=150)
    print("\n[INFO] Graphique sauvegardé : output/calibration_comparison.png")


if __name__ == "__main__":
    main()
```

### 2.7 Résumé exécutif

| Aspect | Recommandation |
|---|---|
| Méthode | Platt Scaling (`sklearn.calibration.CalibratedClassifierCV(method='sigmoid')`) |
| Métrique principale | Brier Score (< 0.12 production, < 0.15 prototype) |
| Métrique secondaire | ECE (< 0.05) + ROC-AUC (> 0.75) |
| Visualisation | Reliability Diagram (10 bins uniformes) |
| Validation croisée | 5-fold (CalibratedClassifierCV intègre déjà le cv) |
| Split | Calibration sur validation set **jamais** sur test set |
| Impact métier | La calibration détermine la rentabilité du value betting |

**Règle d'or** : Un modèle avec AUC=0.80 mais Brier=0.22 est moins utile qu'un modèle avec AUC=0.75 et Brier=0.12 — car le second permet une gestion de bankroll correcte.
