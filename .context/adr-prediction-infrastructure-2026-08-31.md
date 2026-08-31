# ADR: Infrastructure du Modèle Prédictif Football (2026-08-31)

## ADR-001: Endpoint de calcul on-demand (POST /api/v1/predictions/compute)

### Statut
Accepté

### Contexte
Le meta-learner ML (`predictML()`) existait dans le code mais n'était jamais invoqué par aucune API. Toutes les routes lisaient des données pré-computées de BSD. Pas de moyen de calculer des prédictions à la volée pour un match donné.

### Décision
Créer un endpoint POST qui invoque `predictPrematch()` (Poisson engine) + `predictML()` (RF + XGBoost + Dixon-Coles soft voting) et retourne les probabilités calibrées.

### Justification
- **POST而不是GET** : Le calcul est coûteux (Poisson matrix 8×8 + ML inference). POST permet de passer des overrides (Elo, xG) dans le body sans gonfler l'URL.
- **Les deux moteurs** : Poisson seul = baseline. ML blend = amélioration attendue de +2-4% Brier. L'API retourne les deux pour comparison.
- **Confidence scoring** : Basé sur l'écart Elo + convergence des modèles. Utile pour le filtering UI.

### Conséquences
- Le frontend peut maintenant calculer des prédictions pour des matchs sans prédiction BSD pré-existante
- Le hook `usePredictionCompute` (SWR) gère le cache et le dédup
- Coût : ~50-100ms par calcul (Poisson dominant)

---

## ADR-002: Bridge CatBoost via subprocess Python

### Statut
Accepté

### Contexte
CatBoost est un modèle ML Python. Le projet utilise déjà ce pattern dans `server.js` (legacy) avec IPC Python. Un binding natif (node-addon-api) ajouterait de la complexité de build sans gain significatif.

### Décision
Maintenir le pattern subprocess : `catboost-bridge.ts` spawn `python ml/infer_catboost.py`, envoie les features via stdin JSON, reçoit les prédictions via stdout JSON.

### Justification
- **Pattern éprouvé** : `server.js:26948-27086` utilise déjà ce mécanisme
- **Kill-switch** : `CATBOOST_ENABLED=true` dans .env. Si false ou Python absent → fallback gracieux sur Poisson/Elo
- **Cache process** : Le process Python est réutilisé (pas de respawn par requête)
- **30s timeout** : Protection contre les hangs Python

### Conséquences
- Dépendance runtime : Python + catboost + scikit-learn dans l'env
- Alternative évaluée et rejetée : ONNX Runtime (conversion CatBoost→ONNX = 2-3h de setup, pas de gain pour 3 modèles)
- Les modèles `.cbm` doivent être présents dans `models/` (entraînés via `ml/train_catboost.py`)

---

## ADR-003: Walk-forward validation (pas k-fold)

### Statut
Accepté

### Contexte
Les données de paris sportifs sont intrinsèquement temporelles. Un match d'octobre 2025 ne doit pas être utilisé pour prédire un match de septembre 2025. Le k-fold classique crée du data leakage temporel.

### Décision
Implémenter une validation walk-forward avec sliding window : entraîner sur N matchs, prédire les M suivants, avancer de K matchs.

### Justification
- **Respect temporel** : Train = passé, test = futur. Aucun leakage.
- **Realisme** : Simule le workflow réel (entraîner sur l'historique, prédire le prochain match)
- **ROI réel** : Inclut le calcul de ROI avec cotes réelles, pas juste Brier score
- **Calibration** : La courbe de calibration est calculée sur chaque fenêtre test

### Conséquences
- Besoin de suffisamment de données historiques (minimum ~200 matchs pour une première évaluation)
- Le script `etl-history-matches.js` est le point d'entrée pour peupler les données
- Les métriques sont moins optimistes que k-fold (réalité vs optimisme de validation croisée)

---

## ADR-004: ModelVersion tracking dans Prisma

### Statut
Accepté

### Contexte
Pas de moyen de tracer quel modèle a produit quelle prédiction. Pas de versioning, pas de métriques historiques. Impossible de comparer les performances entre versions.

### Décision
Ajouter 3 modèles Prisma : `ModelVersion` (registry), `ModelMetrics` (métriques par marché), `PredictionLog` (log des prédictions avec outcomes).

### Justification
- **Un seul query** : `Prediction` → `ModelVersion` → `ModelMetrics` = performance complète en 1 requête ORM
- **Lifecycle** : `staging` → `production` → `archived` = promotion contrôlée des modèles
- **Pas de MLflow/W&B** : Pour un projet de cette taille, un schema Prisma suffit. MLflow = overkill (Docker, tracking server, UI séparée)
- **PredictionLog** : Permet de calculer les métriques réelles post-hoc (comparer predicted vs actual)

### Conséquences
- `npx prisma migrate` nécessaire en dev (pas fait dans cette session, schema-only)
- Les métriques sont calculées à la volée via l'API accuracy, pas stockées en batch (optimisation future)
- Le model registry pourra être étendu pour le tennis/CS2/MMA

---

## ADR-005: UI = panel compact dans la card (pas page séparée)

### Statut
Accepté

### Contexte
Les 6 marchés de prédiction (1X2, DC, O/U 2.5, BTTS, Corners, Correct Score) existent dans les données mais sont dispersés dans l'UI (badges, widgets, dialogs séparés). Pas de vue unifiée.

### Décision
Créer `FootballPredictionMarkets` — un composant panel avec 6 sections (2×3 grid) intégré dans la match card (mode compact) et le detail dialog (mode full).

### Justification
- **Moins de clics** : L'utilisateur voit les 6 marchés sans navigation
- **Cohérence** : Un seul composant, pas 6 badges dispersés
- **Mode compact/full** : Adapte l'info au contexte (card = résumé, dialog = détail)
- **Toggle** : "Marchés prédictifs" expandable évite la surcharge cognitive pour les users qui veulent juste le score

### Conséquences
- Le composant existant `MatchPredictiveCard` est complété, pas remplacé (il affiche le ML verdict)
- Le toggle ajoute une ligne de state (`showMarkets`) dans la card
- Futur : ce composant pourra être utilisé dans les pages ligue, les comparaisons, etc.

---

## ADR-006: ETL standalone pour training CatBoost local

### Statut
Accepté

### Contexte
Le training CatBoost nécessite `kv['history_matches']` dans `pariscore.db`. Ce kv n'est peuplé que par `archivePastMatches()` au boot du serveur. Pas de moyen de peupler les données sans lancer le serveur complet.

### Décision
Script Node.js standalone `scripts/etl-history-matches.js` qui lit les sources de données (DB archive_matches + fichiers backtest JSON) et écrit directement dans le kv.

### Justification
- **Pas de dépendance serveur** : Le script tourne indépendamment
- **Fusion intelligente** : `--source=both` fusionne DB + backtest, dédup par matchId
- **De-vig automatique** : Convertit les cotes close en probabilités fair (ลบ margin bookmaker)
- **Poisson snapshot** : Estime les probs Poisson pour les records qui n'en ont pas (λ depuis les fair probs)

### Conséquences
- Le training CatBoost peut maintenant se faire localement sans boot serveur
- Les données JSON de backtest (`data/top5-backtest/*.json`) sont une source complémentaire
- Le script est lintable et testable indépendamment
