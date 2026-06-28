# Data Engineering Report : ProCyclingStats & FirstCycling

**Date** : 2026-06-26
**Auteur** : Data Engineer
**Contexte** : Évaluation des sources de données cyclisme pour PariScore

---

## 1. ProCyclingStats (PCS)

### 1.1 Aspect Légal

| Élément | Statut |
|---|---|
| `robots.txt` | Très permissif. Seul Googlebot est restreint sur `/nogooglebot/`. Aucun blocage des bots en général. |
| T&C – Restrictions | Interdit la revente, location, distribution, hébergement, exploitation commerciale de la plateforme. Pas de mention explicite du scraping automatisé. |
| T&C – Propriété intellectuelle | "The material may not be copied, modified, reproduced, downloaded or distributed in any way, in whole or in part, without the express prior written permission" |
| Licence | "Revocable, non-exclusive, non-transferable, limited license to download, install and use the website" |
| Juridiction | Pays-Bas (KvK 60039698, VAT NL853742054B01) |
| API officielle | Existe mais **limitée en 2026** : "Due to high requests, for the remainder of 2026 we take on only limited API requests. Please send an email" – pas d'API publique self-service. |

**Verdict légal** : Le scraping est dans une zone grise. Les T&C interdisent la reproduction/distribution sans permission écrite, et la licence limite l'usage. Pour un usage commercial (PariScore), mieux vaut contacter PCS pour l'API officielle ou demander une autorisation explicite.

### 1.2 Structure du Site

- **Base URL** : `https://www.procyclingstats.com`
- **Pages clés** :
  - Fiche coureur : `/rider/{slug}` (ex: `/rider/tadej-pogacar`)
  - Résultat course : `/race/{slug}/{annee}/gc/result` (ex: `/race/tour-de-france/2024/gc`)
  - Startlist : `/race/{slug}/{annee}/startlist`
  - Classements : `/rankings.php`
  - Équipe : `/team/{slug}-{annee}`
  - Statistiques : `/statistics/...`
