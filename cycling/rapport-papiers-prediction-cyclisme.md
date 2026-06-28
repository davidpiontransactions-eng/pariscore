# Rapport d'Analyse — 7 Papiers sur la Prédiction de Performance Cycliste

> Généré le 26/06/2026 — Analyse pour PariScore
> Objectif : extraire algorithmes, features, datasets, métriques, code, limites et réutilisabilité

---

## Papier A — Kholkine et al. (2020) — XGBoost Classics

| Champ | Valeur |
|---|---|
| **Titre** | A Machine Learning Approach for Predicting Top-3 and Top-5 Finishers in Elite Cycling Races (Cobblestones/Classics) |
| **Source** | PDF UAntwerpen / Science & Cycling Congress |
| **Accès** | Partiel (raw PDF, recherche complémentaire dépôt UAntwerpen) |

### Algorithme
- **XGBoost** (gradient boosting) — choisi pour sa gestion native des valeurs manquantes (DNF, DNS)
- Grid search pour tuning hyperparamètres

### Features
| Feature | Description |
|---|---|
| `relative_finish_time` | Temps d'arrivée relatif au vainqueur |
| `career_points` | Points UCI carrière cumulés |
| `sprint_points` | Points sprint carrière |
| `one_day_points` | Points en course d'un jour |
| `PCS_points_prev_year` | Points PCS année précédente |
| `EMA_10y` | Moyenne mobile exponentielle 10 ans de points |

### Target
- Top-3 / Top-5 finish (classification binaire)

### Dataset
- **Source** : ProCyclingStats (scrapé)
- **Période train** : 2008–2016
- **Période test/predict** : 2018–2019
- **Courses** : 5 classiques pavées (Roubaix, Flandres, E3, Gand-Wevelgem, Dwars door Vlaanderen)

### Métriques
- Accuracy, Precision, Recall, F1-score
- AUC-ROC

### Résultats clés
- XGBoost surpasse régression logistique et random forest
- Features temporelles (EMA) importantes pour la forme récente
- Course-specific models meilleurs que modèle global

### Code
- **Non trouvé** — pas de repo public identifié

### Limites
- 5 courses seulement (généralisation limitée)
- Pas de features météo, vent, équipement
- Pas de validation croisée temporelle explicite
- Dataset PCS scrapé — qualité dépend du scraping

### Réutilisabilité PariScore
- **Forte** — XGBoost adapté aux données manquantes (pertinent pour DNF)
- Concept d'EMA temporelle réutilisable
- Approche course-specific model à considérer

---

## Papier B — Kholkine et al. (2022) — Random Forest Classification

| Champ | Valeur |
|---|---|
| **Titre** | Machine Learning for Predicting Top Positions in Cycle Races |
| **Source** | Springer LNCS / SPONET / UAntwerpen |
| **Accès** | Paywall Springer — résumé + métadonnées SPONET |

### Algorithme
- **Random Forest** (meilleur performeur)
- Comparé à XGBoost, Logistic Regression, SVM, KNN
- Feature importance analysis

### Features
| Feature | Description |
|---|---|
| Rider characteristics | Âge, poids, taille, expérience |
| Résultats année N | Top positions current season |
| Résultats année N-1 | Top positions previous season |
| `relative_finish_time` | Réutilisé de 2020 |

### Target
- Top positions (classification — présence/absence dans top)

### Dataset
- **Source** : ProCyclingStats
- **Période** : étendue par rapport à 2020
- **Courses** : plus grand spectre (classics + autres)

### Métriques
- Accuracy, Precision, Recall, F1
- Matthews Correlation Coefficient (MCC)

### Résultats clés
- Random Forest meilleur que XGBoost (contredit partiellement 2020 — dépend du setup)
- Feature importance : `relative_finish_time` domine
- Personnalisation amorcée (ajout de features rider)

### Code
- **Non trouvé**

### Limites
- Pas de features dynamiques (météo, forme jour J)
- Classification binaire seulement (pas de prédiction de temps ou probabilité continue)
- Dataset PCS scrapé — maintenance nécessaire

### Réutilisabilité PariScore
- **Forte** — RF simple, interprétable
- Feature importance utile pour sélection de features PariScore
- Concept résultats N/N-1 directement adaptable

---

## Papier C — Vos et al. (2025) — glm pour Performance TT

