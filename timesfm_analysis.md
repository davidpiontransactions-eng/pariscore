# Analyse TimesFM (Google Research) — Intégration PariScore

**Date** : 2026-06-19
**Source** : https://github.com/google-research/timesfm
**Stars** : 24k ⭐ | **License** : Apache-2.0 | **Paper** : ICML 2024

---

## 1. Qu'est-ce que TimesFM ?

**TimesFM (Time Series Foundation Model)** est un modèle de fondation pré-entraîné par **Google Research** pour le _forecasting_ de séries temporelles. C'est un modèle **decoder-only** (architecture transformer) qui fonctionne en **zero-shot** : vous lui passez n'importe quelle série temporelle univariée, il retourne des prévisions ponctuelles avec des intervalles de confiance quantiles, **sans entraînement**.

### Caractéristiques clés (version 2.5)

| Caractéristique | Valeur |
|---|---|
| **Paramètres** | 200M (contre 500M en v2.0) |
| **Contexte max** | 16 384 points (contre 2 048 en v2.0) |
| **Horizon max** | 1 000 pas (avec tête quantile continue) |
| **Inférence** | PyTorch **ou** Flax (JAX) |
| **Prévisions** | Point forecast + 10 quantiles (moyenne, q10 → q90) |
| **Entrée** | Numpy array 1D |
| **Sortie** | `(batch, horizon)` + `(batch, horizon, 10)` |
| **Poids** | ~800 Mo sur disque (HuggingFace) |
| **RAM** | ~1,5 Go (CPU) / ~1 Go VRAM (GPU) |

### Installation

```bash
pip install timesfm[torch]       # Backend PyTorch
pip install timesfm[flax]        # Backend JAX/Flax (plus rapide GPU)
pip install timesfm[xreg]        # + support covariables externes
```

### Exemple minimal

```python
import torch, numpy as np, timesfm

torch.set_float32_matmul_precision("high")

model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
    "google/timesfm-2.5-200m-pytorch"
)
model.compile(timesfm.ForecastConfig(
    max_context=1024, max_horizon=256, normalize_inputs=True,
    use_continuous_quantile_head=True, fix_quantile_crossing=True,
))

point, quantiles = model.forecast(horizon=12, inputs=[
    np.sin(np.linspace(0, 20, 100)),  # série temporelle quelconque
])
# point.shape      == (1, 12)         — prévision médiane
# quantiles.shape  == (1, 12, 10)     — q10, q20, ..., q90
```

---

## 2. Capacités principales

### 2.1 Forecasting univarié pur
Cœur du modèle : n'importe quelle série Y(t) → Y(t+1 ... t+H).

### 2.2 Intervalles de confiance quantiles
Renvoie 10 tranches : moyenne, puis q10 à q90. Utile pour :
- **Détection d'anomalies** : une valeur hors [q10, q90] est statistiquement rare (< 10%)
- **Bornes hautes/basses** pour les stratégies de paris

### 2.3 Covariables externes (XReg)
Via `forecast_with_covariates()` avec `pip install timesfm[xreg]` :
- Covariables numériques dynamiques (prix, météo, ...)
- Covariables catégorielles dynamiques (holidays, jour de semaine, ...)
- Covariables catégorielles statiques (région, ligue, ...)

### 2.4 Fine-tuning (LoRA)
Depuis avril 2026 : fine-tuning possible via HuggingFace Transformers + PEFT (LoRA).

### 2.5 Agent Skill
Un SKILL.md Claude Code est disponible : `timesfm-forecasting/SKILL.md`, avec preflight checker, estimation mémoire, et exemples complets.

---

## 3. Forces et Faiblesses

### ✅ Forces
- **Zero-shot** : pas de training, fonctionne directement
- **Robuste** : fondation model Google Research, 24k stars
- **Quantiles calibrés** : donne des intervalles de confiance, pas juste une prédiction
- **Contexte long** : jusqu'à 16k points
- **Léger** : 200M paramètres, tient sur un CPU moderne
- **Écosystème** : BigQuery ML, Google Sheets, Vertex AI, HuggingFace

### ❌ Faiblesses
- **Univarié** : ne prend qu'une série à la fois (pas de multivariate natif)
- **Régression, pas classification** : ne prédit pas "Victoire / Défaite"
- **Pas de feature engineering** : vous devez préparer vos séries vous-même
- **Python uniquement** : nécessite un processus Python (Pas de JS natif)
- **Pas de causalité** : ne dit PAS pourquoi la série va augmenter
- **Modèle boîte noire** : pas d'interprétabilité intrinsèque

---

## 4. Pertinence pour PariScore

### 4.1 Ce que PariScore fait déjà (sans TimesFM)

| Composant | Technologie | Rôle |
|---|---|---|
| **Prédictions Tennis** | Elo, Glicko-2, Momentum, Markov, Sackmann | Probas victoire 1N2 |
| **Prédictions Football** | CatBoost, Poisson, Bayésien | 1X2, BTTS, Over/Under |
| **ML Inférence** | CatBoost (Python) | Modèles entraînés |
| **Value Bets** | 6D composite score | Top 10 matchs |
| **Momentum** | EWMA bi-temporel (alpha 0.18 / 0.05) | Tendance récente |

### 4.2 Ce que TimesFM apporterait

| Usage | Description | Utilité pour PariScore |
|---|---|---|
| **📈 Forme d'équipe/joueur** | Prévoir la tendance des performances sur N matchs | Haute — remplacerait/augmenterait le momentum tracker |
| **📊 Volume de paris** | Prévoir le nombre de buts/points d'un match | Haute — complément Poisson |
| **🔮 Odds movement** | Prévoir l'évolution des cotes avant un match | Haute — stratégie de value betting |
| **📉 Détection de méforme** | Intervalle de confiance autour des performances | Moyenne — détection précoce de downswing |
| **🏆 Grands tournois** | Modéliser la montée en forme sur 2 semaines | Haute — Roland Garros, CDM |
| **⚡ Momentum live** | Prévoir l'évolution du momentum intra-match | Basse — nécessite données point-à-point |

