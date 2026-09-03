# Session Tennis ML v2.0 - 2026-08-27

## Résumé de la Session

**Objectif** : Remplacer le modèle Elo+Forme statique par un modèle XGBoost surface-spécifique avec walk-forward backtesting rigoureux.

**Statut** : Infrastructure complète créée, problèmes d'API xgboost à résoudre.

---

## ✅ Ce qui a été Fait

### 1. Structure Module `src/lib/prediction/tennis-ml/`
| Fichier | Description |
|---------|-------------|
| `types.ts` | Types unifiés (MatchFeatures, ModelConfig, TrainingResult, WalkForwardResults, CalibrationResult, etc.) |
| `data-loader.ts` | Téléchargement/parsing Sackmann ATP/WTA (2000-2025), tennis-data.co.uk odds, jointure |
| `elo-surface.ts` | Elo global + surface-specific avec time decay (λ=0.95), K=20 |
| `features.ts` | 40+ features différentielles (A-B) calculées incrémentalement (walk-forward compatible) |
| `model.ts` | XGBoost trainer + predictor ONNX, DEFAULT_MODEL_CONFIGS par surface |
| `walkforward.ts` | Expanding + Rolling window validation, gap=7j, calibration intégrée |
| `calibration.ts` | Platt Scaling + Isotonic Regression, auto-selection |
| `metrics.ts` | LogLoss, AUC, Brier, ECE, Accuracy, Precision, Recall, F1 |
| `backtest-report.ts` | Générateur HTML (Chart.js) + JSON pour API |
| `index.ts` | Export principal |

### 2. Scripts (`scripts/`)
| Script | Usage |
|--------|-------|
| `download-sackmann.ts` | Télécharge ATP/WTA matches + rankings (2000-2025) |
| `download-odds.ts` | Télécharge tennis-data.co.uk odds historiques (2020+) |
| `train-tennis-ml.ts` | Entraînement complet + walk-forward + rapports |
| `run-backtest.ts` | Exécution backtest seul (mode expanding/rolling/both) |
| `monitor-calibration.ts` | Monitoring production hebdo (ECE, LogLoss, Brier, alerts) |

### 3. API Routes (`src/app/api/tennis/`)
| Route | Description |
|-------|-------------|
| `ml-predictions/route.ts` | GET ?matchId=... → probA, probB, confidence, model_version |
| `ml-backtest/route.ts` | GET ?surface=Hard → rapports JSON/HTML |

### 4. Intégration UI
| Fichier | Changement |
|---------|------------|
| `src/lib/tennis-top5.ts` | Ajout métrique `mlWinner` (🤖 XGBoost v2.0) dans TENNIS_TOP5_METRICS |
| `src/components/tennis/ml-model-badge.tsx` | NOUVEAU - Badge version/accuracy/AUC/ECE/calibration status |
| `COMPONENTS.md` | Ajout `ml-model-badge` dans registre |

### 5. Tests
| Fichier | Couverture |
|---------|------------|
| `tests/tennis-ml-features.spec.ts` | Features, Elo, form, surface, H2H, serve stats, rankings, market, normalization |
| `tests/tennis-ml-walkforward.spec.ts` | Expanding/rolling folds, gap, splitWithGap, mean/std |

### 6. Configuration
- `package.json` : Ajout `xgboost@^1.1.0`, `onnxruntime-node@^1.18.0`
- Bead créé : `ParisScorebis-1t5x` (P1, claimed)

---

## ⚠️ Problèmes à Résoudre (Priorité Haute)

### 1. API xgboost@1.1.0 Incompatible
Le code utilise l'API xgboost v3 (`DMatrix`, `Booster.train`, `Booster.predict`, `Booster.load`, `Booster.getScore`) mais **xgboost@1.1.0 a une API complètement différente**.

**Options** :
- **A** : Réécrire `model.ts` et `walkforward.ts` pour l'API xgboost@1.1.0
- **B** : Utiliser un wrapper Python (subprocess) pour l'entraînement, garder inférence JS
- **C** : Passer à LightGBM (API plus stable) ou utiliser ONNX Runtime direct
- **D** : Compiler xgboost from source avec Node-API v3 (complexe sur Windows)

### 2. Erreurs TypeScript (20+ erreurs)
- `FEATURE_NAMES` et `DEFAULT_ELO_CONFIG` non exportés depuis `types.ts` (sont dans `features.ts` et `elo-surface.ts`)
- `CalibrationResult` non exporté depuis `calibration.ts`
- `computeCalibrationCurve` non exporté
- `updateElo`, `applyTimeDecay` non exportés
- `PlayerState`, `PlayerStates` non exportés
- Conversions `Record<string, unknown>` problématiques sur `MatchFeatures` / `SackmannMatch`
- `oddsA`/`oddsB` possibly null dans features.ts
- `CachedPayload` type mismatch dans ml-predictions/route.ts

