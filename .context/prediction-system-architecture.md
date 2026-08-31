# Architecture du Système Prédictif Football

> Dernière mise à jour : 2026-08-31
> Scope : Moteurs de prédiction, ML pipeline, API, monitoring, UI

---

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│                        UTILISATEUR (UI)                             │
│  FootballPredictionMarkets │ PredictiveBets │ Calibration Chart     │
└──────────┬───────────────────────────────────────────────────────────┘
           │ HTTP
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js)                             │
│                                                                      │
│  POST /compute   GET /accuracy   GET /drift   GET /compare          │
│  GET /health     POST /alerts    GET /alerts                         │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    MOTEURS DE PRÉDICTION                              │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Poisson    │  │ Dixon-Coles  │  │     Elo      │               │
│  │  (stats)     │  │  (corrélation│  │  (ratings)   │               │
│  └──────┬──────┘  │   ρ)         │  └──────┬───────┘               │
│         │         └──────┬───────┘         │                         │
│         └────────┬───────┘─────────────────┘                         │
│                  ▼                                                   │
│  ┌──────────────────────────────────────────┐                       │
│  │       ML META-LEARNER (soft voting)       │                       │
│  │                                            │                       │
│  │  RF (0.35) + XGBoost (0.30) + DC (0.35)  │                       │
│  └──────────────────┬───────────────────────┘                       │
│                     │                                                │
│  ┌──────────────────▼───────────────────────┐                       │
│  │        CatBoost Bridge (Python)           │                       │
│  │  subprocess stdin/stdout + kill-switch    │                       │
│  └──────────────────────────────────────────┘                       │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                      │
│                                                                      │
│  Prisma ORM ──→ SQLite (pariscore.db)                                │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │Prediction│ │Prediction│ │ ModelVersion │ │ModelMetrics  │       │
│  │  Log     │ │          │ │              │ │              │        │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘       │
│                                                                      │
│  KvStore ──→ kv['history_matches'] (ETL training)                   │
│                                                                      │
│  models/ ──→ *.cbm (CatBoost), *.json (RF serialized)               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Composants

### 2.1 Moteurs statistiques

| Moteur | Fichier | Rôle | Sortie |
|--------|---------|------|--------|
| **Poisson** | `poisson.ts` | Matrice de scores P(x,y) = P(x\|λ_h) × P(y\|λ_a). Calcul des marchés 1X2, O/U, BTTS, DC, Correct Score, Corners | `Markets` (12 marchés) |
| **Dixon-Coles** | `dixon-coles.ts` | Extension Poisson avec paramètre ρ de corrélation faibles scores (0-0, 1-0, 0-1, 1-1). Ajuste la under-prediction des nuls | `Markets` + `dcLogLikelihood()` |
| **Elo** | `engine.ts` | Système de ratings. `eloProb()` calcule P(home win) depuis l'écart Elo + avantage terrain. `lambdaFromElo()` convertit en λ Poisson | `EloPair`, probabilité 1X2 |
| **Random Forest** | `random-forest.ts` | Classifieur JS-natif. Arbres sérialisés en JSON (`flat array`). Bootstrap aggregating, max depth 6, min samples 5 | `RFProbs` {home, draw, away} |
| **XGBoost (approx)** | `prediction-ml-engine.ts` | Régression logistique + interactions polynomiales. Coefficients calibrés sur ~5000 matchs historiques (5 ligues majeures). Softmax 3 classes | `RFProbs` |
| **CatBoost** | `catboost-bridge.ts` | Bridge Python via subprocess. Features Poisson + fair probs en entrée, prédictions 1X2/O-U/BTTS en sortie. Kill-switch `CATBOOST_ENABLED` | `CatBoostPrediction` |

### 2.2 ML Pipeline

```
┌──────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Feature Extract  │────▶│  Model Inference  │────▶│ Ensemble Blending  │
│  (ml-features.ts)│     │  (4 modèles)      │     │ (soft voting)      │
└──────────────────┘     └──────────────────┘     └────────────────────┘
```