- **Format** : HTML (pas d'API JSON publique)
- **Anti-bot** : Aucun détecté (pas de Cloudflare, pas de CAPTCHA sur les pages testées)
- **Données disponibles** (page rider) :
  - Nom, date de naissance, nationalité, poids, taille
  - Spécialités (points par type : GC, one-day, TT, sprint, climber, hills)
  - Équipes (historique complet avec années)
  - Résultats (table triable : date, place, course, distance, points PCS, points UCI)
  - Programme / calendrier
  - Head-to-head
  - Classements PCS et UCI
  - Badges, statistiques clés
- **Données disponibles** (page course GC) :
  - Classement général (rang, nom, équipe, temps, points UCI, points PCS)
  - Filtres par équipe, nation, âge, spécialité
  - Navigation par année, par étape

### 1.3 Wrapper Python Existant : `procyclingstats`

| Attribut | Valeur |
|---|---|
| Package PyPI | `procyclingstats` v0.2.8 (mars 2026) |
| Auteur | Martin Madzin (`themm1`) |
| Licence | MIT |
| Dépendances | `beautifulsoup4`, `lxml`, `requests` |
| Méthode | Scraping HTML |
| Classes disponibles | `Rider`, `RiderResults`, `Race`, `RaceStartlist`, `RaceClimbs`, `RaceCombativeRiders`, `Ranking`, `Stage`, `Team` |
| Maturité | 17 releases (fév. 2023 – mars 2026), actif |
| GitHub | `github.com/themm1/procyclingstats` |
| Docs | `procyclingstats.readthedocs.io` |

**Exemple d'utilisation** :
```python
from procyclingstats import Rider
rider = Rider("rider/tadej-pogacar")
rider.birthdate()  # "1998-9-21"
rider.parse()      # dict complet
```

---

## 2. FirstCycling

### 2.1 Aspect Légal

| Élément | Statut |
|---|---|
| `robots.txt` | **Inaccessible** (403) |
| T&C | Non vérifié (site protégé) |
| Accès direct | **Bloqué** – retourne 403 sur toutes les pages testées (`/`, `robots.txt`, `rider.php?r=2`, `ranking.php`) |

**Verdict légal** : Impossible d'évaluer car le site est inaccessible. Le blocage 403 est probablement un Cloudflare WAF ou une protection anti-bot classique. Le contournement (user-agent navigateur, cookies, proxy) est risqué légalement.

### 2.2 Structure du Site (déduite)

- **Base URL** : `https://www.firstcycling.com`
- **Format** : Pages PHP avec paramètres GET
- **Pages supposées** :
  - Fiche coureur : `rider.php?r={id}`
  - Résultat course : `race.php?r={id}&y={year}`
  - Classements : `ranking.php`
- **Protection** : Cloudflare (probable) – blocage 403 immédiat depuis un IP scraping

### 2.3 Wrappers Existants

| Wrapper | Type | Auteur | Licence | Qualité |
|---|---|---|---|---|
| `baronet2/FirstCyclingAPI` | Python (PyPI `orange-firstcycling` non, c'est un projet GitHub) | baronet2 | MIT | Fonctionnel, scraping HTML |
| `r-huijts/firstcycling-mcp` | Serveur MCP Python | r-huijts | MIT | Utilise FirstCyclingAPI en interne |
| `orange-firstcycling` (PyPI) | Package MCP wrapper | orange.ai / hientranea | MIT | v0.1.0, avr. 2025, 6.3 kB, dépend de `beautifulsoup4`, `lxml`, `pandas`, `slumber` |

Le `orange-firstcycling` est un serveur MCP qui expose des outils structurés :
- **Rider** : `get_rider_info`, `get_rider_best_results`, `get_rider_grand_tour_results`, `get_rider_monument_results`, `get_rider_team_and_ranking`, `get_rider_race_history`, `get_rider_one_day_races`, `get_rider_stage_races`, `get_rider_teams`, `get_rider_victories`
- **Race** : `get_race_results`, `get_race_overview`, `get_race_stage_profiles`, `get_race_startlist`, `get_race_victory_table`, `get_race_year_by_year`, `get_race_youngest_oldest_winners`, `get_race_stage_victories`
- **Search** : `search_rider`, `search_race`

---

## 3. Comparatif & Recommandations

### 3.1 Tableau Comparatif

| Critère | PCS | FirstCycling |
|---|---|---|
| Accès direct | ✅ Libre (HTML) | ❌ Bloqué (403) |
| Robots.txt | ✅ Permissif | ❌ Inaccessible |
| API officielle | ⚠️ Limitée (sur email) | ❌ Aucune |
| Wrapper Python mature | ✅ `procyclingstats` (MIT, actif) | ⚠️ `orange-firstcycling` (v0.1.0) |
| Structure URLs | ✅ Propres, slug-based | ❌ IDs numériques fragiles |
| Couverture historique | ✅ Très bonne (1903+) | ✅ Bonne |
| Points UCI | ✅ Oui | ✅ Oui |
| Points PCS propriétaires | ✅ Oui | ❌ Non |
| Risque légal scraping | ⚠️ Zone grise (T&C stricts) | ❌ Site bloqué |
| Maintenance wrapper | ✅ Active (2026) | ⚠️ Faible activité |

### 3.2 Recommandation

**PCS comme source primaire** :
- Utiliser `procyclingstats` (wrapper PyPI) comme couche d'abstraction
- Si besoin de données non couvertes par le wrapper, scraper directement le HTML avec `beautifulsoup4` + `requests`
- Contacter PCS pour l'API officielle si usage commercial (email dans `/info/api`)
- Respecter un taux de requêtes raisonnable (pas de bombardement)

**FirstCycling comme source secondaire** :
- Utiliser `orange-firstcycling` (serveur MCP) si les données PCS sont insuffisantes
- Alternative : wrapper `baronet2/FirstCyclingAPI` directement
- Le blocage 403 peut nécessiter un proxy tournant ou des headers navigateur réalistes
- Risque de blocage permanent si détecté

### 3.3 Prochaines Étapes Techniques

1. Tester `procyclingstats` en local : extraire 10 riders, 5 courses, vérifier taux d'erreur
2. Analyser les classes du wrapper : `Rider`, `RiderResults`, `Race`, `RaceStartlist`, `Ranking`, `Stage`, `Team`
3. Cartographier les données disponibles vs. besoins PariScore (classements, cotes, tendances)
4. Tester `orange-firstcycling` en mode MCP Inspector
5. Évaluer la stabilité des deux sources sur 7 jours (taux de changement HTML, 403 intermittents)
6. Contacter PCS pour l'API officielle (limites, prix, contrat)