| Champ | Valeur |
|---|---|
| **Titre** | Predicting Performance Changes in Recreational Cyclists After a 12-Week Training Intervention |
| **Source** | Applied Artificial Intelligence (Taylor & Francis) |
| **Accès** | **403 Forbidden** — résumé seul via snippet moteur |

### Algorithme
- **Generalized Linear Model (glm)** — meilleur R²
- Random Forest (RF)
- Principal Component Regression (PCR)

### Features
| Feature | Description |
|---|---|
| `power_at_VO2max` | Puissance à VO2max (W) |
| `power_at_VT1` | Puissance au premier seuil ventilatoire (W) |
| `power_at_VT2` | Puissance au second seuil ventilatoire (W) |
| `body_composition` | Masse grasse, masse maigre |
| `deoxygenation` | NIRS — désoxygénation musculaire |
| `sleep_quality` | Qualité de sommeil (auto-reportée) |
| `sickness` | Jours de maladie |

### Target
- Changement de performance (W/kg) sur 4-km TT
- Prédiction post-intervention

### Dataset
- **N** = 27 cyclistes récréatifs
- **Design** : Pré/post intervention 12 semaines
- **Test** : 4-km time trial laboratoire

### Métriques
- R² = **0.875** (pré-intervention)
- R² = **0.792** (post-intervention)
- MAE = **0.260 W/kg** (pré)
- MAE = **0.266 W/kg** (post)

### Résultats clés
- glm linéaire surpasse RF et PCR
- Puissance aux seuils ventilatoires = features dominantes
- Prédiction du changement difficile vs prédiction absolue

### Code
- **Non trouvé**

### Limites
- **Petit échantillon (N=27)** — généralisation très limitée
- Prédiction du delta performance significativement moins bonne
- Cyclistes récréatifs seulement (pas élite)
- Pas de validation externe

### Réutilisabilité PariScore
- **Moyenne** — N trop faible pour transfer direct
- Concept seuils ventilatoires intéressant pour feature engineering
- MAE en W/kg utile comme métrique de référence

---

## Papier D — Kontro et al. (2025) — Modèle 3D Impulse-Response

| Champ | Valeur |
|---|---|
| **Titre** | Individualized 3-Component Impulse-Response Model for Performance in Endurance Sports |
| **Source** | arXiv preprint 2503.14841 / ResearchGate |
| **Accès** | **403 ResearchGate** — preprint arXiv disponible |

### Algorithme
- **Modèle 3D Impulse-Response** (système dynamique, pas ML supervisé classique)
- Calibration individuelle par fitting non-linéaire
- 3 systèmes couplés : alactique / lactique / aérobie

### Features (Inputs)
| Input | Description |
|---|---|
| `training_load_alactic` | Charge d'entraînement alactique (efforts très courts, haute intensité) |
| `training_load_lactic` | Charge lactique (efforts intenses, 30s-3min) |
| `training_load_aerobic` | Charge aérobie (endurance) |

### Outputs
| Output | Description |
|---|---|
| `CP` | Critical Power (W) |
| `W'` | Anaerobic Work Capacity (kJ) |
| `tau` | Constante de temps récupération |

### Dataset
- Pas de dataset fixe — calibration individuelle par test terrain
- Modèle physiologique avec paramètres individuels

### Métriques
- RMSE entre CP modélisé et CP mesuré
- Validation croisée intra-individu

### Résultats clés
- Modèle individualisé meilleur que modèle générique
- 3 systèmes couplés capturent mieux la dynamique d'entraînement
- Applicable à cyclisme, course à pied, aviron

### Code
- **Non trouvé** (pas de repo public référencé)

### Limites
- Pas de ML supervisé — pas de généralisation cross-athlète
- Nécessite données d'entraînement détaillées (difficile à obtenir)
- Calibration complexe (non-linéaire, plusieurs paramètres)
- Pas de validation sur large cohorte

### Réutilisabilité PariScore
- **Faible-Moyenne** — approche différente (physiologique vs data-driven)
- Concept d'individualisation intéressant
- Relation charge → performance utile pour features latentes

---

## Papier E — Horvath & Andersson (2025) — VAM / Power-to-Mass Optimization

| Champ | Valeur |
|---|---|
| **Titre** | Beyond VO2max : The Role of Mass Exponent and Power-to-Weight Ratio in Climbing Performance |
| **Source** | Frontiers in Sports and Active Living |
| **Accès** | **Libre** (Frontiers) |

