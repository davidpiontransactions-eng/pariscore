# 🎾 Top 10 Tennis — Rapport d'Analyse & Plan de Refonte Complète

**Date**: 2026-09-04
**Scope**: Transformation du Top 5 Tennis sidebar → Top 10 Tennis central area avec refonte UX complète
**Auteur**: PariScore Engineering

---

## 1. État des Lieux

### 1.1 Composant Actuel

| Élément | Détail |
|---------|--------|
| **Composant** | `TennisStrategyTop5Widget` (232 lignes) |
| **Position** | Sidebar sport (`sports-sidebar.tsx:1398`) |
| **Données** | 5 matchs par métrique, 9 métriques disponibles |
| **API** | `/api/tennis/top5?metric=X&surface=Y&period=Z` |
| **Hook** | `useTennisTop5` (SWR, 60s dedup) |
| **Backtest** | `Top5BacktestStrip` (WR%, ROI%, streak) |

### 1.2 Limites Actuelles

1. **Taille limitée** : Top 5 uniquement — manque de profondeur analytique
2. **Position sidebar** : Réduit la visibilité, pas de place pour des visualisations riches
3. **Données restreintes** : Uniquement les 5 matchs à venir les plus pertinents par métrique
4. **Pas de profil joueur** : Nom + métrique brute, pas de photo, pays, classement ATP/WTA
5. **Pas de tendance** : Pas de sparkline, pas de variation récente
6. **Pas de comparaison** : Pas de face-à-face H2H intégré

---

## 2. Analyse Concurrentielle

### 2.1 Plateformes Analysées

| Plateforme | Features Clés | Forces | Faiblesses |
|-----------|---------------|--------|------------|
| **ATP Dashboard (Tableau)** | Top 50, form, surfaces, streaks | Data riche, viz interactive | Pas temps réel, pas betting-oriented |
| **Tennis Tour Dashboard** (GitHub) | Live scores, rankings, H2H, brackets, player profiles | Tout-en-un, notifications | Complexe, pas de métriques betting |
| **Tennis Rankings Dashboard** (Streamlit) | Distribution, percentile, federation analysis | Académique, comparatif | Lent, pas de design mobile |
| **ESPN Tennis Bracket** | Bracket interactif, 3D court, données Hawk-Eye | Storytelling immersif, personnel | Uniquement tournois majeurs, pas de rankings |
| **PlayerDEX** (Ropstam) | Serve/return analytics, 3D court, comparison engine | Pro-level, scouting | Mobile natif, pas web-first |
| **tenis-app** (Astro) | Top 100 ATP, live matches, responsive | Fast, dark mode | Basique, pas de métriques avancées |

### 2.2 Patterns UX Dominants

1. **Player Card** : Photo + nom + pays + classement + métriques clés (ATP, ESPN, PlayerDEX)
2. **Sparkline/Trend** : Mini-graphiques pour montrer la tendance (ATP Dashboard, Tableau)
3. **Comparaison H2H** : Face-à-face avec stats comparatives (Tennis Tour Dashboard, PlayerDEX)
4. **Filtres contextuels** : Surface, période, tournoi (toutes les plateformes)
5. **Progressive disclosure** : Vue résumée → détails au clic (ESPN, PlayerDEX)

---

## 3. Recherche Académique & Scientifique

### 3.1 Papers Pertinents

| Paper | Auteur(s) | Application PariScore |
|-------|-----------|----------------------|
| **"Visualization of Tennis Players' Game Performance"** (Wang, 2024) | Wavelet analysis + ARIMA-LightGBM | Sparklines multi-échelles pour tendance forme |
| **"Who's the GOAT? Sports Rankings and Data-Driven Random Walks"** (Garcia & Martínez Mori, 2024) | Random walk sur le groupe symétrique + stochastic dominance | Comparaison partielle entre joueurs |
| **"Tennis Game Dynamic Prediction Based on Momentum"** (MDPI AppliedMath, 2025) | EWMA momentum + XGBoost 84% accuracy | Score de momentum visuel (barre progressive) |
| **"Practitioners' Perspectives on Designing Data Visualizations"** (ACM, 2025) | 21 interviews practitioners — storytelling data | Un message clé par visualisation |
| **"SportSQL: Interactive System for Real-Time Sports Reasoning"** (2025) | NL querying + auto-visualization | Question/réponse naturelle sur stats |

### 3.2 Insights Scientifiques Appliqués

1. **Momentum EWMA** : Quantifier la forme récente avec un score 0-100 qui intègre la décroissance exponentielle (les matchs récents pèsent plus)
2. **Comparaison partielle** : Ne pas forcément classer les joueurs de A à B — montrer les forces/faiblesses relatives (surface, service, retour)
3. **Un message par visualisation** : Chaque card doit avoir UN message principal ("Meilleur service de la surface", "Forme ascendante", etc.)
4. **Storytelling data** : Le titre de chaque card doit être un insight, pas un label ("Sinner domine sur dur" plutôt "Sinner - Surface Elo: 1842")

