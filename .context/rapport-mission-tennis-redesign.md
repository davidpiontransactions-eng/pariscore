# Rapport de mission — Redesign Top 10 Tennis (table + scorecard + Elo réel)

**Date** : 2026-09-04
**Demandeur** : Utilisateur
**Statut** : ✅ TERMINÉ

---

## Objectif

Redesign complet du Top 10 Tennis :
1. **Table layout** — un match par ligne (pas des cards)
2. **Elo réel** — remplacer les "1500" par les vraies valeurs
3. **Scorecard scientifique** — formule composite basée sur la littérature académique
4. **Meilleur joueur en vert** — avec son scorecard
5. **Probabilité de victoire** — formatée par rapport au match

---

## État initial vs Final

| Critère | Avant | Après |
|---------|-------|-------|
| Layout | Cards grid 2-col | Table 1 ligne/match |
| Elo | 1500 (tous) | Réel (2209 Sabalenka, 2157 Alcaraz) |
| Scorecard | Aucun | Composite 0-100 (6 pondérations) |
| Win prob | Non affichée | 95% Sabalenka, 93% Alcaraz |
| Meilleur joueur | Non distingué | Fond vert + trophée |
| Prochains matchs | Cards compactes | Ligne avec adversaire, date, heure |

---

## Scorecard — Formule scientifique

Basée sur 5 sources académiques :

| Composante | Poids | Source |
|------------|-------|--------|
| **Serve won %** | 0.28 | Gorgi/Koopman/Lit 2022 (WElo) |
| **Return won %** | 0.22 | Barnett/Clarke 2005 |
| **Elo surface-adj** | 0.20 | Klaassen/Magnus 2003 |
| **Momentum EWMA** | 0.15 | MDPI AppliedMath 2025 |
| **Tiebreak/pressure** | 0.10 | ACM 2026 TOPSIS |
| **Forme (W/L ratio)** | 0.05 | Consensus |

```
Score = 0.28×serve + 0.22×return + 0.20×elo + 0.15×momentum + 0.10×pressure + 0.05×form
```

---

## Elo réel — Source

Lookup via `lookupAbstractElo()` → cache `abstract-cache.json` (1087 joueurs ATP+WTA).
- Sabalenka: 2209 (surface: 2196)
- Alcaraz: 2157 (surface: 2083)
- Pegula: 2097 (surface: 2058)
- Swiatek: 2058 (surface: 2019)

---

## Résultats QA Playwright

| Test | Résultat |
|------|----------|
| Table rows rendues | ✅ |
| Elo réel affiché | 2209, 2157, 2097 ✅ |
| Win prob affichée | 95%, 93% ✅ |
| Meilleur joueur vert | 1 row highlighted ✅ |
| Modal ouvre | ✅ |
| Modal "PROCHAIN MATCH" | ✅ |
| Modal "vs adversaire" | ✅ |
| Page errors | 0 ✅ |

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/lib/tennis-top10.ts` | +computeScorecard(), +computeMatchWinProb(), +lookupAbstractElo(), +matchWinProb |
| `src/components/tennis/tennis-top10-section.tsx` | Redesign table 8-col, scorecard, green highlight |
| `src/components/tennis/tennis-player-modal.tsx` | +scorecard badge |

---

## Commits

1. `a5afde89` — `feat(tennis-top10): scientific scorecard + real Elo lookup + matchWinProb`
2. `6337b749` — `feat(tennis-top10): redesign table layout with scorecard + real Elo + win prob`

---

## Sources académiques citées

- Gorgi, Koopman & Lit (2022): "WElo" — 81% accuracy, 3.56% ROI
- Barnett & Clarke (2005): Opponent-adjusted serve/return
- Klaassen & Magnus (2003): Logit ranking model
- ACM 2026: Momentum TOPSIS (AHP+EWM)
- MDPI AppliedMath 2025: EWMA momentum (α=0.34)