### Algorithme
- **Simulation numérique** (pas ML)
- Optimisation du mass exponent m pour P/W ratio
- Modèle mécanique de la performance en montée

### Features
| Feature | Description |
|---|---|
| `mass_exponent_m` | Exposant de masse optimal (0.27–0.37 selon profil) |
| `absolute_power_W` | Puissance absolue (W) |
| `body_mass_kg` | Masse corporelle (kg) |
| `gradient_percent` | Pente (%) |
| `wind_speed` | Vitesse du vent |
| `drafting_factor` | Facteur d'abri aérodynamique |

### Profils cyclistes
| Profil | Caractéristiques |
|---|---|
| Sprinter | 80 kg, 1500 W sprint, masse élevée |
| Climber | 58 kg, excellent P/W, masse faible |
| All-rounder | 68 kg, équilibré |
| GC contender | 62 kg, bon contre-la-montre + montagne |
| Time Trialist | 72 kg, aérodynamique, puissance élevée |

### Dataset
- Données théoriques / paramètres standards
- Validation : **TT réels Tour de France 2024** et **Giro d'Italia 2024**

### Métriques
- Erreur relative de temps montée (modèle vs réalité)
- Sensibilité du mass exponent au profil de pente

### Résultats clés
- Mass exponent optimal varie avec le terrain (pentes faibles → m plus bas, pentes fortes → m plus haut)
- Validation sur données réelles Grand Tour 2024
- Impact du vent non négligeable (2-3% sur temps montée)

### Code
- **Non trouvé**

### Limites
- Pas de ML — simulation mécanique uniquement
- Pas de prédiction de résultat de course (seulement performance mécanique)
- Ne prend pas en compte la fatigue, tactique, drafting en groupe
- Validation seulement sur étapes de montagne (pas plat, pas contre-la-montre plat)

### Réutilisabilité PariScore
- **Moyenne** — utile pour features de contextualisation (terrain, profil)
- Mass exponent à intégrer dans un modèle de performance
- Profils types (climber, sprinter, etc.) comme catégories de riders

---

## Papier F — Critical Power Review (Poole et al., non trouvée)

| Champ | Valeur |
|---|---|
| **Titre attendu** | Critical Power : An Important Fatigue Threshold in Exercise Physiology |
| **Source** | Frontiers Physiology (DOI: 10.3389/fphys.2019.00950) |
| **Accès** | **Résolu vers mauvais article** — review non localisée |

### Statut
- **EXCLU DU COMPARATIF** — article non accessible et contenu différent de l'attendu
- La recherche complémentaire a trouvé un article Frontiers Physiology sur CP vs FTP (2021) qui n'est pas la review ciblée
- Le concept Critical Power est déjà couvert par le papier D (Kontro)

---

## Papier G — Bruno Gregory (2021) — ML Pipeline ProCyclingStats

| Champ | Valeur |
|---|---|
| **Titre** | Predicting Winners in Cycling Races with Machine Learning |
| **Source** | Medium |
| **Accès** | **Libre** |

### Algorithmes
- **Random Forest** (meilleur, 95% accuracy)
- **XGBoost**
- **Logistic Regression**
- Ensemble voting classifier

### Features
| Feature | Description |
|---|---|
| `age` | Âge du coureur |
| `weight` | Poids (kg) |
| `height` | Taille (cm) |
| `UCI_points_total` | Points UCI carrière |
| `UCI_points_season` | Points UCI saison en cours |
| `race_history_top10` | Nombre de top 10 dans cette course (historique) |
| `race_history_podium` | Nombre de podiums dans cette course (historique) |
| `parcours_profile` | Profil de parcours (plat, vallonné, montagne) |
| `days_since_last_race` | Jours depuis dernière course |
| `team_strength` | Force de l'équipe (points UCI cumulés équipe) |
| `home_advantage` | Binaire — course dans pays d'origine |

### Target
- Podium finish (classification binaire)
- Win prediction (classification binaire)

### Dataset
- **Source** : ProCyclingStats
- **Période** : 2014–2019
- **Taille** : ~50 000 entrées (toutes courses World Tour)
- **Ratio** : ~5% podiums, ~1% victoires (déséquilibré)

### Métriques
- **95% accuracy** (toutes courses)
- Precision, Recall, F1
- Matrice de confusion

### Résultats clés
- RF meilleur (vs XGBoost, vs LR)
- Feature importance : `UCI_points_season` > `race_history_top10` > `race_history_podium`
- Déséquilibre de classe géré par SMOTE + class weights
- Modèle par type de course (plat/vallon/montagne) meilleur que modèle unique

