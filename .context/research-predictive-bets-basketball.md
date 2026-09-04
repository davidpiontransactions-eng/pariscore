# Rapport Recherche : Bets Prédictifs Basketball (Prematch & Live)

**Date :** 2026-09-04  
**Périmètre :** Concurrents betting AI + revues académiques 2024-2026

---

## 1. Synthèse des Sources

### 1.1 Concurrents (GitHub / Apps production)

| Projet | Approche | Accuracy | Méthode clé |
|--------|----------|----------|-------------|
| **whisdev/NBA-prediction** | XGBoost ONNX moneyline + totals | ~69% validation | EV + Kelly criterion |
| **mc156-lgtm/nba-betting-model** | XGBoost spread/totals/moneyline | 95% accuracy (overfit?) | Ridge regression player props |
| **chris-munch.dev** | Gradient boosting end-to-end | 62.1% (2024) | Feature engineering + Streamlit |
| **MatchOdds-AI** | LLM multi-agent debate + RAG | Brier 0.2263 (CoT) | 6 data sources, ChromaDB |
| **Sport-suite (untitled114)** | Stacked LightGBM 134 features | Production | 11 sportsbooks, TimescaleDB |

### 1.2 Revues Académiques (2024-2026)

| Paper | Journal | Méthode | Résultat clé |
|-------|---------|---------|--------------|
| **In-Play Outcome Prediction** (2025) | J. Prediction Markets | ML + SHAP | 74% accuracy globale, 63-90% in-play |
| **Uncertainty-Aware NBA** (2026) | Information (MDPI) | LSTM + MC dropout | Calibration > XGBoost, moneyline ROI positif |
| **Playing the Odds** (2026) | J. Youth Impact | LLM agentic + Kelly | Brier + market returns |
| **Real-time NBA predictions** (2020) | Physica A | Gamma process | Over/under betting positif |
| **XGBoost NBA Calibration** (2026) | DataField.dev | XGBoost + isotonic | ECE réduit 30-50%, ROI +53-55% |

---

## 2. Types de Bets Prédictifs

### 2.1 Prematch (avant tip-off)

| Bet Type | Description | Modèle typique | Edge |
|----------|-------------|----------------|------|
| **Moneyline** | Gagnant du match | XGBoost/LightGBM classification binaire | 2-5% vs marché |
| **Spread (Handicap)** | Marge de victoire | Régression (MAE 2.37 pts) | Modèle prédit mieux que le spread bookmaker |
| **Total Points (O/U)** | Points combinés | XGBoost régression | Edge sur marchés sous-efficients |
| **Team Total** | Points d'une équipe | Ridge regression | complémentaire au total |
| **Winner + Margin** | Gagnant + écart | Classification multi-classes | Plus risqué mais plus de value |

### 2.2 Live (pendant le match)

| Bet Type | Description | Timing | Données |
|----------|-------------|--------|---------|
| **Live Winner** | Révision probabilité gagnant | Après chaque quart | Score, momentum, fautes |
| **Live O/U Adjusted** | Total révisé en cours | Mi-temps, Q3 | Pace actuel vs prédit |
| **Next Quarter Winner** | Gagnant du prochain quart | Fin de quart | Momentum, rotation |
| **Live Spread** | Handicap ajusté | En cours | Score + temps restant |
| **Run/Momentum** | Prochain passage en score | Temps réel | séquence de points |

---

## 3. Architecture Modèle Recommandée

### 3.1 Features (d'après littérature)

**Four Factors (Dean Oliver) — les plus importants :**
1. **eFG%** (Effective Field Goal %) — tirs efficaces
2. **TOV%** (Turnover Rate) — ballons perdus
3. **FT Rate** — lancers francs
4. **ORB%** (Offensive Rebound %) — rebonds offensifs

**Features supplémentaires (validation académique) :**
- Elo rating (pré-match)
- Pace (possessions par match)
- Rest days (jours de repos)
- H2H (head-to-head récent)
- Home/Away splits
- Rolling form (L5, L10, L20 games)
- Shot chart embeddings (pour live)
- Bookmaker spread (feature importante !)

### 3.2 Pipeline Modèle

```
Données → Feature Engineering → XGBoost/LightGBM → Calibration (Isotonic) → EV + Kelly → Signal
```

**Calibration critique** : Les probabilités brutes XGBoost sont surconfiantes. Isotonic regression réduit l'ECE de 30-50%.

### 3.3 Live Model Updates

D'après le paper "In-Play Outcome Prediction" (2025) :
- Feature importance change au cours du match
- Q1 : Elo + pace dominent
- Q2+ : Score margin + momentum dominent
- SHAP révèle que les features varient avec le temps

---

## 4. Stratégie de Betting

### 4.1 Kelly Criterion (formule)

```
f* = (bp - q) / b
où b = cote décimale - 1, p = probabilité modèle, q = 1 - p
```

**Fractional Kelly recommandé :** 0.3x (contrôle le risque)

### 4.2 EV Threshold

- **Minimum EV > 1.1** pour placer un pari
- EV = p × odds > 1.1
- Filtre lesopportunités à faible edge

### 4.3 Bankroll Management

- Unit = 1-2% du bankroll
- Max 5% par jour
- Stop-loss à -10% du bankroll

---

## 5. Application à PariScore FIBA WC

### 5.1 3 Bets Recommandés

**Prematch (non-live) :**
1. **Moneyline Predict** — Gagnant avec probabilité calibrée + edge vs marché
2. **Total Predict** — Over/Under points totaux avec spread ajusté
3. **Winner + Spread** — Gagnant + marge prédite

**Live (match en cours) :**
1. **Live Winner** — Probabilité révisée après chaque quart
2. **Live Total Adjusted** — Total révisé basé sur pace actuel
3. **Momentum Bet** — Prochain passage en score

### 5.2 Données Disponibles (PariScore)

- ✅ Four Factors (eFG%, TOV%, FT%, ORB%)
- ✅ Elo ratings
- ✅ Pace
- ✅ H2H
- ✅ Rolling form
- ✅ API ESPN en temps réel
- ⚠️ Odds simulées (pas de vraies cotes)

---

## 6. Sources

1. whisdev/NBA-prediction-sports-betting — GitHub
2. mc156-lgtm/nba-betting-model — GitHub (2025)
3. MatchOdds-AI — GitHub (2026)
4. Sport-suite — GitHub (2026)
5. "In-Play Outcome Prediction of an Ongoing Basketball Game Using ML" — J. Prediction Markets (2025)
6. "Uncertainty-Aware ML for NBA Forecasting" — Information MDPI (2026)
7. "Playing the Odds: Agentic LLMs for Real-Time NBA" — J. Youth Impact (2026)
8. "Making real-time predictions for NBA" — Physica A (2020)
9. XGBoost NBA Case Study — DataField.dev (2026)
