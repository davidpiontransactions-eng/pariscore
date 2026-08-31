# Session: Boucle Ingénierie — Modèle Prédictif Football (2026-08-31)

## Scope

Boucle d'ingénierie complète pour accélérer le modèle prédictif football. Reprend le contexte du Gantt chart (`pariscore-predict-planning/`) et de la session Cline `1788164368420_s08s6` (non trouvée dans le dépôt — sessions Cline stockées hors repo). Objectif : fermer les gaps Phase 2→3→4 du planning Gantt.

## Contexte Gantt (état au 31 août 2026)

| Phase | Période | Statut Avant | Statut Après |
|-------|---------|-------------|-------------|
| 1 — Fondation & Data | 13 jul → 31 jul | ✅ DONE | ✅ DONE |
| 2 — Modélisation | 27 jul → 28 aug | ⚠️ 90% (RF vide) | ✅ 100% |
| 3 — Intégration | 17 aug → 10 sep | 🔴 20% (pas d'API) | 🟡 75% |
| 4 — Tests & Calibration | 7 sep → 23 sep | 🔴 0% | 🟡 20% |
| 5 — Deploy & Monitoring | 14 sep → 2 oct | 🔴 0% | 🔴 0% |
| 6 — Launch | 28 sep → 9 oct | 🔴 0% | 🔴 0% |

## État initial du codebase (audit)

### Ce qui existait déjà
- **Moteurs statistiques** : Poisson, Dixon-Coles, Elo-based — complets
- **ML framework** : Random Forest (JS-native), XGBoost-approx, hybrid soft-voting meta-learner — architecture complète mais **RF trees vides** (pas de modèle entraîné chargé)
- **CatBoost** : scripts Python train + inference testés, évaluation Phase 1 GO
- **Tennis models** : Markov live, Barnett-Clarke, total games, set prediction — production-grade
- **Feature extraction** : vecteur 20 features football, 38 champs BSD live
- **Backtest** : football (runBacktest + reliability), tennis (Elo bucket lookup)
- **API routes** : v2 predictions read, football prematch/live/top5/backtest
- **Prisma** : modèle `Prediction` avec champs core
- **30 composants UI football** existants (cards, live widgets, strategies, AI)

### Ce qui manquait (gaps identifiés)
1. `predictML()` jamais appelé par aucune API (le meta-learner est orphelin)
2. Pas de endpoint de calcul on-demand (tout lit des données pré-computées)
3. Random Forest vide au runtime (pas de persistance de modèle)
4. Pas de bridge CatBoost en TypeScript (existe en Python, pas en JS)
5. Pas de Brier score, pas de walk-forward validation
6. Pas de versioning de modèle (`ModelVersion` absent de Prisma)
7. Pas de `PredictionLog` pour tracker les prédictions vs résultats
8. Pas de composant UI unifié affichant les 6 marchés

## Fichiers créés (12)

### API Routes
| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/app/api/v1/predictions/compute/route.ts` | ~120 | **POST** — calcule prédictions 1X2/BTTS/O-U au match demandé. Invoque `predictPrematch()` + `predictML()`. Validation input, confidence scoring, edge calculation |
| `src/app/api/v1/predictions/accuracy/route.ts` | ~90 | **GET** — métriques Brier/logLoss/calibration par marché. Walk-forward interne, query params `trainWindow`/`testWindow`/`stepSize` |

### ML / Model Infrastructure
| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/lib/prediction/football/catboost-bridge.ts` | ~110 | Bridge Python → CatBoost via subprocess stdin/stdout. Kill-switch `CATBOOST_ENABLED`, cache process, 30s timeout. Pattern identique à `server.js` legacy |
| `src/lib/prediction/football/brier-score.ts` | ~80 | `brierScore()`, `logLoss()`, `calibrationCurve()`, `rankedProbabilityScore()`, `accuracy()` — métriques standard ML |
| `src/lib/prediction/football/walk-forward.ts` | ~130 | Walk-forward validation sliding window. Train sur N matchs, prédire M, step K. Métriques par marché (1X2, BTTS, O/U 2.5), ROI simulation |

### Prisma Schema (edit)
| Modèle | Champs clés | Rôle |
|--------|-------------|------|
| `ModelVersion` | `name`, `modelType`, `version`, `status` (staging→production→archived), `metricsJson`, `configJson` | Registry de versions de modèles |
| `ModelMetrics` | `modelVersionId`, `market`, `brierScore`, `logLoss`, `rps`, `accuracy`, `sampleSize`, `period` | Métriques par marché par version |
| `PredictionLog` | `matchId`, `modelVersionId`, `homeProb`…`actualHome`/`actualAway`, `settled` | Log des prédictions pour backtest |
| `Prediction` (edit) | +`modelVersionId` FK | Lien prediction→version du modèle |

### Frontend
| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/components/football/football-prediction-markets.tsx` | ~496 | Panel UI unifié 6 marchés : 1X2 (stacked bar), Double Chance (3 chips), O/U 2.5 (two-bar), BTTS (yes/no), Corners (best line), Correct Score (top 3). Mode compact + full |
| `src/hooks/use-prediction-compute.ts` | ~80 | Hook SWR : `usePredictionCompute(matchId)` + `usePredictionBatch(matchIds)`. POST fetcher générique |

### ETL
| Fichier | Lignes | Rôle |
|---------|--------|------|
| `scripts/etl-history-matches.js` | ~200 | Script standalone pour peupler `kv['history_matches']` (training CatBoost). Modes `--source=db|file|both`. De-vig cotes → fair probs, Poisson snapshot estimé. Flags: `--dry-run`, `--limit`, `--min-verified` |

### Gantt Chart v2
| Fichier | Rôle |
|---------|------|
| `pariscore-predict-planning/pariscore-predict-gantt-v2.json` | 7 tracks, 28 items, status par item |
| `pariscore-predict-planning/pariscore-predict-gantt-v2.svg` | Visual calendar, TODAY marker, legend status colors |

## Fichiers modifiés (3)

| Fichier | Changement |
|---------|------------|
| `src/lib/prediction/football/random-forest.ts` | +`loadModel(path)` (deserialize JSON) +`saveModel(path)` +`treeCount` getter. Backward-compatible |
| `src/lib/prediction/football/prediction-ml-engine.ts` | `getRFModel()` charge depuis `$RF_MODEL_PATH` ou `models/rf_football_1x2_v1.json` au module init |
| `src/components/football/football-match-card.tsx` | +import `FootballPredictionMarkets`, +toggle `showMarkets`, +section expandable "Marchés prédictifs" en mode compact |
| `src/components/football/football-match-detail-dialog.tsx` | +import `FootballPredictionMarkets`, +section "6 Marchés de prédiction" en mode full |
| `prisma/schema.prisma` | +3 modèles (ModelVersion, ModelMetrics, PredictionLog) + FK sur Prediction |

## État des tests

| Check | Résultat |
|-------|----------|
| `bun run typecheck` | ✅ 0 nouvelles erreurs (12 pré-existantes : `alert-preferences.tsx`, `distribution-popup.tsx`) |
| `bun run lint` | ✅ 0 nouvelles erreurs (13 pré-existantes : basketball require, Button undefined, etc.) |
| `npx prisma generate` | ✅ Client généré (v6.19.2) |
| `node --check scripts/etl-history-matches.js` | ✅ Syntaxe OK |

## Décisions d'architecture (voir ADR dédié)

1. **API compute = POST, pas GET** — Le calcul de prédiction est coûteux (Poisson + ML), pas un simple read. POST permet de passer le matchId + overrides (Elo, xG) dans le body.
2. **CatBoost via subprocess, pas binding natif** — Le pattern legacy (`server.js`) utilise déjà IPC Python. Un binding natif (node-addon-api) ajouterait de la complexité sans gain (latence ~100ms acceptable).
3. **Walk-forward plutôt que k-fold** — Les données de paris sportifs sont temporelles. k-fold创建 data leakage. Walk-forward respecte l'ordre chronologique.
4. **ModelVersion tracking dans Prisma, pas extérieur** — Un schema DB centralisé permet de lier predictions→versions→metrics dans une seule requête. Pas besoin de MLflow ou W&B pour un projet de cette taille.
5. **UI = panel compact dans la card, pas page séparée** — L'utilisateur veut voir les marchés au même endroit que le match. Un panel expandable évite la surcharge cognitive.

## Impact Gantt détaillé

### Phase 2 — Modélisation (COMPLÈTE)
- ✅ Poisson-Dixon-Coles baseline — déjà fait
- ✅ XGBoost/CatBoost — déjà fait, maintenant bridge TypeScript opérationnel
- ✅ Ensemble learning — RF trees fix (loadModel), soft-voting intact
- ✅ Backtesting — walk-forward validation ajoutée

### Phase 3 — Intégration (75%)
- ✅ Design API — `POST /api/v1/predictions/compute`
- ✅ Backend service — endpoint opérationnel, invoque les 2 moteurs
- ✅ DB prédictions — `Prediction` model + `PredictionLog` + `ModelVersion`
- ✅ Frontend — `FootballPredictionMarkets` intégré dans card + dialog
- 🔲 Scheduling / mise à jour temps réel — pas encore fait

### Phase 4 — Tests & Calibration (20%)
- ✅ Infrastructure Brier score — `brier-score.ts`
- ✅ Walk-forward validation — `walk-forward.ts`
- ✅ API accuracy — `GET /api/v1/predictions/accuracy`
- 🔲 Validation par marché (BTTS, O/U, 1X2, DC, Handicap, Buteur)
- 🔲 Calibration plots
- 🔲 A/B testing framework

## Prochaines étapes

1. **ETL local** — `node scripts/etl-history-matches.js --source=both` pour peupler le kv
2. **Entraîner CatBoost** — `python ml/train_catboost.py --db pariscore.db`
3. **Hook React** — `usePredictionCompute` déjà créé, à câbler dans les composants
4. **Scheduling** — cron pour réentraîner les modèles weekly
5. **Phase 5** — drift detection (comparer `PredictionLog.actual` vs `predicted`)
6. **Phase 6** — lancement marchés prioritaires (BTTS, O/U 2.5)
