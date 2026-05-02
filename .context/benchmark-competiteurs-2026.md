# 📊 Benchmark Concurrentiel — PariScore

**Date** : 2 mai 2026  
**Version** : v5.18  
**Auteur** : GM PariScore  
**Objectif** : Identifier les features manquantes et prioriser le développement

---

## 1. RÉSUMÉ EXÉCUTIF

PariScore v5.18 couvre **~60%** des fonctionnalités attendues par les parieurs modernes. Le socle technique (BSD API, Poisson, xG, Power Score AI) est solide, mais **l'expérience visuelle et les signaux betting explicites** manquent pour rivaliser avec FootyStats, Sofascore et 1x2.expert.

**3 gaps critiques identifiés** :
1. Pas de streaks/tendances automatisées (Over, BTTS, Clean Sheets)
2. Pas de momentum visuel en temps réel
3. Pas de grille de forme récente sur les match cards

---

## 2. MÉTHODOLOGIE

**Sites analysés** : Sofascore, WhoScored, FootyStats, Betexplorer, 1x2.expert, Winamax, Betclic, Datafoot  
**Critères** : Features betting, UX temps réel, data depth, signaux value, design  
**Focus** : Ce que PariScore n'a PAS et qui est facile à implémenter avec BSD

---

## 3. ANALYSE PAR CONCURRENT

### 3.1 Sofascore — Live & Momentum

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Attack Momentum** | Barre visuelle montrant quelle équipe domine le match en temps réel (vert/rouge) | ❌ Absent — on a xG timeline mais pas de momentum |
| **Player Heatmaps** | Zones d'activité des joueurs sur le terrain | ❌ Absent — data spatiale non dispo via BSD |
| **Rating en direct** | Note par joueur mise à jour pendant le match | ⚠️ Partiel — BSD ratings post-match |
| **Shot Maps** | Position et type de chaque tir | ❌ Absent |
| **Forme 5 matchs** | V/D/N avec couleurs sur la page match | ❌ Absent |

**Leçon** : Sofascore gagne par le **visuel temps réel**. La momentum bar est leur feature la plus reconnaissable.

---

### 3.2 WhoScored — Profondeur Statistique

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Player Ratings** | Algorithme propriétaire de notes par joueur | ⚠️ Partiel — BSD ratings existants mais pas intégrés UI |
| **Match Preview** | Stats H2H + forme + absences + prédiction | ✅ Fait (Power Score + Insights) |
| **Team of the Week** | Classements par poste | ❌ Absent |
| **Statistical Leaderboards** | Top buteurs, passeurs, notes par ligue | ⚠️ Partiel — BSD top scorers |
| **Characteristics** | Points forts/faibles par équipe | ❌ Absent |

**Leçon** : WhoScored se distingue par la **profondeur individuelle**. BSD fournit déjà des ratings — il faut les afficher mieux.

---

### 3.3 FootyStats — Signaux Betting

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Forme récente** | 5 derniers matchs avec résultats et xG | ❌ Absent |
| **Streaks** | "Over 2.5 sur 8/10 matchs", "BTTS sur 7/10" | ❌ Absent — CRITIQUE |
| **Table Form** | Classement sur les 6 derniers matchs seulement | ❌ Absent |
| **H2H Filtered** | Historique filtrable dom/ext/neutre | ❌ Absent |
| **Goals Timeline** | Buts par tranche de 15 minutes | ❌ Absent |
| **Corners Stats** | Avg corners par match, par équipe, Over/Under | ⚠️ Partiel — corners tab existe |
| **Matchday Predictor** | Simulation probabiliste avant le match | ✅ Fait (Poisson) |

**Leçon** : FootyStats est le **modèle direct** pour PariScore. Les streaks sont leur feature la plus partagée sur les réseaux sociaux.

---

### 3.4 Betexplorer — Odds & History

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Odds Movement** | Historique des cotes sur 7/30 jours | ❌ Absent |
| **Closing Line** | Cote de clôture vs cote d'ouverture | ❌ Absent |
| **H2H Archive** | Historique très profond (10+ ans) | ❌ Absent |
| **Standings Toggle** | Tableau domicile / extérieur / global | ✅ Partiel (BSD standings) |
| **Results Calendar** | Vue calendrier des résultats passés | ❌ Absent |