**Feature extraction** (`ml-features.ts` — 20 features) :
- `eloGapNorm`, `eloProbHome` — rating Elo
- `formHome`, `formAway`, `formDiff`, `formTrendHome/Away` — forme (decay exponentiel, 5 matchs)
- `ppgHome`, `ppgAway`, `ppgDiff` — points par match
- `xgHome`, `xgAway`, `xGd` — expected goals
- `h2hHomeRatio`, `homeAdvantage` — contexte
- `rankHomeNorm`, `rankAwayNorm` — classement
- `goalsScoredHome`, `goalsConcededAway`, `cleanSheetHome` — stats buts

**Meta-learner** (`prediction-ml-engine.ts`) :
- `P_final = w_RF × RF + w_XGB × XGB + w_DC × DixonColes`
- Poids par défaut : `{ rf: 0.35, xgboost: 0.30, dixonColes: 0.35 }`
- Les poids sont surchargables par requête

### 2.3 API Layer

| Endpoint | Méthode | Rôle | Source |
|----------|---------|------|--------|
| `/api/v1/predictions/compute` | POST | Calcul on-demand d'un match. Invoque `predictPrematch()` + `predictML()`. Validation input, confidence scoring, edge calculation | `compute/route.ts` |
| `/api/v1/predictions/accuracy` | GET | Métriques Brier/logLoss/calibration via walk-forward validation. Params : `trainWindow`, `testWindow`, `stepSize` | `accuracy/route.ts` |
| `/api/v1/predictions/drift` | GET | Détection de drift (Brier récent vs baseline). Params : `period` (7d), `baseline` (90d) | `drift/route.ts` |
| `/api/v1/predictions/compare` | GET | Comparaison A/B de deux versions de modèle. Test chi-deux de significativité | `compare/route.ts` |
| `/api/v1/predictions/health` | GET | Dashboard santé : modèle actif, métriques, drift, volume, état CatBoost | `health/route.ts` |
| `/api/v1/predictions/alerts` | GET | Historique des alertes drift (mémoire in-memory) | `alerts/route.ts` |
| `/api/v1/predictions/alerts` | POST | Déclenchement manuel drift + alerte multi-canal | `alerts/route.ts` |

### 2.4 Data Layer (Prisma)

| Modèle | Rôle | Champs clés |
|--------|------|-------------|
| `ModelVersion` | Registry des versions de modèles | `name`, `modelType` (poisson/dixon-coles/catboost/ensemble/ml-meta), `version`, `status` (staging→production→archived), `metricsJson`, `configJson`, `trainedAt`, `promotedAt` |
| `ModelMetrics` | Métriques par marché par version | `modelVersionId`, `market` (1x2/btts/over25/double_chance), `brierScore`, `logLoss`, `rps`, `accuracy`, `sampleSize`, `period` |
| `PredictionLog` | Log des prédictions pour backtest | `matchId`, `modelVersionId`, `homeProb/drawProb/awayProb`, `bttsProb`, `over25Prob`, `edge`, `confidence`, `actualHome`, `actualAway`, `settled` |
| `Prediction` | Prédiction attachée à un Match | `matchId`, `modelVersionId` (FK), `homeProb/drawProb/awayProb`, `bttsProb`, `over25Prob`, `model`, `edge`, `confidence` |
| `KvStore` | KV pour ETL training | `key='history_matches'`, `value=JSON[]` (records format CatBoost) |

### 2.5 ETL & Training

| Script | Rôle | Usage |
|--------|------|-------|
| `scripts/etl-history-matches.js` | Peuple `kv['history_matches']` pour training CatBoost. Modes : `--source=db`, `--source=file`, `--source=both`. De-vig cotes, Poisson snapshot estimé | `node scripts/etl-history-matches.js --source=db` |
| `scripts/cron-retrain-catboost.js` | Pipeline hebdomadaire complet : ETL → training → métriques. Logs structurés, exit codes, dry-run | `node scripts/cron-retrain-catboost.js` |
| `scripts/compute-model-metrics.js` | Calcule Brier/logLoss/accuracy par marché sur les PredictionLog récentes. Output DB ou JSON | `node scripts/compute-model-metrics.js --period=30d` |
| `ml/train_catboost.py` | Entraîne CatBoost sur `history_matches`. Walk-forward interne, metrics RPS/accuracy | `python ml/train_catboost.py --db pariscore.db` |
| `ml/infer_catboost.py` | Inférence batch : lit features JSON stdin, écrit prédictions stdout | Spawne par `catboost-bridge.ts` |

### 2.6 Monitoring