---

## 4. Architecture Technique Proposée

### 4.1 Données — API enrichie

```
GET /api/tennis/top10?metric=X&surface=Y&period=Z

Response:
{
  entries: TennisTop10Entry[] (10 items),
  meta: { metric, surface, period, matchesConsidered, ... }
}

TennisTop10Entry = {
  rank: number,
  player: {
    name, shortName, photoUrl, country,
    atpRank, wtaRank, elo, surfaceElo,
    form: ("W"|"L")[],     // 6 derniers matchs
    momentumScore: number,  // EWMA 0-100
    serveWonPct, returnWonPct, tiebreaksWonPct, decidingSetsWonPct
  },
  metricValue: number,
  metricLabel: string,
  insight: string,          // "🔥 Forme ascendante" ou "⚡ Meilleur service"
  isValue: boolean          // edge vs marché
}
```

### 4.2 Composants

```
TennisTop10Section (nouveau — zone centrale, remplace le widget sidebar)
├── TennisTop10Header
│   ├── Titre insight ("TOP 10 — Sinner domine sur dur")
│   ├── Filtre Surface (Toutes | Dur | Terre | Gazon)
│   ├── Filtre Période (52 sem | YTD | Tout)
│   └── Filtre Métrique (9 options avec emojis)
├── TennisTop10Grid (grille responsive)
│   └── TennisPlayerCard × 10
│       ├── PlayerPhoto (lazy) + Flag emoji + Rank badge
│       ├── Player Name + Country
│       ├── Métrique principale (grand, coloré)
│       ├── MomentumBar (barre EWMA 0-100)
│       ├── FormSparkline (6 derniers résultats W/L)
│       ├── SurfaceBadge (Dur/Terre/Gazon)
│       ├── H2H mini-badge (si applicable)
│       └── Insight tag ("🔥 Forme ascendante")
├── TennisTop10Backtest (WR%, ROI%, streak — existant)
└── TennisTop10Legend (explication des métriques)
```

### 4.3 Emplacement

- **Avant** : Sidebar sport (compact, 5 matchs dans TennisStrategyTop5Widget)
- **Après** : Zone centrale du tab Tennis (pleine largeur, 10 joueurs, cards riches)
- **Sidebar** : Widget retiré, remplacé par "Derniers résultats" ou espace libéré

---

## 5. Brainstorming Expert Multi-Disciplinaire

### 🧠 Expert 1 — Data Scientist (Tennis Analytics)

> "Le Top 5 actuel montre des matchs à venir, pas des joueurs. Un Top 10 de JOUEURS avec leur score de forme serait plus utile pour anticiper les tendances. Le momentum EWMA (alpha=3.4 comme dans le paper MDPI 2025) est idéal pour un sparkline de forme. Il faut montrer le surface Elo séparément — un joueur peut être #1 mondial mais #15 sur terre battue."

**Recommandations** :
- Afficher les 10 joueurs les mieux classés par la métrique sélectionnée
- Sparkline EWMA sur 6 matchs avec décroissance exponentielle
- Badge "Spécialiste surface" si surfaceElo > globalElo + 100

### 🎨 Expert 2 — UX/UI Designer

> "La sidebar est un mauvais endroit pour du contenu analytique riche. Le user veut D'ABORD voir les matchs du jour, puis explorer les rankings. Le Top 10 doit être dans la zone centrale avec un layout en grille. Chaque card doit être cliquable pour ouvrir un modal de détails. Le design doit suivre le pattern 'F-pattern' : nom en haut à gauche, métrique principale au centre, détails en bas."

**Recommandations** :
- Layout grille 2×5 sur desktop, 1×10 sur mobile
- Card cliquable → modal H2H + stats détaillées
- Photo du joueur + drapeau pays + classement ATP/WTA
- Titre de chaque card = insight ("🔥 Forme ascendante" ou "⚡ Meilleur service")

### 📊 Expert 3 — Sports Betting Analyst

> "Pour un parieur, le Top 10 doit montrer le EDGE — la différence entre la probabilité du modèle et la probabilité implicite du marché. Le backtest existant (WR%, ROI%) est bon mais il faut l'intégrer dans chaque card. Aussi, montrer si le joueur est 'value' ou non par rapport aux cotes du marché."

**Recommandations** :
- Badge "Value Bet" si probPick > cote implicite + 5%
- Intégrer le backtest dans chaque card (mini WR%/ROI%)
- Montrer la tendance des cotes (↑↓) pour chaque joueur

### 🔬 Expert 4 — Scientific Researcher (Sports Analytics)