---

## 📋 Plan pour Demain

### Matin (30-60 min) : Fix xgboost
1. Vérifier l'API exacte de xgboost@1.1.0 : `const xgb = require('xgboost'); console.log(Object.keys(xgb));`
2. Choisir approche : **Recommandation = Option B (Python wrapper)** pour robustesse
   - Script Python `train_xgb.py` utilisant xgboost natif + joblib/ONNX export
   - Node.js appelle via `bun.spawn` ou `child_process`
   - Inférence reste en JS avec ONNX Runtime

### Matin (30 min) : Fix Exports TypeScript
- Déplacer `FEATURE_NAMES` vers `types.ts` ou exporter depuis `features.ts`
- Exporter `DEFAULT_ELO_CONFIG` depuis `elo-surface.ts`
- Exporter `CalibrationResult`, `computeCalibrationCurve` depuis `calibration.ts`
- Exporter `updateElo`, `applyTimeDecay` depuis `elo-surface.ts`
- Fix `CachedPayload` dans ml-predictions/route.ts
- Fix conversions `Record<string, unknown>` avec `as unknown as Record<string, unknown>`

### Après-midi : Tests & Validation
1. `bun run typecheck` → 0 erreurs
2. `bun run lint` → 0 erreurs (ignorer les 3 erreurs pre-existantes basketball)
3. `bun test tests/tennis-ml-features.spec.ts`
4. `bun test tests/tennis-ml-walkforward.spec.ts`
5. Test download : `bun run scripts/download-sackmann.ts` (peut prendre 10-20 min)
6. Test entraînement : `bun run scripts/train-tennis-ml.ts --surface=Hard`

---

## 🔧 Commandes Utiles pour Reprise

```bash
# Reprendre le bead
cd C:\Users\David\ZCodeProject\pariscore
bd show ParisScorebis-1t5x

# Vérifier l'API xgboost
node -e "const xgb = require('xgboost'); console.log(Object.keys(xgb));"

# Typecheck seulement le module tennis-ml
bunx tsc --noEmit src/lib/prediction/tennis-ml/**/*.ts

# Lint seulement les nouveaux fichiers
bunx eslint src/lib/prediction/tennis-ml/ scripts/*.ts src/app/api/tennis/ml-*.ts src/components/tennis/ml-model-badge.tsx

# Tests
bun test tests/tennis-ml-features.spec.ts
bun test tests/tennis-ml-walkforward.spec.ts
```

---

## 📁 Fichiers Clés à Revoir

1. **`src/lib/prediction/tennis-ml/model.ts`** - Réécrire pour xgboost@1.1.0 API
2. **`src/lib/prediction/tennis-ml/walkforward.ts`** - Adapter imports xgboost
3. **`src/lib/prediction/tennis-ml/index.ts`** - Fix exports manquants
4. **`src/lib/prediction/tennis-ml/features.ts`** - Fix conversions Record + null checks
5. **`src/app/api/tennis/ml-predictions/route.ts`** - Fix CachedPayload type
6. **`src/lib/tennis-top5.ts`** - Vérifier mlWinner integration

---

## 💡 Notes Importantes

- Les données Sackmann sont ~500MB (26 ans × ATP+WTA). Téléchargement une seule fois.
- Le walk-forward sur toutes surfaces prend ~30-60 min (réentraîne modèle par fold).
- Pour dev rapide : tester sur une surface seulement (`--surface=Hard`) et réduire `n_estimators`.
- L'API BSD fournit déjà des prédictions ; le modèle ML les remplacera/supplantera via `mlWinner` metric.
- Le badge `ml-model-badge` s'intègre dans le widget Top5 ou page match detail.

---

## 🎯 Definition of Done (Rappel)

| Critère | Cible | Status |
|---------|-------|--------|
| Accuracy surface-specific | Hard ≥78%, Clay ≥75%, Grass ≥76% | ⏳ |
| AUC-ROC | ≥0.85 | ⏳ |
| Log Loss | ≤0.55 | ⏳ |
| Brier Score | ≤0.20 | ⏳ |
| ECE Calibration | ≤0.03 | ⏳ |
| CLV vs Closing Line | >0% | ⏳ |
| ROI flat stake | >5% | ⏳ |
| Latence inférence | <10ms/match (ONNX) | ⏳ |
| Tests | 100% pass | ⏳ |
| Quality Gates | lint + typecheck = 0 | ❌ |

---

**Prochaine session** : Commencer par fix xgboost API → typecheck → tests → download data → train.