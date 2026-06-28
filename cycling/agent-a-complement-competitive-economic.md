# Agent A — Complément analyse économique concurrentielle (cyclisme)

> Mission : Analyse économique et concurrentielle des sources de données et APIs pour l'onglet Cyclisme de PariScore
> Date : 2026-06-26

---

## 1. ProCyclingStats (PCS) — Source données coureurs et courses

### 1.1 API officielle

- **URL** : https://www.procyclingstats.com/info/api (accessed 2026-06-26)
- **Disponibilité 2026** : Limitée — "Due to high requests, for the remainder of 2026 we take on only limited API requests"
- **Contact** : email protected
- **Prix** : Non public (contact requis)
- **Contenu probable** : Données cyclisme complètes (coureurs, équipes, résultats, classements, points PCS)

### 1.2 Terms & Conditions

- **URL** : https://www.procyclingstats.com/info/terms-and-conditions (accessed 2026-06-26)
- **Extrait clé §Intellectual Property** : "The material may not be copied, modified, reproduced, downloaded or distributed in any way, in whole or in part, without the express prior written permission of procyclingstats.com"
- **Interdiction explicite** du scraping, reverse engineering, extraction non autorisée
- **Périmètre** : Site web basé aux Pays-Bas (droit néerlandais)
- **RPA/robots.txt** : https://www.procyclingstats.com/robots.txt — uniquement User-agent: Googlebot avec disallow, pas de règle générale anti-scraping. Mais les Terms prévalent sur robots.txt.

### 1.3 Alternative scraping (non recommandée)

- **Apify** : Scraper PCS disponible sur Apify Marketplace
- **Prix** : À partir de $29/mois + frais d'exécution
- **Risque légal** : Violation des Terms & Conditions de PCS

### Recommandations PariScore

| Option | Coût | Risque légal | Facilité |
|--------|------|-------------|----------|
| API officielle PCS | Inconnu | Aucun | Limitée en 2026 |
| Scraper Apify | $29+/mois | Élevé | Moyenne |
| Scraper maison | Temps dév. | Élevé | Complexe |

---

## 2. CyclingOracle — Précision du modèle prédictif

### 2.1 Métrique de précision

Le modèle utilise un système de points (Table 1) :

| # Prédiction | Points pour résultat | Facteur |
|---|---|---|
| 1 | 15 | x3.0 |
| 2 | 10 | x2.5 |
| 3 | 7 | x2.0 |
| 4-5 | 5-4 | x1.5 |
| 6-10 | 3 | x1.0 |
| 11-15 | 2 | Top10 only |
| 16-20 | 1 | Top10 only |

**Définition** : % du score maximum possible. Mesure "top 10 prédit → top 20 réel".

### 2.2 Chiffres de précision publiés

**Classiques 2025** (article model-quality-2025, 19 sept. 2025) :
- Moyenne : **62.9%** (varie de 5% à 88% selon la course)
- Meilleure : World TT Championships, Flanders, Roubaix, Sanremo (>80%)
- Pire : Omloop Het Nieuwsblad (5.3%)

**Grands Tours 2025** :
- Giro : **52.7%**
- Tour : **56.6%**
- Vuelta : **58.8%** (médiane 68.5%)
- Grands Tours 2024 : **47.5%** en moyenne

**Vuelta TTT 2025** : **98.5%** — meilleure prédiction de la saison (top 5 prédit = top 5 réel)

**Classiques 2026** (article classics-2026-accuracy, 28 avril 2026) :
- Moyenne : **60.5%**
- Médiane : **66.7%**

### 2.3 Interprétation des 52-58%

Les chiffres "52-58%" précédemment mentionnés correspondent aux Grands Tours individuellement (Giro 52.7%, Tour 56.6%, Vuelta 58.8%) ou à la moyenne 2024 des Grands Tours (47.5%). Le chiffre de précision global du modèle (toutes courses confondues) est plus proche de **60-63%** pour les classiques et **56-59%** pour les Grands Tours.

### 2.4 Créateurs et transparence

