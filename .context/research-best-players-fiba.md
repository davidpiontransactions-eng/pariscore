# Rapport Recherche : Onglet "Meilleures Joueuses" — FIBA Women's WC 2026

**Date :** 2026-09-04
**Périmètre :** Sources académiques + concurrents + données FIBA officielles

---

## 1. Données FIBA Officielles (déjà disponibles)

### Sources confirmées
| Source | URL | Données |
|--------|-----|---------|
| **ESPN FIBA API** | `site.web.api.espn.com/apis/site/v2/sports/basketball/fiba/` | Scoreboard, standings, roster, game logs |
| **FIBA.basketball** | `/events/fiba-womens-basketball-world-cup-2026/stats` | Players Leaders, Game Highs, Team Leaders |
| **FIBA App officiel** | iOS/Android | 10 joueurs à suivre, stats live, classements |
| **Yahoo Sports** | Box scores complets | MIN, PTS, REB, AST, STL, BLK, FG, 3P, FT |

### Stats disponibles par joueur (ESPN)
- Points, Rebonds, Passes, Interceptions, Contres
- Minutes jouées, Fautes, Ballons perdus
- Tirs (tentés/marqués), 3-points, Lancers francs
- +/- (différentiel)
- Box scores par match + moyennes

---

## 2. Concurrents Analysés

### 2.1 FIBA officiel (fiba.basketball)
- **Feature** : "Players Leaders" — classement par PPG, RPG, APG, etc.
- **Feature** : "Players Game Highs" — records par match
- **UI** : Tableau classique avec filtres (position, phase)
- **Limitation** : Pas de classement composite, pas de comparaison, pas de prédiction

### 2.2 ESPN Fantasy / Yahoo Fantasy
- **Feature** : Player rankings avec PER, Win Shares, VORP
- **Feature** : Head-to-head comparison
- **Feature** : Fantasy points calculation
- **UI** : Tableaux triables, graphiques radar
- **Limite** : Focus NBA, peu de données FIBA WC

### 2.3 Flashscore / SofaScore
- **Feature** : Live player ratings (note sur 10)
- **Feature** : Heat maps, shot charts
- **Feature** : Comparaison joueurs
- **UI** : Cards compactes, ratings visuels
- **Limite** : Pas de métriques avancées (SHAP, impact)

### 2.4 Fantasy Apps (FantasyHoops, Hashtag Basketball)
- **Feature** : Z-scores, auction values, punt categories
- **Feature** : Player comparison tools
- **Feature** : Draft rankings with projections
- **UI** : Tableaux avec color-coding, radar charts
- **Limite** : Focus fantasy, pas de contexte tournoi

### 2.5 GameShot FIBA (app mobile)
- **Feature** : Shot charts, box scores live
- **Feature** : Tracking individuel joueur
- **UI** : Simple, offline-first
- **Limite** : Pas de classement global, pas d'analytics

---

## 3. Revues Académiques (2024-2026)

### 3.1 Métriques de performance joueur

| Métrique | Source | Description | Applicable FIBA |
|----------|--------|-------------|-----------------|
| **PER** (Player Efficiency Rating) | Hollinger/Basketball-Ref | Rating par minute, somme positive/négative | ✅ Calculable |
| **Win Shares** | Basketball-Ref | Contribution aux victoires | ✅ Calculable |
| **VORP** | Basketball-Ref | Value Over Replacement Player | ⚠️ Nécessite baseline ligue |
| **BPM** (Box Plus-Minus) | Basketball-Ref | Impact par 100 possessions | ✅ Calculable |
| **RAPM** | Nylon Calculus | Regularized Adjusted Plus-Minus | ⚠️ Nécessite play-by-play |
| **FIC** (Floor Impact Counter) | NBA.com | Points + Reb + AST + STL + BLK - Missed FG/FT - TOV | ✅ Simple |
| **PIR** (Performance Index Rating) | FIBA officiel | Métrique FIBA officielle | ✅ Source FIBA |

### 3.2 Papers clés

| Paper | Auteurs | Contribution clé |
|-------|---------|-------------------|
| **MVP-Shapley** (2025) | Sun et al. | Shapley values pour contribution joueur → MVP ranking |
| **Composite Rating Method** (2024) | Ambrutis & Povilaitis | Rating composite multi-ligues (EuroLeague, EuroCup) |
| **Hybrid Decision Support** (2026) | Bisht et al. | Decision Trees + AHP pour ranking joueurs NBA |
| **Comparative Analysis NP/FP** (2024) | Paulauskas et al. | Différences performance joueurs nationaux/étrangers EuroLeague |
| **Uncertainty-Aware ML** (2026) | Montrucchio et al. | LSTM + MC dropout pour prédiction avec incertitude |