| Module | Fichier | Rôle |
|--------|---------|------|
| **Drift Detection** | `drift-detection.ts` | Compare Brier score récent (7j) vs baseline (90j). Seuil : ΔBrier > 0.02. Analyse par marché (1X2, BTTS, O2.5) |
| **Alerting** | `alerting.ts` | Multi-canal : webhook (Slack/Discord), email (SMTP), console. Cooldown 24h par clé de drift. Niveaux : warning (Δ < 0.05) / critical (Δ ≥ 0.05) |
| **Walk-Forward** | `walk-forward.ts` | Validation glissante : train sur N matchs → prédire M → step K. Métriques par marché + ROI simulé |
| **A/B Testing** | `ab-testing.ts` | Comparaison de 2 variants. Assignation déterministe par hash matchId. Test chi-deux pour significativité (p < 0.05) |
| **Brier Score** | `brier-score.ts` | `brierScore()`, `logLoss()`, `calibrationCurve()`, `rankedProbabilityScore()`, `accuracy()` |
| **Calibration** | `brier-score.ts` | Courbe de calibration : fréquence observée vs probabilité prédite par bucket |

### 2.7 UI

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `FootballPredictionMarkets` | `football-prediction-markets.tsx` | Panel unifié 6 marchés : 1X2 (stacked bar), Double Chance (3 chips), O/U 2.5 (two-bar), BTTS (yes/no), Corners (best line), Correct Score (top 3). Mode compact + full |
| `PredictiveBets` (tennis) | `predictive-bets.tsx` | 3 paris prédictifs Over/Under Total Games pour tennis |
| `FootballMatchCard` | `football-match-card.tsx` | Card match avec `FootballPredictionMarkets` intégré (toggle "Marchés prédictifs") |
| `FootballMatchDetailDialog` | `football-match-detail-dialog.tsx` | Dialog détail avec `FootballPredictionMarkets` en mode full + `PredictiveBetsResult` |
| `usePredictionCompute` | `hooks/use-prediction-compute.ts` | Hook SWR pour calcul on-demand : `usePredictionCompute(matchId)` + `usePredictionBatch(matchIds)` |

---

## 3. Flux de données

### 3.1 Flux Prédiction (on-demand)

```
Requête POST /compute
       │
       ▼
┌──────────────┐     ┌─────────────────┐
│ Validation   │────▶│ extractFeatures()│
│ matchId, Elo │     │ (20 features)   │
│ xG           │     └────────┬────────┘
└──────────────┘              │
                              ▼
              ┌───────────────────────────────┐
              │     predictPrematch()          │
              │  Elo → λ → Poisson matrix     │
              │  + xG adjustment              │
              │  + blend cotes (si disponibles)│
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │        predictML()             │
              │  RF.predict(featArr)           │
              │  xgboostPredict(featArr)       │
              │  dixonColes from engine        │
              │  soft voting → homeProb/draw/away│
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │     computeConfidence()        │
              │  gap Elo + convergence modèles │
              └───────────────┬───────────────┘
                              │
                              ▼
                    ComputeResponse JSON
```