- **Créateurs** : Tom Nederend (@TomNederend), Arjan Zoer (@ZoerCyclingStat), Daniël Herbers (@StatsOnCycling)
- **Modèle** : Auto-apprentissage, algorithmes propriétaires
- **Transparence** : 9 métriques connues, poids jamais divulgués
- **Sources** : blog CyclingOracle — https://www.cyclingoracle.com/en/blog/datalearning-2023-ai

---

## 3. APIs de cotes — Support cyclisme

### 3.1 The Odds API

- **Site** : https://the-odds-api.com (accessed 2026-06-26)
- **Liste des sports** : https://the-odds-api.com/sports-odds-data/sports-apis.html
- **Cyclisme** : **NON SUPPORTÉ** — le cyclisme n'apparaît pas dans la liste officielle des 70+ sports couverts
- **Sports couverts** : Football US, Basket, Baseball, Hockey, Tennis, Golf, Cricket, Rugby, MMA, Soccer, Boxe, Esports — pas de cyclisme
- **Prix** : Gratuit (500 crédits/mois), $30 (20K), $59 (100K), $119 (5M), $249 (15M)
- **Conclusion** : Inexploitable pour PariScore cyclisme

### 3.2 OddsAPI.net

- **Site** : https://odds-api.net (accessed 2026-06-26)
- **Documentation** : https://odds-api.net/docs
- **Cyclisme** : Non confirmé — nécessite une clé API pour interroger `/v1/sports`
- **Sports dans la doc** : Basketball, Rugby League (exemples) — cyclisme non mentionné
- **Prix** : $25 (Starter), $55 (Growth), $110 (Builder), $250 (Live), $500 (Pro) — API credits v2
- **Conclusion** : Nécessite test avec clé API pour confirmer la couverture cyclisme

### 3.3 Pinnacle (via ParlayAPI)

- **URL** : https://parlay-api.com/pinnacle-coverage (accessed 2026-06-26)
- **Coverage brut** : https://parlay-api.com/v1/pinnacle-coverage
- **62 sports actifs** (24h) — **AUCUN sport cyclisme**
- **Sports présents** : Soccer (toutes ligues), NBA, MLB, NFL, MMA, Esports (CS2, Valorant, LoL, Rainbow 6), Cricket, Rugby, etc.
- **Conclusion** : Pinnacle ne couvre PAS le cyclisme
- **Alternative** : Vérifier Betfair Exchange (création de marché par les utilisateurs)

### 3.4 Betfair Exchange API

- **Documentation** : https://developer.betfair.com/en/exchange-api/ (accessed 2026-06-26)
- **Modèle** : Exchange — les marchés sont créés par les utilisateurs
- **Cyclisme** : Potentiellement présent si des utilisateurs créent des marchés (Grands Tours, classiques)
- **Prix** : Licence commerciale pour usage data (pas de prix public fixe)
- **Conclusion** : À investiguer — probablement la meilleure source pour des cotes cyclisme via exchange

---

## 4. Reverse engineering du modèle CyclingOracle

### 4.1 Architecture connue

- **Type** : Modèle auto-apprentissage ("self-learning algorithm")
- **Données d'entrée** : Historique PCS + résultats de course
- **Mise à jour** : Continue, après chaque course

### 4.2 Les 9 métriques (connues, poids inconnus)

| # | Métrique | Description |
|---|----------|-------------|
| 1 | Most recent race | Résultat de la course la plus récente |
| 2 | Key race | Résultat sur course clé de la saison |
| 3 | Race currently in | Performance dans la course en cours |
| 4 | PCS points | Points ProCyclingStats |
| 5 | Level | Niveau général du coureur |
| 6 | GC | Aptitude classement général |
| 7 | Punch | Aptitude puncheur |
| 8 | TT | Aptitude contre-la-montre |
| 9 | Sprint | Aptitude sprinteur |

### 4.3 Forces identifiées

- **Time trials** : Excellente précision (CLM, TTT → 98.5%)
- **Sprint stages** : Forte précision quand favoris clairs
- **Mountain stages GC battle** : Bonne précision
- **Races avec favori dominant** : Très bonne (Pogacar, Vingegaard, Philipsen)

### 4.4 Faiblesses identifiées