### 3.3 Approche MVP-Shapley (la plus prometteuse)
```
1. Feature processing (stats joueur)
2. Train win-loss model
3. Shapley value allocation (contribution au win)
4. MVP ranking
```
**Avantage** : Explicable (SHAP), fondé sur la contribution au win, pas juste les stats brutes.

---

## 4. Concept "Meilleures Joueuses" pour PariScore

### 4.1 Données collectées automatiquement
- **Box scores** : Tous les matchs FIBA WC via ESPN API
- **Stats cumulées** : PPG, RPG, APG, SPG, BPG, TOV, FG%, 3P%, FT%
- **Minutes** : Pour normaliser les stats (per-36 ou per-game pondéré)
- **Team context** : Wins/losses, phase du tournoi

### 4.2 Métriques calculables côté serveur

| Métrique | Formule | Usage |
|----------|---------|-------|
| **FIBA PIR** | (PTS + REB + AST + STL + BLK + FTM + 2FGM + 3FGM) - ((FGA - FGM) + (FTA - FTM) + TOV + STL_conceded + BLK_conceded + PF) | Métrique officielle FIBA |
| **Composite Score** | PIR × Games_Played × (Win_Pct + 0.5) | Impact cumulé ajusté victoires |
| **Efficiency Rating** | (PTS + REB + AST + STL + BLK) / MIN × 40 | Performance par minute |
| **Win Contribution** | (Player_VORP × Team_Wins) / Games | Contribution aux victoires équipe |
| **Consistency Score** | 1 - StdDev(PPG) / Mean(PPG) | Régularité |

### 4.3 UI/UX concepts

**Option A : Leaderboard simple** (comme FIBA officiel)
```
| Rank | Player | Team | PPG | RPG | APG | PIR | Score |
|------|--------|------|-----|-----|-----|-----|-------|
```

**Option B : Player Cards enrichies** (comme Fantasy apps)
```
┌─────────────────────────────────┐
│ [Photo] Player Name    Team 🇺🇸 │
│ Position: G  |  Age: 24         │
├─────────────────────────────────┤
│ PPG: 14.3  │ RPG: 4.2          │
│ APG: 11.0  │ SPG: 0.0          │
├─────────────────────────────────┤
│ PIR: 18.5  │ Score: 92.3       │
│ [Radar Chart]                    │
├─────────────────────────────────┤
│ 🏆 MVP Rank: #1                │
│ 📊 Edge vs field: +12.3%       │
└─────────────────────────────────┘
```

**Option C : Hybrid** (PariScore unique) — Leaderboard + Cards enrichis
```
[Onglet Leaderboard] [Onglet MVP Race] [Onglet Comparaison]

┌─ MVP Race ─────────────────────────────┐
│ #1 Clark 🇺🇸  92.3 pts  [+12% edge] │
│ #2 Stewart 🇺🇸  88.7 pts  [+8% edge] │
│ #3 Meesseman 🇧🇪  82.1 pts  [+3%]    │
│ ...                                     │
│ [Radar: Clark vs Stewart]              │
└─────────────────────────────────────────┘
```

---

## 5. Avantages PariScore vs Concurrents

| Aspect | FIBA Officiel | ESPN | Flashscore | **PariScore (proposé)** |
|--------|---------------|------|------------|------------------------|
| Données live | ✅ | ✅ | ✅ | ✅ |
| Métriques avancées | ❌ PIR seul | ⚠️ NBA-focused | ⚠️ Notes arbitraires | ✅ PIR + FIC + Composite |
| Prédiction MVP | ❌ Subjectif | ❌ | ❌ | ✅ ML-based (SHAP) |
| Comparaison joueurs | ❌ | ⚠️ | ✅ Basic | ✅ Radar + H2H |
| Contexte tournoi | ✅ | ⚠️ | ⚠️ | ✅ Phase + Group |
| Integré betting | ❌ | ⚠️ | ❌ | ✅ Value bets |
| Explicable (SHAP) | ❌ | ❌ | ❌ | ✅ Unique |

**Différenciation clé** : PariScore est le SEUL à combiner stats avancées + prédiction ML explicable (SHAP) + contexte betting dans un même onglet.

---

## 6. Plan d'Implémentation

### Phase 1 : API Data Layer (Backend)
**Fichier** : `src/app/api/fiba/players/route.ts`

```
GET /api/fiba/players
  ?phase=group|quarter|semi|final
  &stat=ppg|rpg|apg|pir|composite
  &sort=desc|asc
  &position=G|F|C
```

