# Analyse concurrentielle — Sites de pronostics cyclisme

> Rapport Phase 1 — Juin 2026
> Objectif : Benchmark des sites existants, extraction des meilleures fonctionnalités, recommendations pour l'onglet Cyclisme de PariScore

---

## 1. Périmètre analysé

| Site | Type | Forces | Faiblesses |
|------|------|--------|------------|
| **CyclingStage.com** | Média / Analyse | Profils d'étape détaillés, présentation favoris GC, calendrier complet | Pas de modèle prédictif, pas de cotes, pas de data viz |
| **CyclingOracle.com** | Modèle prédictif + Fantasy | 9 métriques propriétaires, précision publiée, jeu fantasy, blog actif | Pas d'intégration de cotes, UX moyenne |
| **TipsterCompetition.com** | Guide de paris | Cotes bookmakers, stratégies value betting, guide complet TdF | Site généraliste, pas dédié cyclisme |
| **NxtBets.com** | Lexique paris | Taxonomie claire des marchés | Pas de données temps réel, pas de prédictions |
| **ProCyclingBets.com** | Analyse paris | Focus cyclisme, tips | Pas de modèle data-driven |
| **ThePuntersPage.com** | Comparateur cotes | Multi-bookmakers, cotes mises à jour | Pas de modélisation, pas de data viz |

---

## 2. Analyse détaillée

### 2.1 CyclingStage.com — Le standard de l'analyse route

**Structure :**
- Page d'accueil : articles récents, calendrier des courses à venir
- Pages course : profil d'étape (carte + dénivelé), liste des engagés, favoris du jour
- Pages GC : analyse des favoris avec stats clés (âge, palmarès, équipe)

**Exemple TdF 2026 :**
- 3 333 km, 54 450 m de dénivelé positif
- Double arrivée à l'Alpe d'Huez (étapes 18 et 20)
- 7 étapes de montagne, 2 CLM, 10 étapes vallonnées/plates
- Favoris GC : Pogacar, Vingegaard, Evenepoel, Roglic

**Ce qui est récupérable pour PariScore :**
- Format des profils d'étape (carte SVG + profil altimétrique)
- Structure des articles « favoris du jour » → prédictions manuelles
- Récupération des engagés par course

### 2.2 CyclingOracle.com — Le concurrent direct

**Modèle de prédiction :**
- Modèle « computeur » propriétaire (non open-source)
- Note chaque coureur sur **9 métriques** :
  1. `Most recent race` — résultat course la plus récente
  2. `Key race` — résultat course clé de la saison
  3. `Race the rider is currently in` — performance course en cours
  4. `PCS points` — points ProCyclingStats
  5. `Level` — niveau général du coureur
  6. `GC` — aptitude classement général
  7. `Punch` — aptitude puncheur
  8. `TT` — aptitude contre-la-montre
  9. `Sprint` — aptitude sprinteur

**Précision publiée (blog Accuracy) :**
- Giro 2026 : 52.7%
- Tour 2026 : 56.6%
- Vuelta 2026 : 58.8%
- Classiques printemps 2026 : publié dans un billet dédié
- Précision = % de podiums/top-10 correctement prédits (à confirmer)

**Fonctionnalités notables :**
- **Fantasy game** : créer des équipes de 9 coureurs, compétition entre utilisateurs
- **Blog actif** : mises à jour régulières, analyse post-course, audit de précision
- **Dashboard coureur** : classement des meilleurs coureurs avant chaque Grand Tour
- **Statistiques par Grand Tour** : prédictions détaillées par étape (probabilités)

**URLs clés :**
- Accueil : https://www.cyclingoracle.com/en/ ← dashboard temps réel, fantasy, blog
- Meilleurs coureurs TdF 2026 : https://www.cyclingoracle.com/en/tour-de-france/2026/best-riders
- Blog précision : https://www.cyclingoracle.com/en/blog/spring-classics-2026-prediction

### 2.3 TipsterCompetition.com — Guide de paris TdF

**Contenu :**
- Cotes bookmakers pour le TdF 2026
- Pogacar favori à -400 (cotes américaines)
- Stratégie value betting : miser sur les outsiders dans les étapes de montagne
- Bankroll management : ne pas miser plus de 2-3% par pari
- Paris en direct (live betting) : opportunités pendant les étapes

**Types de paris couverts :**
- Vainqueur final (GC)
- Podium
- Top 10
- Vainqueur d'étape
- Maillots : KOM (pois), Points (vert), Jeune (blanc)
- Match bets (H2H)

### 2.4 NxtBets.com — Taxonomie des marchés

**Marchés identifiés :**
- **Outright winner** : vainqueur du classement général
- **Podium finish** : top 3
- **Top 10 finish** : top 10
- **Stage winner** : vainqueur d'étape
- **Stage grouping** : groupes d'étapes (ex: vainqueur 1ère semaine)
- **King of the Mountains (KOM)** : classement de la montagne
- **Points classification** : classement par points (maillot vert)
- **Best Young Rider** : meilleur jeune (maillot blanc)
- **Team classification** : classement par équipes
- **Match bets / Head-to-Head** : duel entre deux coureurs
- **Straight forecast** : prédire l'ordre exact du podium
- **Each-way betting** : pari « place » + « gagnant » combiné

