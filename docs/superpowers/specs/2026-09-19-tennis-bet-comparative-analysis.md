# Analyse Comparative — Tes Bets 1xBet vs Filtres Pariscore

**Date** : 2026-09-19  
**Contexte** : Tu joues en prematch (Winner, Over games, Most aces) et en live (Over games/set, Winner set, Winner match). Les filtres doivent être calibrés sur **ton offre bookmaker réelle**.

---

## 1. Mapping Tes Bets → Marchés 1xBet → Filtres Applicables

### 1.1 PREMATCH

#### Bet #1 : Match Winner (Vainqueur du match)

| Élément | Détail |
|---------|--------|
| **Marché 1xBet** | `match-winner` (cotes 1 / 2) |
| **Type** | Probabilité binaire |
| **Données nécessaires** | Élo surface, Hold%, Break%, Forme L5, H2H |
| **Modèle** | Sigmoid composite (Gao 2019 : serve strength = #1 predictor) |

**Filtres pertinents :**

| Filtre | Priorité | Pourquoi |
|--------|----------|----------|
| **Surface** | 🔴 Critique | Hold% varie de ±15% selon surface (grass/clay/hard) |
| **Catégorie tournoi** | 🟡 Important | Grand Slam = plus de données, plus fiable |
| **Compétitivité** | 🟡 Important | Spread ≤ 2.0 = plus de value (Clegg 2023) |
| **Edge minimum** | 🔴 Critique | ≥ 3% pour justifier le pari |
| **Kelly adaptatif** | 🟡 Important | Fraction 0.25-0.5 (Uhrín 2021) |
| **Fenêtre temporelle** | 🟢 Utile | 48h = données fraîches |

**Score de filtre pour Winner :**
```
score_winner = 
    0.30 × elo_surface_normalized +
    0.25 × (hold_A - hold_B) / surface_factor +
    0.20 × forme_L5_normalized +
    0.15 × h2h_winrate +
    0.10 × tournament_weight
```

---

#### Bet #2 : Over Games Match (Total jeux du match)

| Élément | Détail |
|---------|--------|
| **Marché 1xBet** | `total-over-18.5` à `total-over-22.5` |
| **Type** | Seuil sur somme de jeux |
| **Données nécessaires** | Hold% A, Hold% B, Surface, Tiebreak% |
| **Modèle** | Poisson (λ = hold_A + hold_B × expected_sets) |

**Filtres pertinents :**

| Filtre | Priorité | Pourquoi |
|--------|----------|----------|
| **Surface** | 🔴 Critique | Grass → plus d'hold → plus de jeux. Clay → plus de break → moins de jeux |
| **Hold% des 2 joueurs** | 🔴 Critique | Si hold_A + hold_B > 1.40 → Over probable |
| **Catégorie tournoi** | 🟡 Important | Grand Slam 3 sets/5 sets → λ différent |
| **Compétitivité** | 🟡 Important | Match serré → plus de jeux (7-6, 6-4, etc.) |
| **Edge minimum** | 🔴 Critique | ≥ 3% |
| **Tiebreak% historique** | 🟢 Utile | Si tiebreak probable → +1 jeu |

**Score de filtre pour Over Games :**
```
score_over_games = 
    0.35 × (hold_A + hold_B) × surface_factor +
    0.25 × competitiveness (1 / spread) +
    0.20 × tournament_weight +
    0.10 × tiebreak_probability +
    0.10 × edge_normalized
```

**Seuils recommandés par ligne :**

| Ligne 1xBet | Over probable si | Under probable si |
|-------------|------------------|-------------------|
| Over 18.5 | hold_A + hold_B > 1.30 | hold_A + hold_B < 1.20 |
| Over 19.5 | hold_A + hold_B > 1.35 | hold_A + hold_B < 1.25 |
| Over 20.5 | hold_A + hold_B > 1.40 | hold_A + hold_B < 1.30 |
| Over 21.5 | hold_A + hold_B > 1.45 | hold_A + hold_B < 1.35 |
| Over 22.5 | hold_A + hold_B > 1.50 | hold_A + hold_B < 1.40 |

---

#### Bet #3 : Player Most Aces (Joueur avec le plus d'aces)

| Élément | Détail |
|---------|--------|
| **Marché 1xBet** | `most-aces-a` / `most-aces-b` |
| **Type** | Différence de Poissons (Skellam) |
| **Données nécessaires** | Aces/match joueur A, Aces/match joueur B, Surface, Opponent aces conceded |
| **Modèle** | Skellam (λ_aces_A, λ_aces_B) |

**Filtres pertinents :**

| Filtre | Priorité | Pourquoi |
|--------|----------|----------|
| **Surface** | 🔴 Critique | Grass ×1.3, Hard ×1.0, Clay ×0.7 (différence énorme) |
| **Aces/match des 2 joueurs** | 🔴 Critique | Différence > 3 aces/match = signal fort |
| **Opponent aces conceded** | 🟡 Important | Si adversaire concede beaucoup → bonus |
| **Catégorie tournoi** | 🟢 Utile | Grand Slam = données plus fiables |
| **Edge minimum** | 🔴 Critique | ≥ 3% |
| **Hold% des 2 joueurs** | 🟡 Important | Corrélé avec les aces (serve dominant → plus d'aces) |

**Score de filtre pour Most Aces :**
```
score_most_aces = 
    0.35 × (aces_per_match_A - aces_per_match_B) × surface_ace_factor +
    0.25 × (opponent_aces_conceded_B - opponent_aces_conceded_A) +
    0.20 × (hold_A - hold_B) +
    0.10 × tournament_weight +
    0.10 × edge_normalized
```

---

### 1.2 LIVE

#### Bet #4 : Over Games par Set (Over 6.5, 7.5, 8.5 par set)

| Élément | Détail |
|---------|--------|
| **Marché 1xBet** | `set-over-6.5`, `set-over-7.5`, `set-over-8.5` |
| **Type** | Seuil sur jeux dans le set en cours |
| **Données nécessaires** | Score actuel du set, Hold% observé dans le match, Surface |
| **Modèle** | Markov conditionnel (DP sur le score actuel) |

**Filtres pertinents :**

| Filtre | Priorité | Pourquoi |
|--------|----------|----------|
| **Hold% observé dans le match** | 🔴 Critique | Le hold% réel du match > les stats pré-match |
| **Score actuel du set** | 🔴 Critique | 3-3 → Over 7.5 quasi certain. 5-0 → Under certain |
| **Surface** | 🟡 Important | Ajustement hold% selon surface |
| **Catégorie tournoi** | 🟢 Utile | Grand Slam 5 sets = sets plus serrés |
| **Edge minimum** | 🔴 Critique | ≥ 3% |
| **Momentum** | 🟡 Important | Break récent → hold% peut changer |

**Score de filtre pour Over Games/Set :**
```
score_over_set = 
    0.40 × hold_observed_avg × surface_factor +
    0.30 × set_progress_factor (3-3 = max, 5-0 = min) +
    0.15 × tournament_weight +
    0.10 × momentum_factor +
    0.05 × edge_normalized
```

**Seuils recommandés par ligne :**

| Ligne 1xBet | Over probable si | Situation typique |
|-------------|------------------|-------------------|
| Over 6.5 | hold_observed > 0.60 | Quasi toujours sauf break tôt |
| Over 7.5 | hold_observed > 0.65 | Match serré, pas de break précoce |
| Over 8.5 | hold_observed > 0.70 | 2 holdeurs dominants, tiebreak probable |

---

#### Bet #5 : Set Winner (Vainqueur du set en cours)

| Élément | Détail |
|---------|--------|
| **Marché 1xBet** | `live-set-winner` |
| **Type** | Probabilité binaire conditionnée par le score |
| **Données nécessaires** | Score actuel du set, Hold% observé, Surface, Momentum |
| **Modèle** | Markov temps réel (blend bayésien) |

**Filtres pertinents :**

| Filtre | Priorité | Pourquoi |
|--------|----------|----------|
| **Score actuel du set** | 🔴 Critique | 4-2 → leader a ~85% de gagner le set |
| **Hold% observé** | 🔴 Critique | Hold% réel > stats pré-match |
| **Prochaine game = service ?** | 🔴 Critique | Servir à 4-3 ≠ servir à 3-4 |
| **Surface** | 🟡 Important | Clay = plus de break chances |
| **Momentum** | 🟡 Important | Break dans les 2 dernières games |
| **Catégorie tournoi** | 🟢 Utile | Grand Slam = mental différent |

**Score de filtre pour Set Winner :**
```
score_set_winner = 
    0.40 × set_progress (leader score) +
    0.30 × hold_observed × surface_factor +
    0.15 × serves_remaining_advantage +
    0.10 × momentum_factor +
    0.05 × tournament_weight
```

---

#### Bet #6 : Match Winner Live (Vainqueur du match en live)

| Élément | Détail |
|---------|--------|
| **Marché 1xBet** | `live-match-winner` |
| **Type** | Probabilité binaire conditionnée par le score global |
| **Données nécessaires** | Score sets, Score jeux, Hold% observé, Surface, Fatigue |
| **Modèle** | Blend bayésien (pre-match × live adjustment) |

**Filtres pertinents :**

| Filtre | Priorité | Pourquoi |
|--------|----------|----------|
| **Score sets actuel** | 🔴 Critique | 1-0 → leader a ~65%. 2-0 → ~90% |
| **Score jeux dans le set** | 🟡 Important | Break d'avance = bonus |
| **Hold% observé** | 🔴 Critique | Le vrai indicateur de force |
| **Surface** | 🟡 Important | Ajustement dynamique |
| **Fatigue** | 🟡 Important | 3ème set, 4ème set = facteur |
| **Catégorie tournoi** | 🟢 Utile | Grand Slam 5 sets = plus de retournements |

**Score de filtre pour Match Winner Live :**
```
score_match_winner_live = 
    0.35 × set_advantage (1-0, 2-0, etc.) +
    0.30 × hold_observed × surface_factor +
    0.15 × game_advantage_in_current_set +
    0.10 × fatigue_factor +
    0.05 × tournament_weight +
    0.05 × edge_normalized
```

---

## 2. Matrice Filtres × Bets

| Filtre | Winner | Over Games | Most Aces | Over/Set | Set Winner | Winner Live |
|--------|--------|------------|-----------|----------|------------|-------------|
| **Surface** | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 |
| **Catégorie tournoi** | 🟡 | 🟡 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Compétitivité** | 🟡 | 🟡 | — | — | — | — |
| **Edge minimum** | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Kelly adaptatif** | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| **Hold% observé** | — | 🔴 | 🟡 | 🔴 | 🔴 | 🔴 |
| **Aces/match** | — | — | 🔴 | — | — | — |
| **Score actuel** | — | — | — | 🔴 | 🔴 | 🔴 |
| **Momentum** | 🟢 | 🟢 | — | 🟡 | 🟡 | 🟡 |
| **Fatigue** | 🟢 | 🟢 | — | — | 🟢 | 🟡 |
| **Tiebreak%** | — | 🟢 | — | — | — | — |
| **Fenêtre temporelle** | 🟢 | 🟢 | 🟢 | — | — | — |

**Légende** : 🔴 Critique | 🟡 Important | 🟢 Utile | — Non applicable

---

## 3. Architecture des Filtres par Mode (Prematch vs Live)

### 3.1 Mode Prematch

```
┌─────────────────────────────────────────────────────────┐
│  FILTRES PREMATCH                                       │
├─────────────────────────────────────────────────────────┤
│  [Sélection bet type ▼]  [Surface ▼]  [Tournoi ▼]      │
│                                                         │
│  ┌─ Winner ──────────────┐  ┌─ Over Games ───────────┐  │
│  │ Élo surface ≥ [X]     │  │ Hold% sum ≥ [1.35]     │  │
│  │ Compétitif (≤2.0) [✓] │  │ Compétitif (≤2.0) [✓]  │  │
│  │ Edge ≥ [3]%           │  │ Edge ≥ [3]%            │  │
│  └────────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌─ Most Aces ───────────┐                              │
│  │ Aces diff ≥ [3]       │                              │
│  │ Surface factor [✓]    │                              │
│  │ Edge ≥ [3]%           │                              │
│  └────────────────────────┘                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Mode Live

```
┌─────────────────────────────────────────────────────────┐
│  FILTRES LIVE                                           │
├─────────────────────────────────────────────────────────┤
│  [Sélection bet type ▼]  [Score actuel]  [Set ▼]       │
│                                                         │
│  ┌─ Over/Set ────────────┐  ┌─ Set Winner ───────────┐  │
│  │ Hold% observé ≥ [0.65]│  │ Score set: [X]-[Y]     │  │
│  │ Score set: [3]-[3]    │  │ Hold% observé ≥ [0.60] │  │
│  │ Surface [✓]           │  │ Next game service [✓]  │  │
│  └────────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌─ Match Winner Live ──┐                              │
│  │ Score sets: [X]-[Y]  │                              │
│  │ Hold% observé ≥ [0.60│                              │
│  │ Fatigue factor [✓]   │                              │
│  └────────────────────────┘                              │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Implémentation Pariscore

### 4.1 Fichiers à modifier

| Fichier | Action | Contenu |
|---------|--------|---------|
| `src/lib/tennis-filters.ts` | **Enrichir** | Ajouter `TennisBetType`, `PrematchFilters`, `LiveFilters` |
| `src/components/tennis/tennis-top10-matches-widget.tsx` | **Modifier** | Mode prematch/live toggle, filtres conditionnels par bet type |
| `src/lib/prediction/tennis-market-map.ts` | **Vérifier** | Tous les marchés sont déjà mappés |

### 4.2 Nouveaux types à ajouter

```typescript
// Type de bet du joueur
export type TennisBetType = 
  | "winner"           // Match winner prematch
  | "over-games"       // Over games match prematch
  | "most-aces"        // Player most aces prematch
  | "over-set"         // Over games par set live
  | "set-winner"       // Set winner live
  | "winner-live";     // Match winner live

// Filtres par bet type
export type TennisBetFilters = {
  betType: TennisBetType;
  surface?: TennisSurface;
  tourCat?: TennisTournamentCategory;
  minEdge?: number;
  minHoldSum?: number;      // pour over-games
  minAcesDiff?: number;     // pour most-aces
  minHoldObserved?: number; // pour live
  competitiveness?: number; // spread max
};
```

### 4.3 Scoring par bet type

```typescript
function computeBetScore(match: MatchData, filters: TennisBetFilters): number {
  switch (filters.betType) {
    case "winner":
      return scoreWinner(match, filters);
    case "over-games":
      return scoreOverGames(match, filters);
    case "most-aces":
      return scoreMostAces(match, filters);
    case "over-set":
      return scoreOverSet(match, filters);
    case "set-winner":
      return scoreSetWinner(match, filters);
    case "winner-live":
      return scoreWinnerLive(match, filters);
  }
}
```

### 4.4 UI proposée

```
┌─────────────────────────────────────────────────────────┐
│  Top 10 matchs par stratégie                            │
├─────────────────────────────────────────────────────────┤
│  [Mode: Prematch ▼]  [Bet: Winner ▼]  [Surface ▼]      │
│                                                         │
│  [Tournoi ▼]  [Catégorie ▼]  [Edge ≥ 3%]  [48h]        │
│                                                         │
│  ┌─ Filtres spécifiques bet ──────────────────────────┐  │
│  │ Winner: Élo surface, Compétitivité, Hold%          │  │
│  │ Over Games: Hold% sum, Tiebreak%, Ligne O/U        │  │
│  │ Most Aces: Aces diff, Surface factor, Opponent     │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Recommandations de calibration

### 5.1 Seuils par bet type (à ajuster par backtesting)

| Bet | Edge min | Kelly frac | Hold% min | Surface factor |
|-----|----------|------------|-----------|----------------|
| Winner | 3% | 0.25 | — | Oui |
| Over Games | 3% | 0.20 | 1.35 sum | Oui |
| Most Aces | 4% | 0.20 | — | Oui (×1.3 grass) |
| Over/Set | 3% | 0.25 | 0.65 obs | Oui |
| Set Winner | 3% | 0.30 | 0.60 obs | Oui |
| Winner Live | 3% | 0.25 | 0.60 obs | Oui |

### 5.2 Kelly adaptatif par bet type

| Bet | Kelly base | Ajustement |
|-----|-----------|------------|
| Winner | 0.25 | × confidence × (1 - correlation) |
| Over Games | 0.20 | × confidence × surface_factor |
| Most Aces | 0.20 | × confidence × surface_ace_factor |
| Over/Set | 0.25 | × confidence × set_progress_factor |
| Set Winner | 0.30 | × confidence × momentum_factor |
| Winner Live | 0.25 | × confidence × fatigue_factor |

---

## 6. Conclusion

Tes 6 bets réels couvrent **6 marchés distincts** avec des filtres spécifiques :

| Bet | Filtres critiques | Modèle |
|-----|-------------------|--------|
| **Winner** | Surface, Élo, Hold%, Compétitivité | Sigmoid composite |
| **Over Games** | Surface, Hold% sum, Tiebreak% | Poisson |
| **Most Aces** | Surface (×1.3 grass), Aces diff | Skellam |
| **Over/Set** | Hold% observé, Score set, Surface | Markov conditionnel |
| **Set Winner** | Score set, Hold% observé, Momentum | Markov temps réel |
| **Winner Live** | Score sets, Hold% observé, Fatigue | Blend bayésien |

L'implémentation ajoute un **mode prematch/live** + un **sélecteur de bet type** qui affiche les filtres pertinents pour chaque bet.
