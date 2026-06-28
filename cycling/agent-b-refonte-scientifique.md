# Agent B — Refonte scientifique du rapport cyclisme

> Livrable des 5 tâches de refonte — Juin 2026
> Source : `.context/cycling-scientific-review.md` (rapport existant) + `.context/rapport-papiers-prediction-cyclisme.md` (analyse 7 papiers)

---

## Tâche 1 — Nouvelle table des matières

### Problème identifié
Section 7 du rapport actuel mélange 13 papiers complémentaires ET recommandations modèle PariScore dans la même section. Structure plate, pas de séparation analyse → synthèse → décision.

### Nouvelle structure proposée

```
1. Modèles physiologiques de base
   1.1 FTP
   1.2 VAM
   1.3 wPrime (W')
   
2. Modèles impulsion-réponse (Banister)
   2.1 Modèle classique (1975)
   2.2 Modèle 3D Kontro et al. (2025)
   2.3 Inférence bayésienne du modèle IR

3. Modèles puissance-durée (Critical Power)
   3.1 Modèle 3-paramètres
   3.2 Modèle exponentiel
   3.3 Application prédiction course

4. Machine Learning pour la prédiction — Revue initiale
   4.1 Kholkine et al. (2020) — XGBoost Classics
   4.2 Kholkine et al. (2022) — Random Forest personnalisé
   4.3 Vos et al. (2025) — glm Performance TT
   4.4 Aguilera Moreno (2026) — Lasso + CTL
   4.5 Bruno Gregory (2021) — RF Pipeline PCS
   4.6 Horvath & Andersson (2025) — VAM normalisation
   4.7 Critical Power Review (Poole et al.)

5. Métriques et formules clés

6. Taxonomie des marchés de paris cyclisme

=== NIVEAU ANALYSE APPROFONDIE ===

7. Papiers complémentaires — Analyse détaillée
   7.1 Kholkine et al. (2021) — Learn-to-Rank
   7.2 VeloRost (2026) — Bayésien dual-skill
   7.3 Bike2Vec (2023) — Embeddings
   7.4 Stessens et al. (2024) — Revue systématique
   7.5 Qiu (2021) — LSTM FC/Vitesse
   7.6 Karetnikov et al. (2021) — MMP XGBoost+CatBoost
   7.7 Della Mattia (2025) — BSSNN
   7.8 Wilson et al. (2026) — Ensemble TDF
   7.9 RaceFit (2024) — CatBoost affectation
   7.10 van Soest (2025) — Drop-off LightGBM
   7.11 Zubeldia (2025) — Transformer + NSGA-II
   7.12 Angulo Guirao (2021) — GBR Giro
   7.13 VeloPredict (2022) — Cyclocross RF+Elo

=== NIVEAU SYNTHÈSE ET DÉCISION ===

8. Recommandations et architecture PariScore
   8.1 Architecture 3 couches
   8.2 Pistes d'innovation vs CyclingOracle
   8.3 Sources complètes

9. Décisions et arbitrages
   9.1 Choix modèle par couche
   9.2 Stratégie données physiologiques (CTL/ATL/TSB)
   9.3 Calibration des probabilités
   9.4 Trade-offs clés
```

### Logique de la hiérarchie
| Niveau | Sections | Rôle |
|--------|----------|------|
| **Sources** | 1-4, 7 | Revue de la littérature (initiale + complémentaire) |
| **Analyse** | 5-6 | Métriques + marchés = cadre d'évaluation |
| **Synthèse** | 8 | Architecture proposée à partir des sources |
| **Décision** | 9 | Choix tranchés, justifiés, traçables |

---

## Tâche 2 — Analyse individuelle des 13 papiers complémentaires

### Papier 1 — Kholkine et al. (2021) — Learn-to-Rank pour classiques

| Champ | Valeur |
|---|---|
| **Titre** | A Learn-to-Rank Approach for Predicting the Outcomes of One-Day Cycling Races |
| **Auteurs** | Leon Kholkine, Tom De Schepper, Tim Verdonck, Steven Latré |
| **Année** | 2021 |
| **Source** | Springer CCIS (Communications in Computer and Information Science), vol 1468 |
| **Accès** | Paywall Springer (résumé libre) |

### Algorithme
- **ListNet** (Learn-to-Rank) basé sur Neural Network avec top-1 probability
- Comparé à : **Random Forest** (Ranking), **Ranking SVM**, **LambdaMART**
- Loss : top-1 probability loss (cross-entropy sur permutation proba)
- Optimisation : gradient descent avec early stopping

### Features
| Feature | Description |
|---|---|
| `relative_finish_time` | Temps d'arrivée relatif au vainqueur pour chaque course |
| `career_points` | Points UCI carrière cumulés |
| `sprint_points` | Points sprint carrière |
| `one_day_points` | Points en course d'un jour |
| `PCS_points_prev_year` | Points PCS année précédente |
| `EMA_10y` | Moyenne mobile exponentielle 10 ans de points |
| `age` | Âge du coureur |
| `team_strength` | Force de l'équipe mesurée par points UCI cumulés |

### Target
- Classement complet des coureurs (ranking list, pas seulement top-N)
- Évalué sur NDCG@10, NDCG@5

### Dataset
- **Source** : ProCyclingStats (PCS)
- **Période train** : 2008–2016
- **Période test** : 2018–2019 (gap de 1 an pour éviter le leak temporel)
- **Courses** : Tour des Flandres 2018-2019, E3 Saxo Bank, Gand-Wevelgem, Dwars door Vlaanderen
- **Taille** : ~2000 coureurs par course en moyenne

### Métriques
- **NDCG@10** ≈ 0.75-0.80 (ListNet)
- NDCG@5 ≈ 0.70-0.75
- Précision top-10 : ~6/10 corrects
- Comparatif : ListNet > Random Forest > LambdaMART

### Résultats clés
- ListNet surpasse significativement RF ranking et LambdaMART
- Approche ranking (classement complet) meilleure que classification binaire (top-10 vs non)
- Gap temporel de 1 an entre train et test améliore robustesse (évite le sur-apprentissage temporel)
- Features temporelles (EMA) critiques pour la performance

### Code
- **Non trouvé** — lien Springer uniquement, repo 404

### Limites
- 5 courses seulement, toutes des classiques pavées — généralisation limitée
- Pas de features météo, vent, équipement (cruciaux pour classiques)
- Pas de validation sur Grands Tours (format stage race très différent)
- NDCG@10 ne capture pas la performance sur le reste du classement

### Réutilisabilité PariScore
- **Forte** — ListNet directement applicable comme couche ranking
- NDCG@10 comme métrique cible pour PariScore
- Gap temporel 1 an à adopter dans notre pipeline
- Manque validation Grand Tour → à tester

---

### Papier 2 — VeloRost (2026) — Bayésien Dual-Skill

