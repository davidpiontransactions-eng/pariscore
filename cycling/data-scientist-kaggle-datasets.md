# Datasets Cyclisme — Analyse pour PariScore

> Recherche et analyse de tous les datasets Kaggle et sources ouvertes pertinents pour la prédiction cycliste (Tour de France, courses pros, performances, paris sportifs).

---

## Classement par Note de Réutilisabilité (1-5)

| # | Dataset | Type | Période | Note |
|---|---------|------|---------|:----:|
| 1 | **cyclingdata** (Jens Lemb) | R package / CSV | 1903-2024 | ⭐⭐⭐⭐⭐ |
| 2 | **LeTourDataSet** (Camminady) | CSV (GitHub) | 1903-2025 | ⭐⭐⭐⭐⭐ |
| 3 | **GoldenCheetah OpenData** | JSON (FIT) | N/A | ⭐⭐⭐⭐ |
| 4 | **Sujay Kapadnis — TDF DB** | CSV (Kaggle) | 1903-2023 | ⭐⭐⭐⭐ |
| 5 | **Maven Analytics — TDF** | CSV | 1903-2022 | ⭐⭐⭐½ |
| 6 | **procyclingstats (Python)** | Librairie scraping | Temps réel | ⭐⭐⭐½ |
| 7 | **MiguelMaertens PCS** | CSV (GitHub) | 1980s-2024 | ⭐⭐⭐ |
| 8 | **Cycling World Championships** | CSV (Kaggle) | 1927-2024 | ⭐⭐⭐ |
| 9 | **Eloi Navet TDF** | CSV | 1903-2024 | ⭐⭐⭐ |
| 10 | **Cycling Metrics** | CSV (Kaggle) | N/A | ⭐⭐½ |
| 11 | **UCI Track Cycling WC** | CSV (Kaggle) | N/A | ⭐⭐ |

---

## Fiches Détaillées

### 1. cyclingdata — Jens Lemb ★★★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | `cyclingdata` — Comprehensive dataset on stage-races |
| **URL** | https://jenslemb.github.io/cyclingdata/ |
| **Source** | ProCyclingStats (scrapé) |
| **Type données** | Étapes de courses à étapes professionnelles |
| **Période** | 1903 – 2024 |
| **Taille** | 11 125 lignes, 18 colonnes |
| **Courses incluses** | Tour de France, Giro, Vuelta, Dauphiné, Basque Country, Paris-Nice, Tirreno, Pologne, Romandie, Suisse, Catalunya |
| **Features** | `race`, `year`, `stage`, `stage_id`, `stage_num`, `stage_type`, `date`, `departure`, `arrival`, `parcours_type`, `distance`, `vertical_meters`, `profile_score`, `startlist_quality`, `avg_speed_winner`, `won_how`, `win_type`, `km_solo` |
| **Points forts** | Données de profil d'étape (profile_score, vertical_meters), startlist_quality, win_type. Multi-courses (pas que TDF). |
| **Points faibles** | Beaucoup de données manquantes avant 2000 (hors Grands Tours). Pas de résultats coureurs individuels (v1 uniquement étapes). |
| **Licence** | MIT |
| **Prêt-à-emploi** | Oui — package R, `devtools::install_github("jenslemb/cyclingdata")` |
| **Utilité PariScore** | Excellente pour features sur profil d'étape, difficulté, qualité du peloton, type de victoire. |

---

### 2. LeTourDataSet — Thomas Camminady ★★★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | LeTourDataSet |
| **URL** | https://github.com/thomascamminady/LeTourDataSet |
| **Source** | letour.fr, letourfemmes.fr (scrapé) |
| **Type données** | Coureurs, étapes, classements — Tour de France hommes & femmes |
| **Période** | Hommes: 1903-2025 · Femmes: 2022-2025 |
| **Taille** | 6 fichiers CSV (3 hommes + 3 femmes) |
| **Fichiers** | `TDF_Riders_History.csv`, `TDF_Stages_History.csv`, `TDF_All_Rankings_History.csv` (+ femmes) |
| **Features (riders)** | Rank, Rider, Team, Times, Gap, Year, Distance, Number of stages, TotalSeconds, GapSeconds |
| **Features (stages)** | Stage name, date, departure, arrival, distance, type |
| **Points forts** | Données coureur-level avec temps et écarts. Protection d'intégrité (GitHub Actions). Màj annuelle automatisée. Données femmes incluses. |
| **Points faibles** | Tour de France uniquement (pas Giro/Vuelta/autres). |
| **Licence** | MIT |
| **Prêt-à-emploi** | Oui — CSV prêts à l'emploi, `make install && make update` |
| **Utilité PariScore** | Excellente pour features basées sur performances individuelles des coureurs au TDF. |

---