> "Le paper de Garcia & Martínez Mori (2024) montre que les comparaisons binaires 'mieux/pire' sont trompeuses. Il faut montrer des comparaisons multidimensionnelles : service, retour, pression, forme. Le radar chart est l'outil idéal pour ça. Aussi, le paper Wang (2024) sur les wavelets suggère des sparklines multi-échelles — forme récente (L5) vs forme longue (L20)."

**Recommandations** :
- Radar chart 5 axes (Service, Retour, Pression, Forme, Surface) par joueur
- Double sparkline : L5 (rouge) + L20 (bleu) pour comparaison rapide
- Score composite "Overall Strength" basé sur les 5 axes

### 📱 Expert 5 — Mobile/Performance Engineer

> "10 cards avec photos c'est lourd. Il faut lazy loading des images, virtualisation de liste, et un skeleton state. Sur mobile, le scroll infini avec 5 cards visibles + 5 en lazy. Utiliser IntersectionObserver pour charger les photos. Le CSS doit être optimisé : pas de reflows, GPU-accelerated animations."

**Recommandations** :
- Lazy loading images avec `loading="lazy"` + IntersectionObserver
- Skeleton cards pendant le chargement
- CSS `contain: layout style paint` sur chaque card
- Max 2 requêtes SWR (top10 + backtest) pour minimiser le waterfall

---

## 6. Plan d'Implémentation

### Phase 0 — Préparation Backend (Jour 1)
- [ ] Créer `/api/tennis/top10` (nouvelle route, 10 entries enrichis avec profil joueur)
- [ ] Ajouter type `TennisTop10Entry` avec champs joueur enrichis (photo, pays, rank, elo, form, momentum)
- [ ] Hook `useTennisTop10` (SWR, 60s dedup)
- [ ] Score EWMA momentum dans `tennis-top5.ts` (réutiliser logique existante)

### Phase 1 — Card Component (Jours 2-3)
- [ ] `TennisPlayerCard` : Photo + Flag + Name + Rank + Métrique
- [ ] `MomentumBar` : Barre EWMA 0-100 avec gradient vert/rouge
- [ ] `FormSparkline` : SVG sparkline 6 résultats (W/L comme barres vertes/rouges)
- [ ] `SurfaceBadge` : Badge coloré pour surface
- [ ] `InsightTag` : Titre dynamique par joueur
- [ ] Skeleton states + loading states

### Phase 2 — Grid Layout + Integration (Jour 4)
- [ ] `TennisTop10Grid` : Grille responsive 2×5 / 1×10
- [ ] Intégration dans la zone centrale du tab Tennis
- [ ] Retirer `TennisStrategyTop5Widget` de la sidebar
- [ ] Filtres : Surface, Période, Métrique
- [ ] Header avec titre insight dynamique

### Phase 3 — Enrichissements (Jours 5-6)
- [ ] `TennisPlayerModal` : Modal détaillé au clic (H2H, stats, forme détaillée)
- [ ] Backtest intégré dans chaque card (mini WR%/ROI%)
- [ ] Titres insight dynamiques ("🔥 Forme ascendante", "⚡ Meilleur service")
- [ ] Badge "Value" si edge détecté

### Phase 4 — Polish & QA (Jour 7)
- [ ] Responsive mobile (1-col, scroll)
- [ ] Lazy loading images
- [ ] Animations d'entrée (staggered fade-in)
- [ ] Accessibilité (aria-label, focus rings, contrast)
- [ ] Playwright QA sur VPS

---

## 7. Métriques de Succès

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Cards rendues | 10/10 | Playwright count |
| Temps de chargement | < 2s | Network tab |
| Lighthouse perf | > 90 | Lighthouse audit |
| Erreurs console | 0 | Playwright pageerror |
| Responsive mobile | Pas de overflow | Playwright viewport 375px |
| Sidebar vidé | 0 widget tennis | DOM check |

---

## 8. Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Photos joueurs non disponibles | Card sans image | Fallback initials + color |
| API top10 lente | Loading long | SWR + skeleton + 60s cache |
| Trop de cards = scroll infini | UX dégradée | Grille 2×5 = 5 rows, pas infini |
| Sidebar sans widget = vide | Espace perdu | Remplacer par "Derniers résultats live" |
| 9 métriques = confusion | Choice overload | Default = Surface Elo, insight par défaut |

---

## 9. Conclusion

La refonte du Top 5 Tennis → Top 10 Tennis central est un changement à **fort impact utilisateur** qui aligne PariScore avec les standards de l'industrie (ESPN, ATP Dashboard, PlayerDEX). Les insights académiques (momentum EWMA, comparaison multidimensionnelle, storytelling data) et les patterns UX dominants (player cards, sparklines, progressive disclosure) convergent vers une architecture en cards riches avec grille responsive.

**Priorité** : Haute — c'est le premier élément analytique que voit un utilisateur tennis.