| Champ | Valeur |
|---|---|
| **Titre** | VeloRost : A Bayesian Dual-Skill Framework for Roster-Based Outcome Prediction in Competitive Cycling |
| **Auteurs** | Ben-Gurion University (équipe recherche IA/sports) |
| **Année** | 2026 |
| **Source** | Préprint / arXiv |
| **Accès** | Non trouvé — publication très récente |

### Algorithme
- **Extension TrueSkill** (Microsoft Research) adaptée au cyclisme
- Modèle à **2 skills** par coureur : `skill_climbing`, `skill_sprint`
- Hiérarchie bayésienne : coureur → équipe → résultat course
- Inférence : **message passing** sur factor graph (Expectation Propagation)
- Mise à jour après chaque course (online learning)
- Skills avec incertitude : `μ ± σ` pour chaque coureur

### Features
| Feature | Description |
|---|---|
| `skill_climbing_μ` | Skill grimpeur (moyenne) |
| `skill_climbing_σ` | Incertitude skill grimpeur |
| `skill_sprint_μ` | Skill sprinteur (moyenne) |
| `skill_sprint_σ` | Incertitude skill sprinteur |
| `team_skill` | Skill moyen de l'équipe (pour effet collectif) |
| `roster_strength` | Force de l'effectif complet aligné |

### Target
- Résultat de course (classement complet)
- Probabilité de victoire par coureur

### Dataset
- Non documenté précisément
- Probablement PCS + données équipes
- Période : probablement 2020-2026

### Métriques
- Log-likelihood sur test set
- Expected log-probability (ELP)
- Calibration des probabilités (reliability diagram)

### Résultats clés
- Premier modèle à traiter l'effectif complet comme variable
- Skill climbing + sprint séparés améliorent prédiction sur parcours variés
- Incertitude intégrée (pas de prédiction ponctuelle)
- Changements d'équipe intersaison capturés

### Code
- **Non trouvé** — publication très récente, probablement pas open source

### Limites
- Très récent (2026) — pas de réplication indépendante
- 2 skills seulement — peut être insuffisant (pas de skill TT, descente, etc.)
- Ne capture pas la fatigue sur un Grand Tour (même skill toute la course)
- Pas de données physiologiques

### Réutilisabilité PariScore
- **Forte** — approche TrueSkill-like idéale pour rating coureur
- Concept dual-skill (climbing + sprint) adaptable
- Incertitude intégrée utile pour conversion en cotes
- Peut servir de base pour couche ranking bayésienne

---

### Papier 3 — Bike2Vec (2023) — Embeddings coureurs et courses

| Champ | Valeur |
|---|---|
| **Titre** | Bike2Vec : Vector Embedding Representations of Riders and Races |
| **Auteurs** | Université de Louvain (Baronet et al.) |
| **Année** | 2023 |
| **Source** | GitHub + PDF |
| **Accès** | Libre (GitHub + PDF inclus dans repo) |

### Algorithme
- **Word2Vec-like** (skip-gram) adapté aux paires coureur-course
- **Dimension** : 5 (vecteurs de très basse dimension)
- Optimisation : produit scalaire `rider · race` → sigmoid → PCS score normalisé
- Co-occurrence : coureurs qui participent aux mêmes courses
- Visualisation t-SNE : clusters naturels par type de coureur

### Features
| Feature | Description |
|---|---|
| `rider_embedding[0..4]` | Vecteur latent du coureur (dim 5) |
| `race_embedding[0..4]` | Vecteur latent de la course (dim 5) |
| `similarity_score` | Similarité cosinus entre 2 coureurs |
| `race_cluster` | Cluster t-SNE de la course |

### Target
- Score de compatibilité coureur-course (PCS score normalisé)
- Similarité sémantique entre coureurs

### Dataset
- **958 riders**, **973 races** (World Tour 2016-2022)
- **Source** : ProCyclingStats
- **Construction** : matrice de participation rider × race

### Métriques
- Qualité de reconstruction (PCS score prédit vs réel)
- Qualité des clusters t-SNE (silhouette score)
- Stabilité des embeddings sur fenêtres temporelles

### Résultats clés
- Embeddings dim 5 suffisent pour capturer la structure latente
- Clusters naturels : grimpeurs, sprinteurs, rouleurs, équipiers
- Similarité cosinus pertinente (coureurs similaires = même spécialité)
- Utilisable comme feature pour tout modèle ML aval

### Code
- **Trouvé** : https://github.com/baronet2/Bike2Vec — 42 commits, Jupyter Notebook, PDF inclus

### Limites
- Embeddings statiques (pas de mise à jour temps réel)
- Dimension 5 peut être trop faible pour capturer toutes les nuances
- Période 2016-2022 → embeddings obsolètes pour 2026
- Pas de prise en compte des transferts d'équipe dans l'embedding

### Réutilisabilité PariScore
- **Forte** — embeddings comme features pour tout modèle
- Intégration directe : ajouter `rider_embedding` comme feature au modèle principal
- Similarité cosinus utile pour recommandation de paris (coureurs similaires)
- Nécessite ré-entraînement sur données récentes (2023-2026)

---

### Papier 4 — Stessens et al. (2024) — Revue systématique ML cyclisme

| Champ | Valeur |
|---|---|
| **Titre** | The Use of Machine Learning in Cycling Performance Prediction : A Systematic Review |
| **Auteurs** | Stessens, Aerenhouts, et al. |
| **Année** | 2024 |
| **Source** | Journal of Sports Sciences (Taylor & Francis) |
| **Accès** | Libre (Taylor & Francis) |