### Code
- **Non trouvé** (Medium post seulement, pas de repo GitHub référencé)

### Limites
- Pas de validation croisée temporelle robuste (leak possible)
- Accuracy 95% trompeuse (déséquilibre fort — baseline naive ~95% en prédisant "pas podium")
- Pas de features météo, blessures, forme récente (dernières 3 courses)
- Période 2014-2019 → peut être obsolète (évolution équipes, matériel)
- Medium post ne détaille pas les hyperparamètres

### Réutilisabilité PariScore
- **Très forte** — ML pipeline complet, transposable
- RF + SMOTE + class weights = pattern éprouvé pour classification déséquilibrée
- Features PCS directement reproductibles
- Modèles par type de course à adopter

---

# Table de Comparaison Croisée

| Critère | A (Kholkine 2020) | B (Kholkine 2022) | C (Vos 2025) | D (Kontro 2025) | E (Horvath 2025) | G (Gregory 2021) |
|---|---|---|---|---|---|---|
| **Algorithme** | XGBoost | Random Forest | glm (meilleur) | 3D IR model (physio) | Simulation num. | RF (meilleur) |
| **Type ML** | Classification | Classification | Régression | Dynamique syst. | N/A | Classification |
| **Target** | Top-3/Top-5 | Top positions | Δ W/kg 4km TT | CP, W', τ | Temps montée | Podium / Win |
| **Features count** | ~7 | ~8 | ~8 | 3 inputs | ~5 | ~12 |
| **Dataset** | PCS 2008-2019 | PCS étendu | Labo N=27 | Calibration ind. | Théorique + TT | PCS 2014-2019 |
| **N** | Milliers | Milliers | 27 | 1/athlète | N/A | ~50k entrées |
| **Métrique principale** | AUC/F1 | MCC | R²=0.875 | RMSE | Erreur relative | Accuracy 95% |
| **Gère données manquantes** | Oui (XGBoost) | Partiel | N/A | N/A | N/A | Non (drop) |
| **Validation temporelle** | Partielle | Partielle | Non | Intra-athlète | Réelle TT 2024 | Non |
| **Code disponible** | Non | Non | Non | Non | Non | Non |
| **Réutilisabilité** | **Forte** | **Forte** | Moyenne | Faible-Moy. | Moyenne | **Très forte** |
| **Limite principale** | 5 courses seulement | Classification binaire | N=27, récréatifs | Pas cross-athlète | Pas ML, pas résultat course | Pas validation temporelle |

---

# Synthèse — Recommandations pour PariScore

## Approche ML recommandée
**Random Forest** (B, G) + **XGBoost** (A) pour classification, avec **SMOTE** (G) pour déséquilibre de classes. glm (C) pour approche régression si target continue.

## Features clés à prioriser
1. **Points UCI saison + carrière** (omniprésent A, B, G)
2. **Historique course** (top 10/podiums dans cette course spécifique) (B, G)
3. **Forme récente** — EMA ou dernière N courses (A, B)
4. **Profil parcours** (G) + contextualisation terrain (E)
5. **Âge, poids, taille** (B, G)
6. **Récupération** — days_since_last_race (G)

## Métriques de validation
- **Classification** : MCC > Accuracy (dataset déséquilibré) (B, G)
- **Régression** : R², MAE (en W/kg) (C)
- **Validation temporelle** : train antérieur → test postérieur (critique — manquant dans presque tous les papiers)

## Gaps identifiés (opportunités PariScore)
1. **Aucun papier** ne combine ML + features météo en temps réel
2. **Aucun papier** n'utilise de données live (power meter, HR) en cours de course
3. **Validation temporelle** absente de G (pourtant le meilleur candidat)
4. **Aucun code source** trouvé pour reproduction
5. **Aucun papier** ne prédit sur plus d'un an à l'avance

## Verdict
**Papier G (Gregory 2021)** est le plus directement réutilisable pour PariScore — pipeline ML complet, features PCS, RF + SMOTE. **Papier A et B (Kholkine)** apportent la rigueur académique et la validation cross-course. **Papier E (Horvath)** apporte la contextualisation terrain/vent.

---

*Sources : UAntwerpen, Springer, arXiv:2503.14841, Frontiers, Medium, SPONET, Taylor & Francis*