---

## 3. Matrice fonctionnelle

| Fonctionnalité | CyclingStage | CyclingOracle | TipsterComp | NxtBets | PariScore (cible) |
|---|---|---|---|---|---|
| Profils d'étape | ✅ Complets | ❌ | ❌ | ❌ | **✅** |
| Favoris/rédaction | ✅ Quotidien | ❌ | ✅ Guides | ❌ | **✅** |
| Modèle prédictif | ❌ | ✅ 9 métriques | ❌ | ❌ | **✅** |
| Précision publiée | ❌ | ✅ 52-58% | ❌ | ❌ | **✅** |
| Fantasy game | ❌ | ✅ | ❌ | ❌ | **Option** |
| Cotes bookmakers | ❌ Mentionné | ❌ | ✅ | ❌ | **✅** |
| Comparateur cotes | ❌ | ❌ | ❌ | ❌ | **✅** |
| Data viz (charts) | ❌ | ✅ Basique | ❌ | ❌ | **✅** |
| API/Temps réel | ❌ | ❌ | ❌ | ❌ | **✅** |
| Paris en direct | ❌ | ❌ | ❌ | ❌ | **✅** |

---

## 4. Opportunité whitespace

**Aucun site ne fait aujourd'hui l'intégration complète :**
1. Données route (profil d'étape, favoris) ← *CyclingStage*
2. Modèle prédictif quantitatif avec précision ← *CyclingOracle*
3. Cotes bookmakers et comparaison ← *TipsterCompetition / ThePuntersPage*
4. Visualisation de données et API temps réel ← *Personne*

→ **PariScore peut être le premier à combiner ces 4 dimensions dans un seul onglet.**

---

## 5. Brainstorming — Fonctionnalités recommandées

### 5.1 Module indispensable : Dashboard Grand Tour

- **Onglet calendrier** : liste des courses à venir (TdF, Vuelta, Giro, classiques)
- **Onglet étape du jour** : profil altimétrique, distance, favoris, cotes
- **Onglet GC** : classement général + prédictions
- **Onglet coureur** : dashboard individuel avec stats récentes, cotes, tendances

### 5.2 Module prédictif

Inspiré de CyclingOracle mais amélioré :

**Métriques proposées (10 au lieu de 9) :**
1. **Recent form** — classement moyenne des 5 dernières courses (pondéré décroissant)
2. **Course clé** — performance sur course similaire (ex: autre Grand Tour)
3. **Course en cours** — position actuelle dans la course
4. **PCS points** — points ProCyclingStats
5. **Niveau général** — classement UCI World Tour
6. **GC skill** — performance historique en GC
7. **Montagne** — aptitude grimpeur (pentes, altitude)
8. **CLM** — aptitude contre-la-montre
9. **Sprint** — aptitude sprint massif
10. **Résistance** — tenue sur 3 semaines (spécifique Grand Tour)

**Affichage :** radar chart ou barres horizontales côté-à-côté (comme les notes de joueurs FIFA).

### 5.3 Module cotes

Intégration des cotes via API (à définir) :
- **Cotes pré-course** : vainqueur, podium, top 10
- **Cotes par étape** : vainqueur du jour
- **Cotes en direct** : si API temps réel disponible
- **Comparateur** : meilleure cote parmi les bookmakers suivis

### 5.4 Module data visualisation

- **Graphique d'étape** : profil altimétrique avec annotations (cols, sprint intermédiaires)
- **Évolution GC** : graphique des écarts jour par jour
- **Graphique de prédiction** : probabilité de victoire par coureur (barres horizontales)
- **Carte du parcours** : vue géographique avec étapes marquées

### 5.5 Module fantasy (v2)

- Créer une équipe avec budget limité
- Scoring basé sur les résultats réels
- Classement entre utilisateurs PariScore

---

## 6. Recommandations pour l'implémentation

### Priorité haute (MVP onglet Cyclisme)
1. Page liste des courses à venir (calendrier UCI World Tour)
2. Page étape du jour avec profil altimétrique + favoris + cotes
3. Top-10 des favoris GC avec notes prédictives (radar chart)
4. Cotes bookmakers pour vainqueur / podium / top-10

### Priorité moyenne (v1.1)
5. Prédictions par étape (modèle ML léger)
6. Graphique d'évolution GC (temps réel si données dispo)
7. Comparateur de cotes

### Priorité basse (v2+)
8. Fantasy game
9. Paris en direct
10. API publique

---

## 7. Sources

- https://www.cyclingstage.com/ — profils, favoris, calendrier
- https://www.cyclingoracle.com/en/ — modèle prédictif, fantasy, blog
- https://tipstercompetition.com/article/tour-de-france-2026-betting-guide-odds-tips-strategy — guide TdF 2026
- https://nxtbets.com/tour-de-france-betting-markets/ — marchés de paris
- https://thepunterspage.com/cycling/ — cotes bookmakers
- https://www.procyclingbets.com/ — tips cyclisme