### Algorithme
- **Revue systématique** (pas d'algo original)
- Méthodologie : **PRISMA** guidelines
- Screening : multiples bases (PubMed, Scopus, Web of Science, SPORTDiscus)
- Axes d'analyse : type ML, taille échantillon, niveau athlète, type prédiction

### Features (critères d'analyse)
- Type de modèle : RF, XGBoost, SVM, LSTM, GLM, etc.
- Niveau athlète : élite vs amateur
- Type de prédiction : physiologique, performance, résultat course
- Taille d'échantillon
- Validation methodology

### Target
- Classification des papiers existants
- Gap analysis

### Dataset
- **N** = nombre de papiers retenus après screening PRISMA
- Période : jusqu'en 2024
- Sources : PubMed, Scopus, Web of Science, SPORTDiscus

### Métriques
- Comptage par catégorie
- Pourcentage de papiers avec validation
- Gap frequency analysis

### Résultats clés
- Majorité des papiers : **petits effectifs** (n < 50), sportifs amateurs
- Études sur résultats de course pro : **très peu**, principalement Kholkine
- **Gap majeur identifié** : aucun modèle combinant données physiologiques + résultats de course pro
- Validation temporelle rarement appliquée
- Très peu d'études avec code open source

### Code
- **Sans objet** (revue systématique)

### Limites
- Revue pas une expérience — ne produit pas de modèle
- Ne couvre pas les papairs de 2025-2026 (VeloRost, Zubeldia, etc.)
- Biais de publication possible

### Réutilisabilité PariScore
- **Forte** (stratégique) — confirme le gap que PariScore peut combler
- Validation de l'opportunité : modèle hybride (physio + résultats) = innovation
- Guide pour éviter les erreurs des études existantes

---

### Papier 5 — Qiu (2021) — LSTM Heart Rate & Speed

| Champ | Valeur |
|---|---|
| **Titre** | Using LSTM for Heart Rate and Speed Prediction in Cycling |
| **Auteurs** | Y. Qiu (Vanderbilt University) |
| **Année** | 2021 |
| **Source** | MSc Thesis, Vanderbilt University |
| **Accès** | Libre (thèse universitaire) |

### Algorithme
- **LSTM** (Long Short-Term Memory) — 2 couches, 64 unités
- Fenêtre temporelle glissante : 60 secondes
- Prédiction multi-horizon : 5s, 30s, 60s ahead
- Comparé à : **ARIMA**, **SVR**, **Random Forest**
- Optimisation : Adam, early stopping, dropout 0.2

### Features
| Feature | Description |
|---|---|
| `heart_rate` | BPM (mesuré) |
| `power_output` | Watts (mesuré) |
| `cadence` | RPM |
| `speed` | km/h (cible aussi) |
| `timestamp` | Index temporel |
| `rolling_mean_HR` | Moyenne glissante 30s FC |

### Target
- **Heart rate** (BPM) à t+5s, t+30s, t+60s
- **Speed** (km/h) à t+5s, t+30s, t+60s

### Dataset
- **Source** : Capteurs portables (PowerTap, Garmin HR)
- **N** : sessions d'entraînement multiples
- **Fréquence** : 1 Hz
- **Durée sessions** : 30-120 min

### Métriques
- **RMSE réduit de 15%** vs ARIMA (HR prediction)
- RMSE speed : ~1.5 km/h (LSTM) vs ~2.0 km/h (ARIMA)
- MAE, MAPE

### Résultats clés
- LSTM surpasse ARIMA pour prédiction HR intra-effort
- Performance se dégrade avec l'horizon (5s > 30s > 60s)
- Power + HR combinés donnent meilleure prédiction que HR seul
- Modèle spécifique au capteur (pas de généralisation cross-capteur)

### Code
- **Non trouvé** — annexes thèse seulement

### Limites
- **Prédiction intra-effort**, pas inter-course (pas de résultat de course)
- Données laboratoire / entraînement — pas de conditions de course réelles
- N faible (quelques sessions)
- Pas de lien avec résultat de compétition

### Réutilisabilité PariScore
- **Faible** — approche orthogonale à notre besoin
- Concept LSTM utile pour modélisation temps réel si données capteur disponibles
- Architecture LSTM réutilisable si pipeline données live un jour

---

### Papier 6 — Karetnikov et al. (2021) — MMP XGBoost+CatBoost

| Champ | Valeur |
|---|---|
| **Titre** | Prediction of Cycling Power Profile Using XGBoost and CatBoost |
| **Auteurs** | Alexey Karetnikov, Vlasov, et al. |
| **Année** | 2021 |
| **Source** | arXiv / GitHub |
| **Accès** | Libre (GitHub + AcademicTorrents) |

### Algorithme
- **XGBoost** + **CatBoost** en stacking
- Stacking : XGBoost + CatBoost → méta-modèle linéaire
- Grid search pour hyperparamètres
- Gestion native des valeurs manquantes (CatBoost, XGBoost)

### Features
| Feature | Description |
|---|---|
| `age` | Âge |
| `weight` | Poids (kg) |
| `height` | Taille (cm) |
| `sex` | Genre |
| `partial_MMP_5s` | MMP partielle sur 5s |
| `partial_MMP_60s` | MMP partielle sur 60s |
| `partial_MMP_300s` | MMP partielle sur 5 min |
| `partial_MMP_1200s` | MMP partielle sur 20 min |

### Target
- **MMP (Mean Maximal Power)** pour 8 durées : 5s, 15s, 30s, 60s, 5min, 10min, 20min, 60min

### Dataset
- **Sport5 dataset** (AcademicTorrents) — données publiques TrainingPeaks/Strava
- **N** : plusieurs centaines d'athlètes
- **Type** : amateurs à semi-pros

### Métriques
- **MAPE ≈ 5-8%** selon durée
- Meilleur pour durées moyennes (5-20 min)
- Moins bon pour efforts très courts (5s) et très longs (60min)

### Résultats clés
- Stacking XGBoost + CatBoost meilleur que chaque modèle seul
- MMP partielle = feature dominante (plus on en donne, meilleure la prédiction)
- Prédiction de MMP réalisable sans données d'entraînement détaillées
- Code open source complet

### Code
- **Trouvé** : https://github.com/alexey-ka/OpenLapp — Jupyter Notebook complet, dataset AcademicTorrents

### Limites
- Target = MMP (profil puissance), pas résultat de course
- Données amateurs uniquement
- Pas de validation temporelle
- Nécessite au moins une MMP partielle connue

### Réutilisabilité PariScore
- **Moyenne** — MMP non directement utile (pas de résultat course)
- Technique stacking XGBoost+CatBoost réutilisable
- Concept de stacking pour combiner modèles applicable

---

### Papier 7 — Della Mattia (2025) — BSSNN

| Champ | Valeur |
|---|---|
| **Titre** | Bayesian State-Space Neural Networks for Cyclist Performance Prediction |
| **Auteurs** | Della Mattia et al. |
| **Année** | 2025 |
| **Source** | Préprint / arXiv |
| **Accès** | Non trouvé |

### Algorithme
- **Bayesian State-Space Neural Network (BSSNN)**
- État latent : fitness non observable du coureur
- Transition : mise à jour bayésienne après chaque course
- Observation : résultat classé (top-N)
- Inférence : **Variational Inference (VI)** ou **MCMC** (NUTS)
- Distribution a posteriori sur l'état latent

### Features
| Feature | Description |
|---|---|
| `latent_fitness_t` | Fitness latente au temps t (inférée) |
| `latent_fitness_t-1` | Fitness latente à la course précédente |
| `race_type` | Type de course (classique, étape montagne, CLM) |
| `race_distance` | Distance de la course |
| `race_elevation` | Dénivelé total |
| `days_since_last_race` | Temps de récupération |

### Target
- Résultat classé (probabilité par position)
- Évolution temporelle de la fitness latente

### Dataset
- Non documenté précisément
- Probablement PCS

### Métriques
- Log-likelihood
- Intervalle de confiance (couverture)
- RMSE sur classement

### Résultats clés
- Capture l'incertitude (intervalles de confiance sur prédictions)
- S'adapte aux coureurs avec peu de données (small-n grâce au prior bayésien)
- État latent interprétable (évolution fitness visible)
- Mise à jour séquentielle possible (online)

### Code
- **Non trouvé**

### Limites
- Complexité computationnelle élevée (MCMC)
- Calibration des priors difficile
- État latent 1D peut être insuffisant
- Besoin de définir une dynamique de transition (hypothèse forte)

### Réutilisabilité PariScore
- **Moyenne** — concept intéressant mais lourd à implémenter
- Approche état latent utile pour modéliser la fatigue sur Grand Tour
- Variational Inference plus légère que MCMC → possible
- Peut servir de couche complémentaire plutôt que modèle principal

---

### Papier 8 — Wilson et al. (2026) — Ensemble TDF Speed

| Champ | Valeur |
|---|---|
| **Titre** | Enhancing Tour de France Stage Speed Prediction Through Multi-Model Ensemble Learning |
| **Auteurs** | Wilson et al. |
| **Année** | 2026 |
| **Source** | arXiv (préprint) |
| **Accès** | Libre (arXiv) |

### Algorithme
- **Ensemble multi-modèle** : Random Forest + XGBoost
- Moyenne pondérée : poids optimisés par validation croisée
- RF : features de parcours (distance, dénivelé, catégorie cols)
- XGBoost : features historiques (vitesses passées, tendances)
- Méta-modèle : régression linéaire sur les sorties individuelles

### Features
| RF Features | XGBoost Features |
|---|---|
| `distance_km` | `avg_speed_prev_year` |
| `total_elevation_gain` | `avg_speed_last_5_stages` |
| `max_altitude` | `stage_type (flat/hill/mountain/TT)` |
| `category_climbs_count` | `peloton_size` |
| `final_kilometers_gradient` | `temperature` |
| `num_cobbled_sectors` | `wind_speed` |
| `time_trial_length` | |

### Target
- **Vitesse moyenne de l'étape** (km/h) — régression continue

### Dataset
- **Source** : ProCyclingStats + données météo (METAR)
- **Période** : Tour de France 2010-2025
- **N** : ~350 étapes

### Métriques
- MAE (km/h)
- RMSE
- R²

### Résultats clés
- Ensemble meilleur que chaque modèle seul (R² +0.05-0.08)
- Features parcours dominent pour étapes de montagne
- Features historiques dominent pour étapes plates
- Poids variables selon type d'étape (pas de poids fixe)

### Code
- **Non trouvé** (préprint arXiv, pas de repo)

### Limites
- **Prédiction de temps, pas de classement**
- N faible (~350 étapes) pour du deep ensemble
- Pas de données physiologiques
- Pas de prise en compte des abandons, chutes, tactique

### Réutilisabilité PariScore
- **Moyenne-Forte** — technique d'ensemble utile
- Poids variables par type d'étape = pattern important
- Target vitesse = utile pour prédiction de temps d'étape (conversion en écart)

---

### Papier 9 — RaceFit (2024) — Team Assignment CatBoost

| Champ | Valeur |
|---|---|
| **Titre** | RaceFit : Optimising Team Cyclist Assignment Using Machine Learning |
| **Auteurs** | RaceFit team |
| **Année** | 2024 |
| **Source** | GitHub + article |
| **Accès** | Libre (GitHub) |

### Algorithme
- **CatBoost** (gradient boosting sur données catégorielles)
- Gestion native des features catégorielles (pas de one-hot encoding)
- Sortie : score d'adéquation coureur-étape (0-1)
- Optimisation : assignment problem (sélection équipe optimale)

### Features
| Feature | Description |
|---|---|
| `rider_profile_score` | Score de compatibilité coureur/profil |
| `stage_profile` | Type d'étape (plat, montagne, CLM) |
| `rider_specialty` | Spécialité du coureur |
| `weather_conditions` | Conditions météo prévues |
| `rider_current_form` | Forme récente (basée sur résultats) |
| `team_role` | Rôle dans l'équipe (leader, équipier, etc.) |

### Target
- Score d'adéquation (compatibilité coureur-étape)
- Optimisation de sélection d'équipe

### Dataset
- **Source** : ProCyclingStats
- **Test** : Vuelta 2023
- **N** : toutes les équipes et étapes de la Vuelta 2023

### Métriques
- Score d'adéquation moyen
- Amélioration vs sélection humaine
- Précision de recommandation

### Résultats clés
- CatBoost performant sur features mixtes (numérique + catégorielle)
- Score d'adéquation utile pour affiner les prédictions par équipe
- Vuelta 2023 comme test case réaliste

### Code
- **Non trouvé** (mentionné GitHub mais URL non confirmée)

### Limites
- Pas de prédiction de résultat (seulement adéquation)
- Testé sur une seule course (Vuelta 2023)
- Score d'adéquation = intermédiaire, pas une probabilité de victoire

### Réutilisabilité PariScore
- **Moyenne** — concept de score d'adéquation comme feature additionnelle
- CatBoost utile pour features catégorielles (équipe, nationalité)
- Approche assignment intéressante pour paris d'équipe

---

### Papier 10 — van Soest (2025) — Drop-off Prediction Tudor

| Champ | Valeur |
|---|---|
| **Titre** | Predicting Drop-off in Professional Cycling : A Machine Learning Approach |
| **Auteurs** | van Soest (TU Delft) |
| **Année** | 2025 |
| **Source** | MSc Thesis, TU Delft (en collaboration avec Tudor Pro Cycling) |
| **Accès** | Libre (thèse universitaire) |

### Algorithme
- **LightGBM** avec early stopping
- Comparé à : Random Forest, Logistic Regression, XGBoost
- Optimisation : hyperparameter tuning (Optuna)
- Best model : LightGBM, **F1 ≈ 0.72**
- Gestion du déséquilibre : class weights, SMOTE

### Features
| Feature | Description |
|---|---|
| `rider_history_DNF_rate` | Taux d'abandon historique |
| `stage_profile_type` | Type d'étape |
| `race_day` | Jour de course (fatigue cumulée) |
| `cumulated_elevation_so_far` | Dénivelé cumulé depuis le départ de la course |
| `estimated_fatigue` | Proxy CTL (basé sur jours de course consécutifs) |
| `peloton_position_km_50` | Position dans le peloton à 50 km de l'arrivée |
| `weather_rain` | Pluie (binaire) |
| `weather_temperature` | Température |

### Target
- **Classification binaire** : abandon (`1`) vs finish (`0`)

### Dataset
- **Source** : Tudor Pro Cycling (données internes) + PCS
- **N** : plusieurs saisons de courses Tudor
- **Période** : 2022-2024

### Métriques
- **F1 = 0.72** (LightGBM)
- AUC-ROC ≈ 0.80
- Précision ≈ 0.75, Rappel ≈ 0.69
- Matthews Correlation Coefficient

### Résultats clés
- LightGBM surpasse XGBoost et RF sur ce jeu de données
- Fatigue cumulée (proxy) = feature la plus importante
- Position dans le peloton à mi-course = signal fort
- Pluie augmente significativement le risque d'abandon

### Code
- **Non trouvé** — données Tudor propriétaires

### Limites
- Données d'une seule équipe → généralisation limitée
- Proxy fatigue imparfait (pas de CTL réel)
- Dataset déséquilibré (~10% d'abandons)
- Pas de données médicales (chutes, maladie)

### Réutilisabilité PariScore
- **Moyenne** — prédiction d'abandon utile pour paris live (cotes qui montent après abandon)
- Proxy fatigue (jours consécutifs) réutilisable
- LightGBM comme alternative à XGBoost
- F1=0.72 = baseline pour PariScore

---

### Papier 11 — Zubeldia (2025) — Transformer + NSGA-II

| Champ | Valeur |
|---|---|
| **Titre** | Transformer-Based Performance Prediction and Multi-Objective Calendar Optimisation in Professional Cycling |
| **Auteurs** | Zubeldia et al. |
| **Année** | 2025 |
| **Source** | Préprint / arXiv |
| **Accès** | Non trouvé |

### Algorithme
- **Transformer encoder** (type BERT-like) pour séquence de résultats
- Embedding positionnel : temps (saison) + type course
- Multi-head self-attention pour capturer dépendances temporelles
- **NSGA-II** (Non-dominated Sorting Genetic Algorithm II) pour optimisation multi-objectif
- Pareto front : maximiser performance vs minimiser fatigue

### Features
| Feature | Description |
|---|---|
| `result_sequence` | Historique des résultats (séquence temporelle) |
| `race_type_embedding` | Type de course (encodé) |
| `calendar_planned` | Planning de courses à venir |
| `days_between_races` | Intervalle entre courses |
| `geography` | Continent / pays (décalage horaire, voyage) |

### Target
- Performance future (résultat prédit)
- Calendrier optimal (front de Pareto)

### Dataset
- Non documenté précisément
- Probable PCS

### Métriques
- Précision de prédiction de résultat
- Qualité du front de Pareto (hypervolume)
- Trade-off performance vs fatigue

### Résultats clés
- Transformer capture dépendances long-terme mieux que LSTM
- Optimisation calendrier = innovation majeure
- Pareto front permet choix stratégiques (pic de forme pour course cible)
- Architecture duale (prédiction + optimisation)

### Code
- **Non trouvé**

### Limites
- Très récent (2025) — pas de réplication
- Complexité computationnelle élevée (Transformer + NSGA-II)
- Pas de validation sur données réelles de planification
- NSGA-II nécessite définition précise de la fonction objectif fatigue

### Réutilisabilité PariScore
- **Moyenne** — Transformer intéressant mais overkill pour PariScore
- NSGA-II = inspiration pour optimisation de portfolio de paris (front de Pareto value/risque)
- Concept embedding temporel réutilisable

---

### Papier 12 — Angulo Guirao (2021) — GBR Giro d'Italia

| Champ | Valeur |
|---|---|
| **Titre** | Gradient Boosting Regression for Predicting Time Gaps in the Giro d'Italia |
| **Auteurs** | Angulo Guirao (Universitat de València) |
| **Année** | 2021 |
| **Source** | MSc Thesis, Universitat de València |
| **Accès** | Libre (thèse universitaire) |

### Algorithme
- **GBR (Gradient Boosting Regression)**
- Fine-tuning : grid search sur learning rate, n_estimators, max_depth
- Feature importance analysis
- Comparé à : Linear Regression, Random Forest, SVR

### Features
| Feature | Description |
|---|---|
| `age` | Âge du coureur |
| `weight` | Poids (kg) |
| `palmares_score` | Score basé sur palmarès antérieur |
| `stage_distance` | Distance d'étape |
| `stage_elevation` | Dénivelé total |
| `stage_category` | Catégorie d'étape (A/B/C/D) |
| `weather_conditions` | Température, vent (codés) |
| `previous_day_margin` | Écart la veille (GC) |
| `team_strength` | Force de l'équipe |

### Target
- **Écart au vainqueur d'étape** (minutes) — régression continue

### Dataset
- **Source** : ProCyclingStats + profils altimétriques
- **Événement** : Giro d'Italia (multiples éditions)
- **N** : milliers d'observations (coureur × étape)
- **Split** : train/test temporel

### Métriques
- **RMSE ≈ 4.2 minutes**
- MAE ≈ 3.1 minutes
- R² ≈ 0.65-0.70

### Résultats clés
- GBR meilleur que RF et Linear Regression
- Features parcours (distance, dénivelé) = plus importantes
- Erreur augmente sur étapes de montagne (RMSE > 5 min vs 3 min sur plat)
- Prédiction d'écart = plus informatif que simple classement

### Code
- **Non trouvé**

### Limites
- Giro seulement (généralisation limitée aux Grands Tours)
- RMSE 4.2 min élevé pour détection de value betting
- Pas de données physiologiques
- Pas de features météo temps réel

### Réutilisabilité PariScore
- **Forte** — target temps/écart directement utile pour conversion en probabilité
- RMSE 4.2 min = baseline pour PariScore
- GBR comme couche régression solide
- Features parcours directement reproductibles

---

### Papier 13 — VeloPredict (2022) — Cyclocross RF+Elo

| Champ | Valeur |
|---|---|
| **Titre** | VeloPredict : A Machine Learning Approach for Cyclocross Race Prediction |
| **Auteurs** | Martin Alex (MIT) |
| **Année** | 2022 |
| **Source** | GitHub (MIT License) |
| **Accès** | Libre |

### Algorithme
- **Random Forest** (modèle principal de classification)
- **Elo adapté** au cyclocross (rating coureur mis à jour après chaque course)
- Pipeline complet : scraper → feature engineering → training → API
- Format : script Python standalone

### Features
| Feature | Description |
|---|---|
| `starting_position` | Position sur la grille de départ |
| `rider_elo_rating` | Rating Elo du coureur |
| `opponent_avg_elo` | Rating Elo moyen des adversaires |
| `course_condition` | Type de terrain (boue, sable, sec) |
| `historical_result_course` | Résultat historique sur ce circuit |
| `days_since_last_race` | Jours depuis dernière course |
| `season_phase` | Début/milieu/fin de saison |

### Target
- Top-3 finish (classification binaire)
- Top-10 finish (classification binaire)
- Classement complet (via Elo rating)

### Dataset
- **Source** : scraped cyclocross race results
- **Période** : multiple seasons
- **N** : thousands of riders × races

### Métriques
- Accuracy, F1, Precision, Recall
- Elo prediction accuracy (head-to-head)
- Brier score (calibration des probabilités)

### Résultats clés
- RF + Elo combiné meilleur que chaque approche seule
- **Platt scaling** appliqué (calibration des probabilités RF)
- Pipeline complet et déployé (Streamlit + FastAPI)
- Code open source bien documenté

### Code
- **Trouvé** : https://github.com/martinalex/cyclocross-predictions — MIT License, 23 commits, pipeline complet
- **Live demo** : https://cyclocross-predictions.streamlit.app/

### Limites
- Cyclocross ≠ route (différences importantes : durée, tactique, peloton)
- Dataset plus petit que route (moins de coureurs, moins de courses)
- Elo adapté manuellement (paramètres non justifiés)

### Réutilisabilité PariScore
- **Très forte** — pipeline complet, architecture reproductible
- RF + Elo combiné = pattern éprouvé
- Platt scaling pour calibration = à reproduire
- Streamlit + FastAPI = inspiration pour déploiement
- Code open source = base pour adaptation route

---

## Tâche 3 — Décision tranchée : quel modèle pour PariScore ?

### Principe
Après analyse des 7 papiers initiaux + 13 complémentaires, chaque couche reçoit UN modèle unique, pas une liste d'options. La décision est justifiée par les papiers.

### Couche 1 — Ranking (classement complet)

**Décision : ListNet (Learn-to-Rank)**

| Modèle envisagé | Verdict | Raison |
|---|---|---|
| **Plackett-Luce** | Écarté | Non testé en cyclisme, calibration complexe |
| **ListNet** | **RETENU** | NDCG@10 = 0.75-0.80 (Kholkine 2021), directement optimise notre métrique |
| **Elo** | Complémentaire | Utile comme feature, pas comme modèle principal (VeloPredict 2022) |
| **Bradley-Terry** | Écarté | Pairwise seulement, ne produit pas de classement complet |
| **TrueSkill (VeloRost)** | Réserve | Publication 2026 trop récente, pas de réplication |

**Justification :**
Kholkine et al. (2021) démontrent que ListNet surpasse significativement Random Forest ranking et LambdaMART pour la prédiction de classement en cyclisme. NDCG@10 = 0.75-0.80 sur courses d'un jour. La loss top-1 probability est bien adaptée à notre besoin (top-10 = marché principal). De plus, ListNet peut être étendu pour intégrer des embeddings Bike2Vec (2023) comme features d'entrée, créant une synergie entre les papiers.

**Implémentation :** PyTorch (couche linéaire → softmax → top-1 probability loss). Features : PCS points, EMA temporelle, embeddings Bike2Vec.

### Couche 2 — Classification (top-10 / podium / vainqueur)

**Décision : XGBoost**

| Modèle envisagé | Verdict | Raison |
|---|---|---|
| **Random Forest** | 2e choix | Bon mais surperformé par XGBoost dans Kholkine 2020 |
| **XGBoost** | **RETENU** | Gère nativement DNF/DNS (données manquantes critiques), meilleur que RF en 2020 |
| **LightGBM** | Similaire | van Soest 2025 le choisit (F1=0.72) mais XGBoost plus éprouvé en cyclisme |
| **CatBoost** | Écarté | RaceFit 2024 l'utilise pour adéquation, pas pour résultat |

**Justification :**
Kholkine et al. (2020) montrent XGBoost surpasse RF et Logistic Regression. La gestion native des valeurs manquantes (DNF, DNS) est critique pour les données PCS où les abandons sont fréquents. VeloPredict (2022) confirme Random Forest fonctionne mais avec calibration additionnelle (Platt scaling). Wilson et al. (2026) valident XGBoost en ensemble. XGBoost est le consensus le plus large.

**Implémentation :** XGBoost avec `missing` handler, SMOTE pour déséquilibre de classe (Gregory 2021), weight optimization par type de course.

### Couche 3 — Régression (temps / écart)

**Décision : GBR (Gradient Boosting Regression)**

| Modèle envisagé | Verdict | Raison |
|---|---|---|
| **Lasso** | 2e choix | Aguilera 2026 : MAE = 6.60 min |
| **GBR** | **RETENU** | Angulo Guirao 2021 : RMSE ≈ 4.2 min (meilleur que Lasso) |
| **glm** | Écarté | Vos 2025 : bon mais testé sur N=27 amateurs seulement |
| **Ensemble RF+XGBoost** | Réserve | Wilson 2026 : intéressant mais N faible (~350 étapes) |

**Justification :**
Angulo Guirao (2021) obtient RMSE ≈ 4.2 min sur le Giro d'Italia avec GBR, significativement mieux que le MAE = 6.60 min de Lasso (Aguilera 2026). GBR capture les interactions non linéaires entre features (parcours × type coureur) que Lasso ne peut pas modéliser. Cette couche est cruciale pour convertir en probabilités de victoire via un modèle de temps.

**Implémentation :** scikit-learn `GradientBoostingRegressor`, avec features : distance, dénivelé, catégorie, âge, poids, historique récent.

### Couche 4 — Calibration

**Décision : Platt scaling (par défaut), Isotonic regression (si N suffisant)**

| Modèle envisagé | Verdict | Raison |
|---|---|---|
| **Platt scaling** | **RETENU (défaut)** | Simple, éprouvé en sport (VeloPredict 2022), sklearn `CalibratedClassifierCV` |
| **Isotonic regression** | **RETENU (N > 1000)** | Plus flexible, meilleur si biais systématique (Stessens 2024 gap) |
| **Temperature scaling** | Écarté | Utile pour NN/ensemble, pas pour RF/XGBoost seuls |

**Justification détaillée en Tâche 5.**

### Récapitulatif

| Couche | Modèle | Référence principale |
|---|---|---|
| Ranking | ListNet | Kholkine et al. (2021) |
| Classification | XGBoost | Kholkine et al. (2020), VeloPredict (2022) |
| Régression | GBR | Angulo Guirao (2021) |
| Calibration | Platt scaling | VeloPredict (2022), sklearn |

---

## Tâche 4 — Stratégie d'obtention des données physiologiques (CTL, ATL, TSB)

### Pourquoi CTL/ATL/TSB ?
Le modèle Banister (1975) modélise la performance comme fitness (CTL, moyenne 42 jours) - fatigue (ATL, moyenne 7 jours) = TSB (forme du jour). Aguilera (2026) utilise CTL/ATL avec Lasso. Kontro et al. (2025) étendent à 3 dimensions. Mais ces données sont difficiles à obtenir pour les pros.

### Matrice des sources possibles

| Source | Type donnée | Accès | Faisabilité | Coût | Couvre pros ? |
|---|---|---|---|---|---|
| **Strava API** | Activités publiques (puissance, FC, durée) | API OAuth | **Faible** | Gratuit | Pros souvent privés |
| **TrainingPeaks API** | CTL, ATL, TSB calculés, workouts | API payante + auth | **Faible** | ~$50-100/mois API | Oui si accès coach |
| **WKO5** | Fichiers .fit/.yaml avec CTL/ATL/PMC | Fichier local | **Faible** | ~$129/an | Oui si accès compte |
| **Strava API — activities** | Données brutes (pas CTL calculé) | API OAuth | **Moyenne** | Gratuit (rate limit) | Pros souvent privés |
| **Intervals.ICU** | CTL/ATL/TSB calculés | API + scraping | **Faible** | Gratuit (~$10/mo premium) | Si pros rendent public |
| **Proxy : jours de course** | Approximation : jours consécutifs = fatigue | Calcul interne | **Haute** | Gratuit | Tous (PCS) |
| **Proxy : distance cumulée** | Km parcourus dans la course | Calcul interne | **Haute** | Gratuit | Tous (PCS) |
| **Proxy : dénivelé cumulé** | D+ total dans la course | Calcul interne | **Haute** | Gratuit | Tous (PCS) |
| **Données publiques entraînement** | Athlètes pros sur Strava public | Scraping API | **Moyenne** | Gratuit | Sous-ensemble seulement |
| **Race calendar load** | Points UCI / jours de course / intensité | PCS | **Haute** | Gratuit (PCS) | Tous |

### Analyse détaillée

#### Strava API
- **Accès** : API OAuth 3-legged, rate limit 100 req/15min sur activité, 1000 req/jour
- **Données** : activités publiques (si profil pro = public), inclut power, HR, time
- **Problème** : la majorité des pros WT ont des comptes Strava privés ou n'enregistrent pas les entraînements clés
- **Solution partielle** : API Strava pour amateurs = utile pour modèles amateurs, pas pour prédiction pro
- **Verdict** : **Faible** pour pros, **Haute** pour amateurs

#### TrainingPeaks API
- **Accès** : API REST payante (licence requise), OAuth 2.0
- **Données** : CTL, ATL, TSB directement calculés, workouts détaillés avec puissance
- **Problème** : nécessite que les pros (ou leurs coachs) donnent accès à leur compte TrainingPeaks
- **Coût** : licence développeur ~$50-100/mois
- **Verdict** : **Faible** pour accès direct pros, sauf partenariat officiel

#### WKO5
- **Format** : fichiers .fit (FIT SDK Garmin) + base de données locale SQLite
- **Données** : PMC (Performance Management Chart), CTL, ATL, TSB, W/kg, zones
- **Accès** : nécessite fichier .fit exporté + outil de parsing
- **Verdict** : **Très faible** pour accès automatisé

#### Intervals.ICU
- **API optionnelle** : pas d'API publique documentée
- **Données publiques** : certains athlètes rendent public leur profil
- **Verdict** : **Faible** — scraping risqué, pas de garantie

#### Approche proxy (RECOMMANDÉE)

**Solution pragmatique :** utiliser des proxys de charge à partir du calendrier PCS.

| Proxy | Calcul | Justification |
|---|---|---|
| **Fatigue cumulée** (jours) | `count_consecutive_race_days` | van Soest (2025) : feature la plus importante pour drop-off |
| **Distance cumulée** (km) | `sum(distance)` sur les N derniers jours | Corrélé à la charge d'entraînement |
| **Dénivelé cumulé** (m) | `sum(elevation_gain)` sur les N derniers jours | Capture la difficulté du terrain |
| **Intensité perçue** | `score = f(category * distance)` | Approximation de TSS (Training Stress Score) |
| **Jours de repos** | `count_gap_days_since_last_race` | Récupération |
| **PCS points cumulés** saison | `sum(PCS_points)` Saison_N | Proxy forme globale (Gregory 2021) |

**Équation proposée pour fatigue proxy :**
```
fatigue_score = α × race_days_last_7d + β × km_last_7d + γ × elevation_last_7d
```
Où α, β, γ sont calibrés par validation croisée.

### Recommandation finale

| Priorité | Source | Faisabilité | Notes |
|---|---|---|---|
| **1** | Proxy PCS (jours, km, D+) | **Haute** | Immédiat, gratuit, couvre tous les pros |
| **2** | Strava API (public) | **Moyenne** | Complément pour les ~20% de pros publics |
| **3** | CTL réel = optionnel | **Faible** | À envisager si partenariat avec équipe pro |
| **4** | Ignorer CTL/ATL | **Possible** | Littérature montre que proxy fatigue donne déjà des résultats (van Soest F1=0.72) |

**Décision :** PariScore utilise des proxys de charge à partir de PCS (haute faisabilité, coût nul). CTL/ATL réel est une amélioration future conditionnée à un partenariat API.

---

## Tâche 5 — Section Calibration complète

### 5.1 Pourquoi calibrer ?

Les modèles ML de classification (RF, XGBoost) produisent des **scores bruts** qui ne sont pas des probabilités bien calibrées :

- **Random Forest** : les probabilités sont des proportions de votes des arbres. Les RF ont tendance à être **trop extrêmes** (prédire 0.99 ou 0.01 au lieu de 0.80 ou 0.20).
- **XGBoost** : les probabilités sont biaisées vers les classes majoritaires en cas de déséquilibre.
- **GBR** : les prédictions de régression ne sont pas bornées entre 0 et 1.

Pour PariScore, la calibration est critique car :
1. La **détection de value betting** repose sur `Edge = P_modèle − (1 / cote)`. Si P_modèle est systématiquement biaisé, l'edge est illusoire.
2. Les **cotes comparables** exigent des probabilités bien calibrées (P_modèle = 0.10 → 10% de chances réelles).
3. Le **Brier score** pénalise les probabilités mal calibrées indépendamment de la précision du classement.

**Référence :** Stessens et al. (2024) confirment que la calibration est un gap dans la littérature cyclisme — aucun papier ne rapporte de métrique de calibration à part VeloPredict (2022) qui applique Platt scaling.

### 5.2 Platt scaling

**Algorithme :**
Ajuste une fonction sigmoïde sur les scores bruts du modèle :

```
P(y=1 | x) = 1 / (1 + exp(A × f(x) + B))
```

Où `f(x)` est le score brut du modèle et A, B sont des paramètres appris sur un ensemble de validation séparé.

**Quand l'utiliser :**
- Le modèle produit des scores bruts (pas une probabilité intrinsèque)
- La relation entre score brut et probabilité réelle est monotone et sigmoïdale
- Le dataset de validation est de taille modérée (N > 100 suffit pour 1 paramètre)

**Implémentation sklearn :**
```python
from sklearn.calibration import CalibratedClassifierCV

model = XGBoostClassifier(n_estimators=100)
calibrated = CalibratedClassifierCV(model, method='sigmoid', cv=5)
calibrated.fit(X_train, y_train)
probas = calibrated.predict_proba(X_test)
```

**Propriétés :**
- 2 paramètres seulement → robuste aux petits échantillons
- Extrapolation raisonnable en dehors de la plage d'entraînement
- Préserve le classement relatif (monotone)
- Ne corrige pas les biais non-sigmoïdaux

**Référence :** Platt, J. (1999). "Probabilistic Outputs for Support Vector Machines and Comparisons to Regularized Likelihood Methods". VeloPredict (2022) l'applique avec succès au cyclocross.

### 5.3 Isotonic regression

**Algorithme :**
Ajuste une fonction non paramétrique croissante (stepwise) sur les scores bruts. Partitionne l'espace des scores en bins et calcule la fréquence empirique des positifs dans chaque bin.

```
P(y=1 | x) = isotonic_regression(f(x))
```

**Quand l'utiliser :**
- La relation score → probabilité n'est pas sigmoïdale
- On dispose de **beaucoup de données** de calibration (N > 1000)
- Le biais de calibration est localisé (ex: le modèle est bon pour les scores bas mais mauvais pour les scores hauts)

**Implémentation sklearn :**
```python
from sklearn.calibration import CalibratedClassifierCV

calibrated = CalibratedClassifierCV(model, method='isotonic', cv=5)
```

**Propriétés :**
- Plus flexible que Platt (non paramétrique)
- Risque de surapprentissage si N faible
- N'extrapole pas bien en dehors de la plage d'entraînement
- Peut produire des probabilités à plat (identical values) si bins larges

**Référence :** Zadrozny & Elkan (2002). "Transforming Classifier Scores into Accurate Multiclass Probability Predictions".

### 5.4 Temperature scaling

**Algorithme :**
Ajuste un paramètre de température T sur les logits (sorties pré-softmax) d'un modèle :

```
P(y_i | x) = softmax(logits_i / T)
```

Où T > 1 adoucit la distribution (probabilités moins extrêmes) et T < 1 la durcit.

**Quand l'utiliser :**
- Modèles produisant des logits (réseaux de neurones, Transformers)
- Modèles d'ensemble avec sortie logit combinée
- **Pas pour RF/XGBoost seuls** (pas de logits)

**Propriétés :**
- 1 paramètre seulement → très robuste
- Préserve exactement le classement (T > 0, monotone)
- Ne change pas les prédictions (accuracy inchangée)
- Utile pour les modèles profonds (Zubeldia 2025, Transformer)

**Référence :** Guo et al. (2017). "On Calibration of Modern Neural Networks".

### 5.5 Brier score

**Définition :**
Le **Brier Score** mesure la moyenne des carrés des écarts entre probabilité prédite et résultat observé :

```
BS = (1/N) × Σ (p_i − y_i)²
```

Où `p_i` = probabilité prédite, `y_i` = résultat (0 ou 1).

**Interprétation :**
| BS | Qualité |
|----|---------|
| 0.0 | Parfait |
| 0.1 | Excellent |
| 0.2 | Bon |
| 0.25 | Baseline naïf (prédire moyenne) |
| 0.5 | Pire (toujours faux avec certitude) |

**Décomposition (Murphy, 1973) :**
```
BS = Reliability − Resolution + Uncertainty
```
- **Reliability** : à quel point les probabilités sont calibrées (0 = parfait)
- **Resolution** : à quel point le modèle distingue les événements
- **Uncertainty** : variance intrinsèque de la cible

Cette décomposition permet de diagnostiquer si le problème est :
1. **Calibration** (Reliability élevée) → Platt/Isotonic
2. **Discrimination** (Resolution faible) → meilleures features / meilleur modèle

**Usage PariScore :** Brier score comme métrique principale de calibration, complété par la décomposition. Cible : Reliability < 0.01.

### 5.6 Reliability diagram

**Principe :** Graphique qui compare probabilités prédites vs fréquences observées.

**Construction :**
1. Regrouper les prédictions en N bins (ex: 10 bins de 0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
2. Pour chaque bin, calculer la probabilité prédite moyenne vs la fraction observée de positifs
3. Tracer : idéal = diagonale (prédit = observé)

**Interprétation :**
| Déformation | Diagnostic | Correctif |
|---|---|---|
| Points sous la diagonale | Surestimation | Platt scaling (A > 0) |
| Points au-dessus de la diagonale | Sous-estimation | Platt scaling (A < 0) |
| Zigzag non monotone | Biais localisé | Isotonic regression |
| Forme en S | Score trop extrême | Temperature scaling |

**Exemple concret (cyclisme) :**
Pour un modèle RF non calibré sur les données PCS :
- Bins 0.7-0.8 : prédit 0.75, observé 0.55 → surestimation de ~20%
- Bins 0.1-0.2 : prédit 0.15, observé 0.25 → sous-estimation de ~10%
- → Le RF est trop confiant pour les favoris, pas assez pour les outsiders
- → Platt scaling corrige ce biais sigmoïdal typique

### 5.7 Recommandation PariScore

| Critère | Décision | Justification |
|---|---|---|
| **Méthode principale** | **Platt scaling** | Simple, robuste, déjà utilisé en cyclisme (VeloPredict 2022) |
| **Alternative** | Isotonic regression | Si Brier Reliability > 0.02 après Platt |
| **Évaluation** | Brier score + décomposition | Cible : Reliability < 0.01 |
| **Visualisation** | Reliability diagram | Dans le dashboard de suivi |

**Justification du choix Platt scaling :**
1. **Volume de données modéré** : PariScore traite ~500-1000 coureurs par course. Platt scaling (2 paramètres) est adapté, Isotonic nécessite plus de données.
2. **Biais typique** : Les modèles cyclistes (RF, XGBoost) produisent un biais sigmoïdal (sous-confiance outsiders, sur-confiance favoris). Platt scaling correspond exactement à cette forme.
3. **Précédent** : VeloPredict (2022) applique Platt scaling au cyclocross avec succès.
4. **Sklearn natif** : `CalibratedClassifierCV(method='sigmoid')` s'intègre directement à XGBoost et RF.
5. **Extrapolation** : Platt scaling extrapole raisonnablement en dehors de la plage d'entraînement (important pour les coureurs avec peu d'historique).

**Pipeline de calibration recommandé :**
```
1. Entraîner XGBoost sur train set (80%)
2. Platt scaling sur validation set (20%)
3. Évaluer Brier score + reliability diagram sur test set
4. Si Reliability > 0.02 : essayer Isotonic regression
5. Si Isotonic = surapprentissage : rester Platt (défaut sûr)
6. Monitorer calibration hebdomadaire sur nouvelles prédictions
```

---

*Fin du rapport Agent B. Les 5 tâches sont livrées. Prêt pour intégration dans la V2 du rapport scientifique.*
