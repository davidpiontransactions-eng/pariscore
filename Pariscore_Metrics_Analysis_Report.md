# Analyse des Métriques de Prédiction Sportive — Rapport Pariscore

**Source :** *Data-Driven Prediction of ATP Tennis Match Outcomes Using Machine Learning Techniques*  
**Auteur :** Kacper Dryja (Vrije Universiteit Amsterdam, 2024)  
**Date d'analyse :** 17 Juin 2026

---

## 1. Résumé Exécutif

Ce rapport analyse la thèse de Kacper Dryja sur la prédiction des matchs ATP par apprentissage automatique. L'étude démontre qu'un **Random Forest bien feature-engineering atteint 76,4% de précision sur les Grand Chelems** — quasiment à égalité avec les bookmakers (76,5%) — et génère des **ROI positifs (+2,17% à +10,33%)** sur stratégies de paris, prouvant que le marché n'est pas parfaitement efficace.

**Les 4 piliers de la prédiction :**
1. **Métriques composées** (Serve Advantage, Completeness, Momentum) > statistiques brutes
2. **EWMA bi-temporel** (court terme α=0.18, long terme α=0.05)
3. **Cote Elo** (global + par surface) > classement ATP
4. **Forêts aléatoires** > XGBoost pour le calibrage probabiliste

---

## 2. Métriques Pré-Match (Features Design)

Toutes les métriques sont **différentielles** (Joueur1 − Joueur2) : une valeur proche de zéro indique un match équilibré.

### 2.1 Groupes de Features

| Groupe | Métriques | Rôle |
|--------|-----------|------|
| **Démographique** | AGE, HEIGHT | Valeur prédictive faible ; consistent avec Van Rooij [6] |
| **Classement & Global** | ATP_RANK, ATP_PTS, ELO, ELO_SURFACE | Elo surpasse ATP_RANK (Kovalchik [3]) |
| **Composées** | SRV_ADV, CMPLT, MOMENTUM | Les plus importantes selon l'analyse |
| **Win Rates** | WINRATE_S, TB_WINRATE, HAND_WINRATE, H2H | Contextuels |
| **Service (EWMA S/L)** | ACE, DF, 1ST_IN, 1ST_WON, 2ND_WON, SRV_PTS_WON, SRV_GMS_WON | Noyau de la performance |
| **Retour & Pression (EWMA S/L)** | RET_PTS_WON, RET_GMS_WON, BP_CONV, BP_SAVED | Capacité à breaker |

### 2.2 Métriques Composées (Les Plus Importantes)

| Métrique | Formule | Pourquoi c'est critique |
|----------|---------|------------------------|
| **Serve Advantage (SRV_ADV)** | `SRV_PTS_WON(A) − RET_PTS_WON(B)` | Capture l'interaction service/retour ; pouvoir prédictif > composants seuls |
| **Completeness (CMPLT)** | `SRV_PTS_WON × RET_PTS_WON` | Récompense les joueurs complets (Federer, Djokovic) |
| **Momentum (MOMENTUM)** | `(1/N) × Σ sign(m_i) × |m_i|` où m_i = EWMA_court − EWMA_long | Capture la direction et volatilité de la forme récente |
| **Elo Surface** | Elo séparé pour dur, terre battue, gazon | Essentiel : Nadal terre battue ≠ Nadal gazon |

### 2.3 Transformation EWMA

Deux fenêtres temporelles — le secret de la robustesse :

```
EWMA_court  : α = 0.18  (demi-vie ≈ 3.5 matchs) → forme récente
EWMA_long   : α = 0.05  (demi-vie ≈ 14 matchs)  → tendance stable
```

**Pourquoi EWMA plutôt que moyenne simple :** évite les discontinuités quand une donnée sort de la fenêtre.

### 2.4 Leakage Prevention

Architecture critique : générer les features **avant** le match avec `generate_features_for_match()`, puis mettre à jour l'état **après** le match. Sans ça, le modèle « voit le futur » et ses performances en conditions réelles s'effondrent.

