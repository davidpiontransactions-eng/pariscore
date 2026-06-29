# Pariscore — TODO

**Mission** : Système complet de prédiction de paris tennis (ATP Top 10) avec API FastAPI + UI React
**Stack** : FastAPI + scikit-learn + React + Vite
**Modèle** : models/pariscore_rf_v1.joblib — Random Forest (600 arbres, max_depth=10, Platt scaling)
**Données** : Sackmann ATP 2023-2026 → 9 039 matchups propres, 18 features
**Version API** : 1.1.0

---

## ✅ Done

| Module | Notes |
|--------|-------|
| Backend API | /health, /predict (singleton + batch), /features/generate, /strategy/simulate, /tennis/* |
| Feature engineering | EWMA, calculators, pipeline (18 features) |
| Modèle RF | 600 arbres, Platt scaling, TimeSeriesSplit CV, Brier=0.0327 |
| Calibration | 96/100 correct (96%), Brier 0.0327 |
| Bug duplicats (C-03) | NaN match_num → fallback non-unique. Fix: tourney_date dans match_id + filtre safety |
| Pipeline feature | run_pipeline.py → 9 039 matchups, 0 duplicats, 0 corrompus |
| Endpoint batch vectorisé | POST /predict/batch — 1 call predict_proba pour N matchups |
| UI React (Tier 2) | MatchCard, PredictionOverview, KeyFactors, Draw view, dark theme |
| Tests unitaires | conftest, test_features, test_models, test_api, test_strategies |
| Responsive mobile (375×812) | TournamentBar, RoundTabs, MatchRow, Draw view OK |
| Audit QA frontend | bugs-01.md — A-01 corrigé, A-02 vérifié, B-01 validé, C-01/C-02 OK |
| Docker / docker-compose | python:3.12-slim + uvicorn, hot-reload |
| CI/CD (GitHub Actions) | Backend (tests + smoke) + Frontend (typecheck + build) |
| snake_case frontend | Tournament type, MatchesTab, PreMatch — toutes les inconsistances corrigées |
| PreMatch.tsx | Supprimé DEMO_MATCHES, null selected handling, 3 empty states |
| Dead code cleanup | sampleMatches.ts supprimé |
| tennisExplorer fallback | camelCase→snake_case conversion ajoutée |
| types/index.ts | Commentaires pour atp_points_6m (champs info-only) |
| Race condition prediction | AbortController dans PreMatch.tsx + pariscore.ts |
| Race condition fetchMatches | cancelled flag dans useEffect |
| model_loaded tracking | Lu depuis /health, affiché dans l'UI |
| Loading skeletons | Composants avec animation CSS shimmer |
| Code-splitting | Vendor chunks + React.lazy pour Dashboard |
| Bundle size | <500KB par chunk |
| Debug logs | 2 console.log retirés de usePlayerData.ts |
| Backend main.py | sys.path.insert pour chargement modèle |
| run.py | reload=False (évite double-load) |
| MatchFeatures | Marqué deprecated |
| /predict/pre-match | Prédictions réelles, model_loaded: true |
| /predict/batch | Vectorisé, fonctionnel |
| /health | Status, model_loaded, version 1.1.0, registry |
| /features/generate | Validation format Sackmann, retour 400 avec message |
| .gitignore | models/, dev scripts, generated data |

---

## 🔄 In Progress

| Item | Status |
|------|--------|
| Tennis scraper (TennisExplorer) | DNS bloqué dans l'environnement — pas un bug de code |

---

## 🔜 Next Up

### N-01 : Kelly Criterion + backtesting stratégie
- Remplacer le placeholder dans /strategy/simulate (ligne 156-167)
- Implémenter Kelly : f* = (p*b - q) / b
- Backtesting sur 500+ matchups avec cotes BET365
- **Fichiers** : src/api/main.py, nouveau src/strategies/

### N-02 : Benchmark endpoint batch
- Comparer /predict/pre-match (séquentiel, ~3s/req) vs /predict/batch (vectorisé)
- Tester N=50, 100, 200, 500, 1000
- Calculer speedup réel (attendu : 10-50×)

### N-03 : Matrice de confusion 500+ échantillons
- Tirer 500+ matchups aléatoires du CSV
- Comparer prob_a vs target par bin de confiance
- Calibration curve, Brier par bin, reliability diagram

### N-04 : Accélération batch aiohttp
- Script client qui envoie N requêtes concurrentes
- httpx/asyncio
- Comparer : séquentiel vs aiohttp (N=10) vs batch vectorisé

---

## 📋 Backlog

### M-01 : Bloquer API synchrone pour batch
- Interdire /predict/pre-match pour >5 matchups
- Rediriger vers /predict/batch avec message

### M-02 : Documenter bug C-03 dans docs/bugs-01.md
- Cause racine, fix, validation (0 duplicats)

### M-03 : Tester /strategy/simulate
- value_betting, kelly, bankroll=10000
- Remplacer les placeholders par du vrai backtesting

### M-04 : Refactor predict_batch.py
- Mesure temps batch + speedup vs séquentiel
- Calibration curve
- Export CSV

### L-01 : Mode Live / WebSocket
- Redis pub/sub, endpoint WS /live/{match_id}, UI temps réel

### L-02 : Dashboard stratégies
- Historique paris simulés, ROI, drawdown, Sharpe, filtres

### L-03 : Améliorations modèle
- XGBoost/LightGBM vs RF, grid search, données 2022+, feature importance

### L-04 : Monitoring production
- Logs JSON, Prometheus, alerting dérive calibration

### L-05 : Tests de charge
- k6/locust — seuil <500ms P95 batch (N=50), <100ms P99 /health

### L-06 : Mode hors-ligne
- Service worker cache, fallback UI, dernière calibration connue

---

## 📊 Métriques Clés

| Métrique | Valeur | Cible |
|----------|--------|-------|
| Précision calibration | 96.0% | >90% |
| Brier score | 0.0327 | <0.05 |
| Précision >90% confiance | 80/80 (100%) | >95% |
| Matchups propres | 9 039 | >10 000 |
| Temps inférence (singleton) | ~3s/req | <1s |
| Temps inférence (batch 200) | ? | <5s total |
| Erreurs API (timeout 15s) | 1/20 (5%) | <1% |

---

## 🚧 Bloqueurs Connus

| Bloqueur | Impact | Solution |
|----------|--------|----------|
| TennisExplorer.com DNS bloqué | Scraping live impossible | Fallback mock / API alternative |
