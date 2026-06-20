# Plan de Mise en Œuvre — Pariscore

## Métriques de Prédiction Sportive : Pré-Match & Live

*Basé sur la thèse de Kacper Dryja et les bonnes pratiques engineering*

---

## Table des Matières
1. [Vision Globale](#1-vision-globale)
2. [Architecture Technique](#2-architecture-technique)
3. [Phase 1 : Foundation Pré-Match (Semaine 1-2)](#3-phase-1--foundation-pré-match-semaine-1-2)
4. [Phase 2 : Métriques Live (Semaine 3-4)](#4-phase-2--métriques-live-semaine-3-4)
5. [Phase 3 : Multi-Sport & Optimisation (Semaine 5-6)](#5-phase-3--multi-sport--optimisation-semaine-5-6)
6. [Phase 4 : Production & Monitoring (Semaine 7+)](#6-phase-4--production--monitoring-semaine-7)
7. [Glossaire des Métriques à Surveiller](#7-glossaire-des-métriques-à-surveiller)

---

## 1. Vision Globale

### Objectif
Construire un pipeline de prédiction sportive qui :
- **Pré-Match** : atteint ≥76% de précision (benchmark : Random Forest Dryja)
- **Live** : met à jour les probabilités en temps réel à chaque jeu/point clé
- **Rentable** : génère un ROI > 5% en backtesting sur stratégies de paris
- **Multi-sport** : architecture extensible tennis → football → basketball

### Stack Recommandée

| Composant | Technologie | Justification |
|-----------|------------|---------------|
| Langage | **Python 3.12+** | Écosystème ML mature |
| ML | **scikit-learn (RF) + XGBoost** | RF meilleur calibrage, XGBoost compétitif |
| Data Pipeline | **Pandas + Polars** | Volumes historiques importants |
| API | **FastAPI** | Faible latence, WebSocket natif pour live |
| Base de données | **PostgreSQL + TimescaleDB** | Données temporelles, hypertables |
| Cache | **Redis** | États de match en cours, EWMA live |
| Monitoring | **Prometheus + Grafana** | Suivi dérive modèle, performance |
| CI/CD | **GitHub Actions** | Tests automatiques, déploiement |

---

## 2. Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                              │
├──────────────┬──────────────┬───────────────────────────────┤
│  ATP/WTA API │  Live Score  │ Bookmaker Odds (API scraping) │
│  (historique)│  (WebSocket) │                               │
└──────┬───────┴──────┬───────┴──────────────┬────────────────┘
       │              │                      │
       ▼              ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│              FEATURE PIPELINE (Python/Pandas)                │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐                 │
│  │ Pre-Match       │  │ Live             │                 │
│  │ • EWMA S/L      │  │ • EWMA fenêtre   │                 │
│  │ • Elo calc      │  │   glissante 15pt  │                 │
│  │ • SRV_ADV/CMPLT │  │ • SRV_ADV_live   │                 │
│  │ • Momentum      │  │ • Momentum live   │                 │
│  │ • Différentiel  │  │ • Pressure Index  │                 │
│  └────────┬────────┘  └────────┬─────────┘                 │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────────────────────────────┐               │
│  │     Feature Store (PostgreSQL/Redis)    │               │
│  └─────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 MODEL INFERENCE                              │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │ Random      │  │ XGBoost     │  │ Ensemble Voting    │  │
│  │ Forest      │  │ (backup)    │  │ (calibration Platt)│  │
│  │ 600 arbres  │  │ 500 arbres │  │                    │  │
│  └─────────────┘  └─────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   API & PRESENTATION                         │
│                                                             │
│  FastAPI REST + WebSocket → Dashboard Pariscore             │
│  • Pré-match : proba J1 gagne, cote estimée                │
│  • Live : proba évolutive à chaque jeu                      │
│  • Stratégies : recommandation de pari (ROI attendu)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1 : Foundation Pré-Match (Semaine 1-2)

### J1-J3 : Data Acquisition & Pipeline

```
TODO: Intégrer les données historiques ATP/WTA
Sources :
  - Jeff Sackmann Tennis Data (GitHub) → dataset de la thèse
  - ATP/WTA official API → classements, stats joueurs
  - Bookmaker odds historiques → évaluation ROI
```

**Livrables :**
```python
# 1. Data Extractor
src/data/sackmann_loader.py    # Charge les données Sackmann
src/data/atp_api_client.py     # API classements ATP
src/data/odds_parser.py        # Parsing cotes bookmakers

# 2. Schema & Validation
src/schema/match.py             # Dataclass Match, Player, Features
src/schema/validation.py        # Validation Pydantic des données
```

**Critères de succès :**
- [ ] 50 000+ matchs ATP chargés
- [ ] Schéma validé (Pydantic)
- [ ] Tests unitaires > 80%
- [ ] Pipeline reproductible (Makefile + Docker)

### J4-J6 : Feature Engineering (Le Cœur)

```python
# src/features/
__init__.py
ewma.py            # Fonction EWMA générique (α paramétrable)
elo.py             # Calcul Elo global + surface + decay
composed.py        # SRV_ADV, CMPLT, MOMENTUM
differential.py    # Conversion en features différentielles
leakage.py         # API generate_features_for_match()
normalization.py   # Rate-based transformation
pipeline.py        # Pipeline complet pré-match
```

**Le savant dosage de la thèse :**
```
Pour chaque joueur, pour chaque métrique :
  - EWMA court (α=0.18, window=3.5) → réactivité
  - EWMA long  (α=0.05, window=14)  → stabilité
  - Différence court − long          → momentum individuel
  - Puis différentiel JoueurA − JoueurB  → matchup
  - Enfin composé : SRV_ADV, CMPLT, MOMENTUM → features finales
```

**Critères de succès :**
- [ ] Leakage vérifié : pas une seule feature post-match
- [ ] 30+ features pré-match (comme Dryja)
- [ ] Profilage mémoire : feature engineering < 1s/match
- [ ] Tests sur données synthétiques

### J7-J9 : Modélisation & Entraînement

```python
# src/models/
train.py           # Pipeline entraînement time-aware
hyperopt.py        # Grid/Random search hyperparamètres
evaluate.py        # Métriques : Accuracy, ROC AUC, Log Loss, Brier
calibrate.py       # Platt Scaling / Isotonic Regression
infer.py           # Inférence pré-match

# src/strategies/
shorter_price.py   # Cote < 2.0 → parier
threshold.py       # Cote ≥ seuil → parier
agreement.py       # Consensus modèles → parier
backtest.py        # Backtesting historique multi-stratégie
```

**Grille d'hyperparamètres à tester (basée Dryja) :**
```python
rf_params = {
    'n_estimators': [200, 400, 600, 800],
    'max_depth': [5, 8, 10, 12],
    'min_samples_leaf': [2, 4, 8, 16],
    'max_features': ['sqrt', 'log2', None]
}

xgb_params = {
    'n_estimators': [300, 500, 700],
    'max_depth': [3, 5, 7],
    'learning_rate': [0.005, 0.01, 0.05],
    'subsample': [0.7, 0.8, 0.9],
    'colsample_bytree': [0.7, 0.8, 0.9]
}
```

**Time-Aware Cross-Validation :**
```
Window: 5-fold expanding window (pas de shuffle — l'ordre temporel est sacré)
Inner: 3-fold pour tuning hyperparamètres
```

**Critères de succès :**
- [ ] Accuracy pré-match ≥ 67% (overall), ≥ 74% (Grand Chelem)
- [ ] Random Forest calibré (Brier < 0.21)
- [ ] ROI backtest > +2% (stratégie Short Price)
- [ ] Export modèle format ONNX (inférence légère)

### J10 : Intégration API Pré-Match

```python
# src/api/
main.py                # FastAPI app
routes/prematch.py     # GET /predict/prematch/{match_id}
routes/live.py         # WebSocket /predict/live/{match_id}
middleware.py          # Rate limiting, auth, monitoring
models.py              # Pydantic request/response models
```

**Endpoints pré-match :**
```
GET  /predict/pre-match/{player_a_id}/{player_b_id}
     → { prob_a, prob_b, confidence, key_factors: [...] }

GET  /predict/pre-match/{tournament_id}
     → { matches: [{...}], bracket_predictions }

POST /strategy/simulate
     { model, strategy, threshold, bankroll }
     → { roi, profit, sharpe_ratio, max_drawdown }
```

**Critères de succès :**
- [ ] API répond en < 100ms
- [ ] WebSocket connecté, temps réel
- [ ] Documentation OpenAPI complète

---

## 4. Phase 2 : Métriques Live (Semaine 3-4)

### Architecture Live

```
[Flux Live] → [Message Queue (Redis)] → [Feature Engine Live] → [Modèle] → [WebSocket → UI]

où Feature Engine Live = EWMA glissante 15 points
                         + différentiel
                         + SRV_ADV_live
                         + MOMENTUM_live
                         + Pressure Index
```

### J11-J13 : Intégration Flux Live

```python
# src/live/
providers/
  atp_live.py        # ATP Live Scoring (WebSocket/API)
  sportradar.py      # Sportradar (si budget)
  mock_live.py       # Simulateur pour dév (rejoue matchs historiques)

engine.py            # Moteur de features temps réel
ewma_live.py         # EWMA fenêtre glissante 15 points
momentum_live.py     # MOMENTUM live
pressure_index.py    # Break points, tie-breaks, points importants

publish.py           # Publie probas actualisées sur Redis Pub/Sub
```

**Métriques Live à implémenter :**

| Métrique | Fenêtre | Mise à jour | Algorithme |
|----------|---------|-------------|------------|
| SRV_PTS_WON_live | Derniers 15 pts du serveur | Chaque point | EWMA fenêtre glissante |
| RET_PTS_WON_live | Derniers 15 pts du retourneur | Chaque point | EWMA fenêtre glissante |
| SRV_ADV_live | 15 pts | Chaque point | SRV_PTS_WON − RET_PTS_WON_adverse |
| MOMENTUM_live | Court (5pts) vs Long (20pts) | Chaque jeu | Différence EWMA court − long |
| Pressure Index | Match entier | Chaque break/tie-break | Ratio points importants gagnés |
| Fatigue Proxy | Match entier | Chaque jeu | Jeux longs, durée, temps au sol |
| Service Form | 3 derniers jeux de service | Chaque jeu | % 1ères balles, % points gagnés |
| Comeback Score | Set en cours | Chaque jeu | Retour dans le set après break |

### J14-J16 : Inférence Live & Calibration

```python
# src/models/live/
live_inference.py    # Inférence légère (ONNX Runtime)
ensemble_live.py     # Combine RF pré-match + live (poids adaptatifs)
calibration_live.py  # Calibration spécifique live (différente du pré-match)
threshold_live.py    # Détection de retournement (swing detection)
```

**Modèle hybride recommandé :**
```python
# Poids progressif : pré-match dominant au début, live prend le relais
proba_finale = alpha(t) * proba_prematch + (1 - alpha(t)) * proba_live

où alpha(t) = exp(-λ * jeu_courant)
  λ = facteur de transition (typ. 0.1-0.3)
```

**Critères de succès :**
- [ ] Mise à jour proba en < 500ms par point
- [ ] Prédictions live améliorent accuracy pré-match de +3-5%
- [ ] Backtesting sur 500+ matchs rejoués
- [ ] Détection de swing (retournement de match) fiable

### J17 : Dashboard Live

```python
# src/ui/dashboard.py (Streamlit ou React)
components/
  live_card.py       # Carte de match en direct
  proba_gauge.py     # Jauge de probabilité évolutive
  momentum_chart.py  # Graphique momentum live
  swing_alert.py     # Alerte retournement
  strategy_card.py   # Recommendation pari en direct
```

**Vue Dashboard (wireframe concept) :**
```
┌─────────────────────────────────────────────────────────┐
│  🎾 Djokovic vs Alcaraz  │  Set: 6-4, 3-2  │  Live     │
├─────────────────────────────────────────────────────────┤
│  Proba : 62% Djokovic  │  38% Alcaraz                  │
│  ━━━━━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━                   │
│                                                         │
│  Momentum : ↗ Fort Djokovic (+0.32)                    │
│  Serve Advantage : +0.15 Djokovic                       │
│  Pressure Index : 1.4x (normal)                         │
│                                                         │
│  💡 Recommandation : Parier Djokovic (cote 1.72)       │
│  ROI attendu : +8.2%  │  Confiance : Élevée            │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Phase 3 : Multi-Sport & Optimisation (Semaine 5-6)

### J18-J21 : Football

**Adaptation des métriques tennis → football :**

| Tennis | Football |
|--------|----------|
| Serve Advantage | xG differential |
| Completeness | Attaque × Défense |
| Momentum | Forme récente (5 matchs) |
| Elo Surface | Elo domicile/extérieur |
| Break Points | Expected goals (xG) |
| Tie-break | Pénaltys / Corners |

```python
# src/sports/football/
features_football.py    # xG, possession, tirs cadrés
elo_football.py         # Elo avec home/away advantage
momentum_football.py    # Forme 5 matchs, séquence résultats
```

### J22-J25 : Basketball

**Métriques clés basketball :**
```python
# src/sports/basketball/
features_basketball.py  # Points, rebounds, assists, +/- per game
elo_basketball.py       # Elo avec home court advantage
momentum_basketball.py  # Run detection (séquences 10-0)
clutch_index.py         # Performance dans les "clutch minutes"
```

| Tennis | Basketball |
|--------|------------|
| Serve Advantage | Offensive Rating − Defensive Rating |
| Completeness | PER (Player Efficiency Rating) |
| Momentum | Run en cours (points consécutifs) |
| Break Points | Lead changes, biggest lead |
| Fatigue | Back-to-back games, minutes jouées |

### J26-J28 : Optimisation & Backtesting Lourd

```python
# src/optimization/
ensemble_weights.py     # Optimisation des poids d'ensemble
threshold_opt.py        # Seuils de pari optimaux par sport
multi_sport_strategy.py # Allocation bankroll multi-sport
monte_carlo.py          # Simulation Monte Carlo des stratégies
sensitivity.py          # Analyse de sensibilité des features
```

---

## 6. Phase 4 : Production & Monitoring (Semaine 7+)

### J29-J31 : Infrastructure

```yaml
# docker-compose.yml
services:
  pariscore-api:       # FastAPI
  pariscore-worker:    # Celery (entraînement, backtest)
  postgres:            # + TimescaleDB pour données temporelles
  redis:               # Cache, pub/sub live
  grafana:             # Monitoring dashboards
  prometheus:          # Métriques système
```

### J32-J33 : Monitoring ML

```python
# src/monitoring/
feature_drift.py       # Détection de dérive des features (PSI)
model_drift.py         # Suivi accuracy, log loss en production
prediction_logger.py   # Log toutes les prédictions pour analyse
alert_manager.py       # Alertes : dérive > seuil, ROI négatif
dashboard_grafana.py   # Métriques temps réel dans Grafana
```

**Métriques de surveillance en production :**

| Métrique | Seuil d'alerte | Action |
|----------|---------------|--------|
| Accuracy glissante | < 65% | Ré-entraînement |
| Brier Score | > 0.22 | Calibration |
| Feature Drift (PSI) | > 0.1 | Investigation |
| Prédictions/jour | < 100 | Vérifier flux data |
| Latence API | > 500ms | Scaling |
| ROI 30 jours | < 0% | Révision stratégie |

### J34-J35 : Documentation & CI/CD

```yaml
# .github/workflows/
test.yml         # Tests unitaires + intégration
train.yml        # Entraînement automatique (hebdomadaire)
deploy.yml       # Déploiement staging + production
backtest.yml     # Backtesting quotidien
monitor.yml      # Vérification dérive modèle
```

**Documentation :**
```
docs/
  architecture.md     → Architecture technique détaillée
  metrics_prematch.md → Documentation des métriques pré-match
  metrics_live.md     → Documentation des métriques live
  strategies.md       → Stratégies de paris, ROI attendu
  api.md              → Documentation API OpenAPI
  CONTRIBUTING.md     → Guide pour contributeurs
```

---

## 7. Glossaire des Métriques à Surveiller

### Pré-Match (30+ Features)

```
🏆 CATÉGORIE GLOBALE (4 features)
  ├── Elo global               → Rating de force général (baseline 1500)
  ├── Elo surface              → Rating par surface (dur, terre, gazon)
  ├── ATP Rank                 → Classement officiel
  └── ATP Points               → Points ATP non pondérés

🏅 CATÉGORIE COMPOSÉE (3 features — LES + IMPORTANTES)
  ├── SRV_ADV                  → Service Advantage (points gagnés serv − pts gagnés retour)
  ├── CMPLT                    → Completeness (points serv gagnés × points retour gagnés)
  └── MOMENTUM                 → Direction et volatilité forme récente

🎯 CATÉGORIE SERVICE (8 features × 2 échelles EWMA)
  ├── ACE                      → Aces par jeu de service
  ├── DF                       → Double fautes par jeu de service
  ├── 1ST_IN                   → % 1ères balles
  ├── 1ST_WON                  → % points gagnés sur 1ère
  ├── 2ND_WON                  → % points gagnés sur 2nde
  ├── SRV_PTS_WON              → % points de service gagnés
  ├── SRV_GMS_WON              → % jeux de service gagnés
  └── SRV_ADV                  → Pareil mais EWMA

⚡ CATÉGORIE RETOUR (4 features × 2 échelles EWMA)
  ├── RET_PTS_WON              → % points en retour gagnés
  ├── RET_GMS_WON              → % jeux de retour gagnés (breaks)
  ├── BP_CONV                  → % conversion balles de break
  └── BP_SAVED                 → % balles de break sauvées

📊 CATÉGORIE TENDANCE (4 features)
  ├── WINRATE_S                → % victoires sur surface
  ├── TB_WINRATE               → % tie-breaks gagnés
  ├── HAND_WINRATE             → % victoires vs main dominante
  └── H2H                      → Face-à-face historique

📐 CATÉGORIE DÉMOGRAPHIQUE (2 features — faible impact)
  ├── AGE                      → Âge du joueur
  └── HEIGHT                   → Taille du joueur
```

### Live (15+ Features Dynamiques)

```
🔥 MOMENTUM LIVE (6 features)
  ├── MOMENTUM_live            → EWMA court (5pts) − EWMA long (20pts)
  ├── SRV_ADV_live             → Points serv gagnés − pts retour adverse (15pts)
  ├── PRESSURE_INDEX           → Ratio points importants gagnés
  ├── SWING_DETECT             → Changement soudain de momentum (> seuil)
  ├── CONSECUTIVE_GAMES        → Jeux consécutifs gagnés
  └── BREAK_CONV_LIVE          → Breaks convertis dans le match

🎯 SERVICE LIVE (5 features)
  ├── 1ST_IN_LIVE              → % 1ères balles live
  ├── 1ST_WON_LIVE             → % points gagnés 1ère live
  ├── 2ND_WON_LIVE             → % points gagnés 2nde live
  ├── ACE_RATE_LIVE            → Aces par jeu live
  └── DF_RATE_LIVE             → Double fautes par jeu live

⚡ RETOUR LIVE (3 features)
  ├── RET_PTS_WON_LIVE         → % points retour gagnés live
  ├── 2ND_RET_WON_LIVE         → Points gagnés sur 2nde adverse
  └── BP_CHANCES_LIVE          → Balles de break obtenues

🧠 CONTEXTE (4 features)
  ├── FATIGUE_PROXY            → Durée match, jeux longs, température
  ├── TOURNAMENT_PROGRESS      → Tours joués dans le tournoi
  ├── TIME_SINCE_LAST_MATCH    → Heures depuis dernier match
  └── CHALLENGES_REMAINING     → Challenges restants (si applicable)
```

---

## Check-list de Déploiement Pariscore

### Prérequis (Avant Phase 1)
- [ ] Dépôt GitHub créé (`pariscore/`)
- [ ] Python 3.12+ installé, `venv` configuré
- [ ] Données Sackmann téléchargées et accessibles
- [ ] Docker / Docker Compose installé
- [ ] PostgreSQL + TimescaleDB prêts

### Phase 1 : Pré-Match (J1-J10)
- [ ] Pipeline data chargé (50k+ matchs)
- [ ] 30+ features EWMA différentielles créées
- [ ] Time-aware cross-validation fonctionnelle
- [ ] Random Forest atteint ≥67% accuracy overall
- [ ] API REST déployée, endpoint `/predict/pre-match` OK
- [ ] Backtest stratégie Short Price ROI > +2%

### Phase 2 : Live (J11-J17)
- [ ] Flux live mocké (rejeu de matchs historiques)
- [ ] EWMA live fenêtre glissante 15 points OK
- [ ] Inférence live < 500ms
- [ ] Dashboard live affiche probas évolutives
- [ ] Backtest avec 500+ matchs live simulés

### Phase 3 : Multi-Sport (J18-J28)
- [ ] Football : pipeline features + modèle
- [ ] Basketball : pipeline features + modèle
- [ ] Optimisation : stratégie multi-sport backtestée
- [ ] Rapport de sensibilité des features

### Phase 4 : Production (J29-J35)
- [ ] Tests > 90% coverage
- [ ] CI/CD avec entraînement hebdomadaire auto
- [ ] Monitoring dérive (PSI) + alertes
- [ ] Dashboard Grafana pour performance modèle
- [ ] Documentation complète
- [ ] GPU-ready (optionnel, pour XGBoost large-scale)

---

*Plan généré pour Pariscore — Juin 2026*  
*Basé sur : Dryja (2024), Kovalchik (2020), FiveThirtyEight Elo*