**Leçon** : Betexplorer = **archive + cotes**. Moins pertinent pour PariScore (focus prédiction, pas historique).

---

### 3.5 1x2.expert — Value Detection

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Value Signals** | "+15.3%" affiché directement sur le match | ✅ Fait (Edge detection) |
| **Stratégies** | Sequenza goal, Scenario Hunter, Reverse Engineer | ⚠️ Partiel — on a les strategies mais pas l'UX |
| **Analyse par buts** | Over/Under, GG/NG, analyse temporelle | ⚠️ Partiel — Poisson couvre mais pas d'onglet dédié |
| **Championnats** | Vue par ligue avec filtres avancés | ✅ Fait (league filters) |
| **EV Count** | Nombre de signaux Value du jour (95 aujourd'hui) | ❌ Absent — bon hook marketing |

**Leçon** : 1x2.expert affiche la **value explicitement**. PariScore a le calcul mais pas le badge "+X%" sur les cards.

---

### 3.6 Winamax / Betclic — Bookmakers

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Live Betting** | Paris en temps réel avec cotes dynamiques | ❌ Hors scope — on n'est pas bookmaker |
| **Cash Out** | Retrait anticipé | ❌ Hors scope |
| **Visual Stats** | Stats visuelles avant match (barres comparatives) | ⚠️ Partiel — live stats panel existe |
| **Streaming** | Vidéo du match en direct | ❌ Hors scope |

**Leçon** : Les bookmakers font du **visuel simple et rapide**. PariScore doit rester l'outil d'analyse, pas de pari.

---

### 3.7 Datafoot — Modèle Affiliation

| Feature | Description | PariScore |
|---------|-------------|-----------|
| **Pronostic Gratuit via Bookmaker** | CPA inversé : accès gratuit si inscription via lien | ✅ Fait (section CPA inversé) |
| **Transparence** | Historique public des pronostics | ✅ Fait (accuracy badge) |
| **Réseau Partners** | 25+ bookmakers partenaires | ⚠️ Partiel — Winamax + fallback |
| **Contenu Éducatif** | Blog, guides, vidéos | ❌ Absent |

**Leçon** : Datafoot = **modèle économique** plus que features. PariScore a déjà adopté le bon modèle.

---

## 4. MATRICE COMPARATIVE

| Feature | Sofascore | FootyStats | 1x2.expert | PariScore v5.18 |
|---------|-----------|------------|------------|-----------------|
| Poisson/Prédiction | ❌ | ✅ | ✅ | ✅ |
| xG en temps réel | ✅ | ✅ | ❌ | ✅ |
| Momentum visuel | ✅ | ❌ | ❌ | ❌ |
| Streaks betting | ❌ | ✅ | ❌ | ❌ |
| Forme 5 matchs | ✅ | ✅ | ✅ | ❌ |
| H2H filtrable | ❌ | ✅ | ✅ | ❌ |
| Player ratings | ✅ | ⚠️ | ❌ | ✅ (non affiché) |
| Value % explicite | ❌ | ❌ | ✅ | ✅ (non affiché) |
| Live Top 5 | ❌ | ❌ | ❌ | ✅ |
| Power Score AI | ❌ | ❌ | ❌ | ✅ |
| Back-testing | ❌ | ❌ | ❌ | ✅ |
| BSD (coût €0) | ❌ | ❌ | ❌ | ✅ |

**Score** : PariScore = **8/12** features (67%). Les 4 manquantes sont visuelles ou signaux explicites.

---

## 5. GAP ANALYSIS

### 🔴 Gaps Critiques (impact direct sur conversion)
| Gap | Pourquoi c'est critique | Effort |
|-----|------------------------|--------|
| **Pas de streaks** | C'est la feature la plus virale de FootyStats. Les parieurs adorent "Over 2.5 sur 8/10" | ~2h |
| **Pas de forme sur les cards** | L'info #1 recherchée avant un pari | ~1.5h |
| **Value % pas visible** | On calcule l'edge mais on ne l'affiche pas clairement | ~1h |

### 🟡 Gaps Moyens (améliore l'UX mais pas bloquant)
| Gap | Effort |
|-----|--------|
| Momentum bar live | ~2h |
| H2H avec filtres dom/ext | ~1.5h |
| Goals timeline par 15min | ~3h |
| Table form (6 derniers matchs) | ~2h |

### 🟢 Hors Priorité (trop complexe ou hors scope)
| Feature | Raison |
|---------|--------|
| Heatmaps | Pas de data spatiale via BSD |
| Shot maps | Idem |
| Streaming vidéo | Hors scope |
| Odds movement history | BSD ne fournit pas l'historique des cotes |

---

## 6. RECOMMANDATIONS — ROADMAP

### Sprint 1 — Signaux Betting (Semaine prochaine)
| # | Feature | Fichier | Effort | Impact |
|---|---------|---------|--------|--------|
| 1.1 | **Streaks auto-detectés** (Over 2.5, BTTS, Clean Sheet) | `server.js` + `pariscore.html` | 2h | 🔴 Haute |
| 1.2 | **Grille forme 5 matchs** sur match cards | `pariscore.html` | 1.5h | 🔴 Haute |
| 1.3 | **Badge Value %** visible sur les cards (ex: "+15.3%") | `pariscore.html` | 1h | 🔴 Haute |

### Sprint 2 — Live Visuel (Semaine 2)
| # | Feature | Fichier | Effort | Impact |
|---|---------|---------|--------|--------|
| 2.1 | **Momentum bar** (style Sofascore) sur modal live | `pariscore.html` | 2h | 🟡 Moyenne |
| 2.2 | **H2H filtrable** (Tous / Dom / Ext) | `server.js` + `pariscore.html` | 1.5h | 🟡 Moyenne |
| 2.3 | **Goals timeline** par tranche 15min | `server.js` | 3h | 🟡 Moyenne |

### Sprint 3 — Data Enrichment (Semaine 3)
| # | Feature | Fichier | Effort | Impact |
|---|---------|---------|--------|--------|
| 3.1 | **Table Form** (classement 6 derniers matchs) | `server.js` | 2h | 🟡 Moyenne |
| 3.2 | **Power Rankings** (classement par xG) | `server.js` | 1.5h | 🟡 Moyenne |
| 3.3 | **EV Counter** global dans le header | `pariscore.html` | 0.5h | 🟢 Marketing |

---

## 7. ESTIMATION ROI

| Feature | Coût Dev | Impact UX | Impact Conversion | ROI |
|---------|----------|-----------|-------------------|-----|
| Streaks | 2h | 🔴 | 🔴 | ⭐⭐⭐⭐⭐ |
| Forme 5 matchs | 1.5h | 🔴 | 🟡 | ⭐⭐⭐⭐ |
| Badge Value % | 1h | 🔴 | 🔴 | ⭐⭐⭐⭐⭐ |
| Momentum bar | 2h | 🟡 | 🟡 | ⭐⭐⭐ |
| H2H filtrable | 1.5h | 🟡 | 🟢 | ⭐⭐⭐ |
| Goals timeline | 3h | 🟡 | 🟢 | ⭐⭐ |

**Top 3 ROI** : Streaks > Badge Value % > Forme 5 matchs

---

## 8. CONCLUSION

PariScore a un **avantage technique unique** (BSD gratuit, Poisson, AI Power Score, back-testing). Le marché attend maintenant :

1. **Des signaux clairs** : streaks, badges value, forme — pas de calcul à faire soi-même
2. **Du visuel temps réel** : momentum bar, timeline — l'utilisateur doit "voir" le match
3. **De la transparence** : EV counter public, accuracy rolling — proof social comme Datafoot

**Recommandation GM** : Lancer Sprint 1 immédiatement. 4.5h de dev pour les 3 features les plus visibles.

---

*Document auto-généré. À archiver dans ARCHIVE_PROJECT.md à la fin de session.*