---

## 3. Métriques Live / In-Play

⚠️ **La thèse ne couvre PAS le live.** Les données utilisées (Sackmann's dataset) n'ont que des stats par match, pas par point.

**Cependant, on peut extrapoler les principes :**

### 3.1 Extrapolation Live depuis les Features Pré-Match

| Principe Pré-Match → | Équivalent Live |
|---------------------|----------------|
| EWMA court terme (3.5 matchs) | EWMA **intra-match** (phénomènes de 5-10 jeux) |
| Momentum inter-matchs | Momentum **in-match** (séquence de jeux gagnés, breaks consécutifs) |
| Serve Advantage statique | Serve Advantage **live** (évolution au fil du match) |
| Win Rates par surface | Win Rates **par condition de match** (score, set, fatigue) |

### 3.2 Métriques Live Proposées

#### Groupe Score & Momentum
- **Score courant** : `{sets}, {jeux}, {points}` dans le jeu actuel
- **Break points convertis** dans le match
- **Séquence de jeux consécutifs** gagnés
- **Momentum Fenêtre Glissante** : EWMA des 10-30 derniers points

#### Groupe Service (Live)
- **% 1ères balles** dans le match
- **% points gagnés sur 1ère / 2nde balle** live
- **Aces / Double fautes** taux live
- **Points gagnés au service** live

#### Groupe Retour (Live)
- **% points gagnés en retour** live
- **Taux de conversion de break points** live
- **Points gagnés sur 2nde balle adverse** live

#### Groupe Avancé (Modélisation)
- **Serve Advantage Live** : `SRV_PTS_WON_live − RET_PTS_WON_adverse_live`
- **Momentum Score** : différence EWMA court/long sur les points live
- **Fatigue Proxy** : durée du match, nombre de jeux longs, température
- **Pressure Index** : ratio de points importants gagnés (break points, tie-breaks)

#### Groupe Contextuel
- **Wireless / challenges restants** (effet psychologique)
- **Temps depuis dernier match** (fatigue cumulée dans le tournoi)
- **Head-to-Head live** (confiance psychologique)

### 3.3 Architecture Live Recommandée

```
[Flux data live] → [EWMA fenêtre glissante window=15 points]
                 → [Différentiel Joueur A − Joueur B]
                 → [Features composées live (SRV_ADV_live, MOMENTUM_live)]
                 → [Modèle RF/XGBoost inféré en temps réel]
                 → [Cote dynamique / probabilité de victoire]
```

---

## 4. Modèles ML : Comparatif

### Résultats Globaux

| Modèle | Accuracy | ROC AUC | Log Loss | Brier |
|--------|----------|---------|----------|-------|
| Decision Tree | 0.6611 | 0.7234 | 0.6118 | 0.2117 |
| Logistic Regression | 0.6756 | 0.7440 | 0.5948 | 0.2048 |
| Random Forest | 0.6748 | 0.7402 | 0.5985 | 0.2063 |
| **XGBoost** | **0.6767** | **0.7448** | **0.5942** | **0.2046** |

### Résultats Grand Chelem (2010-2024)

| Modèle | Accuracy | ROC AUC | Log Loss | Brier |
|--------|----------|---------|----------|-------|
| Decision Tree | 0.7347 | 0.8138 | 0.5283 | 0.1768 |
| Logistic Regression | 0.7468 | 0.8271 | 0.5133 | 0.1712 |
| **Random Forest** | **0.7642** | **0.8525** | **0.4876** | **0.1600** |
| XGBoost | 0.7518 | 0.8352 | 0.5054 | 0.1676 |
| **Bookmakers** | **0.7653** | **0.8452** | **0.4888** | 0.1608 |

### Résultat Clé
Le **Random Forest bat les bookmakers** sur ROC AUC, Log Loss et Brier Score aux Grand Chelems. C'est inattendu — le boosting était censé dominer. Explication : XGBoost est sur-confiant dans ses probabilités.

### Hyperparamètres Optimaux

| Modèle | Hyperparamètres |
|--------|----------------|
| Decision Tree | min_samples_leaf=30, max_depth=5 |
| Logistic Regression | C=0.215, penalty=L1 |
| Random Forest | n_estimators=600, min_samples_leaf=4, max_features=sqrt, max_depth=10 |
| XGBoost | subsample=0.8, n_estimators=500, max_depth=5, learning_rate=0.01, lambda=1, gamma=0.2, colsample_bytree=0.8 |

---

## 5. Stratégies de Paris et ROI

| Stratégie | Modèle | ROI | Profit Net |
|-----------|--------|-----|-----------|
| Short Price (cote < 2.0) | Random Forest | **+2.17%** | +1 616 € |
| Threshold (cote ≥ 1.71) | Random Forest | **+10.33%** | +2 113 € |
| Threshold (cote ≥ 3.97) | Random Forest | +7.33% | +3 578 € |
| Agreement (seuil=0.76) | RF seul | +4.32% | +1 147 € |
| Agreement (seuil=0.76) | RF+XGB+LR | +2.29% | +679 € |

**Leçons :**
- **Seuil modéré (cote ~1.71) maximise le ROI** (+10.33%)
- **Seuil élevé maximise le profit absolu** (+3 578 €)
- **Accord entre modèles réduit le nombre de paris** → ROI plus faible
- **Seul le Random Forest est rentable** systématiquement

---

## 6. Conclusions pour Pariscore

### Ce qui marche (Pre-Match)
1. ✅ **Random Forest** — meilleur calibrage, ROI positif, robuste
2. ✅ **Serve Advantage + Completeness + Momentum** — features composites > stats brutes
3. ✅ **EWMA bi-temporel** — capture forme récente + tendance
4. ✅ **Elo surface-spécifique** — indispensable pour le tennis
5. ✅ **Grands Chelems** — plus prédictibles (+9 points d'accuracy)

### Ce qui manque (Pistes Live)
1. ❌ Données point-à-point (Hawk-Eye) — difficiles d'accès
2. ❌ Momentum intra-match — pas dans les données Sackmann
3. ❌ Fatigue et contexte physique — non modélisés
4. ❌ Statistiques par set — pas disponibles
5. ❌ Modélisation des surfaces en live — pas explorée

### Recommandations Architecture Pariscore

**Stack Technique Suggérée :**
```
[API de données historiques] → [Feature Pipeline Python]
                                     ↓
[Entraînement]   Random Forest (600 arbres) + XGBoost (500 arbres)
[Calibration]    Platt Scaling / Isotonic Regression
[Inférence]      API REST temps réel (FastAPI)
[Live Update]    WebSocket → mise à jour des probas à chaque jeu/point
```

**Phases de Développement :**
1. **Phase 1** (Pré-Match) : Répliquer le pipeline Dryja sur tennis, puis football, basketball
2. **Phase 2** (Live) : Intégrer flux temps réel, EWMA fenêtre glissante
3. **Phase 3** (Multi-sport) : Adapter les features composées par sport
4. **Phase 4** (Optimisation) : Stratégies de paris, backtesting, UI

---

## 7. Références Clés de la Thèse

| Réf | Auteur | Contribution |
|-----|--------|-------------|
| [3] | Kovalchik | Elo surpasse ATP rankings pour les Grands Chelems |
| [6] | Van Rooij | Features démographiques (âge, taille) peu prédictives |
| [12] | Sackmann | Dataset historique ATP (données utilisées dans la thèse) |
| [15] | Clarke & Dyte | Modèles de prédiction tennis fondateurs |
| [21] | Gu & Ryzhov | EWMA pour features séquentielles |
- Thèse : `https://www.cs.vu.nl/~wanf/theses/dryja-bscthesis.pdf`

---

*Rapport généré pour Pariscore — Juin 2026*