### 3.2 Flux Training (CatBoost)

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ etl-history- │────▶│ KvStore         │────▶│ train_catboost.py│
│ matches.js   │     │ ['history_      │     │                  │
│              │     │  matches']      │     │ walk-forward     │
│ --source=db  │     └─────────────────┘     │ train/val split  │
│ --source=file│                              │ → models/*.cbm   │
└──────────────┘                              └──────────────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │compute-model-    │
                                              │metrics.js        │
                                              │ → Prisma         │
                                              │   ModelMetrics   │
                                              └──────────────────┘
```

### 3.3 Flux Monitoring

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ PredictionLog    │────▶│ drift-detection │────▶│ alerting.ts      │
│ (settled=true)   │     │                 │     │                  │
│                  │     │ Brier recent    │     │ webhook (Slack)  │
│ recent (7j)      │     │ vs baseline     │     │ email (SMTP)     │
│ baseline (90j)   │     │ Δ > 0.02 ?      │     │ console          │
└──────────────────┘     └─────────────────┘     └──────────────────┘
```

### 3.4 Flux Retraining (cron hebdomadaire)

```
cron-retrain-catboost.js (dimanche 05:00 UTC)
       │
       ├── Étape 1: etl-history-matches.js --source=db
       │            → kv['history_matches'] mis à jour
       │
       ├── Étape 2: python ml/train_catboost.py
       │            → models/catboost_football_1x2_v1.cbm
       │
       └── Étape 3: compute-model-metrics.js --period=30d
                    → Prisma ModelMetrics écrit
```

---

## 4. API Reference

### POST `/api/v1/predictions/compute`

**Request :**
```json
{
  "matchId": "string (requis)",
  "homeElo": "number (optionnel)",
  "awayElo": "number (optionnel)",
  "homeXG": "number (optionnel)",
  "awayXG": "number (optionnel)"
}
```

**Response :**
```json
{
  "matchId": "string",
  "markets": {
    "homeProb": "number (%)",
    "drawProb": "number (%)",
    "awayProb": "number (%)",
    "bttsProb": "number (%)",
    "over25Prob": "number (%)"
  },
  "model": "blend-poisson-rf-xgb",
  "confidence": "number (10-95)",
  "edge": "number (%)",
  "ml": {
    "homeProb": "number",
    "drawProb": "number",
    "awayProb": "number",
    "trend": "strong_home|home_favored|balanced|away_favored|strong_away",
    "summary": "string"
  }
}
```

### GET `/api/v1/predictions/accuracy`

**Query params :** `trainWindow` (défaut 100), `testWindow` (défaut 20), `stepSize` (défaut 20)

**Response :**
```json
{
  "brierScore": "number",
  "logLoss": "number",
  "accuracy": "number",
  "calibration": [{ "center": 0.15, "meanPredicted": 0.12, "observedFrequency": 0.14, "count": 42 }],
  "sampleSize": "number",
  "period": { "from": "2026-01-01", "to": "2026-08-31", "matchCount": 1500 },
  "markets": {
    "1X2": { "brier": "number", "logLoss": "number", "accuracy": "number", "roi": "number", "sampleSize": "number" },
    "BTTS": { "..." },
    "O25": { "..." }
  },
  "windows": "number"
}
```

### GET `/api/v1/predictions/drift`

**Query params :** `period` (défaut "7d"), `baseline` (défaut "90d")

**Response :**
```json
{
  "drifted": "boolean",
  "summary": "string",
  "markets": [
    { "market": "1x2", "baselineBrier": 0.21, "recentBrier": 0.24, "drift": 0.03, "significant": true }
  ],
  "checkedAt": "ISO date",
  "details": { "recentCount": 150, "baselineCount": 1200, "period": "7d", "baseline": "90d" }
}
```

### GET `/api/v1/predictions/compare`

**Query params :** `versionA` (requis), `versionB` (requis), `period` (défaut "30d")

**Response :**
```json
{
  "comparison": {
    "winner": "A" | "B" | null,
    "confidence": "number (%)",
    "metricsA": { "brierScore": "number", "accuracy": "number", "logLoss": "number", "sampleSize": "number" },
    "metricsB": { "..." },
    "significant": "boolean"
  },
  "period": "30d",
  "sampleSize": { "versionA": 500, "versionB": 480 }
}
```

### GET `/api/v1/predictions/health`

**Response :**
```json
{
  "status": "healthy" | "degraded" | "critical",
  "model": { "active": "v1.0-ensemble", "totalVersions": 3, "lastTrainedAt": "ISO" },
  "metrics": { "brierScore": 0.21, "accuracy": 0.54, "sampleSize": 1200, "period": "monthly" },
  "drift": { "detected": false, "summary": "..." },
  "data": { "totalPredictions": 5000, "settledPredictions": 4200, "pendingPredictions": 800, "lastPredictionAt": "ISO" },
  "catboost": { "enabled": true, "available": true }
}
```

### POST `/api/v1/predictions/alerts`

**Query params :** `period` (défaut "7d"), `baseline` (défaut "90d")

**Response :**
```json
{
  "drift": { "drifted": "boolean", "metrics": [...], "summary": "string" },
  "alerted": "boolean",
  "lastChecked": "ISO date",
  "details": { "recentCount": 150, "baselineCount": 1200 }
}
```

### GET `/api/v1/predictions/alerts`

**Response :**
```json
{
  "alerts": [
    { "level": "warning|critical", "message": "string", "metrics": {...}, "timestamp": "ISO" }
  ],
  "lastChecked": "ISO date",
  "count": "number"
}
```

---

## 5. Configuration

### Variables d'environnement

| Variable | Rôle | Défaut | Notes |
|----------|------|--------|-------|
| `CATBOOST_ENABLED` | Kill-switch pour CatBoost. `true` = bridge actif | `false` | Si absent ou `false`, fallback gracieux sur Poisson/Elo |
| `CATBOOST_PYTHON_BIN` | Chemin vers l'exécutable Python | `.venv-data/Scripts/python.exe` (Win) / `python3` (Linux) | Utilisé par `catboost-bridge.ts` |
| `RF_MODEL_PATH` | Chemin vers le modèle RF sérialisé | `models/rf_football_1x2_v1.json` | Si absent, fallback Elo |
| `DRIFT_WEBHOOK_URL` | URL webhook Slack/Discord pour alertes drift | aucun | POST au format Slack blocks |
| `DRIFT_EMAIL_TO` | Adresse email destinataire pour alertes drift | aucun | Via infrastructure Nodemailer existante |
| `DATABASE_URL` | URL de connexion Prisma (SQLite) | `file:./pariscore.db` | Schema Prisma |
| `DATABASE_PATH` | Chemin DB pour scripts ETL/metrics | `pariscore.db` | Utilisé par `compute-model-metrics.js` et `etl-history-matches.js` |
| `ODDS_API_KEY` | Clé API Odds (BetsAPI/similaire) | requis | Pour les cotes en temps réel |
| `API_FOOTBALL_KEY` | Clé API-Football.com | requis | Données matchs, xG, standings |

---

## 6. Architecture Décisionnelle (ADR)

### ADR-001 : Endpoint de calcul on-demand

**Décision** : POST `/api/v1/predictions/compute` invoque `predictPrematch()` + `predictML()`.
**Rationale** : Le meta-learner ML existait mais n'était appelé par aucune API. POST permet overrides Elo/xG dans le body sans gonfler l'URL. Les deux moteurs (Poisson + ML) sont retournés pour comparison.

### ADR-002 : Bridge CatBoost via subprocess

**Décision** : `catboost-bridge.ts` spawn `python ml/infer_catboost.py` via stdin/stdout JSON.
**Rationale** : Pattern éprouvé (legacy `server.js`). Kill-switch `CATBOOST_ENABLED`. 30s timeout. Alternative ONNX Runtime rejetée (2-3h setup, pas de gain pour 3 modèles).

### ADR-003 : Walk-forward validation

**Décision** : Validation glissante au lieu de k-fold.
**Rationale** : Les données de paris sont temporelles. K-fold crée du data leakage. Walk-forward simule le workflow réel (entraîner sur le passé, prédire le futur). ROI calculé avec cotes réelles.

### ADR-004 : ModelVersion tracking dans Prisma

**Décision** : 3 modèles Prisma (`ModelVersion`, `ModelMetrics`, `PredictionLog`).
**Rationale** : Lifecycle staging→production→archived. Pas de MLflow/W&B (overkill pour ce projet). Un seul query ORM pour performance complète.

### ADR-005 : UI panel compact

**Décision** : `FootballPredictionMarkets` — composant panel 6 marchés intégré dans la card (compact) et le dialog (full).
**Rationale** : Moins de clics, cohérence, toggle "Marchés prédictifs" évite la surcharge cognitive.

### ADR-006 : ETL standalone

**Décision** : `scripts/etl-history-matches.js` peuple `kv['history_matches']` sans boot serveur.
**Rationale** : Le training CatBoost nécessite ce KV. Fusion DB + backtest JSON. De-vig automatique. Poisson snapshot estimé.

---

## 7. Roadmap

### Terminé (Phase 1-3)

| Composant | Statut | Fichiers |
|-----------|--------|----------|
| Moteurs statistiques (Poisson, Dixon-Coles, Elo) | ✅ Production | `engine.ts`, `poisson.ts`, `dixon-coles.ts` |
| ML meta-learner (RF + XGBoost + DC) | ✅ Production | `prediction-ml-engine.ts`, `random-forest.ts` |
| Feature extraction (20 features) | ✅ Production | `ml-features.ts` |
| Bridge CatBoost | ✅ Production | `catboost-bridge.ts` |
| API compute (POST on-demand) | ✅ Production | `compute/route.ts` |
| API accuracy (walk-forward) | ✅ Production | `accuracy/route.ts` |
| API drift detection | ✅ Production | `drift/route.ts` |
| API A/B compare | ✅ Production | `compare/route.ts` |
| API health dashboard | ✅ Production | `health/route.ts` |
| API alerts (drift) | ✅ Production | `alerts/route.ts` |
| Prisma schema (ModelVersion, ModelMetrics, PredictionLog) | ✅ Schema | `schema.prisma` |
| Brier score, log-loss, calibration, RPS | ✅ Production | `brier-score.ts` |
| Walk-forward validation | ✅ Production | `walk-forward.ts` |
| A/B testing (chi-deux) | ✅ Production | `ab-testing.ts` |
| UI FootballPredictionMarkets (6 marchés) | ✅ Production | `football-prediction-markets.tsx` |
| Hook usePredictionCompute (SWR) | ✅ Production | `use-prediction-compute.ts` |
| ETL standalone | ✅ Production | `etl-history-matches.js` |
| Cron retraining | ✅ Production | `cron-retrain-catboost.js` |
| Métriques compute | ✅ Production | `compute-model-metrics.js` |

### En cours (Phase 4)

| Composant | Statut | Notes |
|-----------|--------|-------|
| Calibration chart UI | 🟡 À faire | `calibrationCurve()` prêt, composant React à créer |
| Push PredictionLog au compute | 🟡 À faire | Enregistrer chaque prédiction dans `PredictionLog` pour tracking |
| Walk-forward dans accuracy | 🟡 Amélioration | Baseline fréquentiste actuelle → remplacer par RF/XGB |

### À faire (Phase 5-6)

| Composant | Statut | Notes |
|-----------|--------|-------|
| Dashboard admin (ModelVersion mgmt) | 🔴 Prévu | UI pour promouvoir/archiver des modèles |
| Retraining automatisé post-drift | 🔴 Prévu | Hook : drift détecté → cron retraining |
| CatBoost features étendues | 🔴 Prévu | Ajouter H2H, xG forme, standing positions |
| Intégration live scores → PredictionLog | 🔴 Prévu | Settler les prédictions quand le match est terminé |
| Monitoring Grafana/Prometheus | 🔴 Prévu | Métriques temps réel (optionnel, overkill aujourd'hui) |

---

## 8. Dossier fichiers

```
src/lib/prediction/football/
├── engine.ts                  # Moteur principal (Elo → λ → Poisson → EV)
├── poisson.ts                 # Matrice de scores Poisson
├── dixon-coles.ts             # Dixon-Coles (ρ correlation)
├── prediction-ml-engine.ts    # Meta-learner RF + XGBoost + DC
├── random-forest.ts           # Classifieur RF JS-natif
├── catboost-bridge.ts         # Bridge Python CatBoost
├── ml-features.ts             # Extraction 20 features
├── brier-score.ts             # Métriques calibration
├── walk-forward.ts            # Validation glissante
├── ab-testing.ts              # Comparaison A/B
├── drift-detection.ts         # Détection de drift
├── alerting.ts                # Alertes multi-canal
├── math-utils.ts              # utilitaires numériques
├── types.ts                   # Types partagés
├── engine.test.ts             # Tests moteur
├── poisson.test.ts            # Tests Poisson
├── math-utils.test.ts         # Tests utilitaires
└── metrics.test.ts            # Tests métriques

src/app/api/v1/predictions/
├── compute/route.ts           # POST on-demand
├── accuracy/route.ts          # GET walk-forward metrics
├── drift/route.ts             # GET drift detection
├── compare/route.ts           # GET A/B comparison
├── health/route.ts            # GET health dashboard
└── alerts/route.ts            # GET/POST drift alerts

scripts/
├── etl-history-matches.js     # ETL standalone
├── cron-retrain-catboost.js   # Pipeline retraining
└── compute-model-metrics.js   # Métriques Brier/accuracy

ml/
├── train_catboost.py          # Training CatBoost
└── infer_catboost.py          # Inférence CatBoost

models/
├── catboost_football_1x2_v1.cbm   # Modèle CatBoost
└── rf_football_1x2_v1.json        # Modèle RF sérialisé
```