### 3. GoldenCheetah OpenData ★★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | GoldenCheetah OpenData |
| **URL** | https://github.com/GoldenCheetah/OpenData |
| **Source** | Athlètes anonymisés (FIT files) |
| **Type données** | Données physiologiques — puissance, FC, vitesse, cadence |
| **Période** | N/A (fichiers d'entraînement individuels) |
| **Taille** | 18 000+ fichiers |
| **Features** | Power (watts), Heart Rate, Speed, Cadence, Altitude, Timestamps |
| **Points forts** | **Seul dataset public de puissance cycliste**. Données brutes FIT. CC0. |
| **Points faibles** | Pas de lien avec courses pros. Données anonymisées. Pas de résultats de course. |
| **Licence** | CC0 (Public Domain) |
| **Prêt-à-emploi** | Oui — JSON/FIT |
| **Utilité PariScore** | Modélisation de performance physiologique (FTP, W/kg, power profiles). Peut servir à créer des profils de puissance synthétiques. |

---

### 4. Sujay Kapadnis — Le Tour de France Database 1903-2023 ★★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | Le Tour De France DataBase [1903-2023] |
| **URL** | https://www.kaggle.com/datasets/sujaykapadnis/le-tour-de-france-database-1903-2023 |
| **Source** | Wikipedia, letour.fr |
| **Type données** | Résultats coureurs + étapes TDF |
| **Période** | 1903 – 2023 |
| **Taille** | 9 878 lignes (riders), 2 365 lignes (stages) |
| **Features (riders)** | Rank, Rider, Rider.No., Team, Times, Gap, Year, Distance (km), Number.of.stages, TotalSeconds, GapSeconds |
| **Features (stages)** | Year, TotalTDFDistance, Stage (name) |
| **Points forts** | Grand volume de données coureurs. Colonnes TotalSeconds/GapSeconds prêtes pour ML. |
| **Points faibles** | Tour de France uniquement. Colonnes variables selon années (données hétérogènes pré-WWII). Page Kaggle crash (JS). Contournement: téléchargement direct via Kaggle API. |
| **Licence** | Non spécifiée (Kaggle) |
| **Prêt-à-emploi** | Oui — CSV (téléchargement via Kaggle API) |
| **Utilité PariScore** | Base solide pour prédiction de classement TDF. |

---

### 5. Maven Analytics — Tour de France ★★★½

| Champ | Valeur |
|-------|--------|
| **Nom** | Tour de France — Maven Analytics Data Playground |
| **URL** | https://mavenanalytics.io/data-playground/tour-de-france |
| **Source** | Wikipedia |
| **Type données** | Résultats agrégés par édition |
| **Période** | 1903 – 2022 |
| **Taille** | 499 records, 25 fields |
| **Features** | Stages, distance, entrants, finishers, winning times, etc. |
| **Points forts** | Propre, bien documenté. 25 colonnes. Licence Public Domain. |
| **Points faibles** | Données agrégées par édition (pas coureur-level). Nécessite inscription pour download. |
| **Licence** | Public Domain |
| **Prêt-à-emploi** | Oui — CSV (inscription requise) |
| **Utilité PariScore** | Features globales par édition, analyse macro. |

---

### 6. procyclingstats (Python) — themm1 ★★★½

| Champ | Valeur |
|-------|--------|
| **Nom** | procyclingstats — Python scraper |
| **URL** | https://github.com/themm1/procyclingstats |
| **Source** | ProCyclingStats (scraping temps réel) |
| **Type données** | Toutes les données PCS (coureurs, courses, étapes, équipes, classements) |
| **Période** | Temps réel (données historiques disponibles via PCS) |
| **Format** | API Python → dicts/listes |
| **Classes** | `Rider`, `Race`, `Stage`, `Team`, `Ranking`, `RaceStartlist`, `RaceClimbs`, `RiderResults` |
| **Points forts** | Accès à **toutes** les données PCS. Pas de limite de volume. Données temps réel. |
| **Points faibles** | Dépend du HTML de PCS (casse potentielle). Pas un dataset figé — nécessite scraping. |
| **Licence** | MIT |
| **Installation** | `pip install procyclingstats` |
| **Utilité PariScore** | Source de données vivante pour alimenter le modèle en continu. |

---

### 7. MiguelMaertens — ProCyclingStats Dataset ★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | ProCyclingStats — Dataset creation and rider characteristics analysis |
| **URL** | https://github.com/MiguelMaertens/ProCyclingStats |
| **Source** | ProCyclingStats |
| **Type données** | Résultats courses + caractéristiques coureurs |
| **Fichier** | `pro_cycling.csv` |
| **Features** | Données de course, caractéristiques des coureurs (taille, poids, âge, etc.) |
| **Points forts** | Inclut des données anthropométriques des coureurs. |
| **Points faibles** | Volume limité. Projet académique (peut ne pas être maintenu). |
| **Licence** | Non spécifiée |
| **Prêt-à-emploi** | Oui — CSV |
| **Utilité PariScore** | Utile pour features coureur (taille/poids → W/kg estimé). |

---

### 8. Cycling World Championships (1927-2024) ★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | Cycling World Championships (1927-2024) |
| **URL** | https://www.kaggle.com/datasets/emiliencoicaud/cycling-world-championships-1927-2024 |
| **Source** | N/A |
| **Type données** | Championnats du monde cyclisme sur route |
| **Période** | 1927 – 2024 |
| **Points forts** | Longue période historique. |
| **Points faibles** | Uniquement championnats du monde (1 course/an). Page Kaggle instable. |
| **Prêt-à-emploi** | Oui — CSV (sous réserve accès Kaggle) |
| **Utilité PariScore** | Faible — données trop sporadiques pour un modèle prédictif. |

---

### 9. Eloi Navet — Tour de France Dataset ★★★

| Champ | Valeur |
|-------|--------|
| **Nom** | Tour de France Dataset (fork amélioré) |
| **URL** | https://eloinavet.github.io/en/project/tdf/ |
| **Source** | letour.fr (officiel) |
| **Type données** | Résultats TDF |
| **Période** | 1903 – 2024 |
| **Format** | CSV |
| **Points forts** | Données officielles letour.fr. Fork d'un dataset existant amélioré. |
| **Points faibles** | Documentation limitée. Volume non précisé. |
| **Licence** | CC BY-NC-ND 4.0 |
| **Prêt-à-emploi** | Oui — CSV |
| **Utilité PariScore** | Alternative au dataset Camminady si besoin source officielle. |

---

### 10. Cycling Metrics ★★½

| Champ | Valeur |
|-------|--------|
| **Nom** | Cycling Metrics |
| **URL** | https://www.kaggle.com/datasets/dixienewsome/cycling/data |
| **Source** | Indoor & outdoor cycling |
| **Type données** | Métriques d'entraînement cyclisme |
| **Points forts** | Données brutes d'effort. |
| **Points faibles** | Provenance amateur, pas de lien avec courses pros. Documentation minimale. |
| **Utilité PariScore** | Faible — données non structurées pour le contexte pro. |

---

### 11. UCI Track Cycling World Championships ★★

| Champ | Valeur |
|-------|--------|
| **Nom** | UCI Track Cycling World Championships |
| **URL** | https://www.kaggle.com/datasets/mathurinache/uci-track-cycling-world-championships |
| **Source** | N/A |
| **Type données** | Championnats du monde de cyclisme sur piste |
| **Utilité PariScore** | Très faible — le projet PariScore est axé route, pas piste. |

---

## Datasets Non-Kaggle (Références Externes)

### ProCyclingStats.com (Source Primaire)
| Champ | Valeur |
|-------|--------|
| **URL** | https://www.procyclingstats.com |
| **Contenu** | Résultats courses pros, profils coureurs, classements, startlists, parcours |
| **API** | Pas d'API officielle — scrapers disponibles: `procyclingstats` (Python), `cyclingdata` (R) |
| **Utilité** | Source la plus complète pour les données cyclisme pro. |

### Strava / Veloviewer
| Champ | Valeur |
|-------|--------|
| **URL** | https://www.veloviewer.com |
| **Contenu** | Segment leaderboards, performances historiques |
| **Accès** | Compte Strava requis. Données non publiques en vrac. |

### OpenStreetMap / SRTM (Données Élévation)
| Champ | Valeur |
|-------|--------|
| **URL** | https://www.openstreetmap.org |
| **Contenu** | Profils d'élévation, données géospatiales |
| **Licence** | ODbL |
| **Utilité** | Reconstruction de profils d'étape si besoin. |

### TheOddsAPI / PredictionData.io (Paris Sportifs)
| Champ | Valeur |
|-------|--------|
| **Contenu** | Cotes et odds pour les courses cyclistes |
| **Accès** | API payantes |
| **Utilité** | Source de données pour les features de marché. |

---

## Recommandations pour PariScore

### Dataset Principal Recommandé
**`cyclingdata` (R) + `LeTourDataSet` (CSV)** en combinaison :
- `cyclingdata` pour les features au niveau étape (profil, difficulté, type de victoire, startlist quality) — multi-courses
- `LeTourDataSet` pour les features au niveau coureur (temps, écarts, classements) — TDF uniquement

### Pipeline d'Acquisition Suggéré

```
1. cyclingdata (R) → exporter en CSV → features étapes
2. LeTourDataSet (CSV) → features coureurs TDF
3. procyclingstats (Python) → scraping complémentaire (Giro, Vuelta, classements UCI)
4. GoldenCheetah OpenData → entraînement modèle performance physiologique (optionnel)
```

### Points d'Attention
- **Aucun dataset de puissance (watts) pour les pros** — les données physiologiques pros sont propriétaires. GoldenCheetah OpenData est la seule source publique, mais anonymisée et non-pro.
- **Aucun dataset d'odds/paris cyclisme sur Kaggle** — nécessite API payante (TheOddsAPI, PredictionData.io) ou scraping.
- **Données pré-2000** — très lacunaires pour les courses non-Grand Tours. Privilégier 2000+ pour l'entraînement.
- **Maintenance** — `cyclingdata` et `LeTourDataSet` sont activement maintenus (2025). Les datasets Kaggle peuvent être obsolètes.