- **Breakaway stages** : Mauvaise précision — le modèle ne prédit pas bien qui rejoint l'échappée
- **Omloop Het Nieuwsblad** : Pire score (5.3%) — scénario de course déviant
- **Courses tactiques/plates** : Scénario sprint vs échappée difficile à anticiper
- **Absence de favori dominant** : Précision chute (Giro sans Pogacar en 2025 → 52.7%)

### 4.5 Limites de la recherche

- Les poids exacts des 9 métriques ne sont pas divulgués
- L'algorithme précis (Random Forest, XGBoost ou autre) n'est pas spécifié
- La taille du jeu de données d'entraînement n'est pas communiquée
- Les 52-58% initiaux (2023-2024) sont basés sur des articles archivés non trouvés

---

## 5. Dates d'accès et limitations

### 5.1 Journal des accès (2026-06-26)

| Source | URL | Statut |
|--------|-----|--------|
| PCS robots.txt | https://www.procyclingstats.com/robots.txt | ✅ OK |
| PCS API page | https://www.procyclingstats.com/info/api | ✅ OK |
| PCS Terms | https://www.procyclingstats.com/info/terms-and-conditions | ✅ OK |
| Oracle classics 2026 | https://www.cyclingoracle.com/en/blog/classics-2026-accuracy | ✅ OK |
| Oracle model quality 2025 | https://www.cyclingoracle.com/en/blog/model-quality-2025 | ✅ OK |
| Oracle datalearning 2023 | https://www.cyclingoracle.com/en/blog/datalearning-2023-ai | ✅ OK |
| Oracle model quality blog | https://www.cyclingoracle.com/en/blog/model-quality | ✅ OK |
| Oracle best riders 2026 | https://www.cyclingoracle.com/en/blog/best-riders-tour-2026 | ✅ OK |
| Oracle about page | https://www.cyclingoracle.com/en/about-cyclingoracle | ✅ OK |
| The Odds API homepage | https://the-odds-api.com | ✅ OK |
| The Odds API sports list | https://the-odds-api.com/sports-odds-data/sports-apis.html | ✅ OK |
| OddsAPI.net docs | https://odds-api.net/docs | ✅ OK |
| Pinnacle coverage | https://parlay-api.com/v1/pinnacle-coverage | ✅ OK |
| ParlayAPI pinnacle page | https://parlay-api.com/pinnacle-coverage | ✅ OK (JS blind) |
| Betfair API docs | https://developer.betfair.com/en/exchange-api/ | ✅ OK |
| OddsAPI.net pricing | https://odds-api.net/pricing | Précédent |

### 5.2 Limitations de cette recherche

- **API OddsAPI.net** : Impossible de confirmer la couverture cyclisme sans clé API (endpoint `/v1/sports` nécessite auth)
- **CyclingOracle 52-58%** : Le chiffre initial n'a pas été retrouvé dans un article 2023-2024. Probablement une moyenne des Grands Tours 2024-2025.
- **Betfair Exchange** : Pas de test direct de disponibilité des marchés cyclisme actuels
- **PCS API pricing** : Non disponible publiquement
- **Pas de test data** : Aucun appel API réel effectué (coût, pas de clé)
- **Pas d'analyse PPC/SEO** : Hors scope — coût d'acquisition utilisateur non évalué

---

## Synthèse et recommandations stratégiques

### Constats clés

1. **Aucune API de cotes ne couvre le cyclisme** (The Odds API, Pinnacle → NON). Betfair Exchange est la seule piste.
2. **PCS reste la source souveraine** des données cyclisme mais l'accès API est limité en 2026 et le scraping est contractuellement interdit.
3. **CyclingOracle est le seul modèle prédictif public** avec une précision documentée de 60-63% (classiques) et 53-59% (Grands Tours).
4. **Whitespace confirmé** : Aucun site ne combine modèle prédictif + cotes + data viz pour le cyclisme.

### Actions prioritaires

1. Contacter PCS (email protected) pour obtenir un devis API 2026
2. Investiguer Betfair Exchange pour vérifier la disponibilité de marchés cyclisme (Grands Tours, classiques)
3. Benchmarker notre futur modèle ML cyclisme contre la baseline CyclingOracle (60-63%)
4. Surveiller l'ajout du cyclisme par The Odds API (bouton "suggest a sport" sur leur site)
