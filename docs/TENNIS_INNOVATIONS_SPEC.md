# TENNIS_INNOVATIONS_SPEC.md — Spécification des innovations prédictives Tennis

> **Version** : v1.0 (2026-08-18) · **Statut** : prête pour la phase de dev
> **Auteur** : Brainstorming experts — Data Scientist / UI-UX Designer / Parieur Pro Tennis
> **Base de code** : `src/lib/prediction/` (engine, total-games, most-aces), `src/lib/tennis-elo/`, `src/lib/tennis-data.ts`

---

## 0. Principes de design

1. **Transparence** : chaque probabilité exposée doit être décomposable (l'UI affiche déjà « Détail du modèle »).
2. **Gating** : toute innovation doit respecter le gating `eloKnown`/`insufficientData` — jamais de chiffre inventé.
3. **Surfaces canoniques** : `Dur` | `Terre battue` | `Gazon` | `Indoor` (à ajouter partout, cf. audit M1).
4. **Backtest d'abord** : chaque modèle s'accompagne d'un runner de backtest sur l'historique BSD/tennisabstract.

---

## 1. Innovations Data & Modèles Prédictifs

### 1.1 Surface-Specific Elo Matrix (fix de M1 + M2)

**Objectif** : séparation stricte des Elo par surface avec **coefficient de transition** réaliste.

- **Matrice** : `Elo[surface] = { hard, clay, grass, indoor }` — extension de `abstract-cache.json` (déjà hElo/cElo/gElo ; ajouter `iElo` pour indoor/carpet).
- **Transition factor** `τ(s1 → s2, k)` : un joueur qui n'a joué que 3 matchs sur la surface cible voit son Elo surface **pivoté** vers son Elo général :
  ```
  surfaceElo_eff = w_surface * surfaceElo + (1 - w_surface) * elo
  w_surface = min(1, matches_on_surface / K)   // K = 8 matchs (calibré par backtest)
  ```
- **Indoor mapping** (fix M1) : `normalizeSurface()` reconnaît `indoor`/`carpet`/`hall`/`covered` → surface `Indoor`, Elo dédié, `toModelSurface()` → `"Indoor"` dans le modèle total-games.
- **Champ additionnel** : `transitionFactor` exposé dans `Player` (debug + UI « surface récente faible »).
- **Backtest** : comparer Brier score de la version actuelle (pondération statique 0.55) vs version τ sur l'historique 2023-2026.

### 1.2 Serve & Break Advantage Index

**Objectif** : modéliser la probabilité de gain d'un jeu de service vs la capacité de retour adverse — le vrai moteur du tennis.

- **Données** (déjà disponibles via `src/lib/tennis-dr/lookup.ts` + stats BSD) :
  - `% 1st serve` (p1_first_pct), `% pts gagnés 1ère balle` (p1_first_won), `% pts gagnés 2e balle` (p1_second_won)
  - `% retour gagnés` (ret_won), `% balles de break sauvées` (bp_saved)
- **Modèle** : probabilité de hold `P(hold | serveur, receveur)` par chaîne de Markov simplifiée :
  ```
  P(win point on serve) = f(firstPct, firstWon, secondPct)
  holdProb = Markov(4 points, 2 de différence)
  ```
- **Indices exposés** :
  - `ServeIndex` [0-100] (agrégat pondéré des 3 stats service, EWM)
  - `BreakIndex` [0-100] (capacité de retour + conversion BP)
  - `ServeBreakEdge = ServeIndex_A * (100 - BreakIndex_B) vs inverse` → affiché sur la carte.
- **Livrable UI** : mini-jauge « Service A vs Retour B » dans le détail du modèle.

### 1.3 Fatigue & Travel Index

**Objectif** : capturer le facteur physique — la plus grande faille des Elo purs.

- **FatigueIndex** : heures de jeu cumulées sur **7 jours** (matchs terminés + retraits récents) :
  ```
  fatigue = Σ (minutes_jouées) / 60  sur 7j  →  catégorisé : < 4h = frais, 4-8h = modéré, > 8h = à risque
  ```
- **TravelIndex** : kilomètres entre la ville du tournoi précédent et le tournoi courant (tableau de coordonnées ville → haversine) + fuseaux franchis + ±3 jours de repos minimum.
- **Blend** : pénalité `× (1 - 0.06 * fatigue_penalty)` sur le Elo du joueur concerné, déclenchée seulement si `confidence ≥ seuil`.
- **Sources** : historique BSD `sets_detail` (durée dispo via point-by-point), tournois BSD (location/country).

---

## 2. Améliorations Design & Rendu UI (React 19)

### 2.1 Badges Visuels de Surface (code couleur par tournoi)

| Surface | Couleur (token) | Usage |
|---------|-----------------|-------|
| 🧱 Terre battue | Ocre `#C77B3F` / `clay` | Badge + bordure carte + fond jauge |
| 🌿 Gazon | Vert `#2E7D32` / `grass` | idem |
| 🟦 Dur | Bleu `#1976D2` / `hard` | idem |
| 🏟️ Indoor | Violet `#6A1B9A` / `indoor` | idem |

- Composant : `SurfaceBadge` (à créer dans `src/components/tennis/`) — badge pilule avec pastille colorée + nom de surface, rendu dans `MatchCardHeader`, `MatchDetailDialog`, filtres.
- **Design tokens** : ajout à `DESIGN_CHARTER.md` + variables Tailwind `--surface-clay` etc.

### 2.2 Barre de Probabilité & Intervalle de Confiance

- **Évolution de `probability-bar.tsx`** :
  - Jauge segmentée A/B avec **aire d'incertitude** grisée autour du seuil 50% : largeur de l'aire = `(IC_high - IC_low) / 2` (déjà calculé : `stats.ic`).
  - Exemple : « **68% vs 32%** ± 9 » avec tooltip « Intervalle de confiance 90% ».
  - Animation React 19 : transition de largeur via `useTransition` (pas de layout shift).
- **A11y** : `role="progressbar"` + `aria-valuenow` = probA, texte alternatif complet.

### 2.3 Comparateur H2H Intuitif

- **Radar chart H2H** (dans `MatchDetailDialog`, section H2H existante) : 4 axes — victoires, jeux gagnés, % points, aces — A vs B, données `h2hHistory` (déjà enrichies).
- **Historique par surface** : filtres Dur / Terre / Gazon sur la liste `h2hHistory` + compteur « 3-1 sur Terre battue ».
- **Bibliothèque** : `recharts` déjà installé (utilisé par bankroll-dialog) — pas de nouvelle dépendance.

---

## 3. Rendu des Prédictions & Value Bets

### 3.1 Badge « Value Edge »

- **Définition** : écart entre cote bookmaker et probabilité du modèle dé-margée :
  ```
  edge = prob_modèle (%) − prob_implicite_market (%)
  badge si |edge| ≥ 5 pts ET confiance modèle ≥ 0.6
  ```
  - Vert `+edge` (value sur le favori modèle), rouge `−edge` (le marché est plus optimiste), gris si données insuffisantes.
- **Rendu** : chip sur la carte (`MatchCardBroadcast`) + tri « Value » ajouté à `useMatchFilter` (`SortKey`).
- **Déjà partiellement présent** : `valueBetCount` / `ValueBetScannerIndicator` — unifier les deux calculs dans un seul util `src/lib/prediction/value-edge.ts`.

### 3.2 Marché « Handicap Jeux & Sets »

- **Handicap de jeux** (ex: `-3.5 jeux`) : à partir de `lambda` (E[total games]) + `probA`/`probB`, utiliser le modèle de différence de jeux (Poisson-Skellam déjà utilisé pour les aces) :
  ```
  P(A gagne par ≥ 4 jeux) = Skellam(λA, λB, k ≥ 4)
  ```
- **Handicap de sets** : `prob_over_2_5_sets` (déjà calculé par BSD Predictions) + probabilité victoire 2-0 / 2-1 via matrice de transition des sets.
- **Types** : `SetHandicapPredictions`, `GameHandicapPredictions` dans `tennis-data.ts`, calculés dans `bsd-fetcher.buildMatch`.
- **Rendu** : onglet « Marchés avancés » dans `MatchDetailDialog` (cotes 1x2 / O-U jeux / Handicap jeux / Handicap sets), chaque ligne avec edge (3.1).

---

## 4. Bankroll & Validation RET/WO automatisée (complément audit R1/R2)

- **Règle** : lors du règlement, si le statut BSD du match est `retired`/`walkover` :
  - 1er set **non terminé** → pari `void` (remboursé) — statut déjà implémenté manuellement, à automatiser
  - 1er set **terminé** → pari résolu normalement (résultat du moment du RET)
- **Implémentation** : hook `useBankroll` expose `settleFromMatchStatus(matchId, status)` branché sur le flux live BSD (`use-live-matches`) quand un match passe à `finished/retired/walkover`.

---

## 5. Plan de livraison proposé

| Phase | Contenu | Effort estimé |
|-------|---------|---------------|
| P1 | Value Edge util + tri + unification scanner | 1 j |
| P2 | Badges surface + tokens design | 0,5 j |
| P3 | Serve & Break Index (Markov) + jauge UI | 2 j |
| P4 | Elo Matrix τ + Indoor (avec backtest) | 2 j |
| P5 | Handicap jeux/sets (Skellam) + onglet marchés | 2 j |
| P6 | Fatigue & Travel Index | 2 j |
| P7 | Radar H2H + barre IC animée | 1 j |
| P8 | Auto-void bankroll sur RET/WO live | 1 j |

**Total** : ~11,5 j — ordre conseillé P1 → P2 → P8 (quick wins) puis P3 → P4 → P5 → P6 → P7.
Chaque phase livre un backtest ou un test unitaire (`src/lib/__tests__/`) + entrée CHANGELOG.