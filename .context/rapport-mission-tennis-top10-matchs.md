# Rapport de mission — Enrichissement Top 10 Tennis avec prochains matchs

**Date** : 2026-09-04
**Demandeur** : Utilisateur
**Statut** : ✅ TERMINÉ

---

## Objectif

Enrichir les cards Top 10 joueurs tennis avec leurs **prochains matchs à venir** (adversaire, date, heure, tournoi, cote) et les **probabilités de marché** (odds dévigotées).

---

## État initial

| Composant | État |
|-----------|------|
| Top 10 cards | 10 joueurs avec Elo, momentum, forme, insight |
| Modal détail | Radar 5 axes, momentum gauge, stats, forme |
| Données matchs | Aucun lien joueur → match |
| Sidebar | Top 5 widget encore présent (supprimé séparément) |

---

## Livrables

### 1. Data Engineering — `src/lib/tennis-top10.ts`

**Nouveau type `TennisTop10NextMatch`** :
```typescript
{
  id: string;
  opponent: string;          // "Alexandra Eala"
  opponentShort: string;     // "EALA"
  tournament: string;        // "US Open, Women"
  round: string;             // "Round of 32"
  scheduledAt: string;       // ISO date
  surface?: string;
  odds?: number | null;      // Côte décimale joueur
  opponentOdds?: number | null;
  marketProb?: number;       // 0-100 (dévigoté)
  edge?: number;             // prob modèle - prob marché
}
```

**Nouvelle fonction `linkPlayersToMatches()`** :
- Normalized name matching (accent strip + lowercase + substring)
- Filtre matchs à venir (≥ -30min grace period)
- Trie par date croissante, prend le prochain
- Calcule probabilité implicite marché (1/odds dévigoté)

### 2. Data Science — Probabilités

**De-vigodage** :
```
rawProbA = 1 / oddsA
rawProbB = 1 / oddsB
totalVig = rawProbA + rawProbB
marketProb = rawProbA / totalVig × 100
```

**Résultat** : Osaka vs Mertens → odds 1.31 → marketProb 73%

### 3. API — `src/app/api/tennis/top10/route.ts`

- Appel `linkPlayersToMatches(rawEntries, allMatches)` après `buildTennisTop10`
- Les 10 entries retournées incluent `player.nextMatch`

### 4. UI — Cards (`tennis-player-card.tsx`)

**Nouveau composant `NextMatchRow`** :
- Icône Calendar + tournament · round · vs adversaire · date/heure
- Odds colorés : vert (≥60%), rouge (≤40%), gris (milieu)
- Affiché sous les barres momentum/forme dans chaque card

### 5. UI — Modal (`tennis-player-modal.tsx`)

**Section "Prochain match"** :
- Bordure verte, fond émeraude subtil
- Opponent name en gras
- Tournament + round
- Date complète (jour de la semaine + date + heure)
- Odds gros format + probabilité implicite

---

## Résultats QA Playwright

| Test | Résultat |
|------|----------|
| Top 10 cards rendues | 10/10 ✅ |
| Cards avec next match | 10/10 ✅ |
| Cards avec odds | 4/10 (ceux avec cotes BSD) ✅ |
| Modal ouvre | ✅ |
| Modal "PROCHAIN MATCH" | ✅ |
| Modal vs adversaire | ✅ |
| Modal date/heure | ✅ |
| Page errors | 0 ✅ |

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/lib/tennis-top10.ts` | +TennisTop10NextMatch, +nextMatch field, +linkPlayersToMatches() |
| `src/app/api/tennis/top10/route.ts` | +import linkPlayersToMatches, +appel après build |
| `src/components/tennis/tennis-player-card.tsx` | +NextMatchRow component |
| `src/components/tennis/tennis-player-modal.tsx` | +section "Prochain match" |
| `src/components/layout/sports-sidebar.tsx` | Suppression TennisStrategyTop5Widget |

---

## Commits

1. `baf36703` — `fix(tennis): remove TennisStrategyTop5Widget from sidebar`
2. `0cbb2c09` — `feat(tennis-top10): link players to upcoming matches with odds + edge`
3. `1e9df159` — `feat(tennis-top10): display next match in card + modal with odds`

---

## Backlog restant

- **VALUE badges** : améliorer le matching joueur → cotes pour plus de joueurs
- **Edge calculation** : comparer prob modèle vs prob marché pour chaque match
- **H2H modal** : afficher l'historique des confrontations
- **Mobile responsive** : adapter les cards pour écrans étroits
- **Analytics** : tracker les clics sur les cards Top 10