**Sources de données** :
- ESPN FIBA API (box scores par match)
- Calcul agrégé côté serveur (moyennes, cumuls)
- Cache TTL 5min (données quasi-statiques)

**Schéma réponse** :
```typescript
type FibaPlayer = {
  playerId: string;
  name: string;
  team: string;
  teamAbbr: string;
  position: string;
  jersey: number;
  // Stats cumulées
  gamesPlayed: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number; fgAttempted: number;
  threeMade: number; threeAttempted: number;
  ftMade: number; ftAttempted: number;
  // Métriques calculées
  ppg: number;
  rpg: number;
  apg: number;
  pir: number;        // Performance Index Rating (FIBA)
  efficiency: number;  // Rating par minute
  composite: number;   // Score composite ML
  // MVP
  mvpScore: number;    // 0-100
  mvpRank: number;
};
```

### Phase 2 : Hook SWR (Frontend)
**Fichier** : `src/hooks/use-fiba-players.ts`

```typescript
export function useFibaPlayers(options?: {
  phase?: string;
  stat?: string;
  position?: string;
}) {
  return useSWR<FibaPlayer[]>(
    `/api/fiba/players?${params}`,
    fetcher,
    { refreshInterval: 300_000 } // 5min
  );
}
```

### Phase 3 : Composants UI

#### 3.1 `FibaLeaderboard.tsx` — Tableau classement
- Colonnes triables (PPG, RPG, APG, PIR, Composite)
- Filtrage par position (G/F/C)
- Filtrage par phase (Groupe, Quarts, etc.)
- Highlight du top 3
- Lien vers profil joueur détaillé

#### 3.2 `FibaPlayerCard.tsx` — Card individuelle
- Photo joueur (ESPN assets)
- Stats principales en grid
- Radar chart (6 axes : Score, Passes, Rebonds, Interc., Contres, Efficacité)
- Badge MVP rank
- Mini-graphique tendance (3 derniers matchs)

#### 3.3 `FibaMvpRace.tsx` — Course au MVP
- Top 10 avec barres de progression
- Comparaison directe 2 joueurs (radar overlay)
- Indicateur "Edge" vs terrain
- Historique des votes (si disponible)

#### 3.4 `FibaPlayerComparison.tsx` — Comparaison H2H
- Sélection 2 joueurs
- Radar chart superposé
- Tableau côte à côte
- Qui gagne sur chaque catégorie

### Phase 4 : Intégration scoreboard
**Modification** : `src/components/basketball/fiba/fiba-scoreboard.tsx`

Ajouter onglet "Players" après "Classements" :
```
[En direct] [Calendrier] [Classements] [Players] [Backtest]
```

### Phase 5 : MVP Prediction Model
**Fichier** : `src/lib/predictions/fiba-mvp.ts`

Algorithme MVP-Shapley simplifié :
1. Collecter box scores tous matchs
2. Calculer features (PTS, REB, AST, STL, BLK, +/-, EFF)
3. Modèle XGBoost pour prédire win contribution
4. SHAP values pour chaque joueur
5. MVP Score = Σ(SHAP values × win_contribution)
6. Classement MVP = tri par MVP Score

---

## 7. Estimation Effort

| Phase | Jour estimé | Priorité |
|-------|-------------|----------|
| Phase 1 : API | 0.5j | Haute |
| Phase 2 : Hook | 0.25j | Haute |
| Phase 3 : Leaderboard | 0.5j | Haute |
| Phase 3 : Player Card | 0.5j | Haute |
| Phase 3 : MVP Race | 0.5j | Moyenne |
| Phase 3 : Comparison | 0.5j | Basse |
| Phase 4 : Integration | 0.25j | Haute |
| Phase 5 : MVP Model | 1j | Moyenne |
| **Total** | **4j** | — |

### MVP Minimum (Jour 1-2)
- API `/api/fiba/players`
- Hook `useFibaPlayers`
- `FibaLeaderboard` (tableau simple)
- Integration dans scoreboard

### V1 Complète (Jour 3-4)
- `FibaPlayerCard` avec radar
- `FibaMvpRace` avec top 10
- `FibaPlayerComparison` H2H
- MVP prediction model

---

## 8. Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| ESPN API ne fournit pas les box scores joueurs | Élevé | Fallback sur données FIBA officielles manuelles |
| Calcul PIR complexe sans play-by-play | Moyen | Utiliser FIC simplifié (PTS+REB+AST+STL+BLK-Missed) |
| Performance calcul côté client | Faible | Cache SWR 5min + agrégation serveur |
| Trop de données = lourd | Faible | Pagination + lazy loading |
