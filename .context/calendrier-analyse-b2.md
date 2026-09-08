# B2 — Matrice scores exacts TDD (skill: test-driven-development)

## RED
`tests/besoccer-matrix.test.ts` (4 tests) écrit avant le module → échec
(module manquant), raison attendue ✓.

## GREEN
- `src/lib/besoccer-matrix.ts` (nouveau) : `scoreMatrixForMatch()` au-dessus
  de `aggregateFromSources` (λ depuis cotes 1X2) + `buildScoreMatrix`
  (Poisson, max 10) ; retourne `matrix[11][11]` (probas 0-1), `margins`
  `+1..+10` (somme diagonales), `lambdaHome/Away`, `homeWin`.
- `bun test` : **4 pass / 0 fail** (somme≈1, marges décroissantes,
  symétrie, défauts finis).

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
- UI heatmap + clic ligne : B3.