### 4.3 Croisement avec la thèse Dryja (analysée le 17/06)

La thèse Dryja montre que les métriques **composées** (Serve Advantage, Completeness, Momentum) et **EWMA bi-temporel** sont les features les plus importantes pour la prédiction tennis.

TimesFM pourrait directement modéliser l'évolution temporelle de ces métriques :
- **Serve Advantage(t)** → TimesFM → Serve Advantage(t+1 ... t+H)
- **Completeness(t)** → TimesFM → Completeness(t+1 ... t+H)
- **Momentum(t)** → TimesFM → Momentum(t+1 ... t+H)

Cela donnerait des **bandes de confiance** autour des trajectoires de forme — bien plus riche que le simple EWMA actuel.

---

## 5. Proposition d'Architecture

### Option A — Forecasting de forme (recommandée)

```
[BDD] séries historiques (Elo, momentum, winrate)
   ↓
[Python TimesFM] inférence batch (cron 1h)
   ↓
[Pariscore DB] stockage prévisions + intervalles
   ↓
[API / frontend] affichage tendances "Form Forecast"
```

**Pourquoi c'est la meilleure option :**
- TimesFM est utilisé pour ce qu'il fait de mieux : **prévoir des séries temporelles**
- Les sorties sont stockées et servies via l'API existante
- Pas de latence en temps réel
- Complète les modèles existants sans les remplacer

### Option B — Côte dynamique (avancée)

```
[Flux odds API] historique des cotes par match
   ↓
[Python TimesFM] prévision d'évolution des cotes
   ↓
[Pariscore engine] détection de value bets avant déplacement du marché
```

**Risques :** complexité opérationnelle, données odds historiques à collecter.

---

## 6. Prérequis Techniques

### Installation sur le serveur PariScore (Render.com)

```bash
# Dans l'environnement Python du projet
pip install timesfm[torch]

# Vérification mémoire
python scripts/check_system.py
```

### Contraintes
- **RAM** : 1,5 Go pour le modèle + 0,5 Go overhead → **2 Go mini**
- **Stockage** : 800 Mo pour le cache HuggingFace
- **Python** : 3.10+
- **Pas de GPU nécessaire** (CPU suffisant pour inférence batch)

### Script d'inférence proposé

```python
# tools/timesfm_forecast.py
import timesfm, torch, numpy as np, json, sqlite3

MODEL = None

def load_model():
    global MODEL
    if MODEL is None:
        torch.set_float32_matmul_precision("high")
        MODEL = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
            "google/timesfm-2.5-200m-pytorch"
        )
        MODEL.compile(timesfm.ForecastConfig(
            max_context=1024, max_horizon=32,
            normalize_inputs=True,
            use_continuous_quantile_head=True,
            fix_quantile_crossing=True,
            infer_is_positive=True,
        ))

def forecast_player_form(player_id, history, horizon=16):
    """history: liste de floats (résultats, points, etc.)"""
    load_model()
    point, quantiles = MODEL.forecast(horizon=horizon, inputs=[np.array(history)])
    return {
        "player_id": player_id,
        "forecast": point[0].tolist(),
        "lower_80": quantiles[0, :, 1].tolist(),
        "upper_80": quantiles[0, :, 9].tolist(),
        "trend": "up" if point[0][-1] > history[-1] else "down",
    }

# Exemple : prévisions stockées en base
# python tools/timesfm_forecast.py → écrit dans pariscore.db table `form_forecasts`
```

---

## 7. Verdict Final

### ✅ OUI, TimesFM est intéressant pour PariScore

Mais **pas comme remplacement des modèles existants** — comme **complément** :

| Critère | Évaluation |
|---|---|
| **Pertinence technique** | ⚡ Élevée — forecasting de forme, odds movement, tendances |
| **Effort d'intégration** | 🟡 Modéré — nécessite un processus Python + script cron |
| **Valeur ajoutée** | 🟢 Élevée — intervalles de confiance, détection tendances |
| **Risque** | 🟢 Faible — zero-shot, pas de training, peu de lignes de code |
| **Coût** | 🟢 Gratuit (open source Apache 2.0) |
| **Maintenance** | 🟢 Faible — Google Research maintient, écosystème actif |

### Cas d'usage prioritaire

1. **Form Forecast Joueurs Tennis** : modéliser l'évolution de l'Elo surface, momentum, winrate sur les 16 prochains matchs
2. **Tendance d'équipe Football** : xG, points, forme sur les 10 prochains matchs
3. **Détection de downswing** : alerter quand un joueur sort des intervalles de confiance historiques

### Pas recommandé pour

- ❌ Prédire directement le résultat d'un match (classification, pas régression)
- ❌ Remplacer CatBoost / Poisson / Elo (modèles existants déjà calibrés)
- ❌ Inférence en temps réel (latence du modèle ~500ms à froid)

### Suggestion d'implémentation

**Phase 1** (1-2 jours) : Script Python cron qui tourne 1x/h, prévoit la forme des top 50 joueurs tennis, stocke en base, affiche "Tendance" dans le frontend (nouveau badge).

**Phase 2** (3-5 jours) : Étendre au football (équipes), odds movement, intégration dans le scoring 6D comme dimension bonus "Trend confidence".

---

**Rapport généré pour PariScore — Juin 2026**
