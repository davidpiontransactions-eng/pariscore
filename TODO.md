# Pariscore — TODO

**Mission** : Systeme complet de prediction de paris tennis (ATP Top 10) avec API FastAPI + UI React
**Workflow** : `python run.py <commande>` (train | api | generate | pipeline)
**Modele** : `models/pariscore_rf_v1.joblib` — Random Forest sur TennisMyLife 2023-2026 (12 595 matchups, 18 features)
**Charte graphique** : v3 — dark mode (#0b0e17), Poppins/Inter, tokens CSS dans `frontend/src/styles/tokens.css`

---

## Etat d'avancement

| Module | Statut | Notes |
|--------|--------|-------|
| Backend API (FastAPI) | ✅ Complete | /health, /predict, /features/generate, /strategy/simulate |
| Feature Engineering | ✅ Complete | EWMA, calculators, pipeline (18 features, valide Session 3) |
| Modele (Random Forest) | ✅ Complete | 600 arbres, Platt scaling, TimeSeriesSplit CV |
| UI React (Tier 2) | ✅ Complete | MatchCard, PredictionOverview, KeyFactors, dark theme v3 |
| Tests unitaires | ✅ Complete | conftest, test_features, test_models, test_api, test_strategies |
| pytest.ini | ✅ Complete | Marqueurs slow/api, decouverte automatique |
| Dockerfile | ✅ Complete | python:3.12-slim, uvicorn production |
| docker-compose.yml | ✅ Complete | api + frontend avec hot-reload |
| CI/CD (GitHub Actions) | ✅ Complete | Backend (tests + smoke) + Frontend (typecheck + build) |
| Documentation (TODO.md) | ✅ Complete | Tableau de bord etat d'avancement |

---

## Prochains sprints

- [ ] Tier 3 : Mode Live / WebSocket (Redis pub/sub, WS /live/{match_id})
- [ ] Tier 4 : Strategies de pari (backtesting reel avec vrais matchs) + ecran H2H + dashboard
- [ ] Ameliorations modele : XGBoost/LightGBM, hyperparametres, + d annees TennisMyLife
- [ ] Monitoring : logs structures, alerting, métriques Prometheus
- [ ] Tests de charge : k6 ou locust sur les endpoints critiques
