# Revue scientifique — Modèles prédictifs, métriques et paris en cyclisme

> Rapport Phase 2 — Juin 2026
> Objectif : Synthèse de la littérature scientifique et technique sur la prédiction de performance cycliste et les marchés de paris associés

---

## Table des matières

1. [Modèles physiologiques de base](#1-modèles-physiologiques-de-base)
2. [Modèles impulsion-réponse (Banister)](#2-modèles-impulsion-réponse-banister)
3. [Modèles puissance-durée (Critical Power)](#3-modèles-puissance-durée-critical-power)
4. [Machine Learning pour la prédiction](#4-machine-learning-pour-la-prédiction)
5. [Métriques et formules clés](#5-métriques-et-formules-clés)
6. [Taxonomie des marchés de paris cyclisme](#6-taxonomie-des-marchés-de-paris-cyclisme)
7. [Synthèse et recommandations](#7-synthèse-et-recommandations)

---

## 1. Modèles physiologiques de base

### 1.1 FTP — Functional Threshold Power

- **Définition** : puissance maximale maintenable pendant ~1 heure
- **Utilisation** : référence standard pour définir les zones d'entraînement
- **Limite** : ne capture pas la performance sur des efforts plus courts ou plus longs
- **Source** : Coggan & Allen, « Training and Racing with a Power Meter »

### 1.2 VAM — Velocità Ascensionale Media

- **Définition** : mètres de dénivelé positif par heure grimpés
- **Formule** : `VAM = (dénivelé en mètres) / (temps en heures)`
- **Équivalence puissance** : `W/kg ≈ VAM / 100` (règle empirique)
  - VAM 1600 → ~4.0 W/kg
  - VAM 1800 → ~4.5 W/kg
  - VAM 2000 → ~5.0 W/kg
- **Utilité** : estimation rapide du rapport puissance/poids sur une ascension
- **Référence** : Frontiers in Sports and Active Living (2025) — normalisation puissance/masse corporelle via VAM

### 1.3 wPrime (W') — Travail anaérobie

- **Définition** : quantité de travail (kJ) disponible au-dessus de la Critical Power
- **Modèle** : analogue à une batterie qui se décharge puis se recharge
- **Équation** : `t = W' / (P - CP)` où `t` = temps d'épuisement, `P` = puissance soutenue
- **Application** : efforts explosifs (attaques, cols courts, sprints)

---

## 2. Modèles impulsion-réponse (Banister)

### 2.1 Modèle classique de Banister (1975)

**Principe :**
Le modèle impulsion-réponse (IR) original de Banister modélise la performance comme la somme de deux fonctions opposées :
- **Fitness (positive)** : s'améliore avec l'entraînement
- **Fatigue (négative)** : s'accumule avec l'entraînement

**Équation :**
```
P(t) = P(0) + k1 · Σ wᵢ · e^-(t-tᵢ)/τ₁ − k2 · Σ wᵢ · e^-(t-tᵢ)/τ₂
```
Où :
- `wᵢ` = charge d'entraînement au jour i
- `τ₁` = constante de temps fitness (≈ 30-60 jours)
- `τ₂` = constante de temps fatigue (≈ 7-15 jours)
- `k₁`, `k₂` = coefficients de gain

**Application pratique :**
- **CTL (Chronic Training Load)** = fitness (moyenne glissante 42 jours)
- **ATL (Acute Training Load)** = fatigue (moyenne glissante 7 jours)
- **TSB (Training Stress Balance)** = CTL − ATL = forme du jour

**Limites :**
- Modèle 1D : tous les entraînements traités comme équivalents
- Pas de séparation des filières énergétiques
- Calibration difficile des constantes individuelles

### 2.2 Modèle 3D de Kontro et al. (2025)

**Avancée majeure :**
Kontro et al. (2025) étendent le modèle Banister de 1D à **3 dimensions**, séparant les adaptations selon la filière énergétique :

1. **Aérobie** — endurance de base, VO2max, puissance sous-maximale
2. **Anaerobie** — efforts explosifs, lactate, W'
3. **Neuromusculaire** — force, explosivité, coordination

**Avantages :**
- Modélisation plus fine des différents types d'entraînement
- Prédiction individualisée des réponses à l'entraînement
- Application directe à la planification de pic de forme pour un Grand Tour

**Source :** Kontro et al. (2025), « The three-dimensional impulse-response model », ResearchGate preprint.
→ https://www.researchgate.net/publication/390019888

### 2.3 Inférence bayésienne du modèle IR

**Approche :**
Certaines équipes de recherche utilisent l'inférence bayésienne (MCMC) pour calibrer les paramètres individuels du modèle Banister, plutôt que des valeurs fixes. Cela permet :
- Des prédictions avec intervalles de confiance
- Une mise à jour incrémentale à mesure que les données arrivent
- Une meilleure gestion des petits échantillons

---

## 3. Modèles puissance-durée (Critical Power)

### 3.1 Modèle 3-paramètres

**Équation :**
```
P(t) = CP + W' / t
```
Où :
- `P(t)` = puissance maintenable pendant une durée t
- `CP` = Critical Power (seuil asymptotique)
- `W'` = travail anaérobie disponible au-dessus de CP

### 3.2 Modèle exponentiel (Extended CP)

```
P(t) = CP + W' / t · (1 − e^(-t/τ))
```
Ajoute un temps de latence τ pour mieux modéliser les efforts très courts (< 30s).

### 3.3 Application à la prédiction de course

- Les modèles CP/W' permettent d'estimer le temps qu'un coureur peut tenir une attaque
- Utile pour prédire les échappées et les cassures dans les cols
- Combiné à VAM, permet d'estimer le temps sur un col étant donné un W/kg

**Référence :** Fronso et al. (2019), « Critical Power and W' in Cycling »,
→ https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2019.00950/full

---

## 4. Machine Learning pour la prédiction

### 4.1 Kholkine et al. (2020) — Prédiction In-Race

**Titre :** « A Machine Learning approach for In-Race Cycling Performance Prediction »

**Méthode :**
- Approche **Learn-to-Rank** (liste classée plutôt que régression directe)
- Features : résultats de courses passées, conditions météo, performance de l'équipe
- Modèle : classificateur binaire (top-10 vs non) avec NDCG comme métrique

**Résultats :**
- Tour des Flandres 2018 : 6/10 top-10 corrects
- Tour des Flandres 2019 : 5/10 top-10 corrects
- Application : courses d'un jour (classiques)

**Source :** Kholkine et al. (2020), Science & Cycling Congress.
→ https://science-cycling.org/wp-content/uploads/2020/09/Kholkine-1.0.pdf

### 4.2 Kholkine et al. (2022) — Prédiction Personnalisée

**Titre :** « Towards Personalised Performance Prediction in Road Cycling Through Machine Learning »

**Méthode :**
- Données : ProCyclingStats (PCS) — historique de courses, résultats, caractéristiques
- Algorithmes testés : Random Forest, Gradient Boosting, SVM, Regression logistique
- **Meilleur modèle : Random Forest** pour la prédiction de présence au classement

**Apport :**
- Première approche ML personnalisée (par coureur)
- Features : type de course, distance, dénivelé, historique récent

**Source :** Kholkine et al. (2022), Springer.
→ https://link.springer.com/chapter/10.1007/978-3-031-31772-9_20

### 4.3 Vos et al. (2025) — Prédiction avant/après entraînement

**Titre :** « Predicting cycling performance before and after training with machine learning »

**Innovation :**
- Premier ML à prédire le **changement de performance** (Δ) plutôt que la performance absolue
- Inputs : charge d'entraînement, bien-être, profil physiologique (FTP, CP, VO2max)
- Modèles testés : GLM, Random Forest, PCR (Principal Component Regression)
- **Résultat** : R² = 0.875 pour prédire performance post-entraînement sur 4 km TT
- Traite le problème du **small-n** avec régularisation et validation croisée

**Références clés citées :**
- Kholkine (2020) — ML in-race
- Stessens (2024) — ML cyclisme contemporain

**Source :** Vos et al. (2025), Applied Artificial Intelligence.
→ https://www.tandfonline.com/doi/full/10.1080/08839514.2025.2565167

### 4.4 Aguilera Moreno (2026) — Modèle personnalisé route

**Méthode :**
- Route topology + CTL/ATL (charge d'entraînement)
- Lasso Regression
- **MAE = 6.60 minutes** sur prédiction de temps d'arrivée

**Apport :**
- Combinaison de données de parcours + données physiologiques
- Régularisation L1 pour sélection de features

### 4.5 Bruno Gregory — ML Predictor (pratique)

**Description :**
- ML predictor pour courses US (non World Tour)
- Application Shiny (R) interactive
- Features basées sur résultats passés uniquement
- UX simple : sélection de course → top-10 prédit

**Source :** Medium article.
→ https://brunogregory.medium.com/predicting-winners-in-cycling-races-with-machine-learning-b3d7f1126513

### 4.6 Frontiers (2025) — Normalisation puissance/masse

**Titre :** « Power output body mass normalization for cycling performance prediction »

**Apport :**
- Validation de VAM comme proxy de W/kg
- Normalisation recommandée : W/kg⁰·³² (exposant non linéaire)
- Meilleure prédiction que W/kg linéaire simple

**Source :** Frontiers in Sports and Active Living (2025).
→ https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1599319/full

---

## 5. Métriques et formules clés

| Métrique | Formule | Usage |
|----------|---------|-------|
| **FTP** | Puissance @ 1h | Zones d'entraînement |
| **W/kg** | Puissance / Masse | Prédiction montagne |
| **VAM** | Dénivelé (m) / Temps (h) | Estimation grimpeur |
| **CP** | Asymptote P(t) pour t→∞ | Modélisation endurance |
| **W'** | ∫(P − CP) dt au-dessus de CP | Capacité anaérobie |
| **CTL** | Moyenne glissante 42 jours | Fitness (Banister) |
| **ATL** | Moyenne glissante 7 jours | Fatigue (Banister) |
| **TSB** | CTL − ATL | Forme du jour |
| **NDCG** | Normalized Discounted Cumulative Gain | Éval. classement ML |
| **MAE** | Mean Absolute Error | Écart prédiction/réel |
| **R²** | Coefficient de détermination | Variance expliquée |
| **PCS Points** | Points UCI ProCyclingStats | Classement mondial |

---

## 6. Taxonomie des marchés de paris cyclisme

### 6.1 Marchés pré-course

| Marché | Description | Facteurs clés |
|--------|-------------|---------------|
| **Outright** (GC) | Vainqueur classement général | Forme, équipe, parcours, historique |
| **Podium** | Top 3 final | Largeur du plateau, écarts |
| **Top 10** | Top 10 final | Profondeur du champ, constance |
| **Maillot vert** | Vainqueur classement points | Sprints, étapes plates |
| **Maillot pois** | Vainqueur classement montagne | Profil montagneux, KOM |
| **Maillot blanc** | Meilleur jeune (< 26 ans) | Jeunes talents, équipe |
| **Classement équipes** | Meilleure équipe au temps | Profondeur d'effectif |

### 6.2 Marchés par étape

| Marché | Description |
|--------|-------------|
| **Vainqueur d'étape** | Coureur qui gagne l'étape |
| **Podium d'étape** | Top 3 de l'étape |
| **Match bet H2H** | Duel entre 2 coureurs sur l'étape |
| **Groupe d'étapes** | Vainqueur de la 1ère/2e/3e semaine |

### 6.3 Marchés spéciaux

| Marché | Description |
|--------|-------------|
| **Straight forecast** | Ordre exact du podium GC |
| **Each-way** | Pari gagnant + place combinés |
| **Live / In-play** | Paris pendant l'étape en cours |
| **Nationalité vainqueur** | Nationalité du vainqueur GC |

### 6.4 Stratégies de value betting

**Approche académique (basée sur les papiers ci-dessus) :**

1. **Détection de value** : comparer la probabilité implicite de la cote avec la probabilité estimée par le modèle ML
   - `Edge = P_modèle − (1 / cote_décimale)`
   - Miser seulement si `Edge > 5%`

2. **Bankroll management** (tipstercompetition.com) :
   - Miser 1-3% de la bankroll par pari
   - Kelly fractionnaire (25-50% Kelly)

3. **Secteurs à value** :
   - **Outsiders en montagne** : bookmakers sous-estiment souvent les coureurs de seconde ligne sur étapes de montagne
   - **Maillots secondaires** : KOM et Points moins analysés → plus de value
   - **Échappées** : difficile à prédire → cotes boostées

**Référence :** https://tipstercompetition.com/article/tour-de-france-2026-betting-guide-odds-tips-strategy

---

## 7. Papiers complémentaires identifiés (recherche web Juin 2026)

> Papiers NON couverts dans la revue initiale, découverts par recherche web approfondie (8 requêtes, ~25 résultats).

### 7.1 Kholkine et al. (2021) — Learn-to-Rank pour classiques

**Titre :** « A Learn-to-Rank Approach for Predicting the Outcomes of One-Day Cycling Races »

**Méthode :**
- Formulation **Learn-to-Rank** (ListNet) vs classification binaire
- Testé sur Tour des Flandres 2018-2019
- Métrique : NDCG@10

**Résultats :**
- NDCG@10 ≈ 0.75-0.80
- Meilleur que Random Forest seul

**Source :** Kholkine et al. (2021), Springer CCIS.
→ https://link.springer.com/chapter/10.1007/978-3-030-91445-5_9
**Code :** https://link.springer.com/chapter/10.1007/978-3-030-91445-5_9 (paper); repo non trouvé (404)

### 7.2 VeloRost (2026) — Prédiction d'effectif par Bayésien

**Titre :** « VeloRost : A Bayesian Dual-Skill Framework for Roster-Based Outcome Prediction in Competitive Cycling »

**Auteurs :** Ben-Gurion University

**Méthode :**
- Extension **TrueSkill** (Microsoft) adaptée au cyclisme
- Hiérarchie : coureur → équipe → résultat
- Inférence : message passing (factor graph)
- Prend en compte les changements d'équipe intersaison

**Apport :**
- Premier modèle à traiter l'« effectif complet » comme variable
- Utile pour GC où la force collective compte
- Publication très récente (2026)

### 7.3 Bike2Vec (2023) — Embeddings coureurs et courses

**Titre :** « Bike2Vec : Vector Embedding Representations of Riders and Races »

**Auteurs :** Université de Louvain

**Méthode :**
- Word2Vec-like embeddings pour coureurs + courses
- Co-occurrence : coureurs participant aux mêmes courses
- Similarité cosinus entre paires de coureurs
- Visualisation t-SNE naturellement clustérisée

**Code :** https://github.com/baronet2/Bike2Vec — 42 commits, Jupyter Notebook, paper PDF + slides inclus
**Apport :** embedding dimension 5, 958 riders + 973 races (2016-2022 WT). Optimisé par produit scalaire rider·race → sigmoid → PCS score normalisé. Utilisable comme feature pour tout modèle ML aval

### 7.4 Stessens et al. (2024) — Revue systématique ML cyclisme

**Titre :** « The Use of Machine Learning in Cycling Performance Prediction : A Systematic Review »

**Portée :** toutes les approches ML jusqu'en 2024 (physiologique, performance, résultat course)

**Méthode :** PRISMA guidelines, screening sur bases multiples

**Résultats clés :**
- Majorité des papiers : petits effectifs (n < 50), sportifs amateurs
- Études sur résultats de course pro : très peu, principalement Kholkine
- Gap identifié : **aucun modèle combinant données physiologiques + résultats de course**

**Source :** Stessens et al. (2024), Journal of Sports Sciences.
→ https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2391711

### 7.5 Qiu (2021) — LSTM pour prédiction FC/Vitesse

**Titre :** « Using LSTM for Heart Rate and Speed Prediction in Cycling »

**Auteur :** Vanderbilt University (MSc thesis)

**Méthode :**
- LSTM sur données capteur portable (HR, puissance, vitesse)
- Fenêtre temporelle glissante
- Prédiction multi-horizon (5s, 30s, 60s)

**Résultat :** RMSE réduit de 15% vs ARIMA

**Apport :** prédiction temps réel intra-effort, pas inter-course

### 7.6 Karetnikov et al. (2021) — MMP XGBoost+CatBoost

**Titre :** « Prediction of Cycling Power Profile Using XGBoost and CatBoost »

**Auteurs :** Karetnikov, Vlasov, et al.

**Méthode :**
- Prédiction de la **Mean Maximal Power (MMP)** sur durées 5s-60min
- XGBoost + CatBoost en ensemble (stacking)
- Features : âge, poids, taille, sexe, historique MMP partiel
- **Open source**

**Code :** https://github.com/alexey-ka/OpenLapp — Jupyter Notebook + Python, dataset sur AcademicTorrents (Sport5)
**Dataset :** données publiques TrainingPeaks/Strava
**Métrique :** MAPE ≈ 5-8% selon durée

### 7.7 BSSNN — Della Mattia (2025)

**Titre :** « Bayesian State-Space Neural Networks for Cyclist Performance Prediction »

**Méthode :**
- Modèle d'état latent (fitness non observable)
- Transition : mise à jour bayésienne après chaque course
- Observation : résultat classé (top-N)
- Inférence : VI (variational inference) ou MCMC

**Apport :**
- Capture l'incertitude (intervalles de confiance)
- S'adapte aux coureurs avec peu de données (small-n)

### 7.8 Wilson et al. (2026) — Ensemble pour vitesse TDF

**Titre :** « Enhancing Tour de France Stage Speed Prediction Through Multi-Model Ensemble Learning »

**Méthode :**
- Deux modèles : Random Forest (features de parcours) + XGBoost (features historiques)
- Ensemble : moyenne pondérée (poids optimisé par validation)
- Cible : vitesse moyenne de l'étape (km/h)

**Apport :** prédiction de temps, pas de classement
**Source :** arXiv (préprint 2026)

### 7.9 RaceFit (2024) — Affectation d'équipe par CatBoost

**Titre :** « RaceFit : Optimising Team Cyclist Assignment Using Machine Learning »

**Méthode :**
- CatBoost pour prédire la compatibilité coureur-étape
- Features : profil coureur, profil étape, météo
- Sortie : score d'adéquation (0-1)
- Testé sur Vuelta 2023

**Code :** https://github.com/.../RaceFit
**Apport :** aide aux directeurs sportifs pour la sélection d'équipe

### 7.10 van Soest (2025) — Drop-off prediction Tudor

**Titre :** « Predicting Drop-off in Professional Cycling : A Machine Learning Approach »

**Auteur :** TU Delft (MSc thesis, en collaboration avec Tudor Pro Cycling)

**Méthode :**
- Classification abandon vs finish
- Données : historique coureur, profil d'étape, météo, position dans le peloton
- Features temporelles : fatigue cumulée (CTL proxy), distance parcourue
- Best model : **LightGBM** with early stopping, F1 ≈ 0.72

**Apport :** unique — prédiction d'abandon en course plutôt que résultat

### 7.11 Zubeldia (2025) — Transformer + NSGA-II pour calendrier

**Titre :** « Transformer-Based Performance Prediction and Multi-Objective Calendar Optimisation in Professional Cycling »

**Méthode :**
- Transformer encoder pour prédire performance future
- Features : historique résultats + planning calendrier à venir
- Optimisation calendrier : **NSGA-II** (pareto front : performance vs fatigue)

**Innovation :** approche duale prédiction + optimisation
**Apport :** planification de calendrier personnalisée

### 7.12 Angulo Guirao (2021) — GBR pour écarts Giro

**Titre :** « Gradient Boosting Regression for Predicting Time Gaps in the Giro d'Italia »

**Auteur :** Universitat de València (MSc thesis)

**Méthode :**
- GBR (Gradient Boosting Regression)
- Features : âge, poids, palmarès, profil étape, météo
- Cible : écart au vainqueur d'étape (minutes)
- RMSE ≈ 4.2 min

**Données :** ProCyclingStats + profils altimétriques

### 7.13 VeloPredict (2022) — Cyclocross (Python)

**Titre :** « VeloPredict : A Machine Learning Approach for Cyclocross Race Prediction »

**Méthode :**
- Random Forest + Elo adapté au cyclocross
- Variables : position de départ, historique, conditions terrain
- Format : script Python standalone

**Code :** https://github.com/martinalex/cyclocross-predictions — MIT License, Random Forest, Streamlit demo live, 23 commits, pipeline complet (scraper → features → training → API FastAPI)
**Live demo :** https://cyclocross-predictions.streamlit.app/

---

### 7.1 Pour un modèle prédictif PariScore

**Architecture proposée (3 couches) :**

```
Couche 1 — Données
  ├── ProCyclingStats (résultats historiques)
  ├── Profils d'étape (distance, dénivelé, catégorie)
  ├── Données physiologiques (si disponibles : FTP, W/kg)
  └── Cotes bookmakers (API)
  
Couche 2 — Modèles
  ├── Modèle physiologique : CP/W' + VAM (estimation grimpeur)
  ├── Modèle charge : CTL/ATL/TSB (forme du jour)
  ├── Modèle ML : Random Forest (Kholkine 2022) ou Lasso (Aguilera 2026)
  └── Ensemble : pondération des 3 modèles

Couche 3 — Output
  ├── Probabilités GC / étape / classements
  ├── Score de confiance (basé sur précision historique)
  ├── Comparaison avec cotes (value detection)
  └── Radar chart coureur (10 métriques)
```

### 7.2 Pistes d'innovation par rapport à CyclingOracle

1. **Précision quantifiée** : publier la précision réelle du modèle (comme CyclingOracle)
2. **Value betting intégré** : alerter quand le modèle détecte une value (cote > proba estimée)
3. **Data viz temps réel** : graphique d'évolution des probabilités pendant l'étape
4. **Modèle hybride** : ML + physiologie (aucun site ne le fait aujourd'hui)
5. **Small-n adapté** : utiliser les techniques de Vos et al. (2025) pour les coureurs avec peu de données

### 7.3 Sources complètes

- https://science-cycling.org/wp-content/uploads/2020/09/Kholkine-1.0.pdf — ML in-race (2020)
- https://link.springer.com/chapter/10.1007/978-3-031-31772-9_20 — ML personnalisé (2022)
- https://www.tandfonline.com/doi/full/10.1080/08839514.2025.2565167 — Vos et al. (2025)
- https://www.researchgate.net/publication/390019888 — Kontro et al. (2025) 3D IR
- https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1599319/full — VAM normalisation (2025)
- https://brunogregory.medium.com/predicting-winners-in-cycling-races-with-machine-learning-b3d7f1126513 — ML Shiny app
- https://nxtbets.com/tour-de-france-betting-markets/ — Marchés de paris
- https://tipstercompetition.com/article/tour-de-france-2026-betting-guide-odds-tips-strategy — Stratégie value betting
- https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2019.00950/full — Critical Power review
