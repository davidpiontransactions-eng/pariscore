# CYCLING_DATA_SYNTHESIS — PariScore

> Synthèse consolidée de la mission Data Mining Cyclisme
> Juin 2026 — Squad multidisciplinaire : Data Engineers, Data Scientists, Sports Scientist

---

## Table des matières

1. [Architecture des sources de données](#1-architecture-des-sources-de-données)
2. [Pipeline d'acquisition recommandé](#2-pipeline-dacquisition-recommandé)
3. [Métriques avancées](#3-métriques-avancées)
4. [Repos GitHub exploitables](#4-repos-github-exploitables)
5. [Datasets Kaggle & ouverts](#5-datasets-kaggle--ouverts)
6. [Matrice de décision finale](#6-matrice-de-décision-finale)
7. [Plan d'implémentation](#7-plan-dimplémentation)

---

## 1. Architecture des sources de données

### 1.1 Carte des sources

| Source | Accès | Données | Viability | Priorité |
|--------|-------|---------|-----------|----------|
| **ProCyclingStats** | Scraping / API (email) | Résultats, startlists, profils, points UCI, masse coureurs, classements | ✅ Primaire | **P0** |
| **FirstCycling** | Scraping (Cloudflare) | Profils étape, altitude, calendrier | ⚠️ Back-up | P1 |
| **UCI Data Hub** | HTML uniquement | Classements officiels, calendrier, points | ❌ Indirect (via PCS) | P3 |
| **Strava API** | OAuth par athlète | Puissance, FC, segments, entraînement | ❌ **Non viable** | Abandonné |
| **CyclingStage.com** | Scraping | Profils altimétriques, favoris | ✅ Complément | P2 |
| **Climbfinder** | Scraping | Base de cols (pente, distance, altitude) | ✅ Complément | P2 |
| **OpenStreetMap / SRTM** | API Overpass | Données altimétriques | ✅ Gratuit | P3 |
| **Kaggle / GitHub** | Dumps CSV | Datasets historiques | ✅ Pré-entraînement | P1 |

### 1.2 ProCyclingStats (PCS) — Source primaire

**Aspect légal :**
- `robots.txt` : permissif (seul Googlebot restreint sur `/nogooglebot/`)
- T&C : interdisent reproduction/distribution sans permission écrite, pas de clause anti-scraping explicite
- API officielle : existe mais **limitée en 2026** — « Due to high requests, for the remainder of 2026 we take on only limited API requests. Please send an email »
- Juridiction : Pays-Bas (KvK 60039698)
- **Verdict** : scraping en zone grise. Pour usage commercial, contacter PCS pour API officielle

**Wrapper Python `procyclingstats` :**
| Attribut | Valeur |
|----------|--------|
| Package | `procyclingstats` v0.2.8 (mars 2026) |
| Auteur | Martin Madzin (`themm1`) |
| Licence | **MIT** ✅ |
| Stars | 102 ⭐ |
| Dépendances | `beautifulsoup4`, `lxml`, `requests` |
| Classes | `Rider`, `RiderResults`, `Race`, `RaceStartlist`, `RaceClimbs`, `Ranking`, `Stage`, `Team` |

```python
from procyclingstats import Rider
rider = Rider("rider/tadej-pogacar")
rider.birthdate()  # "1998-9-21"
rider.parse()      # dict complet
```

**Pages clés PCS :**
| Page | URL | Données |
|------|-----|---------|
| Fiche coureur | `/rider/{slug}` | Nom, date naissance, poids, taille, spécialités, équipes, résultats |
| Résultat GC | `/race/{slug}/{year}/gc/result` | Classement général, temps, points UCI/PCS |
| Startlist | `/race/{slug}/{year}/startlist` | Composition équipes |
| Classements | `/rankings.php` | Classements UCI et PCS |
| Équipe | `/team/{slug}-{year}` | Effectif, points |
| Statistiques | `/statistics/...` | Variables |

### 1.3 FirstCycling — Source secondaire

**État :**
- Site protégé par **Cloudflare** — retourne **403 sur toutes les pages**
- `robots.txt` inaccessible
- Wrappers existants : `orange-firstcycling` (PyPI v0.1.0, MIT), `r-huijts/firstcycling-mcp` (MCP)
- Le wrapper MCP expose 22 outils structurés (info rider, résultats, courses, recherche)
- **Risque** : blocage permanent si scraping détecté

---

## 2. Pipeline d'acquisition recommandé

### 2.1 Pipeline principal

```
┌─────────────────────────────────────────────────────────────┐
│                    PIPELINE PARISCORE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1 : Historical Data (Offline)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ cyclingdata (R) → 11 125 étapes multi-courses       │   │
│  │ LeTourDataSet (CSV) → coureurs TDF 1903-2025        │   │
│  │ GoldenCheetah → physiologie anonymisée (CC0)        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  Phase 2 : Live Data (Online)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ procyclingstats (Python) → scraping temps réel       │   │
│  │   ├── Rider profiles + historique résultats          │   │
│  │   ├── Race results (GC, stages, classifications)     │   │
│  │   ├── Startlists + team composition                  │   │
│  │   ├── Rankings (UCI + PCS)                           │   │
│  │   └── KOM timing → VAM computation                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  Phase 3 : Enrichissement (Enrich)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CyclingStage → profils altimétriques                 │   │
│  │ Climbfinder → base de cols de référence              │   │
│  │ OSM/SRTM → données d'élévation                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  Phase 4 : Feature Engineering                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ → ELO 5 terrains (montagne/sprint/CLM/pavés/valloné) │   │
│  │ → VAM par col                                         │   │
│  │ → W/kg estimé (back-calc depuis temps ascension)     │   │
│  │ → Team Support Index                                  │   │
│  │ → Fatigue / Form Index (L30) with Banister model     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  Phase 5 : Stockage & API                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SQLite / PostgreSQL (données structurées)            │   │
│  │ Cache layer (données PCS pas scraping à chaque req)  │   │
│  │ API REST PariScore → endpoints prédiction cyclisme   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Code d'acquisition PCS (exemple)

```python
import procyclingstats as pcs
import pandas as pd
from datetime import datetime, timedelta

# --- Phase 1 : Rider profiles ---
riders = ["tadej-pogacar", "jonas-vingegaard", "primož-roglič", 
          "remco-evenepoel", "mathieu-van-der-poel", "wout-van-aert",
          "tadej-pogacar", "ewen-costio", "richard-carapaz", "geraint-thomas"]
rider_data = []
for slug in riders:
    try:
        r = pcs.Rider(f"rider/{slug}")
        data = r.parse()
        rider_data.append(data)
        time.sleep(1)  # Rate limiting
    except Exception as e:
        print(f"Error {slug}: {e}")

df_riders = pd.DataFrame(rider_data)
df_riders.to_csv("data/pcs_riders.csv", index=False)

# --- Phase 2 : Race results ---
races = [("tour-de-france", 2024), ("giro-d-italia", 2024), 
         ("vuelta-a-espana", 2024)]
race_results = []
for race, year in races:
    try:
        r = pcs.Race(f"race/{race}/{year}/gc/result")
        results = r.parse()
        race_results.append({"race": race, "year": year, "results": results})
    except Exception as e:
        print(f"Error {race}/{year}: {e}")

# --- Phase 3 : Startlists ---
for race, year in races:
    try:
        sl = pcs.RaceStartlist(f"race/{race}/{year}/startlist")
        startlist = sl.parse()
        print(f"{race} {year}: {len(startlist)} riders")
    except Exception as e:
        print(f"Error startlist {race}/{year}: {e}")
```

---

## 3. Métriques avancées

### 3.1 ELO Spécifique par terrain (★ 5/5)

**Concept** : 5 ratings orthogonaux (montagne, sprint, CLM, pavés, valloné) mis à jour indépendamment selon le profil de la course.

**Formule :**
```
ELO_post = ELO_pre + K · I · (S − E)
Où S = résultat observé, E = probabilité attendue, K = K-factor variable
K_base = 32 (standard), 48 (WT), 64 (Monuments/GT)
```

**Poids par terrain :** flat 0.5, mountain 1.5, TT 2.0, cobble 1.5, hilly 1.0

**Application :**
- Prédiction GC : 0.6 × ELO_montagne + 0.3 × ELO_CLM + 0.1 × ELO_general
- Match H2H : différence d'ELO terrain → probabilité implicite

### 3.2 VAM — Velocità Ascensionale Media (★ 4/5)

**Formule :** VAM = dénivelé_m / temps_h
**Relation :** W/kg ≈ VAM / 100 (validée pour pentes > 5%)
**Normalisation Frontiers 2025 :** VAM_normalisée = VAM / (masse^0.32) × 100

**Application :** comparaison grimpeurs, prédiction attaque, détection pic de forme

### 3.3 W/kg Estimé (★ 5/5)

**Modèle physique complet :**
```
P = P_gravité + P_aéro + P_roulement
P_gravité = m·g·sin(θ)·v
P_aéro = 0.5·ρ·CdA·v³
P_roulement = m·g·Crr·cos(θ)·v
```

**Précision :** ±0.2 W/kg pour cols > 7%, ±0.5 W/kg pour pentes < 4%

### 3.4 Team Support Index (★ 3/5)

**4 composantes :** Roster depth (0.30), UCI weight (0.25), Collective history (0.25), Historical synergy (0.20)

**Application :** correction probabilité GC, détection leader isolé

### 3.5 Fatigue / Form Index L30 (★ 4/5)

**Modèle Banister :** CTL (EMA 42j) - ATL (EMA 7j) = TSB (forme)
**Composantes :** jours courus L30 (0.35), dénivelé (0.30), altitude > 2000m (0.15), TSB (0.20)

**Application :** prédiction 3e semaine GT, détection risque abandon, comparaison H2H contextuelle

### 3.6 Matrice de corrélation attendue

| Métrique | ELO | VAM | W/kg | TSI | L30 |
|----------|-----|-----|------|-----|-----|
| ELO | 1.00 | 0.45 | 0.50 | 0.20 | -0.10 |
| VAM | 0.45 | 1.00 | 0.85 | 0.05 | -0.25 |
| W/kg | 0.50 | 0.85 | 1.00 | 0.05 | -0.20 |
| TSI | 0.20 | 0.05 | 0.05 | 1.00 | 0.05 |
| L30 | -0.10 | -0.25 | -0.20 | 0.05 | 1.00 |

→ Faible multicolinéarité → toutes les métriques sont combinables.

---

## 4. Repos GitHub exploitables

### 4.1 Top repos (production-ready)

| Repo | Stars | Licence | Utilité | Intégration |
|------|-------|---------|---------|-------------|
| **themm1/procyclingstats** | 102 ⭐ | MIT ✅ | Source données primaire | `pip install procyclingstats` |
| **r-huijts/firstcycling-mcp** | 18 ⭐ | MIT ✅ | Back-up FirstCycling | Serveur MCP |

### 4.2 Repos de référence architecturale

| Repo | Licence | Utilité | Note |
|------|---------|---------|------|
| skuxy/pcs-predictor | Aucune | Architecture scraper + SQLite | Étudier, ne pas copier |
| SamMorton123/velo-research | Aucune | Meilleure référence ELO multi-terrain | Méthodologie ELO à reproduire |
| martinalex/cyclocross-predictions | MIT ✅ | Pipeline ML cyclisme | Adapter route depuis cyclocross |
| baronet2/Bike2Vec | Aucune | Embeddings riders/courses (arXiv 2305.10471) | Réimplémenter depuis le papier |
| **GoldenCheetah/GoldenCheetah** | GPL-2.0 | Formules puissance, CP, CTL/ATL | Référence maths, pas code C++ |

### 4.3 Repos disparus (perte critique)

| Repo | Perte |
|------|-------|
| **lewis-mcgillion/cycling-predictor** | ❌ **GONE (404)** — XGBoost, 475 features, Kelly staking, Flask |
| mohsinhm/cycling-performance-prediction-ml | ❌ GONE (404) |

→ **Head-to-head prediction à construire from scratch.**

---

## 5. Datasets Kaggle & ouverts

### 5.1 Top 3 datasets

| Dataset | Type | Période | Licence | Utilité |
|---------|------|---------|---------|---------|
| **cyclingdata** (Jens Lemb) | R/CSV | 1903-2024 | MIT | 11 125 étapes multi-courses, features profil |
| **LeTourDataSet** (Camminady) | CSV | 1903-2025 | MIT | Coureurs TDF, temps, écarts, màj automatisée |
| **GoldenCheetah OpenData** | JSON/FIT | N/A | CC0 | 18 000+ fichiers puissance, seul dataset watts public |

### 5.2 Pipeline dataset recommandé

```
1. cyclingdata (R) → exporter CSV → features étapes (profil, difficulté, startlist quality)
2. LeTourDataSet → features coureurs TDF (temps, écarts, classements)
3. procyclingstats (Python) → scraping Giro, Vuelta, classements UCI
4. GoldenCheetah → entraînement modèle physiologique (optionnel, CC0)
```

### 5.3 Gaps identifiés

- ❌ **Aucun dataset de puissance (watts) pour les pros** — données propriétaires
- ❌ **Aucun dataset d'odds cyclisme sur Kaggle**
- ⚠️ Données pré-2000 très lacunaires pour les non-Grand Tours

---

## 6. Matrice de décision finale

### 6.1 Sources de données

| Source | Priorité | Faisabilité | Risque | Coût | Effort |
|--------|----------|-------------|--------|------|--------|
| PCS (procyclingstats) | **P0** | ✅ Très facile | ⚠️ Zone grise | 0€ | Faible |
| PCS (API officielle) | P1 | ⏳ À contacter | ✅ Légal | ? | Moyen |
| FirstCycling (MCP) | P2 | ⚠️ Cloudflare | ⚠️ Blocage | 0€ | Moyen |
| CyclingStage.com | P2 | ✅ Facile | ✅ Faible | 0€ | Faible |
| Climbfinder | P2 | ✅ Facile | ✅ Faible | 0€ | Faible |
| Kaggle datasets | P1 | ✅ Direct | ✅ Aucun | 0€ | Faible |
| Strava API | ❌ Abandonné | ❌ OAuth + paywall | ❌ AI/ML ban | 11.99€/mois | Élevé |

### 6.2 Métriques à implémenter

| Métrique | Priorité | Dépendance données | Effort | Impact prédictif |
|----------|----------|--------------------|--------|------------------|
| ELO 5 terrains | **P0** | PCS résultats | 3-5 jours | Très haut |
| Fatigue L30 | **P0** | PCS calendrier | 2-3 jours | Haut |
| W/kg estimé | **P1** | PCS temps + base cols | 5-7 jours | Très haut |
| VAM | **P1** | PCS KOM + base cols | 3-4 jours | Haut |
| Team Support Index | **P2** | PCS startlists + results | 2-3 jours | Moyen |

### 6.3 Infrastructure

| Composant | Technologie | Priorité |
|-----------|-------------|----------|
| Data scraper | Python + `procyclingstats` | **P0** |
| Stockage | SQLite (dev) → PostgreSQL (prod) | **P0** |
| Feature store | Python + pandas + numpy | **P1** |
| ML pipeline | scikit-learn (RF + Platt scaling) | **P1** |
| Embeddings | Word2Vec adapté (Bike2Vec paper) | **P2** |
| API | FastAPI (inspiré VeloPredict) | **P2** |

---

## 7. Plan d'implémentation

### Semaine 1 — Fondation Data
- [ ] Tester `procyclingstats` : extraire 10 riders + 5 courses
- [ ] Cartographier les classes disponibles vs besoins
- [ ] Contacter PCS pour API officielle (prix, contrat)
- [ ] Démarrer base de données SQLite (schéma riders, races, results)
- [ ] Importer cyclingdata (R → CSV) et LeTourDataSet

### Semaine 2 — Feature Engineering
- [ ] Implémenter ELO 5 terrains + tests
- [ ] Implémenter Fatigue L30 (modèle Banister proxy)
- [ ] Construire base de cols (Climbfinder + CyclingStage)
- [ ] Pipeline VAM (KOM timing PCS)

### Semaine 3 — Modèle & Calibration
- [ ] Implémenter W/kg estimé (modèle physique)
- [ ] Construire jeu de features complet (15+ features)
- [ ] RF + Platt scaling (inspiré VeloPredict)
- [ ] Évaluer : MCC, Brier score, NDCG@10

### Semaine 4 — Production
- [ ] API FastAPI (endpoints prédiction cyclisme)
- [ ] Intégration server.js PariScore
- [ ] UI onglet Cyclisme pariscore.html
- [ ] Tests + déploiement

---

## Annexes

### A. Références GitHub

| URL | Utilité |
|-----|---------|
| https://github.com/themm1/procyclingstats | Scraper PCS (MIT, 102⭐, actif) |
| https://github.com/r-huijts/firstcycling-mcp | MCP FirstCycling (MIT, 18⭐) |
| https://github.com/skuxy/pcs-predictor | Architecture ML référence (no license) |
| https://github.com/SamMorton123/velo-research | ELO multi-terrain (no license) |
| https://github.com/martinalex/cyclocross-predictions | Pipeline RF cyclocross (MIT) |
| https://github.com/GoldenCheetah/OpenData | Données physiologiques (CC0) |

### B. Datasets clés

| Dataset | URL |
|---------|-----|
| cyclingdata (R) | https://jenslemb.github.io/cyclingdata/ |
| LeTourDataSet | https://github.com/thomascamminady/LeTourDataSet |
| GoldenCheetah OpenData | https://github.com/GoldenCheetah/OpenData |
| Le Tour de France Database (Kaggle) | https://www.kaggle.com/datasets/sujaykapadnis/le-tour-de-france-database-1903-2023 |

### C. Fichiers produits par la squad

| Fichier | Contenu | Auteur |
|---------|---------|--------|
| `.context/data-engineer-pcs-firstcycling.md` | Analyse PCS + FirstCycling (149 lignes) | Data Engineer |
| `.context/data-engineer-uci-strava.md` | Analyse UCI + Strava (59 lignes) | Data Engineer |
| `.context/data-scientist-kaggle-datasets.md` | 11 datasets Kaggle (277 lignes) | Data Scientist |
| `.context/data-scientist-github-repos.md` | 15 repos GitHub (296 lignes) | Data Scientist |
| `.context/sports-analyst-metrics-architecture.md` | 5 métriques avec code (779 lignes) | Sports Scientist |
| `.context/cycling-competitive-analysis.md` | Benchmark 5 sites concurrents | Phase 1 |
| `.context/cycling-scientific-review.md` | Revue 8 papiers académiques | Phase 2 |
| `.context/rapport-papiers-prediction-cyclisme.md` | Deep-dive 7 papiers | Agent 1 |
| `.context/agent-a-complement-competitive-economic.md` | Analyse éco concurrentielle | Agent A |
| `.context/agent-b-refonte-scientifique.md` | Refonte TOC + 13 fiches papiers | Agent B |
| `.context/agent-c-complement-deep-dive.md` | Critical Power + Gregory debunk | Agent C |
| `.context/agent-d-prototype-calibration.md` | Prototype RF + calibration | Agent D |
| `CYCLING_DATA_SYNTHESIS.md` | **Cette synthèse** | Squad |

---

*Document généré par la squad Data Mining Cyclisme — PariScore, Juin 2026*
