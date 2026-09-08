# D1 — Diagnostic datas (skill: systematic-debugging)

## Phase 1 — Root causes (traçage amont)
1. **xG 0.33/0.27** : `computeXGa` priorité 2 (`football-predictions.ts:299`).
   Formule `λ = -ln(1-p)*1.2` inverse `P(X≥1)` au lieu de `P(X≥3)` :
   pour over25=39% elle rend λ=0.6 au lieu de ≈2.25 (**facteur ~4**).
   Preuve : Poisson P(X≥3|λ=2.2)=0.377≈0.39. `LEAGUE_AVG_XG=1.45`
   (priorité 3) également trop bas vs `totalLambda=2.70` du moteur.
2. **Classement indisponible / Buts —** : `standingStats`/`metricStats`
   null = couverture BSD absente (Copa Sudamericana). Donnée, pas bug.
3. **Tuile « Confiance 43% »** : repli documenté de `computePredictiveBets`
   (`predictive-bets-engine.ts:313`) quand < 3 vrais paris. By design.
4. **Scores exacts approximatifs** : `approxTopScores` (top-3 depuis 1X2) ;
   vraie matrice dispo (B2) mais `SectionCorrectScore` ne reçoit pas les
   cotes → upgrade = plomberie props (jugé hors scope, documenté).

## Décision D2/D3
- D2 : corriger l'inversion (bisection Poisson) + constante 1.45→2.65.
  Tests existants `computeXGa` à mettre à jour (encodaient le bug).
- D3 : restyle light uniquement. Logique paris/standings inchangée.

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
