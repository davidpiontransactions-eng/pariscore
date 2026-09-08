# D2 — Fix inversion xG (skill: test-driven-development)

## RED
Nouveau test `over25Prob=39 → total ∈ [1.8, 2.7]` → échec constaté
(`Received: 0.6`), cause exacte du `xG 0.33/0.27` vu en prod.

## GREEN (cause racine, fonction partagée, une fois)
- `lambdaTotalFromOver25` exportée depuis `football-live-thresholds.ts`
  (bisection `P(X≥3)`, existait déjà — Le Ladder, pas de doublon).
- `computeXGa` priorité 2 l'utilise (remplace `-ln(1-p)*1.2` qui inversait
  `P(X≥1)`, facteur ~4 d'erreur).
- `LEAGUE_AVG_XG` 1.45 → **2.65** (cohérent `totalLambda=2.70` du moteur).
- 2 anciens tests encodant le bug mis à jour (valeurs Poisson correctes
  recalculées à la main : p=0.7 → λ≈3.62).
- `bun test football-predictions` : **54 pass / 0 fail**.

## Non touché (by design / couverture)
- Tuile « Confiance 43% » : repli documenté du moteur de paris.
- `standingStats`/`metricStats` null : couverture BSD, pas un bug.
- `approxTopScores` : upgrade matrice = plomberie props (jugé hors scope).

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
